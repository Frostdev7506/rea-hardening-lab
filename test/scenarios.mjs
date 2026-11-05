export const base = { weight: 2, length: 30, width: 20, height: 15, zone: "national", express: false, item: "general", insured: false, declaredValue: 100, promo: "", dispatchAt: "2026-11-06T11:00:00Z" };

// Frozen before recovery. Test inputs and reference answers are excluded from analyzer snapshots.
export const scenarios = [
  {}, { zone: "local" }, { zone: "remote" }, { express: true },
  { weight: 0.1 }, { weight: 2.01 }, { weight: 6 }, { weight: 6.01 }, { weight: 12 }, { weight: 20 },
  { length: 41, width: 31, height: 21 }, { length: 100, width: 20, height: 20 },
  { zone: "remote", weight: 15 }, { zone: "remote", weight: 15.01 },
  { zone: "remote", length: 101, width: 10, height: 10 },
  { item: "fragile", insured: true }, { item: "fragile" }, { item: "battery" },
  { item: "battery", express: true }, { item: "battery", zone: "remote" },
  { express: true, weight: 12 }, { express: true, weight: 12.01 },
  { declaredValue: 2500 }, { declaredValue: 2500.01 }, { declaredValue: 2500.01, insured: true },
  { insured: true, declaredValue: 179.52 }, { insured: true, declaredValue: 10000 },
  { promo: "NIGHTOWL17", dispatchAt: "2026-11-06T18:00:00Z" },
  { promo: "NIGHTOWL17", dispatchAt: "2026-11-06T17:59:00Z" },
  { promo: "NIGHTOWL17", dispatchAt: "2026-11-06T18:00:00Z", express: true },
  { promo: "NIGHTOWL17", dispatchAt: "2026-11-06T18:00:00Z", zone: "remote" },
  { promo: "NIGHTOWL17", dispatchAt: "2026-11-06T18:00:00Z", item: "battery" },
  { weight: 7.5, promo: "BULKLANE" }, { weight: 8, promo: "BULKLANE" },
  { weight: 9, promo: "BULKLANE", insured: true, declaredValue: 400 },
  { weight: 20, zone: "local", promo: "NIGHTOWL17", dispatchAt: "2026-11-06T18:00:00Z" },
  { dispatchAt: "2026-11-06T17:00:00Z" }, { express: true, dispatchAt: "2026-11-10T14:00:00Z" },
  { zone: "remote", dispatchAt: "2026-11-10T11:00:00Z" },
  { zone: "remote", dispatchAt: "2026-12-24T18:00:00Z" },
  { zone: "local", dispatchAt: "2026-12-31T18:00:00Z" },
  { express: true, dispatchAt: "2026-11-06T13:59:00Z" },
].map((patch, index) => ({ id: `case-${String(index + 1).padStart(2, "0")}`, input: { ...base, ...patch } }));
