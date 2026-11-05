const routes = {
  local: { base: 317, perHalfKg: 43, minimum: 590, remote: 0, transit: 1 },
  national: { base: 683, perHalfKg: 71, minimum: 1120, remote: 0, transit: 3 },
  remote: { base: 1049, perHalfKg: 97, minimum: 1690, remote: 389, transit: 5 },
};

const holidays = new Set(["2026-11-11", "2026-12-25", "2027-01-01"]);

export function assessParcel(parcel) {
  const volumetricWeight = parcel.length * parcel.width * parcel.height / 5000;
  const billableWeight = Math.ceil(2 * Math.max(parcel.weight, volumetricWeight)) / 2;
  const reasons = [];
  if (billableWeight > 20) reasons.push("The billable weight exceeds 20 kg.");
  if (parcel.zone === "remote" && (billableWeight > 15 || Math.max(parcel.length, parcel.width, parcel.height) > 100)) {
    reasons.push("This parcel exceeds the remote route limit.");
  }
  if (parcel.item === "battery" && (parcel.zone === "remote" || parcel.express)) {
    reasons.push("Battery parcels need a local or national standard service.");
  }
  if (parcel.item === "fragile" && !parcel.insured) reasons.push("Fragile parcels require insurance.");
  if (parcel.express && billableWeight > 12) reasons.push("Express service allows up to 12 billable kg.");
  if (parcel.declaredValue > 2500 && !parcel.insured) reasons.push("Parcels valued above $2,500 require insurance.");
  return { eligible: reasons.length === 0, billableWeight, reasons };
}

export function calculateQuote(parcel) {
  const assessment = assessParcel(parcel);
  if (!assessment.eligible) throw Error(assessment.reasons.join(" "));

  const route = routes[parcel.zone];
  const halfKgUnits = 2 * assessment.billableWeight;
  const weightedUnits = Math.min(halfKgUnits, 4)
    + 0.82 * Math.min(Math.max(halfKgUnits - 4, 0), 8)
    + 0.67 * Math.max(halfKgUnits - 12, 0);
  const transportCents = Math.max(route.minimum, route.base + Math.round(weightedUnits * route.perHalfKg));
  const serviceCents = parcel.express ? Math.max(475, Math.round(0.36 * transportCents)) : 0;
  const handlingCents = parcel.item === "fragile" ? 263 : 411 * (parcel.item === "battery");
  const fuelCents = Math.round((transportCents + serviceCents) * (parcel.zone === "remote" ? 0.093 : 0.071));
  const insuranceCents = parcel.insured ? Math.max(149, Math.ceil(0.0083 * Math.round(100 * parcel.declaredValue))) : 0;
  const dispatch = new Date(parcel.dispatchAt);
  let discountCents = 0;
  if (parcel.promo === "NIGHTOWL17" && !parcel.express && parcel.zone !== "remote" && dispatch.getUTCHours() >= 18) {
    discountCents = Math.min(503, Math.round(0.17 * transportCents));
  }
  if (parcel.promo === "BULKLANE" && !parcel.express && assessment.billableWeight >= 8) {
    discountCents = Math.min(transportCents - 590, 327);
  }
  if (parcel.item === "battery") discountCents = 0;

  const subtotalCents = transportCents + serviceCents + handlingCents + fuelCents + insuranceCents + route.remote;
  const taxCents = Math.round((subtotalCents - discountCents) * (parcel.zone === "local" ? 0.0825 : 0.0625));
  const date = new Date(parcel.dispatchAt);
  date.setUTCHours(0, 0, 0, 0);
  const closed = () => [0, 6].includes(date.getUTCDay()) || holidays.has(date.toISOString().slice(0, 10));
  if (dispatch.getUTCHours() >= (parcel.express ? 14 : 17)) date.setUTCDate(date.getUTCDate() + 1);
  while (closed() || (parcel.zone === "remote" && ![1, 3, 5].includes(date.getUTCDay()))) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const shipDate = date.toISOString().slice(0, 10);
  for (let remaining = parcel.express ? 1 : route.transit; remaining > 0;) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (!closed()) remaining--;
  }
  return {
    currency: "USD",
    billableWeight: assessment.billableWeight,
    transportCents,
    serviceCents,
    handlingCents,
    fuelCents,
    insuranceCents,
    remoteCents: route.remote,
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: subtotalCents - discountCents + taxCents,
    shipDate,
    deliveryDate: date.toISOString().slice(0, 10),
  };
}
