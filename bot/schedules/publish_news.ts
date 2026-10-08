import { defineSchedule } from "@cursor/bdk/schedules";

/**
 * Fast zero-LLM cycle: poll often, post every new publishable story.
 * Prefer GitHub Actions / local loop for free 24/7 hosting.
 */
export default defineSchedule({
  cron: "*/5 * * * *",
  async run({ callTool }) {
    const fetched = await callTool("fetch_brazil_news", {
      limit: 12,
      requireImage: true,
    });
    if (fetched.isError) return;

    const items =
      (
        fetched.result as {
          items?: Array<{
            title: string;
            summary: string;
            link: string;
            source: string;
            publishedAt?: string | null;
            resolvedImageUrl?: string | null;
            imageUrl?: string | null;
            publishable?: boolean;
            credibilityScore?: number;
          }>;
        }
      ).items ?? [];

    const publishable = items
      .filter((i) => i.publishable)
      .sort((a, b) => {
        const ta = a.publishedAt ? Date.parse(a.publishedAt) || 0 : 0;
        const tb = b.publishedAt ? Date.parse(b.publishedAt) || 0 : 0;
        if (tb !== ta) return tb - ta;
        return (b.credibilityScore ?? 0) - (a.credibilityScore ?? 0);
      })
      .slice(0, 2);

    for (const item of publishable) {
      const check = await callTool("check_news_credibility", {
        title: item.title,
        summary: item.summary,
        articleLink: item.link,
        source: item.source,
      });
      if (check.isError) continue;
      if (!(check.result as { publishable?: boolean }).publishable) continue;

      const imageUrl = item.resolvedImageUrl ?? item.imageUrl ?? undefined;
      await callTool("post_to_telegram", {
        title: item.title.slice(0, 220),
        summary: item.summary.slice(0, 420),
        articleLink: item.link,
        source: item.source,
        imageUrl,
      });
    }
  },
});
