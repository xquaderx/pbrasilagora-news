/**
 * Free publisher: RSS → credibility/dedupe → Telegram photo post.
 * No Cursor model / no BDK serve required.
 *
 *   npx tsx scripts/publish-cycle.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assessCredibility } from "../bot/lib/credibility.js";
import { findDuplicate, rememberPosted } from "../bot/lib/dedupe.js";
import { createFileKv } from "../bot/lib/file-kv.js";
import { resolveNewsImage } from "../bot/lib/image.js";
import { buildNewsCaption } from "../bot/lib/post-format.js";
import {
  BRAZIL_FEEDS,
  isFreshEnough,
  parseRss,
  publishedSortKey,
  type NewsItem,
} from "../bot/lib/rss.js";
import {
  seedMessageReaction,
  sendTelegramPhoto,
} from "../bot/lib/telegram.js";

function loadEnvFile(path: string): void {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1]!;
      let val = m[2]!;
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

loadEnvFile(resolve(".env.local"));
loadEnvFile(resolve(".env"));

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHANNEL_ID?.trim();
  if (!token || !chatId) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID");
  }

  const kv = createFileKv(resolve("data/posted-kv.json"));
  const items = await fetchCandidates();

  type Candidate = {
    item: (typeof items)[number];
    score: number;
    imageUrl: string;
    summary: string;
  };
  const candidates: Candidate[] = [];

  for (const item of items) {
    const dedupe = await findDuplicate(kv, {
      link: item.link,
      title: item.title,
    });
    if (dedupe.duplicate) continue;

    const credibility = assessCredibility({
      title: item.title,
      summary: item.summary,
      source: item.source,
      articleLink: item.link,
    });
    if (!credibility.ok) continue;

    const imageUrl = await resolveNewsImage({
      imageUrl: item.imageUrl,
      articleLink: item.link,
    });
    if (!imageUrl) continue;

    candidates.push({
      item,
      score: credibility.score,
      imageUrl,
      summary: item.summary.slice(0, 420),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length === 0) {
    console.log(JSON.stringify({ posted: false, reason: "no_publishable_item" }));
    return;
  }

  for (const best of candidates) {
    const caption = buildNewsCaption({
      title: best.item.title,
      summary: best.summary,
      source: best.item.source,
    });

    const result = await sendTelegramPhoto({
      token,
      chatId,
      photoUrl: best.imageUrl,
      caption: caption.slice(0, 1024),
    });
    if (!result.ok) {
      console.error("post_failed", result.error, best.item.link);
      continue;
    }

    await seedMessageReaction({
      token,
      chatId,
      messageId: result.messageId,
      emoji: "🔥",
    });
    await rememberPosted(kv, {
      link: best.item.link,
      title: best.item.title,
      messageId: result.messageId,
    });

    console.log(
      JSON.stringify({
        posted: true,
        messageId: result.messageId,
        title: best.item.title,
        source: best.item.source,
        score: best.score,
      }),
    );
    return;
  }

  console.log(JSON.stringify({ posted: false, reason: "all_candidates_failed" }));
}

async function fetchCandidates(): Promise<NewsItem[]> {
  const byLink = new Map<string, NewsItem>();
  await Promise.all(
    BRAZIL_FEEDS.map(async (feed) => {
      try {
        const response = await fetch(feed.url, {
          headers: {
            "user-agent": "brasil-noticias-free/1.0",
            accept: "application/rss+xml, application/xml, text/xml, */*",
          },
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) return;
        for (const item of parseRss(await response.text(), feed.source)) {
          if (!byLink.has(item.link)) byLink.set(item.link, item);
        }
      } catch {
        // ignore feed errors in free cycle
      }
    }),
  );

  return [...byLink.values()]
    .filter((i) => isFreshEnough(i.publishedAt))
    .sort(
      (a, b) => publishedSortKey(b.publishedAt) - publishedSortKey(a.publishedAt),
    )
    .slice(0, 20);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
