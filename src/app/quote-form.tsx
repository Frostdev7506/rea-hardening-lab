"use client";

import { useState, type FormEvent } from "react";
import { assessParcel, parseParcel } from "@/lib/parcel";
import type { calculateQuote } from "@/lib/quote";

type Quote = { id: string; state: "quoted" | "booked"; quote: ReturnType<typeof calculateQuote> };
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function QuoteForm() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(""); setQuote(null);
    try {
      const parcel = parseParcel({
        weight: Number(data.get("weight")), length: Number(data.get("length")), width: Number(data.get("width")), height: Number(data.get("height")),
        zone: data.get("zone"), item: data.get("item"), express: data.get("express") === "on", insured: data.get("insured") === "on",
        declaredValue: Number(data.get("declaredValue")), promo: data.get("promo"), dispatchAt: `${data.get("dispatchAt")}:00Z`,
      });
      const assessment = assessParcel(parcel);
      if (!assessment.eligible) throw new Error(assessment.reasons.join(" "));
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parcel),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The quote could not be calculated.");
      setQuote(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check your connection and try again."); }
    finally { setBusy(false); }
  }
  async function reserve() {
    if (!quote) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/quotes/${quote.id}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Calculate a new quote and try again.");
      setQuote(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="ticket">
      <form id="quote-form" onSubmit={submit} aria-label="Parcel quote" aria-busy={busy} autoComplete="off">
        <h2>Your parcel</h2>
        <div className="fields">
          <label htmlFor="weight">Weight <span>kg</span><input id="weight" name="weight" type="number" min="0.1" max="20" step="0.1" defaultValue="2" required /></label>
          <label htmlFor="zone">Destination<select id="zone" name="zone" defaultValue="national"><option value="local">Local</option><option value="national">National</option><option value="remote">Remote</option></select></label>
        </div>
        <div className="dimensions">
          {(["length", "width", "height"] as const).map((dimension, index) => <label key={dimension} htmlFor={dimension}>{dimension[0].toUpperCase() + dimension.slice(1)} <span>cm</span><input id={dimension} name={dimension} type="number" min="1" max="120" step="1" defaultValue={[30, 20, 15][index]} required /></label>)}
        </div>
        <div className="fields options">
          <label htmlFor="item">Contents<select id="item" name="item"><option value="general">General</option><option value="fragile">Fragile</option><option value="battery">Battery</option></select></label>
          <label htmlFor="declaredValue">Value <span>USD</span><input id="declaredValue" name="declaredValue" type="number" min="1" max="10000" step="0.01" defaultValue="100" required /></label>
        </div>
        <label className="express" htmlFor="express"><input type="checkbox" id="express" name="express" /><span>Express service<small>For parcels that can’t wait.</small></span></label>
        <label className="express" htmlFor="insured"><input type="checkbox" id="insured" name="insured" /><span>Insure the parcel<small>Required for fragile or high value items.</small></span></label>
        <label htmlFor="dispatchAt">Dispatch date & time <span>UTC</span><input id="dispatchAt" name="dispatchAt" type="datetime-local" defaultValue="2026-11-06T11:00" required /></label>
        <label className="promo" htmlFor="promo">Promo code <span>optional</span><input id="promo" name="promo" type="text" maxLength={40} autoComplete="off" spellCheck={false} placeholder="Enter a promo code…" /></label>
        <button type="submit" disabled={busy}>{busy ? "Calculating…" : "Get my quote"}<span aria-hidden="true">↗</span></button>
      </form>
      <div className="receipt" role="status" aria-live="polite" aria-atomic="true">
        {error ? <p className="error">{error}</p> : quote ? <><dl>
          <div><dt>Billable weight</dt><dd>{quote.quote.billableWeight} kg</dd></div>
          <div><dt>Shipping & services</dt><dd>{money(quote.quote.subtotalCents)}</dd></div>
          {quote.quote.discountCents > 0 && <div><dt>Promo savings</dt><dd>−{money(quote.quote.discountCents)}</dd></div>}
          <div><dt>Tax</dt><dd>{money(quote.quote.taxCents)}</dd></div>
          <div><dt>Dispatch</dt><dd>{quote.quote.shipDate}</dd></div>
          <div><dt>Delivery by</dt><dd>{quote.quote.deliveryDate}</dd></div>
          <div className="total"><dt>Your total</dt><dd data-testid="quote-total">{money(quote.quote.totalCents)}</dd></div>
        </dl><p>{quote.state === "booked" ? "Reservation saved. No payment taken." : "Quote valid for 10 minutes. Prices are fictional."}</p>
        <button type="button" disabled={busy || quote.state === "booked"} onClick={reserve}>{quote.state === "booked" ? "Reserved" : busy ? "Reserving…" : "Reserve this quote"}</button>
        <a className="saved" href={`/api/quotes/${quote.id}`} target="_blank" rel="noreferrer">View saved quote JSON</a></> : <p>Your quote will appear here.</p>}
      </div>
    </div>
  );
}
