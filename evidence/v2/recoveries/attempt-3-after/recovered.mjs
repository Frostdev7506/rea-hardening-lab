const DEPOT = 'depot';

const ROADS = [
  {id: 'depot-west', from: 'depot', to: 'west', minutes: 12},
  {id: 'depot-central', from: 'depot', to: 'central', minutes: 14},
  {id: 'west-north', from: 'west', to: 'north', minutes: 16},
  {id: 'north-central', from: 'north', to: 'central', minutes: 9},
  {id: 'central-east', from: 'central', to: 'east', minutes: 17},
  {id: 'river-bridge', from: 'central', to: 'ridge', minutes: 8},
  {id: 'central-hospital', from: 'central', to: 'hospital', minutes: 18},
  {id: 'hospital-ridge', from: 'hospital', to: 'ridge', minutes: 12},
  {id: 'ridge-east', from: 'ridge', to: 'east', minutes: 11},
  {id: 'depot-docks', from: 'depot', to: 'docks', minutes: 13},
  {id: 'docks-hospital', from: 'docks', to: 'hospital', minutes: 20},
  {id: 'north-east-trail', from: 'north', to: 'east', minutes: 9, bikeOnly: true},
];

const COURIERS = [
  {id: 'sprinter', mode: 'van', capacityKg: 18, maxStops: 4, shiftMinutes: 120,
    coldChain: false, batteries: true, timeFactor: 1, baseCents: 317, minuteCents: 18},
  {id: 'coldbox', mode: 'van', capacityKg: 10, maxStops: 3, shiftMinutes: 110,
    coldChain: true, batteries: false, timeFactor: 1.05, baseCents: 683, minuteCents: 23},
  {id: 'cargo', mode: 'bike', capacityKg: 5, maxStops: 2, shiftMinutes: 100,
    coldChain: false, batteries: false, timeFactor: 1.3, baseCents: 149, minuteCents: 12},
];

const SHIPMENTS = [
  {id: 'P101', destination: 'west', weightKg: 3, readyMinute: 540,
    deadline: 600, serviceMinutes: 4, kind: 'general', penaltyCents: 5000},
  {id: 'P102', destination: 'north', weightKg: 2, readyMinute: 540,
    deadline: 580, serviceMinutes: 5, kind: 'general', penaltyCents: 12000},
  {id: 'P103', destination: 'east', weightKg: 4, readyMinute: 540,
    deadline: 630, serviceMinutes: 6, kind: 'medical', penaltyCents: 8500},
  {id: 'P104', destination: 'ridge', weightKg: 7, readyMinute: 540,
    deadline: 645, serviceMinutes: 4, kind: 'battery', penaltyCents: 4800},
  {id: 'P105', destination: 'docks', weightKg: 2, readyMinute: 540,
    deadline: 610, serviceMinutes: 4, kind: 'general', penaltyCents: 4500},
  {id: 'P106', destination: 'hospital', weightKg: 3, readyMinute: 540,
    deadline: 600, serviceMinutes: 8, kind: 'medical', penaltyCents: 9500},
  {id: 'P107', destination: 'west', weightKg: 4, readyMinute: 555,
    deadline: 585, serviceMinutes: 5, kind: 'medical', penaltyCents: 22000, optional: true},
];

function compatible(courier, shipment) {
  return !(shipment.kind === 'medical' && !courier.coldChain) &&
    !(shipment.kind === 'battery' && !courier.batteries);
}

export function planDispatch(scenario, reserved = {shipments: [], couriers: []}) {
  const unavailableShipments = new Set(reserved.shipments);
  const unavailableCouriers = new Set([...reserved.couriers, ...scenario.disabledCouriers]);
  const closedRoads = new Set(scenario.closedRoads);
  const shipments = SHIPMENTS.filter(shipment =>
    (!shipment.optional || scenario.urgent) && !unavailableShipments.has(shipment.id));
  const couriers = COURIERS.filter(courier => !unavailableCouriers.has(courier.id));
  const roads = ROADS.filter(road => !closedRoads.has(road.id));
  const pathCache = new Map();

  function shortestPath(courier, from, to) {
    const key = `${courier.id}:${from}:${to}`;
    if (pathCache.has(key)) return pathCache.get(key);
    const pending = [{node: from, minutes: 0, nodes: [from], roadIds: []}];
    const visited = new Set();
    while (pending.length) {
      pending.sort((left, right) => left.minutes - right.minutes ||
        left.roadIds.join('|').localeCompare(right.roadIds.join('|')));
      const current = pending.shift();
      if (visited.has(current.node)) continue;
      visited.add(current.node);
      if (current.node === to) {
        pathCache.set(key, current);
        return current;
      }
      for (const road of roads) {
        if (road.bikeOnly && courier.mode !== 'bike') continue;
        const next = road.from === current.node ? road.to :
          road.to === current.node ? road.from : null;
        if (next === null || visited.has(next)) continue;
        pending.push({node: next,
          minutes: current.minutes + Math.ceil(road.minutes * courier.timeFactor),
          nodes: [...current.nodes, next], roadIds: [...current.roadIds, road.id]});
      }
    }
    pathCache.set(key, null);
    return null;
  }

  const subsetCount = 1 << shipments.length;
  const routeOptions = couriers.map(courier => {
    const best = Array(subsetCount).fill(null);

    function visit(node, minute, mask, loadKg, stops, nodes, roadIds) {
      if (mask) {
        const home = shortestPath(courier, node, DEPOT);
        if (home && minute + home.minutes - scenario.startMinute <= courier.shiftMinutes) {
          const returnMinute = minute + home.minutes;
          const costCents = courier.baseCents +
            (returnMinute - scenario.startMinute) * courier.minuteCents;
          const shipmentIds = stops.map(stop => stop.shipmentId);
          if (!best[mask] || costCents < best[mask].costCents ||
              (costCents === best[mask].costCents &&
               shipmentIds.join('|') < best[mask].shipmentIds.join('|'))) {
            best[mask] = {courierId: courier.id, shipmentIds, stops,
              nodes: [...nodes, ...home.nodes.slice(1)],
              roadIds: [...roadIds, ...home.roadIds], loadKg, returnMinute, costCents};
          }
        }
      }
      if (stops.length === courier.maxStops) return;
      for (let shipmentIndex = 0; shipmentIndex < shipments.length; shipmentIndex++) {
        const bit = 1 << shipmentIndex;
        const shipment = shipments[shipmentIndex];
        if ((mask & bit) || !compatible(courier, shipment) ||
            loadKg + shipment.weightKg > courier.capacityKg) continue;
        const path = shortestPath(courier, node, shipment.destination);
        if (!path) continue;
        const arrival = Math.max(minute + path.minutes, shipment.readyMinute);
        const departure = arrival + shipment.serviceMinutes;
        if (departure > shipment.deadline ||
            departure - scenario.startMinute > courier.shiftMinutes) continue;
        visit(shipment.destination, departure, mask | bit, loadKg + shipment.weightKg,
          [...stops, {shipmentId: shipment.id, node: shipment.destination, arrival, departure}],
          [...nodes, ...path.nodes.slice(1)], [...roadIds, ...path.roadIds]);
      }
    }

    visit(DEPOT, scenario.startMinute, 0, 0, [], [DEPOT], []);
    return best;
  });

  let states = new Map([[0, {cost: 0, routes: []}]]);
  for (const options of routeOptions) {
    const nextStates = new Map(states);
    for (const [usedMask, state] of states) {
      for (let routeMask = 1; routeMask < subsetCount; routeMask++) {
        const route = options[routeMask];
        if (!route || (usedMask & routeMask)) continue;
        const mask = usedMask | routeMask;
        const cost = state.cost + route.costCents;
        if (!nextStates.has(mask) || cost < nextStates.get(mask).cost) {
          nextStates.set(mask, {cost, routes: [...state.routes, route]});
        }
      }
    }
    states = nextStates;
  }

  let optimum = null;
  for (const [mask, state] of states) {
    const unassigned = [];
    let penaltyCents = 0;
    for (let shipmentIndex = 0; shipmentIndex < shipments.length; shipmentIndex++) {
      if (mask & (1 << shipmentIndex)) continue;
      penaltyCents += shipments[shipmentIndex].penaltyCents;
      unassigned.push({shipmentId: shipments[shipmentIndex].id,
        reason: 'Not served in the optimal feasible plan.'});
    }
    const objectiveCents = state.cost + penaltyCents;
    if (!optimum || objectiveCents < optimum.objectiveCents) {
      optimum = {routes: state.routes, unassigned,
        delivered: shipments.length - unassigned.length, totalShipments: shipments.length,
        routeCostCents: state.cost, penaltyCents, objectiveCents};
    }
  }
  return optimum;
}
