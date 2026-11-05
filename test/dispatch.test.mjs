import { test } from "node:test";
import assert from "node:assert/strict";
import { planDispatch } from "../src/lib/dispatch-engine.ts";
import { dispatchModel, publicDispatchModel } from "../src/lib/dispatch-fixture.ts";
import { parseDispatchRequest } from "../src/lib/dispatch-request.ts";

const scenario = { disabledCouriers: [], closedRoads: [], startMinute: 540, urgent: false };
test("normal dispatch delivers all six, meeting capacity, deadline and specialty constraints", () => {
  const plan = planDispatch(dispatchModel, scenario);
  assert.equal(plan.delivered, 6); assert.equal(plan.routeCostCents, 5483); assert.equal(plan.penaltyCents, 0);
  const ids = plan.routes.flatMap((route) => route.shipmentIds);
  assert.equal(new Set(ids).size, 6);
  for (const route of plan.routes) {
    const courier = dispatchModel.couriers.find((item) => item.id === route.courierId);
    assert.ok(route.loadKg <= courier.capacityKg);
    assert.ok(route.stops.length <= courier.maxStops);
    assert.ok(route.returnMinute - scenario.startMinute <= courier.shiftMinutes);
    for (const stop of route.stops) {
      const shipment = dispatchModel.shipments.find((item) => item.id === stop.shipmentId);
      assert.ok(stop.departure <= shipment.deadline);
      assert.ok(stop.arrival >= shipment.readyMinute);
      if (shipment.kind === "medical") assert.ok(courier.coldChain);
      if (shipment.kind === "battery") assert.ok(courier.batteries);
    }
  }
});
test("a closed bridge forces a real detour and a higher cost", () => {
  const plan = planDispatch(dispatchModel, { ...scenario, closedRoads: ["river-bridge"] });
  assert.equal(plan.delivered, 6); assert.equal(plan.routeCostCents, 6203);
  assert.ok(plan.routes.every((route) => !route.roadIds.includes("river-bridge")));
});
test("removing cold-chain capacity leaves both medical shipments unassigned", () => {
  const plan = planDispatch(dispatchModel, { ...scenario, disabledCouriers: ["coldbox"] });
  assert.deepEqual(plan.unassigned.map((item) => item.shipmentId).sort(), ["P103", "P106"]);
  assert.equal(plan.penaltyCents, 18000);
});
test("an urgent shipment changes assignments and incurs the least missed-service penalty", () => {
  const plan = planDispatch(dispatchModel, { ...scenario, urgent: true });
  assert.equal(plan.totalShipments, 7); assert.equal(plan.delivered, 6);
  assert.ok(plan.routes.some((route) => route.shipmentIds.includes("P107")));
  assert.deepEqual(plan.unassigned.map((item) => item.shipmentId), ["P106"]);
  assert.equal(plan.objectiveCents, 14937);
});
test("no couriers and a disconnected network return feasible empty plans", () => {
  const disabledCouriers = dispatchModel.couriers.map((item) => item.id);
  assert.equal(planDispatch(dispatchModel, { ...scenario, disabledCouriers }).delivered, 0);
  assert.equal(planDispatch(dispatchModel, { ...scenario, closedRoads: dispatchModel.roads.map((item) => item.id) }).delivered, 0);
});
test("global assignment avoids a greedy choice of the flexible courier", () => {
  const model = {
    depot: "d", nodes: [{ id: "d" }, { id: "a" }, { id: "b" }],
    roads: [{ id: "a", from: "d", to: "a", minutes: 10 }, { id: "b", from: "d", to: "b", minutes: 10 }],
    couriers: [
      { id: "flexible", mode: "van", capacityKg: 5, maxStops: 1, shiftMinutes: 100, coldChain: true, batteries: true, timeFactor: 1, baseCents: 100, minuteCents: 5 },
      { id: "plain", mode: "bike", capacityKg: 5, maxStops: 1, shiftMinutes: 100, coldChain: false, batteries: false, timeFactor: 1, baseCents: 100, minuteCents: 5 },
    ],
    shipments: [
      { id: "ordinary", destination: "a", weightKg: 1, readyMinute: 0, deadline: 100, serviceMinutes: 0, kind: "general", penaltyCents: 1000 },
      { id: "medical", destination: "b", weightKg: 1, readyMinute: 0, deadline: 100, serviceMinutes: 0, kind: "medical", penaltyCents: 2000 },
    ],
  };
  const plan = planDispatch(model, { ...scenario, startMinute: 0 });
  assert.equal(plan.delivered, 2); assert.equal(plan.objectiveCents, 400);
  assert.deepEqual(plan.routes.find((route) => route.courierId === "plain").shipmentIds, ["ordinary"]);
});
test("deadline boundaries include service time, not just arrival", () => {
  const model = structuredClone(dispatchModel);
  model.shipments = [{ ...model.shipments[0], readyMinute: 540, deadline: 552, serviceMinutes: 1 }];
  assert.equal(planDispatch(model, { ...scenario, disabledCouriers: ["cargo", "coldbox"] }).delivered, 0);
  model.shipments[0].deadline = 553;
  assert.equal(planDispatch(model, { ...scenario, disabledCouriers: ["cargo", "coldbox"] }).delivered, 1);
});
test("public data omits tariff coefficients and missed-delivery penalties", () => {
  const data = publicDispatchModel();
  assert.ok(data.shipments.every((item) => !("penaltyCents" in item)));
  assert.ok(data.couriers.every((item) => !("baseCents" in item) && !("minuteCents" in item) && !("timeFactor" in item)));
});
test("request validation rejects tampered constraints and unknown fields", () => {
  const valid = { batchId: null, scenario };
  assert.deepEqual(parseDispatchRequest(valid), valid);
  for (const input of [null, {}, { ...valid, batchId: "bad" }, { ...valid, price: 1 }, { ...valid, scenario: { ...scenario, disabledCouriers: ["invented"] } }, { ...valid, scenario: { ...scenario, closedRoads: ["river-bridge", "river-bridge"] } }, { ...valid, scenario: { ...scenario, startMinute: 540.5 } }, { ...valid, scenario: { ...scenario, urgent: "true" } }]) assert.throws(() => parseDispatchRequest(input));
});
