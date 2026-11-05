import { readDispatch, commitDispatch, DispatchConflict } from "@/lib/dispatch-store";
import { validId } from "@/lib/dispatch-request";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const respond = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const saved = validId(id) ? readDispatch(id) : null;
  return saved ? respond(saved) : respond({ error: "Plan not found. Create a new plan." }, 404);
}
export async function POST(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!validId(id)) return respond({ error: "Plan not found. Create a new plan." }, 404);
  try {
    const saved = commitDispatch(id);
    return saved ? respond(saved) : respond({ error: "Plan not found. Create a new plan." }, 404);
  } catch (error) {
    if (error instanceof DispatchConflict) return respond({ error: error.message }, 409);
    throw error;
  }
}
