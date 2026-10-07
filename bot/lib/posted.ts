import { createHash } from "node:crypto";

export function postedKey(link: string): string {
  const hash = createHash("sha256").update(link).digest("hex").slice(0, 24);
  return `posted:${hash}`;
}

export function titleKey(title: string): string {
  const norm = normalizeTitle(title);
  const hash = createHash("sha256").update(norm).digest("hex").slice(0, 24);
  return `posted-title:${hash}`;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((t) => t.length >= 4),
  );
}

/** Jaccard similarity on tokens; true if looks like the same story. */
export function isSimilarTitle(a: string, b: string, threshold = 0.72): boolean {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union > 0 && inter / union >= threshold;
}

export const RECENT_TITLES_KEY = "posted:recent-titles";

export type PostedRecord = {
  link: string;
  title: string;
  postedAt: string;
  messageId?: number;
};

export type RecentTitles = {
  titles: string[];
};
