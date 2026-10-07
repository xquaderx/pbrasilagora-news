import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { postedKey } from "../lib/posted.js";
import {
  BRAZIL_FEEDS,
  isFreshEnough,
  parseRss,
  publishedSortKey,
  type NewsItem,
} from "../lib/rss.js";

type FetchResult = {
  fetchedAt: string;
  count: number;
  items: Array<
    NewsItem & {
      alreadyPosted: boolean;
    }
  >;
  errors: Array<{ source: string; error: string }>;
};

export default defineTool({
  description: prompt`
    Fetch recent Brazil-related news from Portuguese RSS feeds.
    Use this before drafting channel posts. Returns titles, links,
    short summaries, and whether each link was already posted.
  `,
  effect: "read",
  inputSchema: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe("Max items to return after merge/dedupe. Default 12."),
    includePosted: z
      .boolean()
      .optional()
      .describe("If true, include items already posted to Telegram. Default false."),
  }),
  async execute({ limit, includePosted }, ctx): Promise<FetchResult> {
    const max = limit ?? 12;
    const keepPosted = includePosted ?? false;
    const errors: FetchResult["errors"] = [];
    const byLink = new Map<string, NewsItem>();

    await Promise.all(
      BRAZIL_FEEDS.map(async (feed) => {
        try {
          const response = await fetch(feed.url, {
            headers: {
              "user-agent": "brasil-noticias-bdk/1.0 (+cursor-agent)",
              accept: "application/rss+xml, application/xml, text/xml, */*",
            },
            signal: AbortSignal.timeout(12_000),
          });
          if (!response.ok) {
            errors.push({
              source: feed.source,
              error: `HTTP ${response.status}`,
            });
            return;
          }
          const xml = await response.text();
          for (const item of parseRss(xml, feed.source)) {
            if (!byLink.has(item.link)) byLink.set(item.link, item);
          }
        } catch (err) {
          errors.push({
            source: feed.source,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );

    // Round-robin by source so one feed cannot dominate the window.
    const bySource = new Map<string, NewsItem[]>();
    for (const item of byLink.values()) {
      if (!isFreshEnough(item.publishedAt)) continue;
      const list = bySource.get(item.source) ?? [];
      list.push(item);
      bySource.set(item.source, list);
    }
    for (const list of bySource.values()) {
      list.sort(
        (a, b) => publishedSortKey(b.publishedAt) - publishedSortKey(a.publishedAt),
      );
    }
    const queues = [...bySource.values()];
    const interleaved: NewsItem[] = [];
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const queue of queues) {
        const next = queue.shift();
        if (!next) continue;
        interleaved.push(next);
        progressed = true;
      }
    }

    const annotated: FetchResult["items"] = [];
    for (const item of interleaved) {
      const prior = await ctx.host.kv.get(postedKey(item.link));
      const alreadyPosted = prior !== undefined;
      if (alreadyPosted && !keepPosted) continue;
      annotated.push({ ...item, alreadyPosted });
      if (annotated.length >= max) break;
    }

    return {
      fetchedAt: new Date().toISOString(),
      count: annotated.length,
      items: annotated,
      errors,
    };
  },
});
