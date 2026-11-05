import { readQuote, bookQuote } from "@/lib/quote-store";

export const runtime = "nodejs";
async function find(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) ? readQuote(id) : null;
}
const respond = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const quote = await find(context);
  return quote ? respond(quote) : respond({ error: "Quote not found. Calculate a new quote." }, 404);
}
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const quote = await find(context);
  if (!quote) return respond({ error: "Quote not found. Calculate a new quote." }, 404);
  if (quote.state !== "booked" && Date.parse(quote.expiresAt) <= Date.now()) return respond({ error: "This quote expired. Calculate a new quote." }, 410);
  const booked = bookQuote(quote.id);
  return booked?.state === "booked" ? respond(booked) : respond({ error: "This quote expired. Calculate a new quote." }, 410);
}
