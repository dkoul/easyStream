import { nanoid } from "nanoid";

export type StreamSession = {
  streamId: string;
  ingestUrl: string | null;
  streamKey: string | null;
  playbackUrl: string;
  recordingUrl: string;
};

/**
 * Managed-provider seam. Mux (or similar) can replace this without changing
 * event lifecycle. Demo mode uses a public HLS fixture so the viewer works
 * before a paid ingest account is wired.
 */
export interface StreamProvider {
  startLive(): Promise<StreamSession>;
  endLive(session: StreamSession): Promise<{ recordingUrl: string }>;
}

const DEMO_LIVE =
  process.env.DEMO_LIVE_HLS ??
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const DEMO_RECORDING =
  process.env.DEMO_RECORDING_URL ??
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export class DemoStreamProvider implements StreamProvider {
  async startLive(): Promise<StreamSession> {
    const streamId = `demo_${nanoid(10)}`;
    return {
      streamId,
      ingestUrl: null,
      streamKey: null,
      playbackUrl: DEMO_LIVE,
      recordingUrl: DEMO_RECORDING,
    };
  }

  async endLive(session: StreamSession) {
    return { recordingUrl: session.recordingUrl };
  }
}

export class MuxStreamProvider implements StreamProvider {
  constructor(
    private readonly tokenId: string,
    private readonly tokenSecret: string,
  ) {}

  async startLive(): Promise<StreamSession> {
    const auth = Buffer.from(`${this.tokenId}:${this.tokenSecret}`).toString(
      "base64",
    );
    const res = await fetch("https://api.mux.com/video/v1/live-streams", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        playback_policy: ["public"],
        new_asset_settings: { playback_policy: ["public"] },
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
      recordingUrl: `https://stream.mux.com/${playbackId}.m3u8`,
    };
  }

  async endLive(session: StreamSession) {
    const auth = Buffer.from(`${this.tokenId}:${this.tokenSecret}`).toString(
      "base64",
    );
    await fetch(`https://api.mux.com/video/v1/live-streams/${session.streamId}/complete`, {
      method: "PUT",
      headers: { Authorization: `Basic ${auth}` },
    });
    return { recordingUrl: session.recordingUrl };
  }
}

export function createStreamProvider(): StreamProvider {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (id && secret) return new MuxStreamProvider(id, secret);
  return new DemoStreamProvider();
}
