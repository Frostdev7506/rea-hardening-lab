import fixture from './fixture.json';

export const defaultScenario = {disabledCouriers: [], closedRoads: [], startMinute: 540, urgent: false};
export const validId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

export function validatePlanning(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Send a dispatch request.');
  if (Object.keys(input).some(key => !['batchId', 'scenario'].includes(key))) throw Error('The request contains an unknown field.');
  if (input.batchId !== null && !validId(input.batchId)) throw Error('Choose a valid batch.');
  const scenario = input.scenario;
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) throw Error('Choose a planning scenario.');
  if (Object.keys(scenario).some(key => !['disabledCouriers', 'closedRoads', 'startMinute', 'urgent'].includes(key))) throw Error('The scenario contains an unknown field.');
  for (const [key, choices, label] of [['disabledCouriers', fixture.couriers, 'couriers'], ['closedRoads', fixture.roads, 'roads']]) {
    const values = scenario[key];
    if (!Array.isArray(values) || values.length > choices.length || values.some(value => typeof value !== 'string' || !choices.some(choice => choice.id === value)) || new Set(values).size !== values.length) throw Error(`Choose valid ${label}.`);
  }
  if (typeof scenario.startMinute !== 'number' || !Number.isInteger(scenario.startMinute) || scenario.startMinute < 480 || scenario.startMinute > 720 || typeof scenario.urgent !== 'boolean') throw Error('Choose a start time between 08:00 and 12:00 UTC and an urgent-delivery option.');
  return {batchId: input.batchId, scenario: {disabledCouriers: scenario.disabledCouriers, closedRoads: scenario.closedRoads, startMinute: scenario.startMinute, urgent: scenario.urgent}};
}

export function planDispatch(scenario, reservedShipments = [], reservedCouriers = []) {
  const shipments = fixture.shipments.filter(shipment => !reservedShipments.includes(shipment.id) && (!shipment.optional || scenario.urgent));
  if (shipments.length > 8) throw Error('This exact planner supports up to eight shipments per batch.');
  const couriers = fixture.couriers.filter(courier => !reservedCouriers.includes(courier.id) && !scenario.disabledCouriers.includes(courier.id));
  const roads = fixture.roads.filter(road => !scenario.closedRoads.includes(road.id));
  const pathCache = new Map();
  function shortestPath(from, to, courier) {
    const key = `${courier.id}:${from}:${to}`;
    if (pathCache.has(key)) return pathCache.get(key);
    const pending = [{node: from, minutes: 0, nodes: [from], roadIds: []}];
    const visited = new Set();
    while (pending.length) {
      pending.sort((left, right) => left.minutes - right.minutes || left.roadIds.join('|').localeCompare(right.roadIds.join('|')));
      const current = pending.shift();
      if (visited.has(current.node)) continue;
      visited.add(current.node);
      if (current.node === to) { pathCache.set(key, current); return current; }
      for (const road of roads) {
        if (road.bikeOnly && courier.mode !== 'bike') continue;
        const next = road.from === current.node ? road.to : road.to === current.node ? road.from : null;
        if (next && !visited.has(next)) pending.push({node: next, minutes: current.minutes + Math.ceil(road.minutes * courier.timeFactor), nodes: [...current.nodes, next], roadIds: [...current.roadIds, road.id]});
      }
    }
    pathCache.set(key, null);
    return null;
  }
  const routeCache = new Map();
  function bestRoute(courier, mask) {
    const key = `${courier.id}:${mask}`;
    if (routeCache.has(key)) return routeCache.get(key);
    const selected = shipments.filter((shipment, index) => (mask & (1 << index)) !== 0);
    const loadKg = selected.reduce((total, shipment) => total + shipment.weightKg, 0);
    if (loadKg > courier.capacityKg || selected.length > courier.maxStops || selected.some(shipment => shipment.kind === 'medical' && !courier.coldChain || shipment.kind === 'battery' && !courier.batteries)) {
      routeCache.set(key, null); return null;
    }
    let best = null;
    function visit(node, minute, remaining, stops, nodes, roadIds) {
      if (!remaining.length) {
        const home = shortestPath(node, fixture.depot, courier);
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
    visit(fixture.depot, scenario.startMinute, selected, [], [fixture.depot], []);
    routeCache.set(key, best);
    return best;
  }
  let best = {routes: [], missed: shipments.map((shipment, index) => index), penalty: shipments.reduce((total, shipment) => total + shipment.penaltyCents, 0), cost: 0, signature: '~'};
  function allocate(index, masks, missed, penalty) {
    if (penalty > best.cost + best.penalty) return;
    if (index === shipments.length) {
      const routes = couriers.flatMap((courier, courierIndex) => masks[courierIndex] ? [bestRoute(courier, masks[courierIndex])] : []);
      const cost = routes.reduce((total, route) => total + route.costCents, 0);
      const signature = routes.map(route => `${route.courierId}:${route.shipmentIds.join(',')}`).join('|');
      if (cost + penalty < best.cost + best.penalty || cost + penalty === best.cost + best.penalty && signature < best.signature) best = {routes, missed: [...missed], penalty, cost, signature};
      return;
    }
    for (let courierIndex = 0; courierIndex < couriers.length; courierIndex++) {
      const mask = masks[courierIndex] | (1 << index);
      if (!bestRoute(couriers[courierIndex], mask)) continue;
      const nextMasks = [...masks];
      nextMasks[courierIndex] = mask;
      allocate(index + 1, nextMasks, missed, penalty);
    }
    allocate(index + 1, masks, [...missed, index], penalty + shipments[index].penaltyCents);
  }
  allocate(0, couriers.map(() => 0), [], 0);
  return {routes: best.routes, unassigned: best.missed.map(index => ({shipmentId: shipments[index].id, reason: couriers.some(courier => bestRoute(courier, 1 << index)) ? 'No slot in the lowest-cost feasible plan.' : 'No active courier can meet this shipment’s limits.'})), delivered: shipments.length - best.missed.length, totalShipments: shipments.length, routeCostCents: best.cost, penaltyCents: best.penalty, objectiveCents: best.cost + best.penalty};
}
