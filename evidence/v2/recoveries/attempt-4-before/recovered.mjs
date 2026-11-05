const DEPOT = 'depot';

const ROADS = [
  { id: 'depot-west', from: 'depot', to: 'west', minutes: 12 },
  { id: 'depot-central', from: 'depot', to: 'central', minutes: 14 },
  { id: 'west-north', from: 'west', to: 'north', minutes: 16 },
  { id: 'north-central', from: 'north', to: 'central', minutes: 9 },
  { id: 'central-east', from: 'central', to: 'east', minutes: 17 },
  { id: 'river-bridge', from: 'central', to: 'ridge', minutes: 8 },
  { id: 'central-hospital', from: 'central', to: 'hospital', minutes: 18 },
  { id: 'hospital-ridge', from: 'hospital', to: 'ridge', minutes: 12 },
  { id: 'ridge-east', from: 'ridge', to: 'east', minutes: 11 },
  { id: 'depot-docks', from: 'depot', to: 'docks', minutes: 13 },
  { id: 'docks-hospital', from: 'docks', to: 'hospital', minutes: 20 },
  { id: 'north-east-trail', from: 'north', to: 'east', minutes: 9, bikeOnly: true },
];

const COURIERS = [
  { id: 'sprinter', mode: 'van', capacityKg: 18, maxStops: 4, shiftMinutes: 120, coldChain: false, batteries: true, timeFactor: 1, baseCents: 317, minuteCents: 18 },
  { id: 'coldbox', mode: 'van', capacityKg: 10, maxStops: 3, shiftMinutes: 110, coldChain: true, batteries: false, timeFactor: 1.05, baseCents: 683, minuteCents: 23 },
  { id: 'cargo', mode: 'bike', capacityKg: 5, maxStops: 2, shiftMinutes: 100, coldChain: false, batteries: false, timeFactor: 1.3, baseCents: 149, minuteCents: 12 },
];

const SHIPMENTS = [
  { id: 'P101', destination: 'west', weightKg: 3, readyMinute: 540, deadline: 600, serviceMinutes: 4, kind: 'general', penaltyCents: 5000 },
  { id: 'P102', destination: 'north', weightKg: 2, readyMinute: 540, deadline: 580, serviceMinutes: 5, kind: 'general', penaltyCents: 12000 },
  { id: 'P103', destination: 'east', weightKg: 4, readyMinute: 540, deadline: 630, serviceMinutes: 6, kind: 'medical', penaltyCents: 8500 },
  { id: 'P104', destination: 'ridge', weightKg: 7, readyMinute: 540, deadline: 645, serviceMinutes: 4, kind: 'battery', penaltyCents: 4800 },
  { id: 'P105', destination: 'docks', weightKg: 2, readyMinute: 540, deadline: 610, serviceMinutes: 4, kind: 'general', penaltyCents: 4500 },
  { id: 'P106', destination: 'hospital', weightKg: 3, readyMinute: 540, deadline: 600, serviceMinutes: 8, kind: 'medical', penaltyCents: 9500 },
  { id: 'P107', destination: 'west', weightKg: 4, readyMinute: 555, deadline: 585, serviceMinutes: 5, kind: 'medical', penaltyCents: 22000, optional: true },
];

export function planDispatch(scenario, reserved = { shipments: [], couriers: [] }) {
  const shipments = SHIPMENTS.filter(shipment =>
    (!shipment.optional || scenario.urgent) && !reserved.shipments.includes(shipment.id));
  const couriers = COURIERS.filter(courier =>
    !scenario.disabledCouriers.includes(courier.id) && !reserved.couriers.includes(courier.id));
  const roads = ROADS.filter(road => !scenario.closedRoads.includes(road.id));
  const pathCache = new Map();
  const routeCache = new Map();

  function shortestPath(from, to, courier) {
    const key = `${courier.id}:${from}:${to}`;
    if (pathCache.has(key)) return pathCache.get(key);
    const queue = [{ node: from, minutes: 0, nodes: [from], roadIds: [] }];
    const visited = new Set();
    while (queue.length) {
      queue.sort((left, right) => left.minutes - right.minutes ||
        left.roadIds.join('|').localeCompare(right.roadIds.join('|')));
      const current = queue.shift();
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
        if (next && !visited.has(next)) {
          queue.push({
            node: next,
            minutes: current.minutes + Math.ceil(road.minutes * courier.timeFactor),
            nodes: [...current.nodes, next],
            roadIds: [...current.roadIds, road.id],
          });
        }
      }
    }
    pathCache.set(key, null);
    return null;
  }

  function bestRoute(courier, mask) {
    const key = `${courier.id}:${mask}`;
    if (routeCache.has(key)) return routeCache.get(key);
    const assigned = shipments.filter((shipment, index) => (mask & (1 << index)) !== 0);
    const loadKg = assigned.reduce((total, shipment) => total + shipment.weightKg, 0);
    if (loadKg > courier.capacityKg || assigned.length > courier.maxStops ||
        assigned.some(shipment =>
          (shipment.kind === 'medical' && !courier.coldChain) ||
          (shipment.kind === 'battery' && !courier.batteries))) {
      routeCache.set(key, null);
      return null;
    }
    let best = null;

    function visit(node, minute, remaining, stops, nodes, roadIds) {
      if (!remaining.length) {
        const home = shortestPath(node, DEPOT, courier);
        if (!home || minute + home.minutes - scenario.startMinute > courier.shiftMinutes) return;
        const returnMinute = minute + home.minutes;
        const route = {
          courierId: courier.id,
          shipmentIds: stops.map(stop => stop.shipmentId),
          stops,
          nodes: [...nodes, ...home.nodes.slice(1)],
          roadIds: [...roadIds, ...home.roadIds],
          loadKg,
          returnMinute,
          costCents: courier.baseCents + (returnMinute - scenario.startMinute) * courier.minuteCents,
        };
        if (!best || route.costCents < best.costCents ||
            (route.costCents === best.costCents &&
             route.shipmentIds.join('|') < best.shipmentIds.join('|'))) best = route;
        return;
      }
      for (const shipment of remaining) {
        const path = shortestPath(node, shipment.destination, courier);
        if (!path) continue;
        const arrival = Math.max(minute + path.minutes, shipment.readyMinute);
        const departure = arrival + shipment.serviceMinutes;
        if (departure > shipment.deadline || departure - scenario.startMinute > courier.shiftMinutes) continue;
        visit(
          shipment.destination,
          departure,
          remaining.filter(other => other.id !== shipment.id),
          [...stops, { shipmentId: shipment.id, node: shipment.destination, arrival, departure }],
          [...nodes, ...path.nodes.slice(1)],
          [...roadIds, ...path.roadIds],
        );
      }
    }

    visit(DEPOT, scenario.startMinute, assigned, [], [DEPOT], []);
    routeCache.set(key, best);
    return best;
  }

  let best = {
    routes: [],
    missed: shipments.map((shipment, index) => index),
    penalty: shipments.reduce((total, shipment) => total + shipment.penaltyCents, 0),
    cost: 0,
    signature: '~',
  };

  function assign(index, masks, missed, penalty) {
    if (penalty > best.cost + best.penalty) return;
    if (index === shipments.length) {
      const routes = couriers.flatMap((courier, courierIndex) =>
        masks[courierIndex] ? [bestRoute(courier, masks[courierIndex])] : []);
      const cost = routes.reduce((total, route) => total + route.costCents, 0);
      const signature = routes.map(route => `${route.courierId}:${route.shipmentIds.join(',')}`).join('|');
      if (cost + penalty < best.cost + best.penalty ||
          (cost + penalty === best.cost + best.penalty && signature < best.signature)) {
        best = { routes, missed: [...missed], penalty, cost, signature };
      }
      return;
    }
    for (let courierIndex = 0; courierIndex < couriers.length; courierIndex++) {
      const mask = masks[courierIndex] | (1 << index);
      if (!bestRoute(couriers[courierIndex], mask)) continue;
      const nextMasks = [...masks];
      nextMasks[courierIndex] = mask;
      assign(index + 1, nextMasks, missed, penalty);
    }
    assign(index + 1, masks, [...missed, index], penalty + shipments[index].penaltyCents);
  }

  assign(0, couriers.map(() => 0), [], 0);
  return {
    routes: best.routes,
    unassigned: best.missed.map(index => ({
      shipmentId: shipments[index].id,
      reason: couriers.some(courier => bestRoute(courier, 1 << index))
        ? 'No slot in the lowest-cost feasible plan.'
        : 'No active courier can meet this shipment’s limits.',
    })),
    delivered: shipments.length - best.missed.length,
    totalShipments: shipments.length,
    routeCostCents: best.cost,
    penaltyCents: best.penalty,
    objectiveCents: best.cost + best.penalty,
  };
}
