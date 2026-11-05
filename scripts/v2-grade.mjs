import assert from "node:assert/strict";

export function validatePlan(plan, model, scenario, optimum) {
  assert.ok(plan && typeof plan === "object");
  assert.ok(Array.isArray(plan.routes) && Array.isArray(plan.unassigned));
  const shipments = model.shipments.filter((s) => !s.optional || scenario.urgent);
  const used = new Set(); const couriers = new Set();
  let cost = 0; let penalty = 0; let delivered = 0;
  for (const route of plan.routes) {
    const courier = model.couriers.find((c) => c.id === route.courierId);
    assert.ok(courier && !scenario.disabledCouriers.includes(courier.id));
    assert.ok(!couriers.has(courier.id)); couriers.add(courier.id);
    assert.ok(route.stops.length > 0 && route.stops.length <= courier.maxStops);
    assert.deepEqual(route.shipmentIds, route.stops.map((stop) => stop.shipmentId));
    assert.equal(route.nodes[0], model.depot); assert.equal(route.nodes.at(-1), model.depot);
    assert.equal(route.roadIds.length, route.nodes.length - 1);
    const travel = route.roadIds.map((id, i) => {
      const road = model.roads.find((r) => r.id === id);
      assert.ok(road && !scenario.closedRoads.includes(id) && (!road.bikeOnly || courier.mode === "bike"));
      assert.ok((road.from === route.nodes[i] && road.to === route.nodes[i + 1]) || (road.to === route.nodes[i] && road.from === route.nodes[i + 1]));
      return Math.ceil(road.minutes * courier.timeFactor);
    });
    let load = 0;
    for (const stop of route.stops) {
      const shipment = shipments.find((s) => s.id === stop.shipmentId);
      assert.ok(shipment && !used.has(shipment.id)); used.add(shipment.id); delivered++;
      assert.equal(stop.node, shipment.destination);
      assert.ok(shipment.kind !== "medical" || courier.coldChain);
      assert.ok(shipment.kind !== "battery" || courier.batteries);
      assert.equal(stop.departure, stop.arrival + shipment.serviceMinutes);
      assert.ok(stop.arrival >= shipment.readyMinute && stop.departure <= shipment.deadline);
      load += shipment.weightKg;
    }
    assert.equal(route.loadKg, load); assert.ok(load <= courier.capacityKg);
    function timedPath(stopIndex, pathIndex, minute) {
      if (stopIndex === route.stops.length) return minute + travel.slice(pathIndex).reduce((a, b) => a + b, 0) === route.returnMinute;
      const stop = route.stops[stopIndex];
      const shipment = shipments.find((s) => s.id === stop.shipmentId);
      let elapsed = 0;
      for (let i = pathIndex; i < route.nodes.length; i++) {
        if (route.nodes[i] === stop.node && Math.max(minute + elapsed, shipment.readyMinute) === stop.arrival && timedPath(stopIndex + 1, i, stop.departure)) return true;
        elapsed += travel[i] || 0;
      }
      return false;
    }
    assert.ok(timedPath(0, 0, scenario.startMinute), "Path must reproduce the claimed stop/return times.");
    assert.ok(route.returnMinute >= scenario.startMinute && route.returnMinute - scenario.startMinute <= courier.shiftMinutes);
    assert.equal(route.costCents, courier.baseCents + (route.returnMinute - scenario.startMinute) * courier.minuteCents);
    cost += route.costCents;
  }
  for (const item of plan.unassigned) {
    const shipment = shipments.find((s) => s.id === item.shipmentId);
    assert.ok(shipment && !used.has(shipment.id)); used.add(shipment.id); penalty += shipment.penaltyCents;
  }
  assert.equal(used.size, shipments.length); assert.equal(plan.totalShipments, shipments.length);
  assert.equal(plan.delivered, delivered); assert.equal(plan.routeCostCents, cost);
  assert.equal(plan.penaltyCents, penalty); assert.equal(plan.objectiveCents, cost + penalty);
  assert.equal(plan.objectiveCents, optimum, "Plan must achieve the reference optimum, with any equally optimal feasible route accepted.");
}
