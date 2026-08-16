import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function openDatabase(filePath: string): Database.Database {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      person_name TEXT,
      photo_url TEXT,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      message TEXT,
      template TEXT NOT NULL,
      status TEXT NOT NULL,
      stream_id TEXT,
      ingest_url TEXT,
      stream_key TEXT,
      playback_url TEXT,
      recording_url TEXT,
      viewer_count INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      ended_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );
  `);
}
