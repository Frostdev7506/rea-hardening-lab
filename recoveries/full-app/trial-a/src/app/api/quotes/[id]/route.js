import {validId} from '../../../../lib/planner';
import {getQuote, bookQuote} from '../../../../lib/storage';
import {json} from '../../../../lib/http';
export const runtime = 'nodejs';
const missing = () => json({error: 'Quote not found. Calculate a new quote.'}, 404);
const expired = () => json({error: 'This quote expired. Calculate a new quote.'}, 410);
export async function GET(request, context) {
  const {id} = await context.params;
  const saved = validId(id) ? getQuote(id) : null;
  return saved ? json(saved) : missing();
}
export async function POST(request, context) {
  const {id} = await context.params;
  const saved = validId(id) ? getQuote(id) : null;
  if (!saved) return missing();
  if (saved.state !== 'booked' && Date.parse(saved.expiresAt) <= Date.now()) return expired();
  const booked = bookQuote(id);
  return booked?.state === 'booked' ? json(booked) : expired();
}
