import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { CHANNEL_PUBLIC_URL } from "../lib/post-format.js";
import { getTelegramChat } from "../lib/telegram.js";

type SetupResult = {
  ok: boolean;
  channel?: string;
  commentsEnabled: boolean;
  linkedDiscussionChatId?: number;
  reactionsNote: string;
  commentsNote: string;
  nextSteps: string[];
};

export default defineTool({
  description: prompt`
    Check whether the Telegram channel has discussion comments linked,
    and return the exact next steps to enable user reactions + comments
    (Topor Live style). Does not post news.
  `,
  effect: "read",
  inputSchema: z.object({}),
  async execute(): Promise<SetupResult> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHANNEL_ID?.trim();
    if (!token || !chatId) {
      return {
        ok: false,
        commentsEnabled: false,
        reactionsNote: "Missing TELEGRAM credentials.",
        commentsNote: "Missing TELEGRAM credentials.",
        nextSteps: [
          "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in .env.local",
        ],
      };
    }

    const chat = await getTelegramChat({ token, chatId });
    if (!chat.ok) {
      return {
        ok: false,
        commentsEnabled: false,
        reactionsNote: chat.error ?? "getChat failed",
        commentsNote: chat.error ?? "getChat failed",
        nextSteps: ["Verify the bot is still an admin of the channel."],
      };
    }

    const commentsEnabled = typeof chat.linkedChatId === "number";

    return {
      ok: true,
      channel: CHANNEL_PUBLIC_URL,
      commentsEnabled,
      linkedDiscussionChatId: chat.linkedChatId,
      reactionsNote:
        "Bot API no longer exposes setChatAvailableReactions. Enable reactions in Telegram: Channel → Edit → Reactions → choose emojis (👍❤️🔥😂🤯😱🙏🤡). Each post also seeds 🔥 via setMessageReaction.",
      commentsNote: commentsEnabled
        ? "Discussion group is linked — comment button should appear under posts."
        : "No discussion group linked yet — comments will not appear until you link one.",
      nextSteps: commentsEnabled
        ? [
            "Reactions: confirm they are ON in Channel → Edit → Reactions.",
            "Open a recent post and verify the comment bubble works.",
          ]
        : [
            "In Telegram: open P Brasil Agora → Edit → Discussion → Create a new group (or pick one).",
            "Name it e.g. P Brasil Agora Chat and link it.",
            "Add @PBrasil_Bot as admin of that discussion group too.",
            "Channel → Edit → Reactions → enable several emojis.",
            "Re-run setup_channel_engagement to verify linkedDiscussionChatId.",
          ],
    };
  },
});
