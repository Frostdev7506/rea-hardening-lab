import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlan } from "../scripts/v2-grade.mjs";
import { planDispatch } from "../src/lib/dispatch-engine.ts";
import { dispatchModel } from "../src/lib/dispatch-fixture.ts";

const scenario = { disabledCouriers: [], closedRoads: [], startMinute: 540, urgent: false };
test("V2 grader checks feasibility and arithmetic rather than trusting objective alone", () => {
  const correct = planDispatch(dispatchModel, scenario);
  validatePlan(correct, dispatchModel, scenario, correct.objectiveCents);
  for (const mutate of [
    (p) => { p.routes[0].roadIds[0] = "invented"; },
    (p) => { p.routes[0].stops[0].arrival++; p.routes[0].stops[0].departure++; },
    (p) => { p.routes[0].loadKg = 0; },
    (p) => { p.routes[0].costCents--; },
    (p) => { p.unassigned.push({ shipmentId: p.routes[0].shipmentIds[0] }); },
    (p) => { p.routes = []; },
    (p) => { p.objectiveCents++; },
  ]) { const wrong = structuredClone(correct); mutate(wrong); assert.throws(() => validatePlan(wrong, dispatchModel, scenario, correct.objectiveCents)); }
});
test("V2 grader accepts an equally optimal assignment with a different courier tie-break", () => {
  const model = structuredClone(dispatchModel);
  model.shipments = [model.shipments[0]];
  model.couriers = [{ ...model.couriers[0], id: "a" }, { ...model.couriers[0], id: "b" }];
  const plan = planDispatch(model, scenario);
  plan.routes[0].courierId = plan.routes[0].courierId === "a" ? "b" : "a";
  validatePlan(plan, model, scenario, plan.objectiveCents);
});
