export type TelegramSendResult = {
  ok: true;
  messageId: number;
  chatId: string;
} | {
  ok: false;
  error: string;
};

export async function sendTelegramMessage(input: {
  token: string;
  chatId: string;
  text: string;
  disableWebPagePreview?: boolean;
}): Promise<TelegramSendResult> {
  const url = `https://api.telegram.org/bot${input.token}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text,
      disable_web_page_preview: input.disableWebPagePreview ?? false,
      parse_mode: "HTML",
    }),
  });

  const body = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };

  if (!response.ok || !body.ok) {
    return {
      ok: false,
      error: body.description ?? `Telegram HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    messageId: body.result?.message_id ?? 0,
    chatId: input.chatId,
  };
}

/** Escape text for Telegram HTML parse_mode. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
