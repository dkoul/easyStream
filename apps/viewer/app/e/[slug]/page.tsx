import { fetchPublicEvent } from "../../../lib/api";
import { WatchClient } from "./WatchClient";

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await fetchPublicEvent(slug);
  if (!event) {
    return (
      <main className="landing">
        <h1>This link is not valid</h1>
        <p className="promise">Ask a family member to share the event again.</p>
      </main>
    );
  }
  return <WatchClient initial={event} />;
}
