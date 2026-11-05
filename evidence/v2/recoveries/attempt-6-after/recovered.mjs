const depot = 'depot';

const roads = [
  ['depot-west', 'depot', 'west', 12],
  ['depot-central', 'depot', 'central', 14],
  ['west-north', 'west', 'north', 16],
  ['north-central', 'north', 'central', 9],
  ['central-east', 'central', 'east', 17],
  ['river-bridge', 'central', 'ridge', 8],
  ['central-hospital', 'central', 'hospital', 18],
  ['hospital-ridge', 'hospital', 'ridge', 12],
  ['ridge-east', 'ridge', 'east', 11],
  ['depot-docks', 'depot', 'docks', 13],
  ['docks-hospital', 'docks', 'hospital', 20],
  ['north-east-trail', 'north', 'east', 9, true],
].map(([id, from, to, minutes, bikeOnly = false]) => ({id, from, to, minutes, bikeOnly}));

const shipments = [
  ['P101', 'west', 3, 540, 600, 4, 'general', 5000],
  ['P102', 'north', 2, 540, 580, 5, 'general', 12000],
  ['P103', 'east', 4, 540, 630, 6, 'medical', 8500],
  ['P104', 'ridge', 7, 540, 645, 4, 'battery', 4800],
  ['P105', 'docks', 2, 540, 610, 4, 'general', 4500],
  ['P106', 'hospital', 3, 540, 600, 8, 'medical', 9500],
  ['P107', 'west', 4, 555, 585, 5, 'medical', 22000, true],
].map(([id, destination, weightKg, readyMinute, deadline, serviceMinutes, kind, penaltyCents, optional = false]) =>
  ({id, destination, weightKg, readyMinute, deadline, serviceMinutes, kind, penaltyCents, optional}));

const couriers = [
  ['sprinter', 'van', 18, 4, 120, false, true, 1, 317, 18],
  ['coldbox', 'van', 10, 3, 110, true, false, 1.05, 683, 23],
  ['cargo', 'bike', 5, 2, 100, false, false, 1.3, 149, 12],
].map(([id, mode, capacityKg, maxStops, shiftMinutes, coldChain, batteries, timeFactor, baseCents, minuteCents]) =>
  ({id, mode, capacityKg, maxStops, shiftMinutes, coldChain, batteries, timeFactor, baseCents, minuteCents}));

export function planDispatch(scenario, reserved = {shipments: [], couriers: []}) {
  const activeShipments = shipments.filter(shipment =>
    (!shipment.optional || scenario.urgent) && !reserved.shipments.includes(shipment.id));
  const activeCouriers = couriers.filter(courier =>
    !scenario.disabledCouriers.includes(courier.id) && !reserved.couriers.includes(courier.id));
  const openRoads = roads.filter(road => !scenario.closedRoads.includes(road.id));
  const pathCache = new Map();

  function shortestPath(courier, from, to) {
    const key = `${courier.id}:${from}:${to}`;
    if (pathCache.has(key)) return pathCache.get(key);
    const queue = [{node: from, minutes: 0, nodes: [from], roadIds: []}];
    const visited = new Set();
    while (queue.length) {
      queue.sort((first, second) => first.minutes - second.minutes ||
        first.roadIds.join('|').localeCompare(second.roadIds.join('|')));
      const current = queue.shift();
      if (visited.has(current.node)) continue;
      visited.add(current.node);
      if (current.node === to) {
        pathCache.set(key, current);
        return current;
      }
      for (const road of openRoads) {
        if (road.bikeOnly && courier.mode !== 'bike') continue;
        const next = road.from === current.node ? road.to : road.to === current.node ? road.from : null;
        if (next === null || visited.has(next)) continue;
        queue.push({
          node: next,
          minutes: current.minutes + Math.ceil(road.minutes * courier.timeFactor),
          nodes: [...current.nodes, next],
          roadIds: [...current.roadIds, road.id],
        });
      }
    }
    pathCache.set(key, null);
    return null;
  }

  const maskCount = 1 << activeShipments.length;
  const routeTables = activeCouriers.map(courier => {
    const routes = new Array(maskCount).fill(null);

    function visit(node, minute, mask, loadKg, stops, nodes, roadIds) {
      if (mask) {
        const home = shortestPath(courier, node, depot);
        if (home && minute + home.minutes - scenario.startMinute <= courier.shiftMinutes) {
          const returnMinute = minute + home.minutes;
          const costCents = courier.baseCents + (returnMinute - scenario.startMinute) * courier.minuteCents;
          const shipmentIds = stops.map(stop => stop.shipmentId);
          const previous = routes[mask];
          if (!previous || costCents < previous.costCents ||
              (costCents === previous.costCents && shipmentIds.join('|') < previous.shipmentIds.join('|'))) {
            routes[mask] = {
              courierId: courier.id, shipmentIds, stops,
              nodes: [...nodes, ...home.nodes.slice(1)],
              roadIds: [...roadIds, ...home.roadIds],
              loadKg, returnMinute, costCents,
            };
          }
        }
      }
      if (stops.length === courier.maxStops) return;
      for (let index = 0; index < activeShipments.length; index++) {
        const bit = 1 << index;
        if (mask & bit) continue;
        const shipment = activeShipments[index];
        const nextLoad = loadKg + shipment.weightKg;
        if (nextLoad > courier.capacityKg ||
            (shipment.kind === 'medical' && !courier.coldChain) ||
            (shipment.kind === 'battery' && !courier.batteries)) continue;
        const path = shortestPath(courier, node, shipment.destination);
        if (!path) continue;
        const arrival = Math.max(minute + path.minutes, shipment.readyMinute);
        const departure = arrival + shipment.serviceMinutes;
        if (departure > shipment.deadline || departure - scenario.startMinute > courier.shiftMinutes) continue;
        visit(shipment.destination, departure, mask | bit, nextLoad,
          [...stops, {shipmentId: shipment.id, node: shipment.destination, arrival, departure}],
          [...nodes, ...path.nodes.slice(1)], [...roadIds, ...path.roadIds]);
      }
    }

    visit(depot, scenario.startMinute, 0, 0, [], [depot], []);
    return routes;
  });

  let states = new Map([[0, {cost: 0, routes: []}]]);
  for (const table of routeTables) {
    const nextStates = new Map(states);
    for (const [assigned, state] of states) {
      const available = (maskCount - 1) ^ assigned;
      for (let subset = available; subset; subset = (subset - 1) & available) {
        const route = table[subset];
        if (!route) continue;
        const combined = assigned | subset;
        const cost = state.cost + route.costCents;
        const previous = nextStates.get(combined);
        if (!previous || cost < previous.cost) {
          nextStates.set(combined, {cost, routes: [...state.routes, route]});
        }
      }
    }
    states = nextStates;
  }

  let best = null;
  for (const [assigned, state] of states) {
    const missed = activeShipments.filter((shipment, index) => !(assigned & (1 << index)));
    const penaltyCents = missed.reduce((total, shipment) => total + shipment.penaltyCents, 0);
    const objectiveCents = state.cost + penaltyCents;
    if (!best || objectiveCents < best.objectiveCents) {
      best = {
        routes: state.routes,
        unassigned: missed.map(shipment => ({shipmentId: shipment.id, reason: 'Not served by the minimum-cost feasible plan.'})),
        delivered: activeShipments.length - missed.length,
        totalShipments: activeShipments.length,
        routeCostCents: state.cost,
        penaltyCents,
        objectiveCents,
      };
    }
  }
  return best;
}
