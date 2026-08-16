import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { EventRecord, EventStatus, EventType, TemplateId, User } from "./types.js";

type EventRow = {
  id: string;
  owner_id: string;
  slug: string;
  type: string;
  title: string;
  person_name: string | null;
  photo_url: string | null;
  date: string;
  location: string;
  message: string | null;
  template: string;
  status: string;
  stream_id: string | null;
  ingest_url: string | null;
  stream_key: string | null;
  playback_url: string | null;
  recording_url: string | null;
  viewer_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

function mapEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    type: row.type as EventType,
    title: row.title,
    personName: row.person_name,
    photoUrl: row.photo_url,
    date: row.date,
    location: row.location,
    message: row.message,
    template: row.template as TemplateId,
    status: row.status as EventStatus,
    streamId: row.stream_id,
    ingestUrl: row.ingest_url,
    streamKey: row.stream_key,
    playbackUrl: row.playback_url,
    recordingUrl: row.recording_url,
    viewerCount: row.viewer_count,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  };
}

export class Store {
  constructor(private readonly db: Database.Database) {}

  upsertUserByPhone(phone: string, name?: string | null): User {
    const existing = this.db
      .prepare("SELECT * FROM users WHERE phone = ?")
      .get(phone) as
      | { id: string; name: string | null; phone: string; created_at: string }
      | undefined;
    if (existing) {
      if (name && name !== existing.name) {
        this.db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, existing.id);
        existing.name = name;
      }
      return {
        id: existing.id,
        name: existing.name,
        phone: existing.phone,
        createdAt: existing.created_at,
      };
    }
    const user: User = {
      id: nanoid(),
      name: name ?? null,
      phone,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        "INSERT INTO users (id, name, phone, created_at) VALUES (@id, @name, @phone, @createdAt)",
      )
      .run(user);
    return user;
  }

  getUser(id: string): User | undefined {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | { id: string; name: string | null; phone: string; created_at: string }
      | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      createdAt: row.created_at,
    };
  }

  saveOtp(phone: string, code: string, ttlMs: number) {
    this.db
      .prepare(
        `INSERT INTO otp_codes (phone, code, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at`,
      )
      .run(phone, code, Date.now() + ttlMs);
  }

  consumeOtp(phone: string, code: string): boolean {
    const row = this.db
      .prepare("SELECT code, expires_at FROM otp_codes WHERE phone = ?")
      .get(phone) as { code: string; expires_at: number } | undefined;
    if (!row) return false;
    if (row.expires_at < Date.now()) return false;
    if (row.code !== code) return false;
    this.db.prepare("DELETE FROM otp_codes WHERE phone = ?").run(phone);
    return true;
  }

  createEvent(input: Omit<EventRecord, "viewerCount" | "createdAt"> & { createdAt?: string }): EventRecord {
    const event: EventRecord = {
      ...input,
      viewerCount: 0,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO events (
          id, owner_id, slug, type, title, person_name, photo_url, date, location,
          message, template, status, stream_id, ingest_url, stream_key, playback_url,
          recording_url, viewer_count, started_at, ended_at, created_at
        ) VALUES (
          @id, @ownerId, @slug, @type, @title, @personName, @photoUrl, @date, @location,
          @message, @template, @status, @streamId, @ingestUrl, @streamKey, @playbackUrl,
          @recordingUrl, @viewerCount, @startedAt, @endedAt, @createdAt
        )`,
      )
      .run(event);
    return event;
  }

  getEventById(id: string): EventRecord | undefined {
    const row = this.db.prepare("SELECT * FROM events WHERE id = ?").get(id) as
      | EventRow
      | undefined;
    return row ? mapEvent(row) : undefined;
  }

  getEventBySlug(slug: string): EventRecord | undefined {
    const row = this.db.prepare("SELECT * FROM events WHERE slug = ?").get(slug) as
      | EventRow
      | undefined;
    return row ? mapEvent(row) : undefined;
  }

  listEventsForOwner(ownerId: string): EventRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM events WHERE owner_id = ? ORDER BY created_at DESC")
      .all(ownerId) as EventRow[];
    return rows.map(mapEvent);
  }

  updateEvent(id: string, patch: Partial<EventRecord>): EventRecord | undefined {
    const current = this.getEventById(id);
    if (!current) return undefined;
    const next = { ...current, ...patch, id: current.id };
    this.db
      .prepare(
        `UPDATE events SET
          owner_id = @ownerId, slug = @slug, type = @type, title = @title,
          person_name = @personName, photo_url = @photoUrl, date = @date,
          location = @location, message = @message, template = @template,
          status = @status, stream_id = @streamId, ingest_url = @ingestUrl,
          stream_key = @streamKey, playback_url = @playbackUrl,
          recording_url = @recordingUrl, viewer_count = @viewerCount,
          started_at = @startedAt, ended_at = @endedAt, created_at = @createdAt
         WHERE id = @id`,
      )
      .run(next);
    return next;
  }

  bumpViewers(id: string): number {
    this.db
      .prepare("UPDATE events SET viewer_count = viewer_count + 1 WHERE id = ?")
      .run(id);
    const row = this.db
      .prepare("SELECT viewer_count FROM events WHERE id = ?")
      .get(id) as { viewer_count: number };
    return row.viewer_count;
  }
}

export function toPublicEvent(event: EventRecord) {
  const { ownerId: _o, ingestUrl: _i, streamKey: _s, ...rest } = event;
  return rest;
}

export function toBroadcasterEvent(event: EventRecord) {
  return event;
}
