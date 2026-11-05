import { calculateQuote, parseParcel } from "@/lib/server-quote";
import { saveQuote } from "@/lib/quote-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Send JSON with Content-Type: application/json." }, { status: 415 });
  }
  if (Number(request.headers.get("content-length")) > 2048) {
    return Response.json({ error: "The quote request is too large." }, { status: 413 });
  }
  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Send a quote object." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2048) {
        await reader.cancel();
        return Response.json({ error: "The quote request is too large." }, { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    input = parseParcel(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    return Response.json({ error: error instanceof SyntaxError ? "Send valid JSON." : error instanceof Error ? error.message : "Invalid quote." }, { status: 400 });
  }
  let quote;
  try { quote = calculateQuote(input); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "This parcel is not eligible." }, { status: 422 }); }
  return Response.json(saveQuote(input, quote), { status: 201, headers: { "Cache-Control": "no-store" } });
}
