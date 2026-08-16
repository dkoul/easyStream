import { nanoid } from "nanoid";
import type { EventRecord, User } from "./types.js";
import { type EventStore } from "./store.js";

export class MemoryStore implements EventStore {
  private users = new Map<string, User>();
  private usersByPhone = new Map<string, string>();
  private otps = new Map<string, { code: string; expiresAt: number }>();
  private events = new Map<string, EventRecord>();

  async upsertUserByPhone(phone: string, name?: string | null): Promise<User> {
    const existingId = this.usersByPhone.get(phone);
    if (existingId) {
      const user = this.users.get(existingId)!;
      if (name && name !== user.name) user.name = name;
      return user;
    }
    const user: User = {
      id: nanoid(),
      name: name ?? null,
      phone,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    this.usersByPhone.set(phone, user.id);
    return user;
  }

  async getUser(id: string) {
    return this.users.get(id);
  }

  async saveOtp(phone: string, code: string, ttlMs: number) {
    this.otps.set(phone, { code, expiresAt: Date.now() + ttlMs });
  }

  async consumeOtp(phone: string, code: string) {
    const row = this.otps.get(phone);
    if (!row || row.expiresAt < Date.now() || row.code !== code) return false;
    this.otps.delete(phone);
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
    this.events.set(event.id, event);
    return event;
  }

  async getEventById(id: string) {
    return this.events.get(id);
  }

  async getEventBySlug(slug: string) {
    return [...this.events.values()].find((e) => e.slug === slug);
  }

  async listEventsForOwner(ownerId: string) {
    return [...this.events.values()]
      .filter((e) => e.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateEvent(id: string, patch: Partial<EventRecord>) {
    const current = this.events.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch, id: current.id };
    this.events.set(id, next);
    return next;
  }

  async bumpViewers(id: string) {
    const current = this.events.get(id);
    if (!current) return 0;
    current.viewerCount += 1;
    return current.viewerCount;
  }

  async savePhotoDataUrl(dataUrl: string) {
    return dataUrl;
  }
}
