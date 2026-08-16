import { nanoid } from "nanoid";

export type StreamSession = {
  streamId: string;
  ingestUrl: string | null;
  streamKey: string | null;
  playbackUrl: string | null;
};

/**
 * Managed live ingest/playback only. MVP does not persist recordings
 * and never substitutes a sample clip for the family camera.
 */
export interface StreamProvider {
  startLive(): Promise<StreamSession>;
  endLive(session: StreamSession): Promise<void>;
}

const PLACEHOLDER_PLAYBACK_HOSTS = [
  "test-streams.mux.dev",
  "gtv-videos-bucket",
  "commondatastorage.googleapis.com",
];

/** Drop leftover demo/sample clips so the viewer never plays a random video. */
export function realPlaybackUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (PLACEHOLDER_PLAYBACK_HOSTS.some((host) => lower.includes(host))) return null;
  return url;
}

export class LocalStreamProvider implements StreamProvider {
  async startLive(): Promise<StreamSession> {
    return {
      streamId: `local_${nanoid(10)}`,
      ingestUrl: null,
      streamKey: null,
      playbackUrl: null,
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
  return new LocalStreamProvider();
}
