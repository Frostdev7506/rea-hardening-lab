'use client';
import {useState} from 'react';
import {validateParcel, eligibility} from '@/lib/quote';
const money = cents => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);
export default function QuoteForm() {
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError(''); setSaved(null);
    try {
      const parcel = validateParcel({weight: Number(fields.get('weight')), length: Number(fields.get('length')), width: Number(fields.get('width')), height: Number(fields.get('height')), zone: fields.get('zone'), item: fields.get('item'), express: fields.get('express') === 'on', insured: fields.get('insured') === 'on', declaredValue: Number(fields.get('declaredValue')), promo: fields.get('promo'), dispatchAt: fields.get('dispatchAt') + ':00Z'});
      const check = eligibility(parcel);
      if (!check.eligible) throw Error(check.reasons.join(' '));
      const response = await fetch('/api/quote', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(parcel)});
      const record = await response.json();
      if (!response.ok) throw Error(record.error || 'Check the parcel and try again.');
      setSaved(record);
    } catch (error) { setError(error instanceof Error ? error.message : 'Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  async function reserve() {
    if (!saved) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/quotes/' + saved.id, {method: 'POST'});
      const record = await response.json();
      if (!response.ok) throw Error(record.error || 'Calculate a new quote and try again.');
      setSaved(record);
    } catch (error) { setError(error instanceof Error ? error.message : 'Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  return <div className="ticket"><form id="quote-form" onSubmit={submit} aria-label="Parcel quote" aria-busy={busy} autoComplete="off"><h2>Your parcel</h2><div className="fields"><label htmlFor="weight">Weight <span>kg</span><input id="weight" name="weight" type="number" min="0.1" max="20" step="0.1" defaultValue="2" required/></label><label htmlFor="zone">Destination<select id="zone" name="zone" defaultValue="national"><option value="local">Local</option><option value="national">National</option><option value="remote">Remote</option></select></label></div><div className="dimensions">{['length', 'width', 'height'].map((key, index) => <label key={key} htmlFor={key}>{key[0].toUpperCase() + key.slice(1)} <span>cm</span><input id={key} name={key} type="number" min="1" max="120" step="1" defaultValue={[30, 20, 15][index]} required/></label>)}</div><div className="fields options"><label htmlFor="item">Contents<select id="item" name="item"><option value="general">General</option><option value="fragile">Fragile</option><option value="battery">Battery</option></select></label><label htmlFor="declaredValue">Value <span>USD</span><input id="declaredValue" name="declaredValue" type="number" min="1" max="10000" step="0.01" defaultValue="100" required/></label></div><label className="express" htmlFor="express"><input id="express" name="express" type="checkbox"/><span>Express service<small>For parcels that can’t wait.</small></span></label><label className="express" htmlFor="insured"><input id="insured" name="insured" type="checkbox"/><span>Insure the parcel<small>Required for fragile or high value items.</small></span></label><label htmlFor="dispatchAt">Dispatch date &amp; time <span>UTC</span><input id="dispatchAt" name="dispatchAt" type="datetime-local" defaultValue="2026-11-06T11:00" required/></label><label className="promo" htmlFor="promo">Promo code <span>optional</span><input id="promo" name="promo" type="text" maxLength="40" autoComplete="off" spellCheck={false} placeholder="Enter a promo code…"/></label><button type="submit" disabled={busy}>{busy ? 'Calculating…' : 'Get my quote'}<span aria-hidden="true">↗</span></button></form><div className="receipt" role="status" aria-live="polite" aria-atomic="true">{error ? <p className="error">{error}</p> : saved ? <><dl><div><dt>Billable weight</dt><dd>{saved.quote.billableWeight} kg</dd></div><div><dt>Shipping &amp; services</dt><dd>{money(saved.quote.subtotalCents)}</dd></div>{saved.quote.discountCents > 0 && <div><dt>Promo savings</dt><dd>−{money(saved.quote.discountCents)}</dd></div>}<div><dt>Tax</dt><dd>{money(saved.quote.taxCents)}</dd></div><div><dt>Dispatch</dt><dd>{saved.quote.shipDate}</dd></div><div><dt>Delivery by</dt><dd>{saved.quote.deliveryDate}</dd></div><div className="total"><dt>Your total</dt><dd data-testid="quote-total">{money(saved.quote.totalCents)}</dd></div></dl><p>{saved.state === 'booked' ? 'Reservation saved. No payment taken.' : 'Quote valid for 10 minutes. Prices are fictional.'}</p><button type="button" disabled={busy || saved.state === 'booked'} onClick={reserve}>{saved.state === 'booked' ? 'Reserved' : busy ? 'Reserving…' : 'Reserve this quote'}</button><a className="saved" href={'/api/quotes/' + saved.id} target="_blank" rel="noreferrer">View saved quote JSON</a></> : <p>Your quote will appear here.</p>}</div></div>;
}
