import type { Courier, CourierRoute, DispatchModel, DispatchPlan, DispatchScenario, DispatchStop } from "./dispatch-types.ts";

export function planDispatch(model: DispatchModel, scenario: DispatchScenario): DispatchPlan {
  const shipments = model.shipments.filter((shipment) => !shipment.optional || scenario.urgent);
  if (shipments.length > 8) throw new Error("This exact planner supports up to eight shipments per batch.");
  const couriers = model.couriers.filter((courier) => !scenario.disabledCouriers.includes(courier.id));
  const roads = model.roads.filter((road) => !scenario.closedRoads.includes(road.id));
  const paths = new Map<string, { minutes: number; nodes: string[]; roadIds: string[] } | null>();

  function travel(from: string, to: string, courier: Courier) {
    const key = `${courier.id}:${from}:${to}`;
    if (paths.has(key)) return paths.get(key)!;
    const queue = [{ node: from, minutes: 0, nodes: [from], roadIds: [] as string[] }];
    const visited = new Set<string>();
    while (queue.length) {
      queue.sort((a, b) => a.minutes - b.minutes || a.roadIds.join("|").localeCompare(b.roadIds.join("|")));
      const current = queue.shift()!;
      if (visited.has(current.node)) continue;
      visited.add(current.node);
      if (current.node === to) { paths.set(key, current); return current; }
      for (const road of roads) {
        if (road.bikeOnly && courier.mode !== "bike") continue;
        const next = road.from === current.node ? road.to : road.to === current.node ? road.from : null;
        if (next && !visited.has(next)) queue.push({ node: next, minutes: current.minutes + Math.ceil(road.minutes * courier.timeFactor), nodes: [...current.nodes, next], roadIds: [...current.roadIds, road.id] });
      }
    }
    paths.set(key, null);
    return null;
  }

  const routeCache = new Map<string, CourierRoute | null>();
  function route(courier: Courier, mask: number): CourierRoute | null {
    const key = `${courier.id}:${mask}`;
    if (routeCache.has(key)) return routeCache.get(key)!;
    const orders = shipments.filter((_, index) => (mask & (1 << index)) !== 0);
    const loadKg = orders.reduce((total, order) => total + order.weightKg, 0);
    if (loadKg > courier.capacityKg || orders.length > courier.maxStops || orders.some((order) => (order.kind === "medical" && !courier.coldChain) || (order.kind === "battery" && !courier.batteries))) {
      routeCache.set(key, null); return null;
    }
    let best: CourierRoute | null = null;
    function visit(node: string, minute: number, remaining: typeof orders, stops: DispatchStop[], nodes: string[], roadIds: string[]) {
      if (!remaining.length) {
        const back = travel(node, model.depot, courier);
        if (!back || minute + back.minutes - scenario.startMinute > courier.shiftMinutes) return;
        const returnMinute = minute + back.minutes;
        const result: CourierRoute = { courierId: courier.id, shipmentIds: stops.map((stop) => stop.shipmentId), stops, nodes: [...nodes, ...back.nodes.slice(1)], roadIds: [...roadIds, ...back.roadIds], loadKg, returnMinute, costCents: courier.baseCents + (returnMinute - scenario.startMinute) * courier.minuteCents };
        if (!best || result.costCents < best.costCents || (result.costCents === best.costCents && result.shipmentIds.join("|") < best.shipmentIds.join("|"))) best = result;
        return;
      }
      for (const order of remaining) {
        const leg = travel(node, order.destination, courier);
        if (!leg) continue;
        const arrival = Math.max(minute + leg.minutes, order.readyMinute);
        const departure = arrival + order.serviceMinutes;
        if (departure > order.deadline || departure - scenario.startMinute > courier.shiftMinutes) continue;
        visit(order.destination, departure, remaining.filter((item) => item.id !== order.id), [...stops, { shipmentId: order.id, node: order.destination, arrival, departure }], [...nodes, ...leg.nodes.slice(1)], [...roadIds, ...leg.roadIds]);
      }
    }
    visit(model.depot, scenario.startMinute, orders, [], [model.depot], []);
    routeCache.set(key, best);
    return best;
  }

  let best = { routes: [] as CourierRoute[], missed: shipments.map((_, index) => index), penalty: shipments.reduce((sum, item) => sum + item.penaltyCents, 0), cost: 0, signature: "~" };
  function assign(index: number, masks: number[], missed: number[], penalty: number) {
    if (penalty > best.cost + best.penalty) return;
    if (index === shipments.length) {
      const routes = couriers.flatMap((courier, i) => masks[i] ? [route(courier, masks[i])!] : []);
      const cost = routes.reduce((total, item) => total + item.costCents, 0);
      const signature = routes.map((item) => `${item.courierId}:${item.shipmentIds.join(",")}`).join("|");
      if (cost + penalty < best.cost + best.penalty || (cost + penalty === best.cost + best.penalty && signature < best.signature)) best = { routes, missed: [...missed], penalty, cost, signature };
      return;
    }
    for (let i = 0; i < couriers.length; i++) {
      const mask = masks[i] | (1 << index);
      if (!route(couriers[i], mask)) continue;
      const next = [...masks]; next[i] = mask;
      assign(index + 1, next, missed, penalty);
    }
    assign(index + 1, masks, [...missed, index], penalty + shipments[index].penaltyCents);
  }
  assign(0, couriers.map(() => 0), [], 0);
  // All-unassigned is always feasible, including when every courier is disabled.
  const selected = best;
  return {
    routes: selected.routes,
    unassigned: selected.missed.map((index) => ({ shipmentId: shipments[index].id, reason: couriers.some((courier) => route(courier, 1 << index)) ? "No slot in the lowest-cost feasible plan." : "No active courier can meet this shipment’s limits." })),
    delivered: shipments.length - selected.missed.length,
    totalShipments: shipments.length,
    routeCostCents: selected.cost,
    penaltyCents: selected.penalty,
    objectiveCents: selected.cost + selected.penalty,
  };
}
