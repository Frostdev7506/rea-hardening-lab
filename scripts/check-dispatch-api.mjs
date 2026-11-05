import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.argv[2] || "http://127.0.0.1:4330";
const base = { disabledCouriers: [], closedRoads: [], startMinute: 540, urgent: false };
const checked = [];
async function create(scenario = base, batchId = null) {
  const response = await fetch(`${origin}/api/plans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId, scenario }) });
  assert.equal(response.status, 201);
  return response.json();
}
const normal = await create();
assert.equal(normal.state, "draft"); assert.equal(normal.plan.delivered, 6); assert.equal(normal.plan.objectiveCents, 5483);
checked.push("All six shipments receive a feasible draft plan.");
const bridge = await create({ ...base, closedRoads: ["river-bridge"] });
assert.equal(bridge.plan.routeCostCents, 6203);
assert.ok(bridge.plan.routes.every((route) => !route.roadIds.includes("river-bridge")));
checked.push("Closing the bridge changes routes and cost.");
const noCold = await create({ ...base, disabledCouriers: ["coldbox"] });
assert.deepEqual(noCold.plan.unassigned.map((item) => item.shipmentId).sort(), ["P103", "P106"]);
checked.push("Removing refrigeration leaves both medical deliveries unassigned.");
const urgent = await create({ ...base, urgent: true });
assert.equal(urgent.plan.delivered, 6); assert.equal(urgent.plan.totalShipments, 7);
assert.deepEqual(urgent.plan.unassigned.map((item) => item.shipmentId), ["P106"]);
checked.push("An urgent delivery displaces another shipment under the joint constraints.");
const otherDraft = await create(base, normal.batchId);
const attempts = await Promise.all([normal, otherDraft].map(async (draft) => {
  const response = await fetch(`${origin}/api/plans/${draft.id}`, { method: "POST" });
  return { status: response.status, body: await response.json() };
}));
assert.deepEqual(attempts.map((item) => item.status).sort(), [200, 409]);
const winner = attempts.find((item) => item.status === 200).body;
assert.equal(winner.state, "committed"); assert.equal(winner.events.length, 2);
const retry = await (await fetch(`${origin}/api/plans/${winner.id}`, { method: "POST" })).json();
assert.deepEqual(retry, winner);
assert.deepEqual(await (await fetch(`${origin}/api/plans/${winner.id}`)).json(), winner);
checked.push("Competing draft commits reserve each shipment once; the losing transaction conflicts.");
checked.push("Retrying the winning commit is idempotent, and GET restores the saved plan.");
const remaining = await create(base, normal.batchId);
assert.equal(remaining.plan.totalShipments, 0);
assert.equal((await fetch(`${origin}/api/plans/${remaining.id}`, { method: "POST" })).status, 409);
const newUrgent = await create({ ...base, urgent: true }, normal.batchId);
assert.equal(newUrgent.plan.totalShipments, 1); assert.equal(newUrgent.plan.delivered, 0);
assert.deepEqual(newUrgent.plan.unassigned.map((item) => item.shipmentId), ["P107"]);
checked.push("Replanning excludes reserved shipments and cannot reuse already dispatched couriers.");
const lateCold = await create({ ...base, disabledCouriers: ["sprinter", "cargo"], startMinute: 570 });
const urgentCold = await create({ ...base, disabledCouriers: ["sprinter", "cargo"], urgent: true, closedRoads: ["central-east", "ridge-east", "north-east-trail"] }, lateCold.batchId);
assert.deepEqual(lateCold.plan.routes.flatMap((route) => route.shipmentIds), ["P103"]);
const lateIds = lateCold.plan.routes.flatMap((route) => route.shipmentIds);
const urgentIds = urgentCold.plan.routes.flatMap((route) => route.shipmentIds);
assert.ok(urgentIds.includes("P107"));
assert.ok(urgentIds.every((id) => !lateIds.includes(id)));
assert.equal((await fetch(`${origin}/api/plans/${lateCold.id}`, { method: "POST" })).status, 200);
const courierConflict = await fetch(`${origin}/api/plans/${urgentCold.id}`, { method: "POST" });
assert.equal(courierConflict.status, 409);
assert.match((await courierConflict.json()).error, /courier/);
checked.push("Disjoint shipments still conflict when their draft plans need the same physical courier.");
for (const [body, type, expected] of [["{", "application/json", 400], [JSON.stringify({ batchId: null, scenario: { ...base, closedRoads: ["invented"] } }), "application/json", 400], [JSON.stringify({ batchId: null, scenario: base, objectiveCents: 1 }), "application/json", 400], ["x".repeat(2049), "application/json", 413], ["{}", "text/plain", 415]]) {
  assert.equal((await fetch(`${origin}/api/plans`, { method: "POST", headers: { "Content-Type": type }, body })).status, expected);
}
assert.equal((await fetch(`${origin}/api/plans/not-an-id`)).status, 404);
assert.equal((await create()).plan.delivered, 6);
checked.push("Malformed, oversized, forged and unknown inputs are rejected; a fresh batch is independent.");
const report = { version: 2, origin, passed: true, checks: checked, scope: "Functional application checks. No version-two REA or recovery-cost result is asserted." };
if (process.argv[3]) { await mkdir("evidence/v2", { recursive: true }); await writeFile(process.argv[3], `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify(report, null, 2));
