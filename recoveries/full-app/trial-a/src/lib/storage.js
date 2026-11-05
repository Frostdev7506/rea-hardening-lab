import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

let dispatchDb;
let quoteDb;
function openDatabase(filename) {
  const path = resolve(filename);
  mkdirSync(dirname(path), {recursive: true});
  const database = new DatabaseSync(path);
  database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;');
  return database;
}
export function dispatchDatabase() {
  if (!dispatchDb) {
    dispatchDb = openDatabase(process.env.DISPATCH_DB_PATH || '.data/dispatch.sqlite');
    dispatchDb.exec('CREATE TABLE IF NOT EXISTS dispatch_plans (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS dispatch_reservations (batch_id TEXT NOT NULL, shipment_id TEXT NOT NULL, plan_id TEXT NOT NULL, PRIMARY KEY(batch_id,shipment_id)); CREATE TABLE IF NOT EXISTS dispatch_couriers (batch_id TEXT NOT NULL, courier_id TEXT NOT NULL, plan_id TEXT NOT NULL, PRIMARY KEY(batch_id,courier_id));');
  }
  return dispatchDb;
}
export function reservedShipments(batchId) {return dispatchDatabase().prepare('SELECT shipment_id FROM dispatch_reservations WHERE batch_id=?').all(batchId).map(row => String(row.shipment_id));}
export function reservedCouriers(batchId) {return dispatchDatabase().prepare('SELECT courier_id FROM dispatch_couriers WHERE batch_id=?').all(batchId).map(row => String(row.courier_id));}
export function savePlan(batchId, scenario, plan) {
  const timestamp = new Date().toISOString();
  const saved = {id: randomUUID(), batchId: batchId || randomUUID(), state: 'draft', createdAt: timestamp, scenario, plan, reservedCouriers: batchId ? reservedCouriers(batchId) : [], events: [{type: 'planned', at: timestamp}]};
  dispatchDatabase().prepare('INSERT INTO dispatch_plans VALUES (?,?,?)').run(saved.id, saved.batchId, JSON.stringify(saved));
  return saved;
}
export function getPlan(id) {
  const row = dispatchDatabase().prepare('SELECT payload FROM dispatch_plans WHERE id=?').get(id);
  return row ? JSON.parse(String(row.payload)) : null;
}
export class Conflict extends Error {}
export function commitPlan(id) {
  const database = dispatchDatabase();
  database.exec('BEGIN IMMEDIATE');
  try {
    const saved = getPlan(id);
    if (!saved || saved.state === 'committed') {database.exec('COMMIT'); return saved;}
    const shipments = saved.plan.routes.flatMap(route => route.shipmentIds);
    if (!shipments.length) throw new Conflict('This plan has no shipments to dispatch. Change the constraints and plan again.');
    const dispatched = new Set(reservedShipments(saved.batchId));
    if (shipments.some(id => dispatched.has(id))) throw new Conflict('Another plan already dispatched one of these shipments. Replan this batch.');
    const unavailable = new Set(reservedCouriers(saved.batchId));
    if (saved.plan.routes.some(route => unavailable.has(route.courierId))) throw new Conflict('Another plan already dispatched this courier. Replan this batch.');
    for (const shipmentId of shipments) database.prepare('INSERT INTO dispatch_reservations VALUES (?,?,?)').run(saved.batchId, shipmentId, saved.id);
    for (const route of saved.plan.routes) database.prepare('INSERT INTO dispatch_couriers VALUES (?,?,?)').run(saved.batchId, route.courierId, saved.id);
    saved.state = 'committed';
    saved.reservedCouriers = reservedCouriers(saved.batchId);
    saved.events.push({type: 'committed', at: new Date().toISOString()});
    database.prepare('UPDATE dispatch_plans SET payload=? WHERE id=?').run(JSON.stringify(saved), id);
    database.exec('COMMIT');
    return saved;
  } catch (error) {database.exec('ROLLBACK'); throw error;}
}
export function quoteDatabase() {
  if (!quoteDb) {
    quoteDb = openDatabase(process.env.DEMO_DB_PATH || '.data/quotes.sqlite');
    quoteDb.exec('CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, state TEXT NOT NULL, expires INTEGER NOT NULL, payload TEXT NOT NULL)');
  }
  return quoteDb;
}
export function saveQuote(parcel, quote) {
  const expires = Date.now() + 600000;
  const saved = {id: randomUUID(), state: 'quoted', expiresAt: new Date(expires).toISOString(), parcel, quote};
  quoteDatabase().prepare('INSERT INTO quotes VALUES (?,?,?,?)').run(saved.id, saved.state, expires, JSON.stringify(saved));
  return saved;
}
export function getQuote(id) {
  const row = quoteDatabase().prepare('SELECT state,payload FROM quotes WHERE id=?').get(id);
  return row ? {...JSON.parse(String(row.payload)), state: row.state} : null;
}
export function bookQuote(id) {
  quoteDatabase().prepare("UPDATE quotes SET state='booked' WHERE id=? AND state='quoted' AND expires>?").run(id, Date.now());
  return getQuote(id);
}
