import {validId} from '../../../../lib/planner';
import {getPlan, commitPlan, Conflict} from '../../../../lib/storage';
import {json} from '../../../../lib/http';
export const runtime = 'nodejs';
const missing = () => json({error: 'Plan not found. Create a new plan.'}, 404);
export async function GET(request, context) {
  const {id} = await context.params;
  const saved = validId(id) ? getPlan(id) : null;
  return saved ? json(saved) : missing();
}
export async function POST(request, context) {
  const {id} = await context.params;
  if (!validId(id)) return missing();
  try {const saved = commitPlan(id); return saved ? json(saved) : missing();}
  catch (error) {if (error instanceof Conflict) return json({error: error.message}, 409); throw error;}
}
