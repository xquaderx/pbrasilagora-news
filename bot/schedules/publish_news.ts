import { defineSchedule } from "@cursor/bdk/schedules";

/**
 * Zero-LLM cycle: tools only (no model tokens).
 * For fully free 24/7 hosting prefer GitHub Actions + `npm run publish:once`.
 */
export default defineSchedule({
  cron: "*/20 * * * *",
  async run({ callTool }) {
    const fetched = await callTool("fetch_brazil_news", {
      limit: 8,
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
            resolvedImageUrl?: string | null;
            imageUrl?: string | null;
            publishable?: boolean;
          }>;
        }
      ).items ?? [];

    const item = items.find((i) => i.publishable);
    if (!item) return;

    const check = await callTool("check_news_credibility", {
      title: item.title,
      summary: item.summary,
      articleLink: item.link,
      source: item.source,
    });
    if (check.isError) return;
    if (!(check.result as { publishable?: boolean }).publishable) return;

    const imageUrl = item.resolvedImageUrl ?? item.imageUrl ?? undefined;
    await callTool("post_to_telegram", {
      title: item.title.slice(0, 220),
      summary: item.summary.slice(0, 420),
      articleLink: item.link,
      source: item.source,
      imageUrl,
    });
  },
});
