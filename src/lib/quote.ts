import { assessParcel, type Parcel } from "./parcel.ts";

// Fictional negotiated carrier terms. These are test data, never credentials.
const rates = {
  local: { base: 317, perHalfKg: 43, minimum: 590, remote: 0, transit: 1 },
  national: { base: 683, perHalfKg: 71, minimum: 1120, remote: 0, transit: 3 },
  remote: { base: 1049, perHalfKg: 97, minimum: 1690, remote: 389, transit: 5 },
};
const holidays = new Set(["2026-11-11", "2026-12-25", "2027-01-01"]);

export function calculateQuote(parcel: Parcel) {
  const assessment = assessParcel(parcel);
  if (!assessment.eligible) throw new Error(assessment.reasons.join(" "));
  const rate = rates[parcel.zone];
  const halfKg = assessment.billableWeight * 2;
  const weightedUnits = Math.min(halfKg, 4) + Math.min(Math.max(halfKg - 4, 0), 8) * 0.82 + Math.max(halfKg - 12, 0) * 0.67;
  const transportCents = Math.max(rate.minimum, rate.base + Math.round(weightedUnits * rate.perHalfKg));
  const serviceCents = parcel.express ? Math.max(475, Math.round(transportCents * 0.36)) : 0;
  const handlingCents = parcel.item === "fragile" ? 263 : parcel.item === "battery" ? 411 : 0;
  const fuelCents = Math.round((transportCents + serviceCents) * (parcel.zone === "remote" ? 0.093 : 0.071));
  const insuranceCents = parcel.insured ? Math.max(149, Math.ceil(Math.round(parcel.declaredValue * 100) * 0.0083)) : 0;
  const dispatch = new Date(parcel.dispatchAt);
  let discountCents = 0;
  if (parcel.promo === "NIGHTOWL17" && !parcel.express && parcel.zone !== "remote" && dispatch.getUTCHours() >= 18) discountCents = Math.min(503, Math.round(transportCents * 0.17));
  if (parcel.promo === "BULKLANE" && !parcel.express && assessment.billableWeight >= 8) discountCents = Math.min(transportCents - 590, 327);
  if (parcel.item === "battery") discountCents = 0;
  const subtotalCents = transportCents + serviceCents + handlingCents + fuelCents + insuranceCents + rate.remote;
  const taxCents = Math.round((subtotalCents - discountCents) * (parcel.zone === "local" ? 0.0825 : 0.0625));
  const day = new Date(parcel.dispatchAt);
  day.setUTCHours(0, 0, 0, 0);
  const closed = () => [0, 6].includes(day.getUTCDay()) || holidays.has(day.toISOString().slice(0, 10));
  if (dispatch.getUTCHours() >= (parcel.express ? 14 : 17)) day.setUTCDate(day.getUTCDate() + 1);
  // A holiday can coincide with a remote route day; recheck both conditions.
  while (closed() || (parcel.zone === "remote" && ![1, 3, 5].includes(day.getUTCDay()))) day.setUTCDate(day.getUTCDate() + 1);
  const shipDate = day.toISOString().slice(0, 10);
  for (let remaining = parcel.express ? 1 : rate.transit; remaining > 0;) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (!closed()) remaining--;
  }
  return { currency: "USD" as const, billableWeight: assessment.billableWeight, transportCents, serviceCents, handlingCents, fuelCents, insuranceCents, remoteCents: rate.remote, subtotalCents, discountCents, taxCents, totalCents: subtotalCents - discountCents + taxCents, shipDate, deliveryDate: day.toISOString().slice(0, 10) };
}
