import {readJson, RequestError, json} from '@/lib/requests';
import {validateParcel, calculateQuote} from '@/lib/quote';
import {saveQuote} from '@/lib/store';
export const runtime = 'nodejs';
export async function POST(request) {
  let parcel;
  try { parcel = validateParcel(await readJson(request, true)); }
  catch (error) { return Response.json({error: error instanceof Error ? error.message : 'Invalid quote.'}, {status: error instanceof RequestError ? error.status : 400}); }
  let quote;
  try { quote = calculateQuote(parcel); }
  catch (error) { return Response.json({error: error instanceof Error ? error.message : 'This parcel is not eligible.'}, {status: 422}); }
  return json(saveQuote(parcel, quote), 201);
}
