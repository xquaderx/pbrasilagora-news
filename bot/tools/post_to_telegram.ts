import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { assessCredibility } from "../lib/credibility.js";
import { findDuplicate, rememberPosted } from "../lib/dedupe.js";
import { resolveNewsImage } from "../lib/image.js";
import { buildNewsCaption, CHANNEL_PUBLIC_URL } from "../lib/post-format.js";
import {
  seedMessageReaction,
  sendTelegramMessage,
  sendTelegramPhoto,
} from "../lib/telegram.js";

type PostResult = {
  posted: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: number;
  chatId?: string;
  link: string;
  format: "photo" | "text";
  cta: string;
  credibilityScore?: number;
};

export default defineTool({
  description: prompt`
    Publish one illustrated Topor-style news post to the Telegram channel.
    Requires a credible non-duplicate story. Resolves image from imageUrl or
    article page. articleLink is dedupe-only and never shown. No external URLs
    in title/summary.
  `,
  effect: "write",
  inputSchema: z.object({
    title: z.string().min(3).max(220),
    summary: z.string().min(20).max(700),
    articleLink: z.string().url(),
    source: z.string().min(1).max(80).optional(),
    imageUrl: z.string().url().optional(),
    useQuote: z.boolean().optional(),
    reactionEmoji: z.string().max(8).optional(),
    allowWithoutImage: z
      .boolean()
      .optional()
      .describe("Default false — skip if no image can be resolved."),
  }),
  dryRunResult: ({ articleLink, imageUrl }): PostResult => ({
    posted: false,
    skipped: true,
    reason: "dry-run",
    link: articleLink,
    chatId: process.env.TELEGRAM_CHANNEL_ID,
    format: imageUrl ? "photo" : "text",
    cta: CHANNEL_PUBLIC_URL,
  }),
  async execute(input, ctx): Promise<PostResult> {
    const {
      title,
      summary,
      articleLink,
      source,
      imageUrl,
      useQuote,
      reactionEmoji,
      allowWithoutImage,
    } = input;

    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHANNEL_ID?.trim();
    if (!token || !chatId) {
      return {
        posted: false,
        reason: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID.",
        link: articleLink,
        format: "text",
        cta: CHANNEL_PUBLIC_URL,
      };
    }

    const dedupe = await findDuplicate(ctx.host.kv, {
      link: articleLink,
      title,
    });
    if (dedupe.duplicate) {
      return {
        posted: false,
        skipped: true,
        reason: `already_posted:${dedupe.reason}`,
        link: articleLink,
        chatId,
        format: "text",
        cta: CHANNEL_PUBLIC_URL,
      };
    }

    const credibility = assessCredibility({
      title,
      summary,
      source,
      articleLink,
    });
    if (!credibility.ok) {
      return {
        posted: false,
        skipped: true,
        reason: `credibility_fail:${credibility.score}:${credibility.reasons.join(",")}`,
        link: articleLink,
        chatId,
        format: "text",
        cta: CHANNEL_PUBLIC_URL,
        credibilityScore: credibility.score,
      };
    }

    const resolvedImage = await resolveNewsImage({
      imageUrl,
      articleLink,
    });
    if (!resolvedImage && !(allowWithoutImage ?? false)) {
      return {
        posted: false,
        skipped: true,
        reason: "no_image",
        link: articleLink,
        chatId,
        format: "text",
        cta: CHANNEL_PUBLIC_URL,
        credibilityScore: credibility.score,
      };
    }

    const caption = buildNewsCaption({
      title,
      summary,
      source,
      useQuote: useQuote ?? false,
    });

    let result = resolvedImage
      ? await sendTelegramPhoto({
          token,
          chatId,
          photoUrl: resolvedImage,
          caption: caption.slice(0, 1024),
        })
      : await sendTelegramMessage({
          token,
          chatId,
          text: caption,
          disableWebPagePreview: true,
        });

    if (!result.ok && resolvedImage && (allowWithoutImage ?? false)) {
      result = await sendTelegramMessage({
        token,
        chatId,
        text: caption,
        disableWebPagePreview: true,
      });
    }

    if (!result.ok) {
      return {
        posted: false,
        reason: result.error,
        link: articleLink,
        chatId,
        format: resolvedImage ? "photo" : "text",
        cta: CHANNEL_PUBLIC_URL,
        credibilityScore: credibility.score,
      };
    }

    await seedMessageReaction({
      token,
      chatId,
      messageId: result.messageId,
      emoji: reactionEmoji ?? "🔥",
    });

    await rememberPosted(ctx.host.kv, {
      link: articleLink,
      title,
      messageId: result.messageId,
    });

    return {
      posted: true,
      messageId: result.messageId,
      chatId: result.chatId,
      link: articleLink,
      format: resolvedImage ? "photo" : "text",
      cta: CHANNEL_PUBLIC_URL,
      credibilityScore: credibility.score,
    };
  },
});
