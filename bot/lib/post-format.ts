import { escapeHtml } from "./telegram.js";

export const CHANNEL_PUBLIC_URL = "https://t.me/pbrasilagora";
export const CHANNEL_CTA_LABEL = "P Brasil Agora. Inscrever-se";

/** Strip http(s) URLs so posts never leak external links. */
export function stripExternalUrls(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

export function buildNewsCaption(input: {
  title: string;
  summary: string;
  source?: string;
  useQuote?: boolean;
}): string {
  const title = stripExternalUrls(input.title);
  const summary = stripExternalUrls(input.summary);
  const source = input.source ? stripExternalUrls(input.source) : undefined;

  const headline = source
    ? `⚡️ <b>${escapeHtml(title)} — ${escapeHtml(source)}</b>`
    : `⚡️ <b>${escapeHtml(title)}</b>`;

  const body = input.useQuote
    ? `<blockquote>${escapeHtml(summary)}</blockquote>`
    : escapeHtml(summary);

  const cta =
    `👉 <a href="${CHANNEL_PUBLIC_URL}">${escapeHtml(CHANNEL_CTA_LABEL)}</a>`;

  return [headline, "", body, "", cta].join("\n");
}
