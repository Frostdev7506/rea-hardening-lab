import {planDispatch, validatePlanning} from '../../../lib/planner';
import {reservedShipments, reservedCouriers, savePlan} from '../../../lib/storage';
import {readPlanning, RequestError} from '../../../lib/http';
export const runtime = 'nodejs';
export async function POST(request) {
  let input;
  try {input = validatePlanning(await readPlanning(request));}
  catch (error) {return Response.json({error: error instanceof Error ? error.message : 'Check the planning request.'}, {status: error instanceof RequestError ? error.status : 400});}
  const shipments = input.batchId ? reservedShipments(input.batchId) : [];
  const couriers = input.batchId ? reservedCouriers(input.batchId) : [];
  return Response.json(savePlan(input.batchId, input.scenario, planDispatch(input.scenario, shipments, couriers)), {status: 201, headers: {'Cache-Control': 'no-store'}});
}
