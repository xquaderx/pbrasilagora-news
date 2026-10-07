import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { postedKey, type PostedRecord } from "../lib/posted.js";
import { escapeHtml, sendTelegramMessage } from "../lib/telegram.js";

type PostResult = {
  posted: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: number;
  chatId?: string;
  link: string;
};

export default defineTool({
  description: prompt`
    Publish one news post to the configured Telegram channel.
    Pass a Portuguese headline, short body, and the canonical article link.
    Skips duplicates already posted for the same link.
  `,
  effect: "write",
  inputSchema: z.object({
    title: z.string().min(3).max(280),
    summary: z.string().min(20).max(900),
    link: z.string().url(),
    source: z.string().min(1).max(80).optional(),
  }),
  dryRunResult: ({ link }): PostResult => ({
    posted: false,
    skipped: true,
    reason: "dry-run",
    link,
    chatId: process.env.TELEGRAM_CHANNEL_ID,
  }),
  async execute({ title, summary, link, source }, ctx): Promise<PostResult> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHANNEL_ID?.trim();
    if (!token || !chatId) {
      return {
        posted: false,
        reason:
          "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID in the environment.",
        link,
      };
    }

    const key = postedKey(link);
    const prior = await ctx.host.kv.get(key);
    if (prior !== undefined) {
      return {
        posted: false,
        skipped: true,
        reason: "already_posted",
        link,
        chatId,
      };
    }

    const sourceLine = source ? `\n<i>${escapeHtml(source)}</i>` : "";
    const text = [
      `<b>${escapeHtml(title)}</b>`,
      "",
      escapeHtml(summary),
      "",
      escapeHtml(link) + sourceLine,
    ].join("\n");

    const result = await sendTelegramMessage({
      token,
      chatId,
      text,
    });

    if (!result.ok) {
      return {
        posted: false,
        reason: result.error,
        link,
        chatId,
      };
    }

    const record: PostedRecord = {
      link,
      title,
      postedAt: new Date().toISOString(),
      messageId: result.messageId,
    };
    await ctx.host.kv.put(key, record);

    return {
      posted: true,
      messageId: result.messageId,
      chatId: result.chatId,
      link,
    };
  },
});
