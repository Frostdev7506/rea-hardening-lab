import model from './fixture.json';
import {validId} from './store';

export class RequestError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export async function readJson(request, quote = false) {
  const contentType = request.headers.get('content-type');
  if (quote ? !contentType?.toLowerCase().startsWith('application/json') : contentType?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new RequestError('Send JSON with Content-Type: application/json.', 415);
  const tooLarge = quote ? 'The quote request is too large.' : 'The planning request exceeds 2 KiB.';
  if (quote && Number(request.headers.get('content-length')) > 2048) throw new RequestError(tooLarge, 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(quote ? 'Send a quote object.' : 'Send a request body.');
  const chunks = [];
  let size = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); throw new RequestError(tooLarge, 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new RequestError('Send valid JSON.'); }
}
export function validatePlan(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw Error('Send a dispatch request.');
  if (Object.keys(request).some(key => !['batchId', 'scenario'].includes(key))) throw Error('The request contains an unknown field.');
  if (request.batchId !== null && !validId(request.batchId)) throw Error('Choose a valid batch.');
  const scenario = request.scenario;
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) throw Error('Choose a planning scenario.');
  if (Object.keys(scenario).some(key => !['disabledCouriers', 'closedRoads', 'startMinute', 'urgent'].includes(key))) throw Error('The scenario contains an unknown field.');
  function checkList(list, allowed, name) {
    if (!Array.isArray(list) || list.length > allowed.length || list.some(value => typeof value !== 'string' || !allowed.includes(value)) || new Set(list).size !== list.length) throw Error(`Choose valid ${name}.`);
    return list;
  }
  const disabledCouriers = checkList(scenario.disabledCouriers, model.couriers.map(courier => courier.id), 'couriers');
  const closedRoads = checkList(scenario.closedRoads, model.roads.map(road => road.id), 'roads');
  if (typeof scenario.startMinute !== 'number' || !Number.isInteger(scenario.startMinute) || scenario.startMinute < 480 || scenario.startMinute > 720 || typeof scenario.urgent !== 'boolean') throw Error('Choose a start time between 08:00 and 12:00 UTC and an urgent-delivery option.');
  return {batchId: request.batchId, scenario: {disabledCouriers, closedRoads, startMinute: scenario.startMinute, urgent: scenario.urgent}};
}
export const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
