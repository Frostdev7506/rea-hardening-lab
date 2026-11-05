const depot = 'depot';

const roads = [
  {id: 'depot-west', from: depot, to: 'west', minutes: 12},
  {id: 'depot-central', from: depot, to: 'central', minutes: 14},
  {id: 'west-north', from: 'west', to: 'north', minutes: 16},
  {id: 'north-central', from: 'north', to: 'central', minutes: 9},
  {id: 'central-east', from: 'central', to: 'east', minutes: 17},
  {id: 'river-bridge', from: 'central', to: 'ridge', minutes: 8},
  {id: 'central-hospital', from: 'central', to: 'hospital', minutes: 18},
  {id: 'hospital-ridge', from: 'hospital', to: 'ridge', minutes: 12},
  {id: 'ridge-east', from: 'ridge', to: 'east', minutes: 11},
  {id: 'depot-docks', from: depot, to: 'docks', minutes: 13},
  {id: 'docks-hospital', from: 'docks', to: 'hospital', minutes: 20},
  {id: 'north-east-trail', from: 'north', to: 'east', minutes: 9, bikeOnly: true}
];

const couriers = [
  {id: 'sprinter', mode: 'van', capacityKg: 18, maxStops: 4, shiftMinutes: 120,
    coldChain: false, batteries: true, timeFactor: 1, baseCents: 317, minuteCents: 18},
  {id: 'coldbox', mode: 'van', capacityKg: 10, maxStops: 3, shiftMinutes: 110,
    coldChain: true, batteries: false, timeFactor: 1.05, baseCents: 683, minuteCents: 23},
  {id: 'cargo', mode: 'bike', capacityKg: 5, maxStops: 2, shiftMinutes: 100,
    coldChain: false, batteries: false, timeFactor: 1.3, baseCents: 149, minuteCents: 12}
];

const shipments = [
  {id: 'P101', destination: 'west', weightKg: 3, readyMinute: 540, deadline: 600,
    serviceMinutes: 4, kind: 'general', penaltyCents: 5000},
  {id: 'P102', destination: 'north', weightKg: 2, readyMinute: 540, deadline: 580,
    serviceMinutes: 5, kind: 'general', penaltyCents: 12000},
  {id: 'P103', destination: 'east', weightKg: 4, readyMinute: 540, deadline: 630,
    serviceMinutes: 6, kind: 'medical', penaltyCents: 8500},
  {id: 'P104', destination: 'ridge', weightKg: 7, readyMinute: 540, deadline: 645,
    serviceMinutes: 4, kind: 'battery', penaltyCents: 4800},
  {id: 'P105', destination: 'docks', weightKg: 2, readyMinute: 540, deadline: 610,
    serviceMinutes: 4, kind: 'general', penaltyCents: 4500},
  {id: 'P106', destination: 'hospital', weightKg: 3, readyMinute: 540, deadline: 600,
    serviceMinutes: 8, kind: 'medical', penaltyCents: 9500},
  {id: 'P107', destination: 'west', weightKg: 4, readyMinute: 555, deadline: 585,
    serviceMinutes: 5, kind: 'medical', penaltyCents: 22000, optional: true}
];

function shortestPath(from, to, courier, activeRoads, cache) {
  const key = `${courier.id}:${from}:${to}`;
  if (cache.has(key)) return cache.get(key);
  const pending = [{node: from, minutes: 0, nodes: [from], roadIds: []}];
  const visited = new Set();
  while (pending.length) {
    pending.sort((left, right) => left.minutes - right.minutes ||
      left.roadIds.join('|').localeCompare(right.roadIds.join('|')));
    const path = pending.shift();
    if (visited.has(path.node)) continue;
    visited.add(path.node);
    if (path.node === to) {
      cache.set(key, path);
      return path;
    }
    for (const road of activeRoads) {
      if (road.bikeOnly && courier.mode !== 'bike') continue;
      const next = road.from === path.node ? road.to : road.to === path.node ? road.from : null;
      if (next === null || visited.has(next)) continue;
      pending.push({
        node: next,
        minutes: path.minutes + Math.ceil(road.minutes * courier.timeFactor),
        nodes: [...path.nodes, next],
        roadIds: [...path.roadIds, road.id]
      });
    }
  }
  cache.set(key, null);
  return null;
}

function enumerateRoutes(courier, activeShipments, activeRoads, startMinute, cache) {
  const best = new Map();
  function visit(node, minute, mask, loadKg, stops, nodes, roadIds) {
    if (mask) {
      const home = shortestPath(node, depot, courier, activeRoads, cache);
      if (home && minute + home.minutes - startMinute <= courier.shiftMinutes) {
        const returnMinute = minute + home.minutes;
        const costCents = courier.baseCents + (returnMinute - startMinute) * courier.minuteCents;
        const previous = best.get(mask);
        const shipmentIds = stops.map(stop => stop.shipmentId);
        if (!previous || costCents < previous.costCents ||
            costCents === previous.costCents && shipmentIds.join('|') < previous.shipmentIds.join('|')) {
          best.set(mask, {
            courierId: courier.id, shipmentIds, stops,
            nodes: [...nodes, ...home.nodes.slice(1)],
            roadIds: [...roadIds, ...home.roadIds], loadKg, returnMinute, costCents
          });
        }
      }
    }
    if (stops.length === courier.maxStops) return;
    for (let index = 0; index < activeShipments.length; index++) {
      const shipment = activeShipments[index];
      const bit = 1 << index;
      if (mask & bit || loadKg + shipment.weightKg > courier.capacityKg ||
          shipment.kind === 'medical' && !courier.coldChain ||
          shipment.kind === 'battery' && !courier.batteries) continue;
      const path = shortestPath(node, shipment.destination, courier, activeRoads, cache);
      if (!path) continue;
      const arrival = Math.max(minute + path.minutes, shipment.readyMinute);
      const departure = arrival + shipment.serviceMinutes;
      if (departure > shipment.deadline || departure - startMinute > courier.shiftMinutes) continue;
      visit(shipment.destination, departure, mask | bit, loadKg + shipment.weightKg,
        [...stops, {shipmentId: shipment.id, node: shipment.destination, arrival, departure}],
        [...nodes, ...path.nodes.slice(1)], [...roadIds, ...path.roadIds]);
    }
  }
  visit(depot, startMinute, 0, 0, [], [depot], []);
  return best;
}

export function planDispatch(scenario, reserved = {shipments: [], couriers: []}) {
  const activeShipments = shipments.filter(shipment =>
    (!shipment.optional || scenario.urgent) && !reserved.shipments.includes(shipment.id));
  const activeCouriers = couriers.filter(courier =>
    !scenario.disabledCouriers.includes(courier.id) && !reserved.couriers.includes(courier.id));
  const activeRoads = roads.filter(road => !scenario.closedRoads.includes(road.id));
  const cache = new Map();
  const routeTables = activeCouriers.map(courier =>
    enumerateRoutes(courier, activeShipments, activeRoads, scenario.startMinute, cache));
  let states = new Map([[0, {cost: 0, routes: []}]]);
  for (const routes of routeTables) {
    const nextStates = new Map(states);
    for (const [covered, state] of states) {
      for (const [mask, route] of routes) {
        if (covered & mask) continue;
        const combined = covered | mask;
        const cost = state.cost + route.costCents;
        if (!nextStates.has(combined) || cost < nextStates.get(combined).cost) {
          nextStates.set(combined, {cost, routes: [...state.routes, route]});
        }
      }
    }
    states = nextStates;
  }
  let optimal;
  for (const [covered, state] of states) {
    const missed = activeShipments.filter((shipment, index) => !(covered & 1 << index));
    const penalty = missed.reduce((sum, shipment) => sum + shipment.penaltyCents, 0);
    const objective = state.cost + penalty;
    if (!optimal || objective < optimal.objectiveCents) {
      optimal = {
        routes: state.routes,
        unassigned: missed.map(shipment => ({shipmentId: shipment.id, reason: 'Not served in the optimal feasible plan.'})),
        delivered: activeShipments.length - missed.length,
        totalShipments: activeShipments.length,
        routeCostCents: state.cost,
        penaltyCents: penalty,
        objectiveCents: objective
      };
    }
  }
  return optimal;
}
