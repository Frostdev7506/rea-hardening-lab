import { QuoteForm } from "./quote-form";

export default function Page() {
  return (
    <main>
      <header><a className="wordmark" href="#quote-form">Parcel<span>Lab</span></a><p>A fictional shipping desk</p></header>
      <section className="desk" aria-labelledby="page-title">
        <div className="intro"><p className="context">A small package. A clear price.</p><h1 id="page-title">Where’s it <br />heading?</h1><p>Choose a destination and service. We’ll calculate your parcel’s quote.</p><div className="parcel" aria-hidden="true"><span /><i /></div></div>
        <QuoteForm />
      </section>
      <footer>Educational demo with local quote storage. No payments, accounts, or real shipments. Use fictional data.</footer>
    </main>
  );
}
