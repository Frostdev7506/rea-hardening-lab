export function calculatePlan(model, scenario) {
  const shipments = model.shipments.filter(shipment => !shipment.optional || scenario.urgent);
  if (shipments.length > 8) throw Error('This exact planner supports up to eight shipments per batch.');
  const couriers = model.couriers.filter(courier => !scenario.disabledCouriers.includes(courier.id));
  const roads = model.roads.filter(road => !scenario.closedRoads.includes(road.id));
  const paths = new Map();
  function shortestPath(from, to, courier) {
    const key = `${courier.id}:${from}:${to}`;
    if (paths.has(key)) return paths.get(key);
    const queue = [{node: from, minutes: 0, nodes: [from], roadIds: []}];
    const visited = new Set();
    while (queue.length) {
      queue.sort((first, second) => first.minutes - second.minutes || first.roadIds.join('|').localeCompare(second.roadIds.join('|')));
      const current = queue.shift();
      if (visited.has(current.node)) continue;
      visited.add(current.node);
      if (current.node === to) { paths.set(key, current); return current; }
      for (const road of roads) {
        if (road.bikeOnly && courier.mode !== 'bike') continue;
        const next = road.from === current.node ? road.to : road.to === current.node ? road.from : null;
        if (next && !visited.has(next)) queue.push({node: next, minutes: current.minutes + Math.ceil(road.minutes * courier.timeFactor), nodes: [...current.nodes, next], roadIds: [...current.roadIds, road.id]});
      }
    }
    paths.set(key, null);
    return null;
  }
  const routeCache = new Map();
  function bestRoute(courier, mask) {
    const key = `${courier.id}:${mask}`;
    if (routeCache.has(key)) return routeCache.get(key);
    const selected = shipments.filter((shipment, index) => (mask & (1 << index)) !== 0);
    const loadKg = selected.reduce((sum, shipment) => sum + shipment.weightKg, 0);
    if (loadKg > courier.capacityKg || selected.length > courier.maxStops || selected.some(shipment => shipment.kind === 'medical' && !courier.coldChain || shipment.kind === 'battery' && !courier.batteries)) { routeCache.set(key, null); return null; }
    let best = null;
    function visit(node, minute, remaining, stops, nodes, roadIds) {
      if (!remaining.length) {
        const home = shortestPath(node, model.depot, courier);
        if (!home || minute + home.minutes - scenario.startMinute > courier.shiftMinutes) return;
        const returnMinute = minute + home.minutes;
        const route = {courierId: courier.id, shipmentIds: stops.map(stop => stop.shipmentId), stops, nodes: [...nodes, ...home.nodes.slice(1)], roadIds: [...roadIds, ...home.roadIds], loadKg, returnMinute, costCents: courier.baseCents + (returnMinute - scenario.startMinute) * courier.minuteCents};
        if (!best || route.costCents < best.costCents || route.costCents === best.costCents && route.shipmentIds.join('|') < best.shipmentIds.join('|')) best = route;
        return;
      }
      for (const shipment of remaining) {
        const path = shortestPath(node, shipment.destination, courier);
        if (!path) continue;
        const arrival = Math.max(minute + path.minutes, shipment.readyMinute);
        const departure = arrival + shipment.serviceMinutes;
        if (departure > shipment.deadline || departure - scenario.startMinute > courier.shiftMinutes) continue;
        visit(shipment.destination, departure, remaining.filter(other => other.id !== shipment.id), [...stops, {shipmentId: shipment.id, node: shipment.destination, arrival, departure}], [...nodes, ...path.nodes.slice(1)], [...roadIds, ...path.roadIds]);
      }
    }
    visit(model.depot, scenario.startMinute, selected, [], [model.depot], []);
    routeCache.set(key, best);
    return best;
  }
  let best = {routes: [], missed: shipments.map((shipment, index) => index), penalty: shipments.reduce((sum, shipment) => sum + shipment.penaltyCents, 0), cost: 0, signature: '~'};
  function assign(index, masks, missed, penalty) {
    if (penalty > best.penalty) return;
    if (index === shipments.length) {
      const routes = couriers.flatMap((courier, courierIndex) => masks[courierIndex] ? [bestRoute(courier, masks[courierIndex])] : []);
      const cost = routes.reduce((sum, route) => sum + route.costCents, 0);
      const signature = routes.map(route => route.courierId + ':' + route.shipmentIds.join(',')).join('|');
      if (cost + penalty < best.penalty || cost + penalty === best.penalty && signature < '~') best = {routes, missed: [...missed], penalty, cost, signature};
      return;
    }
    for (let courierIndex = 0; courierIndex < couriers.length; courierIndex++) {
      const mask = masks[courierIndex] | (1 << index);
      if (!bestRoute(couriers[courierIndex], mask)) continue;
      const next = [...masks];
      next[courierIndex] = mask;
      assign(index + 1, next, missed, penalty);
    }
    assign(index + 1, masks, [...missed, index], penalty + shipments[index].penaltyCents);
  }
  assign(0, couriers.map(() => 0), [], 0);
  return {routes: best.routes, unassigned: best.missed.map(index => ({shipmentId: shipments[index].id, reason: couriers.some(courier => bestRoute(courier, 1 << index)) ? 'No slot in the lowest-cost feasible plan.' : 'No active courier can meet this shipment’s limits.'})), delivered: shipments.length - best.missed.length, totalShipments: shipments.length, routeCostCents: best.cost, penaltyCents: best.penalty, objectiveCents: best.cost + best.penalty};
}
