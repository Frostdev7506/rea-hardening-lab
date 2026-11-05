export class RequestError extends Error {
  constructor(message, status) {super(message); this.status = status;}
}
export const json = (payload, status = 200) => Response.json(payload, {status, headers: {'Cache-Control': 'no-store'}});
export async function readPlanning(request) {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new RequestError('Send JSON with Content-Type: application/json.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Send a request body.', 400);
  const chunks = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > 2048) {await reader.cancel(); throw new RequestError('The planning request exceeds 2 KiB.', 413);}
    chunks.push(result.value);
  }
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw new RequestError('Send valid JSON.', 400);}
}
