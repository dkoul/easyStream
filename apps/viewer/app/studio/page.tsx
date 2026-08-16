"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventFrame } from "../../components/EventFrame";
import {
  TYPE_LABELS,
  apiBase,
  type EventType,
  type PublicEvent,
  type TemplateId,
} from "../../lib/types";

type Step =
  | "welcome"
  | "phone"
  | "otp"
  | "type"
  | "details"
  | "design"
  | "preview"
  | "ready"
  | "live"
  | "confirm-end"
  | "ended";

const TYPES: EventType[] = [
  "prayer_meet",
  "family_function",
  "wedding",
  "birthday",
  "other",
];

type EventPayload = {
  id: string;
  slug: string;
  status: string;
  ingestUrl: string | null;
  streamKey: string | null;
} & PublicEvent;

export default function StudioPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [type, setType] = useState<EventType>("prayer_meet");
  const [title, setTitle] = useState("Prayer Meet");
  const [personName, setPersonName] = useState("Rajesh Koul");
  const [date, setDate] = useState("16 August 2026");
  const [location, setLocation] = useState("Pune");
  const [message, setMessage] = useState("Your presence means everything.");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateId>("traditional");
  const [event, setEvent] = useState<EventPayload | null>(null);
  const [shareText, setShareText] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== "live") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);

  const previewEvent = useMemo<PublicEvent>(
    () => ({
      id: "preview",
      slug: "preview",
      type,
      title,
      personName: personName || null,
      photoUrl: photoDataUrl,
      date,
      location,
      message: message || null,
      template,
      status: "upcoming",
      streamId: null,
      playbackUrl: null,
      recordingUrl: null,
      viewerCount: 0,
      startedAt: null,
      endedAt: null,
      createdAt: new Date().toISOString(),
    }),
    [type, title, personName, photoDataUrl, date, location, message, template],
  );

  const duration = startedAt
    ? new Date(now - startedAt).toISOString().substring(11, 19)
    : "00:00:00";

  async function requestOtp() {
    setError(null);
    const res = await fetch(`${apiBase()}/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      setError("Please check the phone number and try again.");
      return;
    }
    setStep("otp");
  }

  async function verifyOtp() {
    setError(null);
    const res = await fetch(`${apiBase()}/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    if (!res.ok) {
      setError("That code did not work. Please try again.");
      return;
    }
    const json = await res.json();
    setToken(json.token);
    setStep("type");
  }

  async function createEvent() {
    setError(null);
    const res = await fetch(`${apiBase()}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type,
        title,
        personName,
        date,
        location,
        message,
        template,
        photoDataUrl,
      }),
    });
    if (!res.ok) {
      setError("We could not create the event. Please try again.");
      return;
    }
    const json = await res.json();
    setEvent(json.event);
    setShareUrl(json.shareUrl);
    setStep("ready");
  }

  async function goLive() {
    if (!event) return;
    const res = await fetch(`${apiBase()}/events/${event.id}/go-live`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setEvent(json.event);
    setShareText(json.shareText);
    setShareUrl(json.shareUrl);
    setStartedAt(Date.now());
    setStep("live");
    if (navigator.share) {
      void navigator.share({ text: json.shareText, url: json.shareUrl });
    }
  }

  async function endLive() {
    if (!event) return;
    await fetch(`${apiBase()}/events/${event.id}/end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setStep("ended");
  }

  return (
    <main className="studio">
      <div className="studio-card">
        {step === "welcome" && (
          <>
            <p className="kicker">easyStream</p>
            <h1>Share your family moments with everyone.</h1>
            <p className="note">
              Create an event, press Start Live, and send a WhatsApp link. Relatives watch without installing anything.
            </p>
            <button className="big-action" type="button" onClick={() => setStep("phone")}>
              Create an Event
            </button>
          </>
        )}

        {step === "phone" && (
          <>
            <h2>Your phone number</h2>
            <p className="note">We will send a one-time code. No password to remember.</p>
            <div className="field">
              <label>Mobile number</label>
              <input
                inputMode="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {error ? <p className="note">{error}</p> : null}
            <button className="big-action" type="button" onClick={() => void requestOtp()}>
              Send code
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <h2>Enter the 6-digit code</h2>
            <p className="note">In this demo, the code is 123456.</p>
            <div className="field">
              <label>Code</label>
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
              />
            </div>
            {error ? <p className="note">{error}</p> : null}
            <button className="big-action" type="button" onClick={() => void verifyOtp()}>
              Continue
            </button>
          </>
        )}

        {step === "type" && (
          <>
            <h2>Choose Event</h2>
            {TYPES.map((t) => (
              <button
                key={t}
                className={`choice ${type === t ? "selected" : ""}`}
                type="button"
                onClick={() => {
                  setType(t);
                  setTitle(TYPE_LABELS[t]);
                  setStep("details");
                }}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </>
        )}

        {step === "details" && (
          <>
            <h2>Event details</h2>
            <div className="field">
              <label>Event name</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>Person&apos;s name (optional)</label>
              <input value={personName} onChange={(e) => setPersonName(e.target.value)} />
            </div>
            <div className="field">
              <label>Date</label>
              <input value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Location</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="field">
              <label>Short message (optional)</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="field">
              <label>Photograph (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setPhotoDataUrl(String(reader.result));
                  reader.readAsDataURL(file);
                }}
              />
            </div>
            <button className="big-action" type="button" onClick={() => setStep("design")}>
              Choose design
            </button>
          </>
        )}

        {step === "design" && (
          <>
            <h2>Choose design</h2>
            {(["classic", "elegant", "traditional"] as TemplateId[]).map((id) => (
              <button
                key={id}
                className={`choice ${template === id ? "selected" : ""}`}
                type="button"
                onClick={() => setTemplate(id)}
              >
                {id[0].toUpperCase() + id.slice(1)}
              </button>
            ))}
            <button className="big-action" type="button" onClick={() => setStep("preview")}>
              Preview
            </button>
          </>
        )}

        {step === "preview" && (
          <>
            <h2>This is what relatives will see</h2>
            <EventFrame event={previewEvent} compact />
            {error ? <p className="note">{error}</p> : null}
            <button className="big-action secondary" type="button" onClick={() => setStep("details")}>
              Edit
            </button>
            <button className="big-action" type="button" onClick={() => void createEvent()}>
              Create Event
            </button>
          </>
        )}

        {step === "ready" && event && (
          <>
            <h2>Your event is ready.</h2>
            <p className="note">Anyone with this link can watch. Share it only with family.</p>
            <p className="note">{shareUrl}</p>
            <button className="big-action" type="button" onClick={() => void goLive()}>
              🔴 START LIVE
            </button>
          </>
        )}

        {step === "live" && (
          <>
            <p className="kicker" style={{ color: "#c43c2c" }}>
              🔴 LIVE
            </p>
            <div className="live-clock">{duration}</div>
            <div className="status-list">
              <div>
                <span>Network</span>
                <span>✓</span>
              </div>
              <div>
                <span>Audio</span>
                <span>🎙 Audio detected</span>
              </div>
              <div>
                <span>Privacy</span>
                <span>Anyone with this link can watch</span>
              </div>
            </div>
            <p className="note">Your event is LIVE. Share with family.</p>
            <button
              className="big-action"
              type="button"
              onClick={() => {
                if (navigator.share) void navigator.share({ text: shareText, url: shareUrl });
                else void navigator.clipboard.writeText(shareText);
              }}
            >
              Share with family
            </button>
            {shareUrl && event ? (
              <p className="note">
                Viewer link: <Link href={`/e/${event.slug}`}>Open event page</Link>
              </p>
            ) : null}
            <button className="big-action secondary" type="button" onClick={() => setStep("confirm-end")}>
              STOP LIVE
            </button>
          </>
        )}

        {step === "confirm-end" && (
          <>
            <h2>End livestream?</h2>
            <p className="note">Relatives will no longer see the live video. A recording will be prepared on the same link.</p>
            <button className="big-action" type="button" onClick={() => void endLive()}>
              End Live
            </button>
            <button className="big-action secondary" type="button" onClick={() => setStep("live")}>
              Keep streaming
            </button>
          </>
        )}

        {step === "ended" && (
          <>
            <h2>Your livestream has ended.</h2>
            <p className="note">The recording will appear on the same family link in a moment.</p>
            {event ? (
              <a className="big-action" href={`/e/${event.slug}`} style={{ textDecoration: "none" }}>
                Share Recording
              </a>
            ) : null}
            <button className="big-action secondary" type="button" onClick={() => (window.location.href = "/")}>
              Done
            </button>
          </>
        )}
      </div>
    </main>
  );
}
