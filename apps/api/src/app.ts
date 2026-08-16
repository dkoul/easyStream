import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import { MemoryStore } from "./memory-store.js";
import { makeEventSlug } from "./slug.js";
import { toBroadcasterEvent, toPublicEvent, type EventStore } from "./store.js";
import { createStreamProvider, type StreamProvider } from "./stream.js";
import type { EventRecord } from "./types.js";
import { EVENT_TYPES, TEMPLATES } from "./types.js";

const createEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  title: z.string().min(1).max(120),
  personName: z.string().max(120).optional().nullable(),
  date: z.string().min(1).max(80),
  location: z.string().min(1).max(120),
  message: z.string().max(500).optional().nullable(),
  template: z.enum(TEMPLATES).default("classic"),
  photoDataUrl: z.string().max(8_000_000).optional().nullable(),
});

export type AppOptions = {
  jwtSecret: string;
  publicBaseUrl: string;
  store?: EventStore;
  streamProvider?: StreamProvider;
  otpTtlMs?: number;
  logger?: boolean;
};

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return raw.trim();
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  const store = opts.store ?? new MemoryStore();
  const streams = opts.streamProvider ?? createStreamProvider();

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: opts.jwtSecret });

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ message: "Please check the details and try again." });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    const message =
      status >= 500
        ? "Something went wrong. Please try again."
        : err instanceof Error
          ? err.message
          : "Please try again.";
    return reply.status(status).send({ message });
  });

  async function requireUser(request: FastifyRequest) {
    try {
      await request.jwtVerify();
    } catch {
      throw httpError(401, "Please sign in again");
    }
    const payload = request.user as { sub: string };
    const user = await store.getUser(payload.sub);
    if (!user) throw httpError(401, "Please sign in again");
    return user;
  }

  app.get("/health", async () => ({ ok: true, store: store.constructor.name }));

  app.post("/auth/otp/request", async (request) => {
    const body = z.object({ phone: z.string().min(10) }).parse(request.body);
    const phone = normalizePhone(body.phone);
    const code = process.env.FIXED_OTP ?? "123456";
    await store.saveOtp(phone, code, opts.otpTtlMs ?? 10 * 60 * 1000);
    return {
      ok: true,
      message: "We sent a 6-digit code to your phone.",
      demoCode: process.env.NODE_ENV === "production" ? undefined : code,
    };
  });

  app.post("/auth/otp/verify", async (request) => {
    const body = z
      .object({ phone: z.string().min(10), code: z.string().min(4), name: z.string().optional() })
      .parse(request.body);
    const phone = normalizePhone(body.phone);
    if (!(await store.consumeOtp(phone, body.code))) {
      throw httpError(401, "That code did not work. Please try again.");
    }
    const user = await store.upsertUserByPhone(phone, body.name ?? null);
    const token = await app.jwt.sign({ sub: user.id, phone: user.phone }, { expiresIn: "30d" });
    return { token, user };
  });

  app.get("/me", async (request) => {
    const user = await requireUser(request);
    return { user };
  });

  app.get("/events", async (request) => {
    const user = await requireUser(request);
    const events = await store.listEventsForOwner(user.id);
    return { events: events.map(toBroadcasterEvent) };
  });

  app.post("/events", async (request) => {
    const user = await requireUser(request);
    const body = createEventSchema.parse(request.body);
    let photoUrl: string | null = null;
    if (body.photoDataUrl) {
      photoUrl = store.savePhotoDataUrl
        ? await store.savePhotoDataUrl(body.photoDataUrl)
        : body.photoDataUrl;
    }
    const event = await store.createEvent({
      id: nanoid(),
      ownerId: user.id,
      slug: makeEventSlug(body.personName, body.title),
      type: body.type,
      title: body.title,
      personName: body.personName ?? null,
      photoUrl,
      date: body.date,
      location: body.location,
      message: body.message ?? null,
      template: body.template,
      status: "upcoming",
      streamId: null,
      ingestUrl: null,
      streamKey: null,
      playbackUrl: null,
      startedAt: null,
      endedAt: null,
    });
    return { event: toBroadcasterEvent(event), shareUrl: shareUrl(opts.publicBaseUrl, event.slug) };
  });

  app.get("/events/:id", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const event = await store.getEventById(id);
    if (!event || event.ownerId !== user.id) throw httpError(404, "Event not found");
    return { event: toBroadcasterEvent(event), shareUrl: shareUrl(opts.publicBaseUrl, event.slug) };
  });

  app.post("/events/:id/go-live", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const event = await owned(store, user.id, id);
    if (event.status === "live") {
      return {
        event: toBroadcasterEvent(event),
        shareUrl: shareUrl(opts.publicBaseUrl, event.slug),
        shareText: shareText(event, opts.publicBaseUrl),
      };
    }
    if (event.status !== "upcoming" && event.status !== "draft") {
      throw httpError(400, "This event can no longer go live.");
    }
    const session = await streams.startLive();
    const updated = (await store.updateEvent(event.id, {
      status: "live",
      streamId: session.streamId,
      ingestUrl: session.ingestUrl,
      streamKey: session.streamKey,
      playbackUrl: session.playbackUrl,
      startedAt: new Date().toISOString(),
      viewerCount: 0,
    }))!;
    return {
      event: toBroadcasterEvent(updated),
      shareUrl: shareUrl(opts.publicBaseUrl, updated.slug),
      shareText: shareText(updated, opts.publicBaseUrl),
    };
  });

  app.post("/events/:id/end", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const event = await owned(store, user.id, id);
    if (event.status !== "live") {
      throw httpError(400, "This livestream is not running.");
    }
    await streams.endLive({
      streamId: event.streamId ?? "",
      ingestUrl: event.ingestUrl,
      streamKey: event.streamKey,
      playbackUrl: event.playbackUrl ?? "",
    });
    const completed = (await store.updateEvent(event.id, {
      status: "completed",
      endedAt: new Date().toISOString(),
      playbackUrl: null,
      ingestUrl: null,
      streamKey: null,
    }))!;
    return { event: toBroadcasterEvent(completed) };
  });

  app.get("/e/:slug", async (request) => {
    const { slug } = request.params as { slug: string };
    const event = await store.getEventBySlug(slug);
    if (!event) throw httpError(404, "This event link is not valid.");
    return { event: toPublicEvent(event) };
  });

  app.post("/e/:slug/presence", async (request) => {
    const { slug } = request.params as { slug: string };
    const event = await store.getEventBySlug(slug);
    if (!event) throw httpError(404, "This event link is not valid.");
    const viewerCount = await store.bumpViewers(event.id);
    return { viewerCount };
  });

  return app;
}

async function owned(store: EventStore, userId: string, eventId: string): Promise<EventRecord> {
  const event = await store.getEventById(eventId);
  if (!event || event.ownerId !== userId) throw httpError(404, "Event not found");
  return event;
}

function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export function shareUrl(publicBaseUrl: string, slug: string) {
  return `${publicBaseUrl.replace(/\/$/, "")}/e/${slug}`;
}

export function shareText(event: EventRecord, publicBaseUrl: string) {
  const who = event.personName ? `${event.personName}'s ` : "";
  return `🔴 *${who}${event.title} is LIVE*\n\nJoin us remotely:\n\n${shareUrl(publicBaseUrl, event.slug)}`;
}
