export class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function readRequestJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new RequestError("Send JSON with Content-Type: application/json.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("Send a request body.", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.byteLength;
    if (length > 2048) { await reader.cancel(); throw new RequestError("The planning request exceeds 2 KiB.", 413); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new RequestError("Send valid JSON.", 400); }
}
