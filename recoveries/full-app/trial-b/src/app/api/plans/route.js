import model from '@/lib/fixture.json';
import {calculatePlan} from '@/lib/planner';
import {savePlan, reservedShipments, reservedCouriers} from '@/lib/store';
import {readJson, validatePlan, RequestError, json} from '@/lib/requests';
export const runtime = 'nodejs';
export async function POST(request) {
  let input;
  try { input = validatePlan(await readJson(request)); }
  catch (error) { return Response.json({error: error instanceof Error ? error.message : 'Check the planning request.'}, {status: error instanceof RequestError ? error.status : 400}); }
  const shipments = new Set(input.batchId ? reservedShipments(input.batchId) : []);
  const couriers = new Set(input.batchId ? reservedCouriers(input.batchId) : []);
  const plan = calculatePlan({...model, shipments: model.shipments.filter(shipment => !shipments.has(shipment.id)), couriers: model.couriers.filter(courier => !couriers.has(courier.id))}, input.scenario);
  return json(savePlan(input.batchId, input.scenario, plan), 201);
}
