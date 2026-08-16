import { nanoid } from "nanoid";

export type StreamSession = {
  streamId: string;
  ingestUrl: string | null;
  streamKey: string | null;
  playbackUrl: string;
};

/**
 * Managed live ingest/playback only. MVP does not persist recordings.
 */
export interface StreamProvider {
  startLive(): Promise<StreamSession>;
  endLive(session: StreamSession): Promise<void>;
}

const DEMO_LIVE =
  process.env.DEMO_LIVE_HLS ??
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

export class DemoStreamProvider implements StreamProvider {
  async startLive(): Promise<StreamSession> {
    return {
      streamId: `demo_${nanoid(10)}`,
      ingestUrl: null,
      streamKey: null,
      playbackUrl: DEMO_LIVE,
    };
  }

  async endLive() {}
}

export class MuxStreamProvider implements StreamProvider {
  constructor(
    private readonly tokenId: string,
    private readonly tokenSecret: string,
  ) {}

  async startLive(): Promise<StreamSession> {
    const auth = Buffer.from(`${this.tokenId}:${this.tokenSecret}`).toString("base64");
    const res = await fetch("https://api.mux.com/video/v1/live-streams", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        playback_policy: ["public"],
        latency_mode: "reduced",
      }),
    });
    if (!res.ok) {
      throw new Error(`Mux live-stream create failed: ${res.status}`);
    }
    const json = (await res.json()) as {
      data: {
        id: string;
        stream_key: string;
        playback_ids: Array<{ id: string }>;
      };
    };
    const playbackId = json.data.playback_ids[0]?.id;
    if (!playbackId) throw new Error("Mux live-stream missing playback id");
    return {
      streamId: json.data.id,
      ingestUrl: "rtmps://global-live.mux.com:443/app",
      streamKey: json.data.stream_key,
      playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`,
    };
  }

  async endLive(session: StreamSession) {
    const auth = Buffer.from(`${this.tokenId}:${this.tokenSecret}`).toString("base64");
    await fetch(`https://api.mux.com/video/v1/live-streams/${session.streamId}/complete`, {
      method: "PUT",
      headers: { Authorization: `Basic ${auth}` },
    });
  }
}

export function createStreamProvider(): StreamProvider {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (id && secret) return new MuxStreamProvider(id, secret);
  return new DemoStreamProvider();
}
