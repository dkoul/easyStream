import { Player } from "./Player";
import {
  TYPE_DEDICATION,
  TYPE_LABELS,
  mediaUrl,
  type PublicEvent,
} from "../lib/types";

export function EventFrame({
  event,
  compact,
}: {
  event: PublicEvent;
  compact?: boolean;
}) {
  const photo = mediaUrl(event.photoUrl);
  const liveSrc =
    event.status === "live" ? event.playbackUrl : event.status === "completed" ? event.recordingUrl ?? event.playbackUrl : null;
  const desktop = !compact;

  return (
    <article className={`frame ${event.template}`}>
      <div className={desktop ? "frame-desktop" : undefined}>
        <div>
          {event.status === "live" || event.status === "completed" ? (
            liveSrc ? (
              <Player src={liveSrc} live={event.status === "live"} />
            ) : (
              <div className="video-shell">
                <div className="placeholder">The recording is being prepared.</div>
              </div>
            )
          ) : (
            <div className="video-shell">
              {event.status === "processing" ? (
                <div className="placeholder">The recording is being prepared. Please wait a moment.</div>
              ) : (
                <div className="placeholder">The event will begin shortly.</div>
              )}
            </div>
          )}
        </div>
        <div className="copy">
          <p className="kicker">{TYPE_LABELS[event.type]}</p>
          <h1 className="event-title">{event.title}</h1>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="portrait" src={photo} alt={event.personName ?? event.title} />
          ) : null}
          {event.personName ? (
            <>
              <p className="dedication">{TYPE_DEDICATION[event.type]}</p>
              <p className="person">{event.personName}</p>
            </>
          ) : null}
          <p className="meta">
            {event.date}
            {event.location ? ` · ${event.location}` : ""}
          </p>
          {event.message ? <p className="message">{event.message}</p> : null}
          <StatusCopy event={event} />
        </div>
      </div>
      <p className="privacy">Anyone with this link can watch. This event is not listed publicly.</p>
    </article>
  );
}

function StatusCopy({ event }: { event: PublicEvent }) {
  if (event.status === "live") {
    return (
      <p className="watchers">
        {event.viewerCount > 0
          ? `${event.viewerCount} family member${event.viewerCount === 1 ? "" : "s"} watching`
          : "Family members can join with this link"}
      </p>
    );
  }
  if (event.status === "upcoming") {
    return <p className="status-copy">The event will begin shortly.</p>;
  }
  if (event.status === "processing") {
    return <p className="status-copy">Your livestream has ended. The recording is being prepared.</p>;
  }
  if (event.status === "completed") {
    return <p className="status-copy">Watch the recording whenever you are ready.</p>;
  }
  return null;
}
