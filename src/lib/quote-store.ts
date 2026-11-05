import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Parcel } from "./parcel";
import type { calculateQuote } from "./quote";

type Price = ReturnType<typeof calculateQuote>;
type SavedQuote = { id: string; state: "quoted" | "booked"; expiresAt: string; parcel: Parcel; quote: Price };
let database: DatabaseSync | undefined;
function db() {
  if (!database) {
    const file = resolve(process.env.DEMO_DB_PATH || ".data/quotes.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    database = new DatabaseSync(file);
    database.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000; CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, state TEXT NOT NULL, expires INTEGER NOT NULL, payload TEXT NOT NULL)");
  }
  return database;
}
export function saveQuote(parcel: Parcel, quote: Price): SavedQuote {
  const id = randomUUID();
  const expires = Date.now() + 10 * 60 * 1000;
  const saved: SavedQuote = { id, state: "quoted", expiresAt: new Date(expires).toISOString(), parcel, quote };
  db().prepare("INSERT INTO quotes VALUES (?, ?, ?, ?)").run(id, saved.state, expires, JSON.stringify(saved));
  return saved;
}
export function readQuote(id: string): SavedQuote | null {
  const row = db().prepare("SELECT state, payload FROM quotes WHERE id = ?").get(id);
  if (!row) return null;
  return { ...JSON.parse(String(row.payload)), state: row.state };
}
export function bookQuote(id: string) {
  // A conditional update makes repeated booking requests idempotent.
  db().prepare("UPDATE quotes SET state = 'booked' WHERE id = ? AND state = 'quoted' AND expires > ?").run(id, Date.now());
  return readQuote(id);
}
