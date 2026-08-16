"use client";

import { useEffect, useState } from "react";
import { EventFrame } from "../../../components/EventFrame";
import { pingPresence } from "../../../lib/api";
import type { PublicEvent } from "../../../lib/types";
import { apiBase } from "../../../lib/types";

export function WatchClient({ initial }: { initial: PublicEvent }) {
  const [event, setEvent] = useState(initial);

  useEffect(() => {
    void pingPresence(initial.slug).then((viewerCount) => {
      setEvent((e) => ({ ...e, viewerCount: viewerCount || e.viewerCount }));
    });
  }, [initial.slug]);

  useEffect(() => {
    if (event.status === "completed") return;
    const id = setInterval(async () => {
      const res = await fetch(`${apiBase()}/e/${encodeURIComponent(initial.slug)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { event: PublicEvent };
      setEvent(json.event);
    }, 4000);
    return () => clearInterval(id);
  }, [event.status, initial.slug]);

  async function share() {
    const url = window.location.href;
    const who = event.personName ? `${event.personName}'s ` : "";
    const text =
      event.status === "live"
        ? `🔴 ${who}${event.title} is LIVE\n\nJoin us remotely:\n\n${url}`
        : `${who}${event.title}\n${url}`;
    if (navigator.share) {
      await navigator.share({ text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text}`);
    alert("Link copied. You can paste it in WhatsApp.");
  }

  return (
    <div className="frame-page">
      <div style={{ width: "100%" }}>
        <EventFrame event={event} />
        <div className="share-row" style={{ paddingBottom: 40 }}>
          <button className="btn btn-primary" type="button" onClick={() => void share()}>
            Share with family
          </button>
        </div>
      </div>
    </div>
  );
}
