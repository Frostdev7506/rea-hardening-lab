import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

let dispatchDatabase;
let quoteDatabase;
export function dispatchDb() {
  if (!dispatchDatabase) {
    const filename = resolve(process.env.DISPATCH_DB_PATH || '.data/dispatch.sqlite');
    mkdirSync(dirname(filename), {recursive: true});
    dispatchDatabase = new DatabaseSync(filename);
    dispatchDatabase.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS dispatch_plans (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS dispatch_reservations (batch_id TEXT NOT NULL, shipment_id TEXT NOT NULL, plan_id TEXT NOT NULL, PRIMARY KEY(batch_id,shipment_id)); CREATE TABLE IF NOT EXISTS dispatch_couriers (batch_id TEXT NOT NULL, courier_id TEXT NOT NULL, plan_id TEXT NOT NULL, PRIMARY KEY(batch_id,courier_id))');
  }
  return dispatchDatabase;
}
export const validId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export const reservedShipments = batch => dispatchDb().prepare('SELECT shipment_id FROM dispatch_reservations WHERE batch_id=?').all(batch).map(row => String(row.shipment_id));
export const reservedCouriers = batch => dispatchDb().prepare('SELECT courier_id FROM dispatch_couriers WHERE batch_id=?').all(batch).map(row => String(row.courier_id));
export function getPlan(id) {
  const row = dispatchDb().prepare('SELECT payload FROM dispatch_plans WHERE id=?').get(id);
  return row ? JSON.parse(String(row.payload)) : null;
}
export function savePlan(batchId, scenario, plan) {
  const createdAt = new Date().toISOString();
  const saved = {id: randomUUID(), batchId: batchId || randomUUID(), state: 'draft', createdAt, scenario, plan, reservedCouriers: batchId ? reservedCouriers(batchId) : [], events: [{type: 'planned', at: createdAt}]};
  dispatchDb().prepare('INSERT INTO dispatch_plans VALUES (?,?,?)').run(saved.id, saved.batchId, JSON.stringify(saved));
  return saved;
}
export class Conflict extends Error {}
export function commitPlan(id) {
  const database = dispatchDb();
  database.exec('BEGIN IMMEDIATE');
  try {
    const saved = getPlan(id);
    if (!saved || saved.state === 'committed') { database.exec('COMMIT'); return saved; }
    const shipments = saved.plan.routes.flatMap(route => route.shipmentIds);
    if (!shipments.length) throw new Conflict('This plan has no shipments to dispatch. Change the constraints and plan again.');
    const existing = new Set(reservedShipments(saved.batchId));
    if (shipments.some(id => existing.has(id))) throw new Conflict('Another plan already dispatched one of these shipments. Replan this batch.');
    const couriers = new Set(reservedCouriers(saved.batchId));
    if (saved.plan.routes.some(route => couriers.has(route.courierId))) throw new Conflict('Another plan already dispatched this courier. Replan this batch.');
    for (const shipment of shipments) database.prepare('INSERT INTO dispatch_reservations VALUES (?,?,?)').run(saved.batchId, shipment, saved.id);
    for (const route of saved.plan.routes) database.prepare('INSERT INTO dispatch_couriers VALUES (?,?,?)').run(saved.batchId, route.courierId, saved.id);
    saved.state = 'committed';
    saved.reservedCouriers = reservedCouriers(saved.batchId);
    saved.events.push({type: 'committed', at: new Date().toISOString()});
    database.prepare('UPDATE dispatch_plans SET payload=? WHERE id=?').run(JSON.stringify(saved), id);
    database.exec('COMMIT');
    return saved;
  } catch (error) { database.exec('ROLLBACK'); throw error; }
}
export function quoteDb() {
  if (!quoteDatabase) {
    const filename = resolve(process.env.DEMO_DB_PATH || '.data/quotes.sqlite');
    mkdirSync(dirname(filename), {recursive: true});
    quoteDatabase = new DatabaseSync(filename);
    quoteDatabase.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, state TEXT NOT NULL, expires INTEGER NOT NULL, payload TEXT NOT NULL)');
  }
  return quoteDatabase;
}
export function saveQuote(parcel, quote) {
  const expires = Date.now() + 600000;
  const saved = {id: randomUUID(), state: 'quoted', expiresAt: new Date(expires).toISOString(), parcel, quote};
  quoteDb().prepare('INSERT INTO quotes VALUES (?,?,?,?)').run(saved.id, saved.state, expires, JSON.stringify(saved));
  return saved;
}
export function getQuote(id) {
  const row = quoteDb().prepare('SELECT state,payload FROM quotes WHERE id=?').get(id);
  return row ? {...JSON.parse(String(row.payload)), state: row.state} : null;
}
export function bookQuote(id) {
  quoteDb().prepare("UPDATE quotes SET state='booked' WHERE id=? AND state='quoted' AND expires>?").run(id, Date.now());
  return getQuote(id);
}
