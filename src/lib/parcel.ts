export type Parcel = {
  weight: number;
  length: number;
  width: number;
  height: number;
  zone: "local" | "national" | "remote";
  express: boolean;
  item: "general" | "fragile" | "battery";
  insured: boolean;
  declaredValue: number;
  promo: string;
  dispatchAt: string;
};

export function parseParcel(value: unknown): Parcel {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Send a parcel object.");
  const input = value as Record<string, unknown>;
  const fields = ["weight", "length", "width", "height", "zone", "express", "item", "insured", "declaredValue", "promo", "dispatchAt"];
  if (Object.keys(input).some((key) => !fields.includes(key))) throw new Error("The parcel contains an unknown field.");
  for (const [key, max] of [["weight", 20], ["length", 120], ["width", 120], ["height", 120], ["declaredValue", 10000]] as const) {
    if (typeof input[key] !== "number" || !Number.isFinite(input[key]) || input[key] <= 0 || input[key] > max) throw new Error(`Choose ${key} above 0 and up to ${max}.`);
  }
  if (input.zone !== "local" && input.zone !== "national" && input.zone !== "remote") throw new Error("Choose a local, national, or remote destination.");
  if (input.item !== "general" && input.item !== "fragile" && input.item !== "battery") throw new Error("Choose a supported parcel contents category.");
  if (typeof input.express !== "boolean" || typeof input.insured !== "boolean" || typeof input.promo !== "string" || input.promo.length > 40) throw new Error("Check the service, insurance, and promo code.");
  if (typeof input.dispatchAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(input.dispatchAt) || !Number.isFinite(Date.parse(input.dispatchAt)) || new Date(input.dispatchAt).toISOString().slice(0, 19) + "Z" !== input.dispatchAt) throw new Error("Choose a valid dispatch date and time in UTC.");
  return { ...input, promo: input.promo.trim().toUpperCase() } as Parcel;
}

// This improves the form; the server repeats it before calculating a price.
export function assessParcel(parcel: Parcel) {
  const dimensionalWeight = parcel.length * parcel.width * parcel.height / 5000;
  const billableWeight = Math.ceil(Math.max(parcel.weight, dimensionalWeight) * 2) / 2;
  const reasons: string[] = [];
  if (billableWeight > 20) reasons.push("The billable weight exceeds 20 kg.");
  if (parcel.zone === "remote" && (billableWeight > 15 || Math.max(parcel.length, parcel.width, parcel.height) > 100)) reasons.push("This parcel exceeds the remote route limit.");
  if (parcel.item === "battery" && (parcel.zone === "remote" || parcel.express)) reasons.push("Battery parcels need a local or national standard service.");
  if (parcel.item === "fragile" && !parcel.insured) reasons.push("Fragile parcels require insurance.");
  if (parcel.express && billableWeight > 12) reasons.push("Express service allows up to 12 billable kg.");
  if (parcel.declaredValue > 2500 && !parcel.insured) reasons.push("Parcels valued above $2,500 require insurance.");
  return { eligible: reasons.length === 0, billableWeight, reasons };
}
