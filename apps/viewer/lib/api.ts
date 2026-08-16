import type { PublicEvent } from "./types";
import { apiBase } from "./types";

export async function fetchPublicEvent(slug: string): Promise<PublicEvent | null> {
  const res = await fetch(`${apiBase()}/e/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Could not load this event");
  const json = (await res.json()) as { event: PublicEvent };
  return json.event;
}

export async function pingPresence(slug: string): Promise<number> {
  const res = await fetch(`${apiBase()}/e/${encodeURIComponent(slug)}/presence`, {
    method: "POST",
  });
  if (!res.ok) return 0;
  const json = (await res.json()) as { viewerCount: number };
  return json.viewerCount;
}
