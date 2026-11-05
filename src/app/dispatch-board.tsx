"use client";

import Link from "next/link";
import { useState } from "react";
import type { DispatchScenario, PublicDispatchModel, SavedDispatch } from "@/lib/dispatch-types";
import { DispatchMap, courierColors } from "./dispatch-map";
import "./dispatch.css";

const initialScenario: DispatchScenario = { disabledCouriers: [], closedRoads: [], startMinute: 540, urgent: false };
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

export function DispatchBoard({ model, initialSaved, initialError }: { model: PublicDispatchModel; initialSaved: SavedDispatch | null; initialError: string }) {
  const [scenario, setScenario] = useState(initialSaved?.scenario || initialScenario);
  const [saved, setSaved] = useState<SavedDispatch | null>(initialSaved);
  const [batchId, setBatchId] = useState<string | null>(initialSaved?.batchId || null);
  const [history, setHistory] = useState<SavedDispatch[]>(initialSaved ? [initialSaved] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [activeCourier, setActiveCourier] = useState("all");
  const [activeShipment, setActiveShipment] = useState<string | null>(null);
  const dirty = Boolean(saved && JSON.stringify(saved.scenario) !== JSON.stringify(scenario));
  const plan = dirty ? undefined : saved?.plan;
  const shipments = model.shipments.filter((shipment) => !shipment.optional || scenario.urgent);
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));

  function receive(value: SavedDispatch) {
    setSaved(value); setBatchId(value.batchId); setScenario(value.scenario); setActiveCourier("all");
    setHistory((items) => [value, ...items.filter((item) => item.id !== value.id)].slice(0, 8));
    window.history.replaceState(null, "", `/?plan=${value.id}`);
  }
  async function load(id: string) {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/plans/${id}`); const value = await response.json(); if (!response.ok) throw new Error(value.error); receive(value); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load plan."); }
    finally { setBusy(false); }
  }
  async function createPlan() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId, scenario }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Check the scenario and try again.");
      receive(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check your connection and try again."); }
    finally { setBusy(false); }
  }
  async function commit() {
    if (!saved) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/plans/${saved.id}`, { method: "POST" });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Replan this batch and try again.");
      receive(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check your connection and try again."); }
    finally { setBusy(false); }
  }
  function toggle(field: "closedRoads" | "disabledCouriers", id: string) {
    setScenario((current) => ({ ...current, [field]: current[field].includes(id) ? current[field].filter((item) => item !== id) : [...current[field], id] })); setError("");
  }
  function newBatch() {
    setSaved(null); setBatchId(null); setHistory([]); setError(""); setScenario(initialScenario); setActiveCourier("all"); setActiveShipment(null); window.history.replaceState(null, "", "/");
  }

  return <main id="main-content" className="dispatch">
    <header className="dispatch-header"><div><a className="wordmark" href="#main-content">Dispatch<span>Lab</span></a><p>Morning operations / fictional network</p></div><div className="header-actions"><Link href="/quote">Original quote demo</Link><button className="secondary-action" onClick={newBatch} disabled={busy}>New batch</button></div></header>
    <div className="dispatch-intro"><div><h1>Every delivery is a decision.</h1><p>Plan a fleet, change the constraints, and see which shipments still make it.</p></div><div className="batch-indicator">{saved?.state === "committed" ? "Dispatched batch" : "Planning batch"}<strong>{plan ? `${plan.delivered} of ${plan.totalShipments}` : `${shipments.length} waiting`}</strong></div></div>
    <section className="scenario-bar" aria-label="Planning constraints">
      <fieldset disabled={busy}><legend>Available fleet</legend><div className="fleet-controls">{model.couriers.map((courier, index) => <label key={courier.id}><input type="checkbox" name={`courier-${courier.id}`} disabled={saved?.reservedCouriers.includes(courier.id)} checked={!scenario.disabledCouriers.includes(courier.id) && !saved?.reservedCouriers.includes(courier.id)} onChange={() => toggle("disabledCouriers", courier.id)} /><span className="courier-dot" style={{ background: courierColors[index] }} /><span>{courier.name}<small>{saved?.reservedCouriers.includes(courier.id) ? "Already dispatched" : `${courier.capacityKg} kg / ${courier.coldChain ? "refrigerated" : courier.batteries ? "battery approved" : "general parcels"}`}</small></span></label>)}</div></fieldset>
      <fieldset className="scenario-options" disabled={busy}><legend>What if?</legend><label className="small-check"><input type="checkbox" name="closeBridge" checked={scenario.closedRoads.includes("river-bridge")} onChange={() => toggle("closedRoads", "river-bridge")} />Close river bridge</label><label className="small-check"><input type="checkbox" name="urgent" checked={scenario.urgent} onChange={(event) => setScenario((current) => ({ ...current, urgent: event.target.checked }))} />Add urgent medical kit</label><label className="start-time">Start, UTC<select name="startMinute" aria-label="Dispatch start time" value={scenario.startMinute} onChange={(event) => setScenario((current) => ({ ...current, startMinute: Number(event.target.value) }))}><option value={540}>09:00</option><option value={555}>09:15</option><option value={570}>09:30</option></select></label></fieldset>
      <button className="primary-action" onClick={createPlan} disabled={busy}>{busy ? "Planning…" : saved?.state === "committed" ? "Plan remaining" : saved ? "Replan batch" : "Plan dispatch"}<span aria-hidden="true">↗</span></button>
    </section>
    <div className="dispatch-notice" role="status" aria-live="polite">{error ? <span className="error-text">{error}</span> : dirty ? "Constraints changed. Replan to update routes before dispatching." : saved?.state === "committed" ? "Dispatch saved. Shipment reservations are locked to this plan; retries will not create duplicates." : saved ? "Draft saved. Review the routes and unassigned shipments before dispatching." : "Start with the full fleet, then close the bridge or remove a courier to compare the plan."}</div>
    <div className="planning-workspace">
      <section className="network-panel" aria-labelledby="network-title"><div className="panel-heading"><div><h2 id="network-title">The delivery network</h2><p>Road labels show base travel minutes. Courier times can differ.</p></div><span>{scenario.closedRoads.length ? "Bridge closed" : "All roads open"}</span></div>
        <div className="route-filters" aria-label="Show courier route"><button className="route-filter" aria-pressed={activeCourier === "all"} onClick={() => setActiveCourier("all")}>All routes</button>{model.couriers.map((courier, index) => <button key={courier.id} className="route-filter" aria-pressed={activeCourier === courier.id} onClick={() => setActiveCourier(courier.id)}><span className="courier-dot" style={{ background: courierColors[index] }} />{courier.name}</button>)}</div>
        <DispatchMap model={model} scenario={scenario} plan={plan} courierId={activeCourier} shipmentId={activeShipment} />
        <div className="map-key"><span><i className="key-line" />Road</span><span><i className="key-line cycle-line" />Bike-only shortcut</span><span>Every courier returns to the depot.</span></div>
      </section>
      <aside className="plan-panel" aria-labelledby="plan-title"><div className="panel-heading"><div><h2 id="plan-title">Dispatch plan</h2><p>{saved ? saved.state === "committed" ? "Saved and dispatched" : "Saved draft" : "Ready when you are"}</p></div><span className={`plan-state ${saved?.state === "committed" ? "is-committed" : ""}`}>{dirty ? "Needs replan" : saved?.state === "committed" ? "Dispatched" : "Draft"}</span></div>
        {plan ? <><dl className="plan-totals"><div><dt>Fleet cost</dt><dd>{money(plan.routeCostCents)}</dd></div><div><dt>Missed-service penalty</dt><dd>{money(plan.penaltyCents)}</dd></div><div><dt>Planning objective</dt><dd>{money(plan.objectiveCents)}</dd></div></dl><p className="objective-help">The planner minimizes fleet cost plus penalties for deliveries it cannot cover.</p>
          <div className="courier-routes">{plan.routes.map((route) => { const index = model.couriers.findIndex((courier) => courier.id === route.courierId); const courier = model.couriers[index]; return <div className="courier-route" key={route.courierId} style={{ borderLeftColor: courierColors[index] }}><div><strong>{courier.name}</strong><span>{money(route.costCents)}</span></div><p>{route.loadKg}/{courier.capacityKg} kg · return {clock(route.returnMinute)}</p><ol>{route.stops.map((stop) => <li key={stop.shipmentId}><time>{clock(stop.arrival)}</time><span>{stop.shipmentId}<small>{nodes.get(stop.node)?.name}</small></span></li>)}</ol></div>; })}</div>
          {plan.unassigned.length > 0 && <div className="unassigned"><h3>{plan.unassigned.length} unassigned</h3>{plan.unassigned.map((item) => <p key={item.shipmentId}><strong>{item.shipmentId}</strong> {item.reason}</p>)}</div>}
          <button className="primary-action dispatch-commit" disabled={busy || saved?.state === "committed" || !plan.delivered} onClick={commit}>{saved?.state === "committed" ? "Dispatch confirmed" : busy ? "Saving…" : `Dispatch ${plan.delivered} shipments`}</button>
        </> : <div className="plan-empty"><span aria-hidden="true">⌁</span><h3>{dirty ? "This scenario needs a new plan." : "A plan is more than the shortest road."}</h3><p>Routes must fit the courier, the load and every delivery window. Plan dispatch to see the assignments.</p></div>}
        {saved && !dirty && <div className="plan-events"><h3>Saved activity</h3>{saved.events.map((event) => <p key={event.type}><span>{event.type === "planned" ? "Plan created" : "Shipments reserved"}</span><time>{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" }).format(new Date(event.at))} UTC</time></p>)}</div>}
      </aside>
    </div>
    <section className="shipment-panel" aria-labelledby="shipments-title"><div className="panel-heading"><div><h2 id="shipments-title">Shipment queue</h2><p>Choose a shipment to locate its destination on the map.</p></div><span>{shipments.length} shipments</span></div><div className="shipment-table-wrap"><table><thead><tr><th scope="col">Shipment</th><th scope="col">Destination</th><th scope="col">Load</th><th scope="col">Deadline, UTC</th><th scope="col">Requirement</th><th scope="col">Assignment</th></tr></thead><tbody>{shipments.map((shipment) => {
      const route = plan?.routes.find((item) => item.shipmentIds.includes(shipment.id)); const missed = plan?.unassigned.some((item) => item.shipmentId === shipment.id);
      return <tr key={shipment.id} className={activeShipment === shipment.id ? "selected-shipment" : ""}><th scope="row"><button className="shipment-select" aria-pressed={activeShipment === shipment.id} onClick={() => setActiveShipment(shipment.id)}>{shipment.id}<span>{shipment.name}</span></button></th><td>{nodes.get(shipment.destination)?.name}</td><td>{shipment.weightKg} kg</td><td>{clock(shipment.deadline)}</td><td><span className={`requirement ${shipment.kind}`}>{shipment.kind === "medical" ? "Cold chain" : shipment.kind === "battery" ? "Battery approved" : shipment.priority === "critical" ? "Time critical" : "General"}</span></td><td>{route ? model.couriers.find((courier) => courier.id === route.courierId)?.name : missed ? <span className="error-text">Unassigned</span> : plan ? "Already dispatched" : "Awaiting plan"}</td></tr>;
    })}</tbody></table></div></section>
    {history.length > 0 && <section className="plan-history" aria-label="Plan history"><h2>This session’s saved plans</h2>{history.map((item, index) => <button className="secondary-action" key={item.id} disabled={busy} onClick={() => void load(item.id)}>{index === 0 ? "Current" : `Plan ${history.length - index}`} · {item.plan.delivered}/{item.plan.totalShipments} covered · {money(item.plan.objectiveCents)}</button>)}</section>}
    <footer>Educational lab. Network, shipments and prices are fictional. Plans are stored locally; no payments, accounts or real dispatches.</footer>
  </main>;
}
