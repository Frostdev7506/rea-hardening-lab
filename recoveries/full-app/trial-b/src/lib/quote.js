export function validateParcel(parcel) {
  if (!parcel || typeof parcel !== 'object' || Array.isArray(parcel)) throw Error('Send a parcel object.');
  const fields = ['weight', 'length', 'width', 'height', 'zone', 'express', 'item', 'insured', 'declaredValue', 'promo', 'dispatchAt'];
  if (Object.keys(parcel).some(key => !fields.includes(key))) throw Error('The parcel contains an unknown field.');
  for (const [key, maximum] of [['weight', 20], ['length', 120], ['width', 120], ['height', 120], ['declaredValue', 10000]]) {
    if (typeof parcel[key] !== 'number' || !Number.isFinite(parcel[key]) || parcel[key] <= 0 || parcel[key] > maximum) throw Error(`Choose ${key} above 0 and up to ${maximum}.`);
  }
  if (!['local', 'national', 'remote'].includes(parcel.zone)) throw Error('Choose a local, national, or remote destination.');
  if (!['general', 'fragile', 'battery'].includes(parcel.item)) throw Error('Choose a supported parcel contents category.');
  if (typeof parcel.express !== 'boolean' || typeof parcel.insured !== 'boolean' || typeof parcel.promo !== 'string' || parcel.promo.length > 40) throw Error('Check the service, insurance, and promo code.');
  if (typeof parcel.dispatchAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(parcel.dispatchAt) || !Number.isFinite(Date.parse(parcel.dispatchAt)) || new Date(parcel.dispatchAt).toISOString().slice(0, 19) + 'Z' !== parcel.dispatchAt) throw Error('Choose a valid dispatch date and time in UTC.');
  return {...parcel, promo: parcel.promo.trim().toUpperCase()};
}
export function eligibility(parcel) {
  const billableWeight = Math.ceil(2 * Math.max(parcel.weight, parcel.length * parcel.width * parcel.height / 5000)) / 2;
  const reasons = [];
  if (billableWeight > 20) reasons.push('The billable weight exceeds 20 kg.');
  if (parcel.zone === 'remote' && (billableWeight > 15 || Math.max(parcel.length, parcel.width, parcel.height) > 100)) reasons.push('This parcel exceeds the remote route limit.');
  if (parcel.item === 'battery' && (parcel.zone === 'remote' || parcel.express)) reasons.push('Battery parcels need a local or national standard service.');
  if (parcel.item === 'fragile' && !parcel.insured) reasons.push('Fragile parcels require insurance.');
  if (parcel.express && billableWeight > 12) reasons.push('Express service allows up to 12 billable kg.');
  if (parcel.declaredValue > 2500 && !parcel.insured) reasons.push('Parcels valued above $2,500 require insurance.');
  return {eligible: reasons.length === 0, billableWeight, reasons};
}
export function calculateQuote(parcel) {
  const check = eligibility(parcel);
  if (!check.eligible) throw Error(check.reasons.join(' '));
  const rates = {local: {base: 317, perHalfKg: 43, minimum: 590, remote: 0, transit: 1}, national: {base: 683, perHalfKg: 71, minimum: 1120, remote: 0, transit: 3}, remote: {base: 1049, perHalfKg: 97, minimum: 1690, remote: 389, transit: 5}};
  const rate = rates[parcel.zone];
  const units = 2 * check.billableWeight;
  const weightedUnits = Math.min(units, 4) + .82 * Math.min(Math.max(units - 4, 0), 8) + .67 * Math.max(units - 12, 0);
  const transportCents = Math.max(rate.minimum, rate.base + Math.round(weightedUnits * rate.perHalfKg));
  const serviceCents = parcel.express ? Math.max(475, Math.round(.36 * transportCents)) : 0;
  const handlingCents = parcel.item === 'fragile' ? 263 : parcel.item === 'battery' ? 411 : 0;
  const fuelCents = Math.round((transportCents + serviceCents) * (parcel.zone === 'remote' ? .093 : .071));
  const insuranceCents = parcel.insured ? Math.max(149, Math.ceil(.0083 * Math.round(100 * parcel.declaredValue))) : 0;
  const dispatch = new Date(parcel.dispatchAt);
  let discountCents = 0;
  if (parcel.promo === 'NIGHTOWL17' && !parcel.express && parcel.zone !== 'remote' && dispatch.getUTCHours() >= 18) discountCents = Math.min(503, Math.round(.17 * transportCents));
  if (parcel.promo === 'BULKLANE' && !parcel.express && check.billableWeight >= 8) discountCents = Math.min(transportCents - 590, 327);
  if (parcel.item === 'battery') discountCents = 0;
  const subtotalCents = transportCents + serviceCents + handlingCents + fuelCents + insuranceCents + rate.remote;
  const taxCents = Math.round((subtotalCents - discountCents) * (parcel.zone === 'local' ? .0825 : .0625));
  const day = new Date(parcel.dispatchAt);
  day.setUTCHours(0, 0, 0, 0);
  const holidays = new Set(['2026-11-11', '2026-12-25', '2027-01-01']);
  const nonworking = () => [0, 6].includes(day.getUTCDay()) || holidays.has(day.toISOString().slice(0, 10));
  const advance = () => day.setUTCDate(day.getUTCDate() + 1);
  if (dispatch.getUTCHours() >= (parcel.express ? 14 : 17)) advance();
  while (nonworking() || parcel.zone === 'remote' && ![1, 3, 5].includes(day.getUTCDay())) advance();
  const shipDate = day.toISOString().slice(0, 10);
  for (let remaining = parcel.express ? 1 : rate.transit; remaining > 0;) { advance(); if (!nonworking()) remaining--; }
  return {currency: 'USD', billableWeight: check.billableWeight, transportCents, serviceCents, handlingCents, fuelCents, insuranceCents, remoteCents: rate.remote, subtotalCents, discountCents, taxCents, totalCents: subtotalCents - discountCents + taxCents, shipDate, deliveryDate: day.toISOString().slice(0, 10)};
}
