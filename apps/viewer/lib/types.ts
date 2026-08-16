export const EVENT_TYPES = [
  "prayer_meet",
  "family_function",
  "wedding",
  "birthday",
  "anniversary",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type TemplateId = "classic" | "elegant" | "traditional";
export type EventStatus = "draft" | "upcoming" | "live" | "processing" | "completed";

export type PublicEvent = {
  id: string;
  slug: string;
  type: EventType;
  title: string;
  personName: string | null;
  photoUrl: string | null;
  date: string;
  location: string;
  message: string | null;
  template: TemplateId;
  status: EventStatus;
  streamId: string | null;
  playbackUrl: string | null;
  recordingUrl: string | null;
  viewerCount: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export const TYPE_LABELS: Record<EventType, string> = {
  prayer_meet: "Prayer Meet",
  family_function: "Family Function",
  wedding: "Wedding",
  birthday: "Birthday",
  anniversary: "Anniversary",
  other: "Family Event",
};

export const TYPE_DEDICATION: Record<EventType, string> = {
  prayer_meet: "In loving memory of",
  family_function: "Celebrating",
  wedding: "Together in celebration of",
  birthday: "Wishing a joyful day to",
  anniversary: "Honouring",
  other: "With family, for",
};

export function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function mediaUrl(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http") || pathOrUrl.startsWith("data:")) return pathOrUrl;
  return `${apiBase()}${pathOrUrl}`;
}
