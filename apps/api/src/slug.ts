import { nanoid } from "nanoid";

const STOP = new Set(["the", "a", "an", "of", "and", "in", "for"]);

export function slugifyBase(parts: Array<string | null | undefined>): string {
  const raw = parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const tokens = raw.split("-").filter((t) => t && !STOP.has(t));
  const base = tokens.slice(0, 6).join("-") || "event";
  return base.slice(0, 40).replace(/-+$/g, "") || "event";
}

/** Unlisted, WhatsApp-friendly slug: human-readable + short random suffix. */
export function makeEventSlug(
  personName: string | null | undefined,
  title: string,
): string {
  const base = slugifyBase([personName, title]);
  return `${base}-${nanoid(6).toLowerCase()}`;
}
