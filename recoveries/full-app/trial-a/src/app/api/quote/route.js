import {validateParcel, calculateQuote} from '../../../lib/quote';
import {saveQuote} from '../../../lib/storage';
export const runtime = 'nodejs';
export async function POST(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return Response.json({error: 'Send JSON with Content-Type: application/json.'}, {status: 415});
  if (Number(request.headers.get('content-length')) > 2048) return Response.json({error: 'The quote request is too large.'}, {status: 413});
  let parcel;
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({error: 'Send a quote object.'}, {status: 400});
    const chunks = [];
    let size = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > 2048) {await reader.cancel(); return Response.json({error: 'The quote request is too large.'}, {status: 413});}
      chunks.push(result.value);
    }
    parcel = validateParcel(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch (error) {return Response.json({error: error instanceof SyntaxError ? 'Send valid JSON.' : error instanceof Error ? error.message : 'Invalid quote.'}, {status: 400});}
  let quote;
  try {quote = calculateQuote(parcel);} catch (error) {return Response.json({error: error instanceof Error ? error.message : 'This parcel is not eligible.'}, {status: 422});}
  return Response.json(saveQuote(parcel, quote), {status: 201, headers: {'Cache-Control': 'no-store'}});
}
