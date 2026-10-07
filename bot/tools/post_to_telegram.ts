import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { buildNewsCaption, CHANNEL_PUBLIC_URL } from "../lib/post-format.js";
import { postedKey, type PostedRecord } from "../lib/posted.js";
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
};

export default defineTool({
  description: prompt`
    Publish one Topor-style news post to the Telegram channel:
    optional image, ⚡️ bold headline, body, and only our channel CTA link.
    Pass articleLink for internal dedupe only — it is never shown in the post.
    Never include external URLs in title/summary.
  `,
  effect: "write",
  inputSchema: z.object({
    title: z.string().min(3).max(220),
    summary: z.string().min(20).max(700),
    articleLink: z
      .string()
      .url()
      .describe("Canonical source URL for dedupe only; never printed in the post."),
    source: z.string().min(1).max(80).optional(),
    imageUrl: z
      .string()
      .url()
      .optional()
      .describe("Public image URL for the post photo (preferred)."),
    useQuote: z
      .boolean()
      .optional()
      .describe("Wrap body in a Telegram blockquote. Default false."),
    reactionEmoji: z
      .string()
      .max(8)
      .optional()
      .describe("Emoji to seed on the post. Default 🔥."),
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
  async execute(
    { title, summary, articleLink, source, imageUrl, useQuote, reactionEmoji },
    ctx,
  ): Promise<PostResult> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHANNEL_ID?.trim();
    if (!token || !chatId) {
      return {
        posted: false,
        reason:
          "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID in the environment.",
        link: articleLink,
        format: imageUrl ? "photo" : "text",
        cta: CHANNEL_PUBLIC_URL,
      };
    }

    const key = postedKey(articleLink);
    const prior = await ctx.host.kv.get(key);
    if (prior !== undefined) {
      return {
        posted: false,
        skipped: true,
        reason: "already_posted",
        link: articleLink,
        chatId,
        format: imageUrl ? "photo" : "text",
        cta: CHANNEL_PUBLIC_URL,
      };
    }

    const caption = buildNewsCaption({
      title,
      summary,
      source,
      useQuote: useQuote ?? false,
    });

    let result =
      imageUrl
        ? await sendTelegramPhoto({
            token,
            chatId,
            photoUrl: imageUrl,
            caption: caption.slice(0, 1024),
          })
        : await sendTelegramMessage({
            token,
            chatId,
            text: caption,
            disableWebPagePreview: true,
          });

    // If photo URL fails, fall back to text-only so the cycle still publishes.
    if (!result.ok && imageUrl) {
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
        format: imageUrl ? "photo" : "text",
        cta: CHANNEL_PUBLIC_URL,
      };
    }

    await seedMessageReaction({
      token,
      chatId,
      messageId: result.messageId,
      emoji: reactionEmoji ?? "🔥",
    });

    const record: PostedRecord = {
      link: articleLink,
      title,
      postedAt: new Date().toISOString(),
      messageId: result.messageId,
    };
    await ctx.host.kv.put(key, record);

    return {
      posted: true,
      messageId: result.messageId,
      chatId: result.chatId,
      link: articleLink,
      format: imageUrl ? "photo" : "text",
      cta: CHANNEL_PUBLIC_URL,
    };
  },
});
