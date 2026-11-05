import QuoteForm from './quote-form';
export const metadata = {title: 'ParcelLab — A fictional shipping desk'};
export default function QuotePage() {
  return <main><a className="skip" href="#quote-form">Skip to quote form</a><header><a className="wordmark" href="/quote">Parcel<span>Lab</span></a><p>A fictional shipping desk</p></header><section className="desk"><div className="intro"><p className="context">A small package. A clear price.</p><h1>Where’s it<br/> heading?</h1><p>Choose a destination and service. We’ll calculate your parcel’s quote.</p><div className="parcel" aria-hidden="true"><span/><i/></div></div><QuoteForm/></section><footer>Educational demo with local quote storage. No payments, accounts, or real shipments. Use fictional data.</footer></main>;
}
