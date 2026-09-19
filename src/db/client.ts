import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzleBetterSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import * as schema from "./schema";

let drizzleDbInstance: any = null;

export function getDb() {
  if (!drizzleDbInstance) {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

    if (tursoUrl) {
      // Production / Vercel Serverless: Turso Cloud SQLite
      const client = createClient({
        url: tursoUrl,
        authToken: tursoAuthToken,
      });
      drizzleDbInstance = drizzleLibsql(client, { schema });
    } else {
      // Local Development / Offline fallback: Local SQLite file
      const DB_PATH = path.join(process.cwd(), "proofit.db");
      const sqlite = new Database(DB_PATH);
      sqlite.pragma("journal_mode = WAL");
      initTables(sqlite);
      drizzleDbInstance = drizzleBetterSqlite(sqlite, { schema });
    }
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
