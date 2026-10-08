import { escapeHtml } from "./telegram.js";
import { sanitizePostText } from "./text.js";

export const CHANNEL_PUBLIC_URL = "https://t.me/pbrasilagora";
export const CHANNEL_CTA_LABEL = "P Brasil Agora. Inscrever-se";

export function buildNewsCaption(input: {
  title: string;
  summary: string;
  source?: string;
  useQuote?: boolean;
}): string {
  const title = sanitizePostText(input.title);
  const summary = sanitizePostText(input.summary);
  const source = input.source ? sanitizePostText(input.source) : undefined;

  const headline = source
    ? `⚡️ <b>${escapeHtml(title)} — ${escapeHtml(source)}</b>`
    : `⚡️ <b>${escapeHtml(title)}</b>`;

  const body = input.useQuote
    ? `<blockquote>${escapeHtml(summary)}</blockquote>`
    : escapeHtml(summary);

  const engage =
    "💬 Comente abaixo o que achou\n" +
    "🔥 Deixe sua reação no post";
  const cta =
    `👉 <a href="${CHANNEL_PUBLIC_URL}">${escapeHtml(CHANNEL_CTA_LABEL)}</a>`;

  return [headline, "", body, "", engage, cta].join("\n");
}
