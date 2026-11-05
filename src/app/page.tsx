import "server-only";
import { publicDispatchModel } from "@/lib/dispatch-fixture";
import { readDispatch } from "@/lib/dispatch-store";
import { validId } from "@/lib/dispatch-request";
import { DispatchBoard } from "./dispatch-board";

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const saved = plan && validId(plan) ? readDispatch(plan) : null;
  return <DispatchBoard model={publicDispatchModel()} initialSaved={saved} initialError={plan && !saved ? "Saved plan not found. Create a new plan." : ""} />;
}
