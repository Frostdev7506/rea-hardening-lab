export function validateParcel(parcel) {
  if (!parcel || typeof parcel !== 'object' || Array.isArray(parcel)) throw Error('Send a parcel object.');
  const fields = ['weight', 'length', 'width', 'height', 'zone', 'express', 'item', 'insured', 'declaredValue', 'promo', 'dispatchAt'];
  if (Object.keys(parcel).some(key => !fields.includes(key))) throw Error('The parcel contains an unknown field.');
  for (const [field, maximum] of [['weight', 20], ['length', 120], ['width', 120], ['height', 120], ['declaredValue', 10000]]) {
    if (typeof parcel[field] !== 'number' || !Number.isFinite(parcel[field]) || parcel[field] <= 0 || parcel[field] > maximum) throw Error(`Choose ${field} above 0 and up to ${maximum}.`);
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
const tariffs = {local: {base: 317, perHalfKg: 43, minimum: 590, remote: 0, transit: 1}, national: {base: 683, perHalfKg: 71, minimum: 1120, remote: 0, transit: 3}, remote: {base: 1049, perHalfKg: 97, minimum: 1690, remote: 389, transit: 5}};
const holidays = new Set(['2026-11-11', '2026-12-25', '2027-01-01']);
export function calculateQuote(parcel) {
  const limits = eligibility(parcel);
  if (!limits.eligible) throw Error(limits.reasons.join(' '));
  const tariff = tariffs[parcel.zone];
  const halves = 2 * limits.billableWeight;
  const units = Math.min(halves, 4) + 0.82 * Math.min(Math.max(halves - 4, 0), 8) + 0.67 * Math.max(halves - 12, 0);
  const transportCents = Math.max(tariff.minimum, tariff.base + Math.round(units * tariff.perHalfKg));
  const serviceCents = parcel.express ? Math.max(475, Math.round(0.36 * transportCents)) : 0;
  const handlingCents = parcel.item === 'fragile' ? 263 : parcel.item === 'battery' ? 411 : 0;
  const fuelCents = Math.round((transportCents + serviceCents) * (parcel.zone === 'remote' ? 0.093 : 0.071));
  const insuranceCents = parcel.insured ? Math.max(149, Math.ceil(0.0083 * Math.round(100 * parcel.declaredValue))) : 0;
  const dispatch = new Date(parcel.dispatchAt);
  let discountCents = 0;
  if (parcel.promo === 'NIGHTOWL17' && !parcel.express && parcel.zone !== 'remote' && dispatch.getUTCHours() >= 18) discountCents = Math.min(503, Math.round(0.17 * transportCents));
  if (parcel.promo === 'BULKLANE' && !parcel.express && limits.billableWeight >= 8) discountCents = Math.min(transportCents - 590, 327);
  if (parcel.item === 'battery') discountCents = 0;
  const subtotalCents = transportCents + serviceCents + handlingCents + fuelCents + insuranceCents + tariff.remote;
  const taxCents = Math.round((subtotalCents - discountCents) * (parcel.zone === 'local' ? 0.0825 : 0.0625));
  const date = new Date(parcel.dispatchAt);
  date.setUTCHours(0, 0, 0, 0);
  const unavailable = () => [0, 6].includes(date.getUTCDay()) || holidays.has(date.toISOString().slice(0, 10));
  if (dispatch.getUTCHours() >= (parcel.express ? 14 : 17)) date.setUTCDate(date.getUTCDate() + 1);
  while (unavailable() || parcel.zone === 'remote' && ![1, 3, 5].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  const shipDate = date.toISOString().slice(0, 10);
  let days = parcel.express ? 1 : tariff.transit;
  while (days > 0) {date.setUTCDate(date.getUTCDate() + 1); if (!unavailable()) days--;}
  return {currency: 'USD', billableWeight: limits.billableWeight, transportCents, serviceCents, handlingCents, fuelCents, insuranceCents, remoteCents: tariff.remote, subtotalCents, discountCents, taxCents, totalCents: subtotalCents - discountCents + taxCents, shipDate, deliveryDate: date.toISOString().slice(0, 10)};
}
