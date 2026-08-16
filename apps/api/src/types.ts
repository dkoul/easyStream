export const EVENT_TYPES = [
  "prayer_meet",
  "family_function",
  "wedding",
  "birthday",
  "anniversary",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const TEMPLATES = ["classic", "elegant", "traditional"] as const;
export type TemplateId = (typeof TEMPLATES)[number];

export const EVENT_STATUSES = [
  "draft",
  "upcoming",
  "live",
  "processing",
  "completed",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export type User = {
  id: string;
  name: string | null;
  phone: string;
  createdAt: string;
};

export type EventRecord = {
  id: string;
  ownerId: string;
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
  ingestUrl: string | null;
  streamKey: string | null;
  playbackUrl: string | null;
  recordingUrl: string | null;
  viewerCount: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export type PublicEvent = Omit<
  EventRecord,
  "ownerId" | "ingestUrl" | "streamKey"
>;
