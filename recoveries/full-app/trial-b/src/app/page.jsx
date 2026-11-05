import DispatchBoard from './dispatch-board';
import model from '@/lib/fixture.json';
import {getPlan, validId} from '@/lib/store';
export const dynamic = 'force-dynamic';
export default async function Page({searchParams}) {
  const {plan} = await searchParams;
  const saved = validId(plan) ? getPlan(plan) : null;
  return <DispatchBoard model={model} initialSaved={saved} initialError={plan && !saved ? 'Saved plan not found. Create a new plan.' : ''}/>;
}
