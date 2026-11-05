'use client';
import {useState} from 'react';

const initialScenario = {disabledCouriers: [], closedRoads: [], startMinute: 540, urgent: false};
const colors = ['#1644d3', '#087971', '#a14c15'];
const money = cents => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);
const clock = minute => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');

function Network({model, scenario, plan, courierId, shipmentId}) {
  const nodes = new Map(model.nodes.map(node => [node.id, node]));
  const shipments = model.shipments.filter(shipment => !shipment.optional || scenario.urgent);
  return <svg className="network-map" viewBox="0 0 800 535" role="img" aria-label="Delivery network with eight locations, road closures and selected courier routes">
    <path d="M560 -20 C490 140 570 270 535 350 S530 490 600 560" fill="none" stroke="#dce9f5" strokeWidth="30"/>
    <text x="554" y="266" fill="#6889a8" fontSize="12" transform="rotate(79 554 266)">River</text>
    {model.roads.map(road => {
      const from = nodes.get(road.from), to = nodes.get(road.to), closed = scenario.closedRoads.includes(road.id);
      return <g key={road.id}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={closed ? '#c13849' : '#c9d3e3'} strokeWidth={closed ? 5 : 3} strokeDasharray={closed || road.bikeOnly ? '7 6' : undefined}/><text x={(from.x + to.x) / 2 + 8} y={(from.y + to.y) / 2 - 8} fill={closed ? '#a32230' : '#6c7c90'} fontSize="12">{closed ? 'Closed' : road.minutes + (road.bikeOnly ? ' · bikes' : '')}</text></g>;
    })}
    {plan?.routes.filter(route => courierId === 'all' || route.courierId === courierId).map(route => <polyline key={route.courierId} points={route.nodes.map(id => nodes.get(id).x + ',' + nodes.get(id).y).join(' ')} fill="none" stroke={colors[model.couriers.findIndex(courier => courier.id === route.courierId)]} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity={courierId === 'all' ? .6 : 1}/>)}
    {model.nodes.map(node => {
      const selected = shipments.some(shipment => shipment.id === shipmentId && shipment.destination === node.id);
      const drops = shipments.filter(shipment => shipment.destination === node.id).length;
      return <g key={node.id}><circle cx={node.x} cy={node.y} r={node.id === model.depot ? 14 : 10} fill={node.id === model.depot ? '#17304e' : 'white'} stroke={selected ? '#1644d3' : '#7f92ac'} strokeWidth={selected ? 5 : 2}/><text x={node.x} y={node.y - 22} textAnchor="middle" fill="#17304e" fontSize="14" fontWeight="600">{node.name}</text>{drops > 0 && <text x={node.x + 19} y={node.y + 5} fill="#526378" fontSize="12">{drops} {drops === 1 ? 'drop' : 'drops'}</text>}</g>;
    })}
  </svg>;
}

export default function DispatchBoard({model, initialSaved, initialError}) {
  const [scenario, setScenario] = useState(initialSaved?.scenario || initialScenario);
  const [saved, setSaved] = useState(initialSaved);
  const [batchId, setBatchId] = useState(initialSaved?.batchId || null);
  const [history, setHistory] = useState(initialSaved ? [initialSaved] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [courierId, setCourierId] = useState('all');
  const [shipmentId, setShipmentId] = useState(null);
  const dirty = !!saved && JSON.stringify(saved.scenario) !== JSON.stringify(scenario);
  const plan = dirty ? undefined : saved?.plan;
  const shipments = model.shipments.filter(shipment => !shipment.optional || scenario.urgent);
  const nodes = new Map(model.nodes.map(node => [node.id, node]));
  function accept(record) {
    setSaved(record); setBatchId(record.batchId); setScenario(record.scenario); setCourierId('all');
    setHistory(previous => [record, ...previous.filter(item => item.id !== record.id)].slice(0, 8));
    window.history.replaceState(null, '', '/?plan=' + record.id);
  }
  async function request(url, options, fallback) {
    setBusy(true); setError('');
    try {
      const response = await fetch(url, options);
      const record = await response.json();
      if (!response.ok) throw Error(record.error || fallback);
      accept(record);
    } catch (error) { setError(error instanceof Error ? error.message : 'Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  function toggle(field, value) {
    setScenario(previous => ({...previous, [field]: previous[field].includes(value) ? previous[field].filter(item => item !== value) : [...previous[field], value]}));
    setError('');
  }
  function newBatch() {
    setSaved(null); setBatchId(null); setHistory([]); setError(''); setScenario(initialScenario); setCourierId('all'); setShipmentId(null);
    window.history.replaceState(null, '', '/');
  }
  return <main className="dispatch" id="main-content">
    <a className="skip" href="#scenario-controls">Skip to planning controls</a>
    <header className="dispatch-header"><div><a className="wordmark" href="#main-content">Dispatch<span>Lab</span></a><p>Morning operations / fictional network</p></div><div className="header-actions"><a href="/quote">Original quote demo</a><button className="secondary-action" onClick={newBatch} disabled={busy}>New batch</button></div></header>
    <div className="dispatch-intro"><div><h1>Every delivery is a decision.</h1><p>Plan a fleet, change the constraints, and see which shipments still make it.</p></div><div className="batch-indicator">{saved?.state === 'committed' ? 'Dispatched batch' : 'Planning batch'}<strong>{plan ? `${plan.delivered} of ${plan.totalShipments}` : `${shipments.length} waiting`}</strong></div></div>
    <section className="scenario-bar" aria-label="Planning constraints" id="scenario-controls">
      <fieldset disabled={busy}><legend>Available fleet</legend><div className="fleet-controls">{model.couriers.map((courier, index) => <label key={courier.id}><input type="checkbox" name={'courier-' + courier.id} disabled={saved?.reservedCouriers.includes(courier.id)} checked={!scenario.disabledCouriers.includes(courier.id) && !saved?.reservedCouriers.includes(courier.id)} onChange={() => toggle('disabledCouriers', courier.id)}/><span className="courier-dot" style={{background: colors[index]}}/><span>{courier.name}<small>{saved?.reservedCouriers.includes(courier.id) ? 'Already dispatched' : `${courier.capacityKg} kg / ${courier.coldChain ? 'refrigerated' : courier.batteries ? 'battery approved' : 'general parcels'}`}</small></span></label>)}</div></fieldset>
      <fieldset className="scenario-options" disabled={busy}><legend>What if?</legend><label className="small-check"><input type="checkbox" name="closeBridge" checked={scenario.closedRoads.includes('river-bridge')} onChange={() => toggle('closedRoads', 'river-bridge')}/>Close river bridge</label><label className="small-check"><input type="checkbox" name="urgent" checked={scenario.urgent} onChange={event => {setScenario({...scenario, urgent: event.target.checked});}}/>Add urgent medical kit</label><label className="start-time">Start, UTC<select name="startMinute" aria-label="Dispatch start time" value={scenario.startMinute} onChange={event => {setScenario({...scenario, startMinute: Number(event.target.value)});}}>{[540, 555, 570].map(minute => <option value={minute} key={minute}>{clock(minute)}</option>)}</select></label></fieldset>
      <button className="primary-action" disabled={busy} onClick={() => request('/api/plans', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({batchId, scenario})}, 'Check the scenario and try again.')}>{busy ? 'Planning…' : saved?.state === 'committed' ? 'Plan remaining' : saved ? 'Replan batch' : 'Plan dispatch'}<span aria-hidden="true">↗</span></button>
    </section>
    <div className="dispatch-notice" role="status" aria-live="polite">{error ? <span className="error-text">{error}</span> : dirty ? 'Constraints changed. Replan to update routes before dispatching.' : saved?.state === 'committed' ? 'Dispatch saved. Shipment reservations are locked to this plan; retries will not create duplicates.' : saved ? 'Draft saved. Review the routes and unassigned shipments before dispatching.' : 'Start with the full fleet, then close the bridge or remove a courier to compare the plan.'}</div>
    <div className="planning-workspace">
      <section className="network-panel" aria-labelledby="network-title"><div className="panel-heading"><div><h2 id="network-title">The delivery network</h2><p>Road labels show base travel minutes. Courier times can differ.</p></div><span>{scenario.closedRoads.length ? 'Bridge closed' : 'All roads open'}</span></div><div className="route-filters" aria-label="Show courier route"><button className="route-filter" aria-pressed={courierId === 'all'} onClick={() => setCourierId('all')}>All routes</button>{model.couriers.map((courier, index) => <button className="route-filter" key={courier.id} aria-pressed={courierId === courier.id} onClick={() => setCourierId(courier.id)}><span className="courier-dot" style={{background: colors[index]}}/>{courier.name}</button>)}</div><Network model={model} scenario={scenario} plan={plan} courierId={courierId} shipmentId={shipmentId}/><div className="map-key"><span><i className="key-line"/>Road</span><span><i className="key-line cycle-line"/>Bike-only shortcut</span><span>Every courier returns to the depot.</span></div></section>
      <aside className="plan-panel" aria-labelledby="plan-title"><div className="panel-heading"><div><h2 id="plan-title">Dispatch plan</h2><p>{saved ? saved.state === 'committed' ? 'Saved and dispatched' : 'Saved draft' : 'Ready when you are'}</p></div><span className={'plan-state ' + (saved?.state === 'committed' ? 'is-committed' : '')}>{dirty ? 'Needs replan' : saved?.state === 'committed' ? 'Dispatched' : 'Draft'}</span></div>
        {plan ? <><dl className="plan-totals"><div><dt>Fleet cost</dt><dd>{money(plan.routeCostCents)}</dd></div><div><dt>Missed-service penalty</dt><dd>{money(plan.penaltyCents)}</dd></div><div><dt>Planning objective</dt><dd>{money(plan.objectiveCents)}</dd></div></dl><p className="objective-help">The planner minimizes fleet cost plus penalties for deliveries it cannot cover.</p><div className="courier-routes">{plan.routes.map(route => {
          const index = model.couriers.findIndex(courier => courier.id === route.courierId), courier = model.couriers[index];
          return <div className="courier-route" key={route.courierId} style={{borderLeftColor: colors[index]}}><div><strong>{courier.name}</strong><span>{money(route.costCents)}</span></div><p>{route.loadKg}/{courier.capacityKg} kg · return {clock(route.returnMinute)}</p><ol>{route.stops.map(stop => <li key={stop.shipmentId}><time>{clock(stop.arrival)}</time><span>{stop.shipmentId} <small>{nodes.get(stop.node)?.name}</small></span></li>)}</ol></div>;
        })}</div>{plan.unassigned.length > 0 && <div className="unassigned"><h3>{plan.unassigned.length} unassigned</h3>{plan.unassigned.map(item => <p key={item.shipmentId}><strong>{item.shipmentId}</strong> {item.reason}</p>)}</div>}<button className="primary-action dispatch-commit" disabled={busy || saved.state === 'committed' || !plan.delivered} onClick={() => request('/api/plans/' + saved.id, {method: 'POST'}, 'Replan this batch and try again.')}>{saved.state === 'committed' ? 'Dispatch confirmed' : busy ? 'Saving…' : `Dispatch ${plan.delivered} shipments`}</button></> : <div className="plan-empty"><span aria-hidden="true">⌁</span><h3>{dirty ? 'This scenario needs a new plan.' : 'A plan is more than the shortest road.'}</h3><p>Routes must fit the courier, the load and every delivery window. Plan dispatch to see the assignments.</p></div>}
        {saved && !dirty && <div className="plan-events"><h3>Saved activity</h3>{saved.events.map(event => <p key={event.type}><span>{event.type === 'planned' ? 'Plan created' : 'Shipments reserved'}</span><time>{new Intl.DateTimeFormat('en-GB', {hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC'}).format(new Date(event.at))} UTC</time></p>)}</div>}
      </aside>
    </div>
    <section className="shipment-panel" aria-labelledby="shipments-title"><div className="panel-heading"><div><h2 id="shipments-title">Shipment queue</h2><p>Choose a shipment to locate its destination on the map.</p></div><span>{shipments.length} shipments</span></div><div className="shipment-table-wrap"><table><thead><tr>{['Shipment', 'Destination', 'Load', 'Deadline, UTC', 'Requirement', 'Assignment'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{shipments.map(shipment => {
      const route = plan?.routes.find(route => route.shipmentIds.includes(shipment.id));
      const unassigned = plan?.unassigned.find(item => item.shipmentId === shipment.id);
      return <tr key={shipment.id} className={shipmentId === shipment.id ? 'selected-shipment' : ''}><td><button className="shipment-select" aria-pressed={shipmentId === shipment.id} onClick={() => setShipmentId(shipment.id)}>{shipment.id}<span>{shipment.name}</span></button></td><td>{nodes.get(shipment.destination)?.name}</td><td>{shipment.weightKg} kg</td><td>{clock(shipment.deadline)}</td><td><span className={'requirement ' + shipment.kind}>{shipment.kind === 'medical' ? 'Cold chain' : shipment.kind === 'battery' ? 'Battery approved' : shipment.priority === 'critical' ? 'Time critical' : 'General'}</span></td><td>{route ? model.couriers.find(courier => courier.id === route.courierId)?.name : unassigned ? <span className="error-text">Unassigned</span> : plan ? 'Already dispatched' : 'Awaiting plan'}</td></tr>;
    })}</tbody></table></div></section>
    {history.length > 0 && <section className="plan-history" aria-label="Plan history"><h2>This session’s saved plans</h2>{history.map((record, index) => <button className="secondary-action" disabled={busy} key={record.id} onClick={() => request('/api/plans/' + record.id, undefined, 'Unable to load plan.')}>{index === 0 ? 'Current' : 'Plan ' + (history.length - index)} · {record.plan.delivered}/{record.plan.totalShipments} covered · {money(record.plan.objectiveCents)}</button>)}</section>}
    <footer>Educational lab. Network, shipments and prices are fictional. Plans are stored locally; no payments, accounts or real dispatches.</footer>
  </main>;
}
