import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

const DB_PATH = path.join(process.cwd(), "proofit.db");

let sqliteInstance: Database.Database | null = null;
let drizzleDbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getRawSqlite(): Database.Database {
  if (!sqliteInstance) {
    sqliteInstance = new Database(DB_PATH);
    sqliteInstance.pragma("journal_mode = WAL");
    initTables(sqliteInstance);
  }
  return sqliteInstance;
}

export function getDb() {
  if (!drizzleDbInstance) {
    const sqlite = getRawSqlite();
    drizzleDbInstance = drizzle(sqlite, { schema });
  }
  return drizzleDbInstance;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      case_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      agency TEXT NOT NULL,
      investigating_officer_badge TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active'
    );

    CREATE TABLE IF NOT EXISTS evidence_items (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      evidence_id TEXT UNIQUE NOT NULL,
      original_filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      merkle_root TEXT NOT NULL,
      sealed_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Sealed',
      metadata_json TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS custody_ledger (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      sequence_number INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      actor_badge_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      notes TEXT NOT NULL,
      canonical_hash TEXT NOT NULL,
      signature TEXT NOT NULL,
      public_stamp TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS officer_registry (
      badge_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      rank TEXT NOT NULL,
      agency TEXT NOT NULL,
      nin_hash TEXT NOT NULL,
      public_stamp TEXT NOT NULL
    );
  `);
}
