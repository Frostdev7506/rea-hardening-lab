import {validId, getQuote, bookQuote} from '@/lib/store';
import {json} from '@/lib/requests';
export const runtime = 'nodejs';
const missing = () => json({error: 'Quote not found. Calculate a new quote.'}, 404);
export async function GET(request, context) {
  const {id} = await context.params;
  const quote = validId(id) ? getQuote(id) : null;
  return quote ? json(quote) : missing();
}
export async function POST(request, context) {
  const {id} = await context.params;
  const quote = validId(id) ? getQuote(id) : null;
  if (!quote) return missing();
  const expired = () => json({error: 'This quote expired. Calculate a new quote.'}, 410);
  if (quote.state !== 'booked' && Date.parse(quote.expiresAt) <= Date.now()) return expired();
  const booked = bookQuote(id);
  return booked?.state === 'booked' ? json(booked) : expired();
}
