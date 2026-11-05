import type { DispatchScenario } from "./dispatch-types.ts";
import { dispatchModel } from "./dispatch-fixture.ts";

export const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
export function parseDispatchRequest(value: unknown): { batchId: string | null; scenario: DispatchScenario } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Send a dispatch request.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["batchId", "scenario"].includes(key))) throw new Error("The request contains an unknown field.");
  if (input.batchId !== null && (typeof input.batchId !== "string" || !validId(input.batchId))) throw new Error("Choose a valid batch.");
  if (!input.scenario || typeof input.scenario !== "object" || Array.isArray(input.scenario)) throw new Error("Choose a planning scenario.");
  const scenario = input.scenario as Record<string, unknown>;
  if (Object.keys(scenario).some((key) => !["disabledCouriers", "closedRoads", "startMinute", "urgent"].includes(key))) throw new Error("The scenario contains an unknown field.");
  function ids(value: unknown, allowed: string[], label: string): string[] {
    if (!Array.isArray(value) || value.length > allowed.length || value.some((id) => typeof id !== "string" || !allowed.includes(id)) || new Set(value).size !== value.length) throw new Error(`Choose valid ${label}.`);
    return value;
  }
  const disabledCouriers = ids(scenario.disabledCouriers, dispatchModel.couriers.map((item) => item.id), "couriers");
  const closedRoads = ids(scenario.closedRoads, dispatchModel.roads.map((item) => item.id), "roads");
  if (typeof scenario.startMinute !== "number" || !Number.isInteger(scenario.startMinute) || scenario.startMinute < 480 || scenario.startMinute > 720 || typeof scenario.urgent !== "boolean") throw new Error("Choose a start time between 08:00 and 12:00 UTC and an urgent-delivery option.");
  return { batchId: input.batchId as string | null, scenario: { disabledCouriers, closedRoads, startMinute: scenario.startMinute, urgent: scenario.urgent } };
}
