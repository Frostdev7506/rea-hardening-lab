import { dispatchModel } from "../src/lib/dispatch-fixture.ts";

// Independent optimum check: Floyd–Warshall + route-prefix enumeration +
// disjoint-set dynamic programming. Does not call the application's solver.
export function independentObjective(scenario, reserved) {
  const shipments = dispatchModel.shipments.filter((s) => (!s.optional || scenario.urgent) && !reserved.shipments.includes(s.id));
  const couriers = dispatchModel.couriers.filter((c) => !scenario.disabledCouriers.includes(c.id) && !reserved.couriers.includes(c.id));
  const nodes = dispatchModel.nodes.map((n) => n.id); const depot = nodes.indexOf(dispatchModel.depot);
  const penalties = shipments.reduce((sum, s) => sum + s.penaltyCents, 0);
  let assignments = new Map([[0, 0]]);
  for (const courier of couriers) {
    const distance = nodes.map((_, i) => nodes.map((_, j) => i === j ? 0 : Infinity));
    for (const road of dispatchModel.roads) if (!scenario.closedRoads.includes(road.id) && (!road.bikeOnly || courier.mode === "bike")) {
      const i = nodes.indexOf(road.from); const j = nodes.indexOf(road.to);
      distance[i][j] = distance[j][i] = Math.min(distance[i][j], Math.ceil(road.minutes * courier.timeFactor));
    }
    for (let k = 0; k < nodes.length; k++) for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) distance[i][j] = Math.min(distance[i][j], distance[i][k] + distance[k][j]);
    const choices = new Map([[0, 0]]);
    function extend(location, minute, mask, stops, weight, avoidedPenalty) {
      if (mask && minute + distance[location][depot] - scenario.startMinute <= courier.shiftMinutes) {
        const cost = courier.baseCents + (minute + distance[location][depot] - scenario.startMinute) * courier.minuteCents;
        choices.set(mask, Math.max(choices.get(mask) ?? -Infinity, avoidedPenalty - cost));
      }
      if (stops === courier.maxStops) return;
      for (let i = 0; i < shipments.length; i++) {
        const s = shipments[i];
        if ((mask & (1 << i)) || weight + s.weightKg > courier.capacityKg || (s.kind === "medical" && !courier.coldChain) || (s.kind === "battery" && !courier.batteries)) continue;
        const next = nodes.indexOf(s.destination);
        const departure = Math.max(minute + distance[location][next], s.readyMinute) + s.serviceMinutes;
        if (departure <= s.deadline && departure - scenario.startMinute <= courier.shiftMinutes) extend(next, departure, mask | (1 << i), stops + 1, weight + s.weightKg, avoidedPenalty + s.penaltyCents);
      }
    }
    extend(depot, scenario.startMinute, 0, 0, 0, 0);
    const next = new Map();
    for (const [assigned, benefit] of assignments) for (const [mask, profit] of choices) if (!(assigned & mask)) next.set(assigned | mask, Math.max(next.get(assigned | mask) ?? -Infinity, benefit + profit));
    assignments = next;
  }
  return penalties - Math.max(...assignments.values());
}
