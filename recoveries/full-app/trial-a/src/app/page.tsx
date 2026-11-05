import DispatchBoard from './DispatchBoard';
import {getPlan} from '../lib/storage';
import {validId} from '../lib/planner';
export const dynamic = 'force-dynamic';
export default async function Page({searchParams}: {searchParams: Promise<{plan?: string}>}) {
  const {plan} = await searchParams;
  const saved = plan && validId(plan) ? getPlan(plan) : null;
  return <DispatchBoard initialSaved={saved} initialError={plan && !saved ? 'Saved plan not found. Create a new plan.' : ''}/>;
}
