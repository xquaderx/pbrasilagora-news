import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { assessCredibility } from "../lib/credibility.js";
import { findDuplicate } from "../lib/dedupe.js";

export default defineTool({
  description: prompt`
    Check whether a Brazil news item is safe to publish: trusted source,
    anti-fake heuristics, and duplicate detection (same link/title/similar story).
    Call this before post_to_telegram. Only post when ok=true and duplicate=false.
  `,
  effect: "read",
  inputSchema: z.object({
    title: z.string().min(3).max(280),
    summary: z.string().min(10).max(900),
    articleLink: z.string().url(),
    source: z.string().min(1).max(80).optional(),
  }),
  async execute({ title, summary, articleLink, source }, ctx) {
    const credibility = assessCredibility({
      title,
      summary,
      articleLink,
      source,
    });
    const dedupe = await findDuplicate(ctx.host.kv, {
      link: articleLink,
      title,
    });

    const publishable = credibility.ok && !dedupe.duplicate;
    return {
      publishable,
      credibility,
      dedupe,
      advice: publishable
        ? "Pode publicar."
        : dedupe.duplicate
          ? `Pular: duplicata (${dedupe.reason}).`
          : `Pular: risco/fonte (score ${credibility.score}).`,
    };
  },
});
