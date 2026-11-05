'use client';

import {useState} from 'react';
import {validateParcel, eligibility} from '../../lib/quote';

const money = cents => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);

function QuoteForm() {
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function calculate(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const parcel = validateParcel({weight: Number(form.get('weight')), length: Number(form.get('length')), width: Number(form.get('width')), height: Number(form.get('height')), zone: form.get('zone'), item: form.get('item'), express: form.get('express') === 'on', insured: form.get('insured') === 'on', declaredValue: Number(form.get('declaredValue')), promo: form.get('promo'), dispatchAt: `${form.get('dispatchAt')}:00Z`});
      const limits = eligibility(parcel);
      if (!limits.eligible) throw Error(limits.reasons.join(' '));
      const response = await fetch('/api/quote', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(parcel)});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'The quote could not be calculated.');
      setSaved(result);
    } catch (failure) {setError(failure instanceof Error ? failure.message : 'Check your connection and try again.');}
    finally {setBusy(false);}
  }
  async function reserve() {
    if (!saved) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/quotes/${saved.id}`, {method: 'POST'});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Calculate a new quote and try again.');
      setSaved(result);
    } catch (failure) {setError(failure instanceof Error ? failure.message : 'Check your connection and try again.');}
    finally {setBusy(false);}
  }
  return <div className="ticket"><form id="quote-form" onSubmit={calculate} aria-label="Parcel quote" aria-busy={busy} autoComplete="off"><h2>Your parcel</h2><div className="fields"><label htmlFor="weight">Weight <span>kg</span><input id="weight" name="weight" type="number" min="0.1" max="20" step="0.1" defaultValue="2" required/></label><label htmlFor="zone">Destination<select id="zone" name="zone" defaultValue="national"><option value="local">Local</option><option value="national">National</option><option value="remote">Remote</option></select></label></div><div className="dimensions">{['length', 'width', 'height'].map((name, index) => <label htmlFor={name} key={name}>{name[0].toUpperCase() + name.slice(1)} <span>cm</span><input id={name} name={name} type="number" min="1" max="120" step="1" defaultValue={[30, 20, 15][index]} required/></label>)}</div><div className="fields options"><label htmlFor="item">Contents<select id="item" name="item" defaultValue="general"><option value="general">General</option><option value="fragile">Fragile</option><option value="battery">Battery</option></select></label><label htmlFor="declaredValue">Value <span>USD</span><input id="declaredValue" name="declaredValue" type="number" min="1" max="10000" step="0.01" defaultValue="100" required/></label></div><label className="express" htmlFor="express"><input type="checkbox" id="express" name="express"/><span>Express service<small>For parcels that can’t wait.</small></span></label><label className="express" htmlFor="insured"><input type="checkbox" id="insured" name="insured"/><span>Insure the parcel<small>Required for fragile or high value items.</small></span></label><label htmlFor="dispatchAt">Dispatch date &amp; time <span>UTC</span><input id="dispatchAt" name="dispatchAt" type="datetime-local" defaultValue="2026-11-06T11:00" required/></label><label className="promo" htmlFor="promo">Promo code <span>optional</span><input id="promo" name="promo" type="text" maxLength={40} autoComplete="off" spellCheck={false} placeholder="Enter a promo code…"/></label><button type="submit" disabled={busy}>{busy ? 'Calculating…' : 'Get my quote'}<span aria-hidden="true">↗</span></button></form><div className="receipt" role="status" aria-live="polite" aria-atomic="true">{error ? <p className="error">{error}</p> : saved ? <><dl><div><dt>Billable weight</dt><dd>{saved.quote.billableWeight} kg</dd></div><div><dt>Shipping &amp; services</dt><dd>{money(saved.quote.subtotalCents)}</dd></div>{saved.quote.discountCents > 0 && <div><dt>Promo savings</dt><dd>−{money(saved.quote.discountCents)}</dd></div>}<div><dt>Tax</dt><dd>{money(saved.quote.taxCents)}</dd></div><div><dt>Dispatch</dt><dd>{saved.quote.shipDate}</dd></div><div><dt>Delivery by</dt><dd>{saved.quote.deliveryDate}</dd></div><div className="total"><dt>Your total</dt><dd data-testid="quote-total">{money(saved.quote.totalCents)}</dd></div></dl><p>{saved.state === 'booked' ? 'Reservation saved. No payment taken.' : 'Quote valid for 10 minutes. Prices are fictional.'}</p><button type="button" disabled={busy || saved.state === 'booked'} onClick={reserve}>{saved.state === 'booked' ? 'Reserved' : busy ? 'Reserving…' : 'Reserve this quote'}</button><a className="saved" href={`/api/quotes/${saved.id}`} target="_blank" rel="noreferrer">View saved quote JSON</a></> : <p>Your quote will appear here.</p>}</div></div>;
}

export default function QuotePage() {
  return <main id="main-content"><header><a className="wordmark" href="#main-content">Parcel<span>Lab</span></a><p>A fictional shipping desk</p></header><section className="desk"><div className="intro"><p className="context">A small package. A clear price.</p><h1>Where’s it <br/>heading?</h1><p>Choose a destination and service. We’ll calculate your parcel’s quote.</p><div className="parcel" aria-hidden="true"><span/><i/></div></div><QuoteForm/></section><footer>Educational demo with local quote storage. No payments, accounts, or real shipments. Use fictional data.</footer></main>;
}
