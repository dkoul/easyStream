import { realPlaybackUrl } from "./stream.js";
import type { EventRecord, EventStatus, EventType, TemplateId, User } from "./types.js";

export type EventStore = {
  upsertUserByPhone(phone: string, name?: string | null): Promise<User>;
  getUser(id: string): Promise<User | undefined>;
  saveOtp(phone: string, code: string, ttlMs: number): Promise<void>;
  consumeOtp(phone: string, code: string): Promise<boolean>;
  createEvent(
    input: Omit<EventRecord, "viewerCount" | "createdAt"> & { createdAt?: string },
  ): Promise<EventRecord>;
  getEventById(id: string): Promise<EventRecord | undefined>;
  getEventBySlug(slug: string): Promise<EventRecord | undefined>;
  listEventsForOwner(ownerId: string): Promise<EventRecord[]>;
  updateEvent(id: string, patch: Partial<EventRecord>): Promise<EventRecord | undefined>;
  bumpViewers(id: string): Promise<number>;
  savePhotoDataUrl?(dataUrl: string): Promise<string>;
};

export function toPublicEvent(event: EventRecord) {
  const { ownerId: _o, ingestUrl: _i, streamKey: _s, ...rest } = event;
  return {
    ...rest,
    playbackUrl: event.status === "live" ? realPlaybackUrl(event.playbackUrl) : null,
  };
}

export function toBroadcasterEvent(event: EventRecord) {
  return event;
}

export function mapEventRow(row: {
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
  viewer_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}): EventRecord {
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
    viewerCount: row.viewer_count,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  };
}
