import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { openDatabase } from "./db.js";
import { makeEventSlug } from "./slug.js";
import { Store, toBroadcasterEvent, toPublicEvent } from "./store.js";
import { createStreamProvider, type StreamProvider } from "./stream.js";
import {
  EVENT_TYPES,
  TEMPLATES,
  type EventRecord,
  type EventStatus,
} from "./types.js";

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
  dbPath: string;
  jwtSecret: string;
  publicBaseUrl: string;
  uploadDir: string;
  streamProvider?: StreamProvider;
  otpTtlMs?: number;
  processingDelayMs?: number;
  logger?: boolean;
};

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return raw.trim();
}

function savePhoto(uploadDir: string, dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) throw new Error("Photo must be a data URL");
  const ext = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg";
  const filename = `${nanoid()}.${ext}`;
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(match[2], "base64"));
  return `/uploads/${filename}`;
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  const db = openDatabase(opts.dbPath);
  const store = new Store(db);
  const streams = opts.streamProvider ?? createStreamProvider();
  const processingDelayMs = opts.processingDelayMs ?? 1500;

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: opts.jwtSecret });
  await app.register(multipart, { limits: { fileSize: 8_000_000 } });
  fs.mkdirSync(opts.uploadDir, { recursive: true });
  await app.register(staticFiles, {
    root: opts.uploadDir,
    prefix: "/uploads/",
    decorateReply: false,
  });

  app.decorate("store", store);

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
    const user = store.getUser(payload.sub);
    if (!user) throw httpError(401, "Please sign in again");
    return user;
  }

  app.get("/health", async () => ({ ok: true }));

  app.post("/auth/otp/request", async (request) => {
    const body = z.object({ phone: z.string().min(10) }).parse(request.body);
    const phone = normalizePhone(body.phone);
    const code = process.env.FIXED_OTP ?? "123456";
    store.saveOtp(phone, code, opts.otpTtlMs ?? 10 * 60 * 1000);
    return {
      ok: true,
      message: "We sent a 6-digit code to your phone.",
      // Dev-only hint so the Android/web studio can proceed without SMS.
      demoCode: process.env.NODE_ENV === "production" ? undefined : code,
    };
  });

  app.post("/auth/otp/verify", async (request) => {
    const body = z
      .object({ phone: z.string().min(10), code: z.string().min(4), name: z.string().optional() })
      .parse(request.body);
    const phone = normalizePhone(body.phone);
    if (!store.consumeOtp(phone, body.code)) {
      throw httpError(401, "That code did not work. Please try again.");
    }
    const user = store.upsertUserByPhone(phone, body.name ?? null);
    const token = await app.jwt.sign({ sub: user.id, phone: user.phone }, { expiresIn: "30d" });
    return { token, user };
  });

  app.get("/me", async (request) => {
    const user = await requireUser(request);
    return { user };
  });

  app.get("/events", async (request) => {
    const user = await requireUser(request);
    return { events: store.listEventsForOwner(user.id).map(toBroadcasterEvent) };
  });

  app.post("/events", async (request) => {
    const user = await requireUser(request);
    const body = createEventSchema.parse(request.body);
    let photoUrl: string | null = null;
    if (body.photoDataUrl) {
      photoUrl = savePhoto(opts.uploadDir, body.photoDataUrl);
    }
    const event = store.createEvent({
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
      recordingUrl: null,
      startedAt: null,
      endedAt: null,
    });
    return { event: toBroadcasterEvent(event), shareUrl: shareUrl(opts.publicBaseUrl, event.slug) };
  });

  app.get("/events/:id", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const event = store.getEventById(id);
    if (!event || event.ownerId !== user.id) throw httpError(404, "Event not found");
    return { event: toBroadcasterEvent(event), shareUrl: shareUrl(opts.publicBaseUrl, event.slug) };
  });

  app.post("/events/:id/photo", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const event = owned(store, user.id, id);
    const file = await request.file();
    if (!file) throw httpError(400, "Please add a photograph");
    const buf = await file.toBuffer();
    const ext = file.mimetype.includes("png") ? "png" : "jpg";
    const filename = `${nanoid()}.${ext}`;
    fs.writeFileSync(path.join(opts.uploadDir, filename), buf);
    const updated = store.updateEvent(event.id, { photoUrl: `/uploads/${filename}` })!;
    return { event: toBroadcasterEvent(updated) };
  });

  app.post("/events/:id/go-live", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const event = owned(store, user.id, id);
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
    const updated = store.updateEvent(event.id, {
      status: "live",
      streamId: session.streamId,
      ingestUrl: session.ingestUrl,
      streamKey: session.streamKey,
      playbackUrl: session.playbackUrl,
      recordingUrl: session.recordingUrl,
      startedAt: new Date().toISOString(),
      viewerCount: 0,
    })!;
    return {
      event: toBroadcasterEvent(updated),
      shareUrl: shareUrl(opts.publicBaseUrl, updated.slug),
      shareText: shareText(updated, opts.publicBaseUrl),
    };
  });

  app.post("/events/:id/end", async (request) => {
    const user = await requireUser(request);
    const { id } = request.params as { id: string };
    const event = owned(store, user.id, id);
    if (event.status !== "live") {
      throw httpError(400, "This livestream is not running.");
    }
    store.updateEvent(event.id, {
      status: "processing",
      endedAt: new Date().toISOString(),
    });
    const session = {
      streamId: event.streamId ?? "",
      ingestUrl: event.ingestUrl,
      streamKey: event.streamKey,
      playbackUrl: event.playbackUrl ?? "",
      recordingUrl: event.recordingUrl ?? "",
    };
    const { recordingUrl } = await streams.endLive(session);
    const finish = () =>
      store.updateEvent(event.id, {
        status: "completed" satisfies EventStatus,
        recordingUrl,
        playbackUrl: recordingUrl,
      });
    if (processingDelayMs <= 0) {
      finish();
    } else {
      setTimeout(finish, processingDelayMs);
    }
    const processing = store.getEventById(event.id)!;
    return { event: toBroadcasterEvent(processing) };
  });

  app.get("/e/:slug", async (request) => {
    const { slug } = request.params as { slug: string };
    const event = store.getEventBySlug(slug);
    if (!event) throw httpError(404, "This event link is not valid.");
    return { event: toPublicEvent(event) };
  });

  app.post("/e/:slug/presence", async (request) => {
    const { slug } = request.params as { slug: string };
    const event = store.getEventBySlug(slug);
    if (!event) throw httpError(404, "This event link is not valid.");
    const viewerCount = store.bumpViewers(event.id);
    return { viewerCount };
  });

  app.addHook("onClose", async () => {
    db.close();
  });

  return app;
}

function owned(store: Store, userId: string, eventId: string): EventRecord {
  const event = store.getEventById(eventId);
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
