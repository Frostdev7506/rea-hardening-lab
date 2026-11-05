import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { DispatchPlan, DispatchScenario, SavedDispatch } from "./dispatch-types";

let database: DatabaseSync | undefined;
function db() {
  if (!database) {
    const file = resolve(process.env.DISPATCH_DB_PATH || ".data/dispatch.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    database = new DatabaseSync(file);
    database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS dispatch_plans (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS dispatch_reservations (batch_id TEXT NOT NULL, shipment_id TEXT NOT NULL, plan_id TEXT NOT NULL, PRIMARY KEY(batch_id,shipment_id)); CREATE TABLE IF NOT EXISTS dispatch_couriers (batch_id TEXT NOT NULL, courier_id TEXT NOT NULL, plan_id TEXT NOT NULL, PRIMARY KEY(batch_id,courier_id))");
  }
  return database;
}
export class DispatchConflict extends Error {}
export function reservedShipments(batchId: string): string[] {
  return db().prepare("SELECT shipment_id FROM dispatch_reservations WHERE batch_id=?").all(batchId).map((row) => String(row.shipment_id));
}
export function reservedCouriers(batchId: string): string[] {
  return db().prepare("SELECT courier_id FROM dispatch_couriers WHERE batch_id=?").all(batchId).map((row) => String(row.courier_id));
}
export function saveDispatch(batchId: string | null, scenario: DispatchScenario, plan: DispatchPlan): SavedDispatch {
  const createdAt = new Date().toISOString();
  const saved: SavedDispatch = { id: randomUUID(), batchId: batchId || randomUUID(), state: "draft", createdAt, scenario, plan, reservedCouriers: batchId ? reservedCouriers(batchId) : [], events: [{ type: "planned", at: createdAt }] };
  db().prepare("INSERT INTO dispatch_plans VALUES (?,?,?)").run(saved.id, saved.batchId, JSON.stringify(saved));
  return saved;
}
export function readDispatch(id: string): SavedDispatch | null {
  const row = db().prepare("SELECT payload FROM dispatch_plans WHERE id=?").get(id);
  return row ? JSON.parse(String(row.payload)) as SavedDispatch : null;
}
export function commitDispatch(id: string): SavedDispatch | null {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const saved = readDispatch(id);
    if (!saved || saved.state === "committed") { database.exec("COMMIT"); return saved; }
    const ids = saved.plan.routes.flatMap((route) => route.shipmentIds);
    if (!ids.length) throw new DispatchConflict("This plan has no shipments to dispatch. Change the constraints and plan again.");
    const reserved = new Set(reservedShipments(saved.batchId));
    if (ids.some((shipment) => reserved.has(shipment))) throw new DispatchConflict("Another plan already dispatched one of these shipments. Replan this batch.");
    const usedCouriers = new Set(reservedCouriers(saved.batchId));
    if (saved.plan.routes.some((route) => usedCouriers.has(route.courierId))) throw new DispatchConflict("Another plan already dispatched this courier. Replan this batch.");
    for (const shipment of ids) database.prepare("INSERT INTO dispatch_reservations VALUES (?,?,?)").run(saved.batchId, shipment, saved.id);
    for (const route of saved.plan.routes) database.prepare("INSERT INTO dispatch_couriers VALUES (?,?,?)").run(saved.batchId, route.courierId, saved.id);
    saved.state = "committed";
    saved.reservedCouriers = reservedCouriers(saved.batchId);
    saved.events.push({ type: "committed", at: new Date().toISOString() });
    database.prepare("UPDATE dispatch_plans SET payload=? WHERE id=?").run(JSON.stringify(saved), id);
    database.exec("COMMIT");
    return saved;
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}
