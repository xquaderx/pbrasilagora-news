import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { assessCredibility } from "../lib/credibility.js";
import { findDuplicate } from "../lib/dedupe.js";
import { resolveNewsImage } from "../lib/image.js";
import {
  BRAZIL_FEEDS,
  isAboutBrazil,
  isEntertainmentSource,
  isFreshEnough,
  parseRss,
  publishedSortKey,
  readFeedText,
  type NewsItem,
} from "../lib/rss.js";

type FetchItem = NewsItem & {
  alreadyPosted: boolean;
  duplicateReason?: string;
  credibilityScore: number;
  publishable: boolean;
  resolvedImageUrl: string | null;
};

type FetchResult = {
  fetchedAt: string;
  count: number;
  items: FetchItem[];
  errors: Array<{ source: string; error: string }>;
};

export default defineTool({
  description: prompt`
    Fetch recent news about Brazil — domestic and international coverage.
    Resolves images, scores credibility, and marks duplicates.
    Prefer items with resolvedImageUrl and publishable=true.
  `,
  effect: "read",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(30).optional(),
    includePosted: z.boolean().optional(),
    requireImage: z
      .boolean()
      .optional()
      .describe("If true, only return items with an image. Default true."),
  }),
  async execute({ limit, includePosted, requireImage }, ctx): Promise<FetchResult> {
    const max = limit ?? 12;
    const keepPosted = includePosted ?? false;
    const mustImage = requireImage ?? true;
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
            errors.push({ source: feed.source, error: `HTTP ${response.status}` });
            return;
          }
          const xml = await readFeedText(response);
          for (const item of parseRss(xml, feed.source)) {
            const entertainment = feed.kind === "entertainment";
            if (!entertainment && !isAboutBrazil(item.title, item.summary)) {
              continue;
            }
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

    const annotated: FetchItem[] = [];
    for (const item of interleaved) {
      if (annotated.length >= max) break;

      const dedupe = await findDuplicate(ctx.host.kv, {
        link: item.link,
        title: item.title,
      });
      if (dedupe.duplicate && !keepPosted) continue;

      const credibility = assessCredibility({
        title: item.title,
        summary: item.summary,
        source: item.source,
        articleLink: item.link,
        entertainment: isEntertainmentSource(item.source),
      });

      const resolvedImageUrl = await resolveNewsImage({
        imageUrl: item.imageUrl,
        articleLink: item.link,
      });
      if (mustImage && !resolvedImageUrl) continue;
      if (!credibility.ok && !keepPosted) continue;

      annotated.push({
        ...item,
        imageUrl: resolvedImageUrl ?? item.imageUrl,
        resolvedImageUrl,
        alreadyPosted: dedupe.duplicate,
        duplicateReason: dedupe.reason,
        credibilityScore: credibility.score,
        publishable: credibility.ok && !dedupe.duplicate && !!resolvedImageUrl,
      });
    }

    return {
      fetchedAt: new Date().toISOString(),
      count: annotated.length,
      items: annotated,
      errors,
    };
  },
});
