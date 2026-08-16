import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import type { EventRecord, User } from "./types.js";
import { mapEventRow, type EventStore } from "./store.js";

export const DEFAULT_SUPABASE_URL = "https://txwjbficiwbenbifzpok.supabase.co";

type EventInsert = {
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
};

function toRow(event: EventRecord): EventInsert {
  return {
    id: event.id,
    owner_id: event.ownerId,
    slug: event.slug,
    type: event.type,
    title: event.title,
    person_name: event.personName,
    photo_url: event.photoUrl,
    date: event.date,
    location: event.location,
    message: event.message,
    template: event.template,
    status: event.status,
    stream_id: event.streamId,
    ingest_url: event.ingestUrl,
    stream_key: event.streamKey,
    playback_url: event.playbackUrl,
    viewer_count: event.viewerCount,
    started_at: event.startedAt,
    ended_at: event.endedAt,
    created_at: event.createdAt,
  };
}

export function createSupabaseAdmin(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class SupabaseStore implements EventStore {
  constructor(private readonly sb: SupabaseClient) {}

  async upsertUserByPhone(phone: string, name?: string | null): Promise<User> {
    const { data: existing, error: lookupError } = await this.sb
      .from("users")
      .select("id, name, phone, created_at")
      .eq("phone", phone)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      if (name && name !== existing.name) {
        await this.sb.from("users").update({ name }).eq("id", existing.id);
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
    const { error } = await this.sb.from("users").insert({
      id: user.id,
      name: user.name,
      phone: user.phone,
      created_at: user.createdAt,
    });
    if (error) throw error;
    return user;
  }

  async getUser(id: string) {
    const { data, error } = await this.sb
      .from("users")
      .select("id, name, phone, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return {
      id: data.id as string,
      name: data.name as string | null,
      phone: data.phone as string,
      createdAt: data.created_at as string,
    };
  }

  async saveOtp(phone: string, code: string, ttlMs: number) {
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const { error } = await this.sb.from("otp_codes").upsert({
      phone,
      code,
      expires_at: expiresAt,
    });
    if (error) throw error;
  }

  async consumeOtp(phone: string, code: string) {
    const { data, error } = await this.sb
      .from("otp_codes")
      .select("code, expires_at")
      .eq("phone", phone)
      .maybeSingle();
    if (error) throw error;
    if (!data) return false;
    if (new Date(data.expires_at as string).getTime() < Date.now()) return false;
    if (data.code !== code) return false;
    await this.sb.from("otp_codes").delete().eq("phone", phone);
    return true;
  }

  async createEvent(
    input: Omit<EventRecord, "viewerCount" | "createdAt"> & { createdAt?: string },
  ) {
    const event: EventRecord = {
      ...input,
      viewerCount: 0,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    const { error } = await this.sb.from("events").insert(toRow(event));
    if (error) throw error;
    return event;
  }

  async getEventById(id: string) {
    const { data, error } = await this.sb.from("events").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapEventRow(data) : undefined;
  }

  async getEventBySlug(slug: string) {
    const { data, error } = await this.sb.from("events").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data ? mapEventRow(data) : undefined;
  }

  async listEventsForOwner(ownerId: string) {
    const { data, error } = await this.sb
      .from("events")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapEventRow);
  }

  async updateEvent(id: string, patch: Partial<EventRecord>) {
    const current = await this.getEventById(id);
    if (!current) return undefined;
    const next = { ...current, ...patch, id: current.id };
    const { error } = await this.sb.from("events").update(toRow(next)).eq("id", id);
    if (error) throw error;
    return next;
  }

  async bumpViewers(id: string) {
    const current = await this.getEventById(id);
    if (!current) return 0;
    const viewerCount = current.viewerCount + 1;
    const { error } = await this.sb.from("events").update({ viewer_count: viewerCount }).eq("id", id);
    if (error) throw error;
    return viewerCount;
  }

  async savePhotoDataUrl(dataUrl: string) {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) throw new Error("Photo must be a data URL");
    const ext = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg";
    const path = `${nanoid()}.${ext}`;
    const bytes = Buffer.from(match[2], "base64");
    const { error } = await this.sb.storage.from("event-photos").upload(path, bytes, {
      contentType: match[1],
      upsert: false,
    });
    if (error) throw error;
    const { data } = this.sb.storage.from("event-photos").getPublicUrl(path);
    return data.publicUrl;
  }
}
