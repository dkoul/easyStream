import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp, shareText } from "../app.js";
import { makeEventSlug, slugifyBase } from "../slug.js";
import type { StreamProvider } from "../stream.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "easystream-"));
const app = await buildApp({
  dbPath: path.join(tmp, "test.sqlite"),
  jwtSecret: "test-secret",
  publicBaseUrl: "https://easystream.in",
  uploadDir: path.join(tmp, "uploads"),
  processingDelayMs: 0,
  logger: false,
  streamProvider: {
    async startLive() {
      return {
        streamId: "s1",
        ingestUrl: "rtmps://example/app",
        streamKey: "key",
        playbackUrl: "https://cdn.example/live.m3u8",
        recordingUrl: "https://cdn.example/rec.mp4",
      };
    },
    async endLive() {
      return { recordingUrl: "https://cdn.example/rec.mp4" };
    },
  } satisfies StreamProvider,
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function authToken() {
  await app.inject({
    method: "POST",
    url: "/auth/otp/request",
    payload: { phone: "9876543210" },
  });
  const res = await app.inject({
    method: "POST",
    url: "/auth/otp/verify",
    payload: { phone: "9876543210", code: "123456", name: "Deepak" },
  });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

describe("slug", () => {
  it("builds a short human-readable slug", () => {
    expect(slugifyBase(["Rajesh Koul", "Prayer Meet"])).toBe("rajesh-koul-prayer-meet");
  });

  it("adds a random suffix for unlisted privacy", () => {
    const slug = makeEventSlug("Rajesh Koul", "Prayer Meet");
    expect(slug.startsWith("rajesh-koul-prayer-meet-")).toBe(true);
    expect(slug.split("-").at(-1)?.length).toBe(6);
  });
});

describe("auth and event lifecycle", () => {
  it("rejects a bad OTP", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phone: "9999999999" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { phone: "9999999999", code: "000000" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates an unlisted event and walks upcoming → live → processing → completed", async () => {
    const token = await authToken();
    const created = await app.inject({
      method: "POST",
      url: "/events",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: "prayer_meet",
        title: "Prayer Meet",
        personName: "Rajesh Koul",
        date: "16 August 2026",
        location: "Pune",
        message: "Your presence means everything.",
        template: "traditional",
      },
    });
    expect(created.statusCode).toBe(200);
    const body = created.json();
    expect(body.event.status).toBe("upcoming");
    expect(body.event.slug).toMatch(/rajesh-koul-prayer-meet-/);
    expect(body.shareUrl).toContain(body.event.slug);

    const publicBefore = await app.inject({ method: "GET", url: `/e/${body.event.slug}` });
    expect(publicBefore.statusCode).toBe(200);
    expect(publicBefore.json().event.streamKey).toBeUndefined();
    expect(publicBefore.json().event.ingestUrl).toBeUndefined();

    const live = await app.inject({
      method: "POST",
      url: `/events/${body.event.id}/go-live`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(live.statusCode).toBe(200);
    expect(live.json().event.status).toBe("live");
    expect(live.json().shareText).toContain("Rajesh Koul's Prayer Meet is LIVE");
    expect(live.json().event.streamKey).toBe("key");

    const presence = await app.inject({
      method: "POST",
      url: `/e/${body.event.slug}/presence`,
    });
    expect(presence.json().viewerCount).toBe(1);

    const ended = await app.inject({
      method: "POST",
      url: `/events/${body.event.id}/end`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ended.statusCode).toBe(200);
    expect(["processing", "completed"]).toContain(ended.json().event.status);

    const after = await app.inject({ method: "GET", url: `/e/${body.event.slug}` });
    expect(after.json().event.status).toBe("completed");
    expect(after.json().event.recordingUrl).toBe("https://cdn.example/rec.mp4");
  });

  it("does not list events on a public index", async () => {
    const res = await app.inject({ method: "GET", url: "/events" });
    expect(res.statusCode).toBe(401);
  });

  it("formats the WhatsApp share message", () => {
    const text = shareText(
      {
        id: "1",
        ownerId: "u",
        slug: "rajesh-koul-abc123",
        type: "prayer_meet",
        title: "Prayer Meet",
        personName: "Rajesh Koul",
        photoUrl: null,
        date: "16 August 2026",
        location: "Pune",
        message: null,
        template: "classic",
        status: "live",
        streamId: null,
        ingestUrl: null,
        streamKey: null,
        playbackUrl: null,
        recordingUrl: null,
        viewerCount: 0,
        startedAt: null,
        endedAt: null,
        createdAt: "",
      },
      "https://easystream.in",
    );
    expect(text).toContain("https://easystream.in/e/rajesh-koul-abc123");
  });
});
