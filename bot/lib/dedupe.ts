import type { HostKvApi } from "@cursor/bdk";
import {
  isSimilarTitle,
  postedKey,
  RECENT_TITLES_KEY,
  titleKey,
  type RecentTitles,
} from "./posted.js";

export type DedupeHit = {
  duplicate: boolean;
  reason?: "link" | "title" | "similar_title";
};

export async function findDuplicate(
  kv: HostKvApi,
  input: { link: string; title: string },
): Promise<DedupeHit> {
  if ((await kv.get(postedKey(input.link))) !== undefined) {
    return { duplicate: true, reason: "link" };
  }
  if ((await kv.get(titleKey(input.title))) !== undefined) {
    return { duplicate: true, reason: "title" };
  }

  const recent = (await kv.get(RECENT_TITLES_KEY)) as RecentTitles | undefined;
  for (const prev of recent?.titles ?? []) {
    if (isSimilarTitle(input.title, prev)) {
      return { duplicate: true, reason: "similar_title" };
    }
  }
  return { duplicate: false };
}

export async function rememberPosted(
  kv: HostKvApi,
  input: {
    link: string;
    title: string;
    messageId?: number;
  },
): Promise<void> {
  const record = {
    link: input.link,
    title: input.title,
    postedAt: new Date().toISOString(),
    ...(typeof input.messageId === "number"
      ? { messageId: input.messageId }
      : {}),
  };
  await kv.put(postedKey(input.link), record);
  await kv.put(titleKey(input.title), record);

  const recent = (await kv.get(RECENT_TITLES_KEY)) as RecentTitles | undefined;
  const titles = [input.title, ...(recent?.titles ?? [])].slice(0, 80);
  await kv.put(RECENT_TITLES_KEY, { titles });
}
