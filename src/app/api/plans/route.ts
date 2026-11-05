import "server-only";
import { dispatchModel } from "@/lib/dispatch-fixture";
import { planDispatch } from "@/lib/dispatch-engine";
import { parseDispatchRequest } from "@/lib/dispatch-request";
import { reservedShipments, reservedCouriers, saveDispatch } from "@/lib/dispatch-store";
import { readRequestJson, RequestError } from "@/lib/request-json";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let input;
  try { input = parseDispatchRequest(await readRequestJson(request)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Check the planning request." }, { status: error instanceof RequestError ? error.status : 400 }); }
  const reserved = new Set(input.batchId ? reservedShipments(input.batchId) : []);
  const usedCouriers = new Set(input.batchId ? reservedCouriers(input.batchId) : []);
  const model = { ...dispatchModel, shipments: dispatchModel.shipments.filter((shipment) => !reserved.has(shipment.id)), couriers: dispatchModel.couriers.filter((courier) => !usedCouriers.has(courier.id)) };
  const plan = planDispatch(model, input.scenario);
  return Response.json(saveDispatch(input.batchId, input.scenario, plan), { status: 201, headers: { "Cache-Control": "no-store" } });
}
