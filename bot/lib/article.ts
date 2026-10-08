import { stripHtml, stripReadMoreBoilerplate } from "./text.js";

const UA = "brasil-noticias-bdk/1.0 (+cursor-agent)";

/**
 * Build a self-contained channel summary from RSS text + article page.
 * Never leaves "Leia mais" / outbound teaser tails.
 */
export async function buildFullSummary(input: {
  rssSummary: string;
  articleLink: string;
  maxLen?: number;
}): Promise<string> {
  const maxLen = input.maxLen ?? 700;
  let text = stripReadMoreBoilerplate(stripHtml(input.rssSummary));

  const needsMore =
    text.length < 160 ||
    /\bleia\s+mais\b/i.test(input.rssSummary) ||
    /\bcontinue\s+lendo\b/i.test(input.rssSummary);

  if (needsMore) {
    const fromPage = await extractArticleText(input.articleLink);
    if (fromPage && fromPage.length > text.length) text = fromPage;
  }

  text = stripReadMoreBoilerplate(text);
  if (text.length <= maxLen) return text;

  // Cut on sentence boundary when possible.
  const sliced = text.slice(0, maxLen);
  const lastStop = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
  );
  if (lastStop > 120) return sliced.slice(0, lastStop + 1).trim();
  return sliced.trim();
}

async function extractArticleText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!response.ok) return null;
    const buf = Buffer.from(await response.arrayBuffer());
    const httpCs =
      response.headers.get("content-type")?.match(/charset=([^\s;]+)/i)?.[1] ??
      "";
    const head = buf.subarray(0, 800).toString("latin1");
    const htmlCs =
      head.match(/charset=["']?([^\s"'/>]+)/i)?.[1] ??
      head.match(/encoding=["']([^"']+)["']/i)?.[1] ??
      "";
    const charset = normalizeCharset(htmlCs || httpCs || "utf-8");
    const html = decodeBuffer(buf, charset);

    const og =
      html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
      )?.[1] ??
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      )?.[1];

    const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripHtml(m[1] ?? ""))
      .filter((p) => p.length > 60)
      .filter((p) => !/\bleia\s+mais\b/i.test(p))
      .slice(0, 5);

    const parts = [
      og ? stripHtml(og) : "",
      ...paragraphs,
    ].filter(Boolean);

    const merged = stripReadMoreBoilerplate(parts.join(" "));
    return merged.length >= 80 ? merged : null;
  } catch {
    return null;
  }
}

function normalizeCharset(raw: string): string {
  const c = raw.trim().toLowerCase().replace(/utf8/, "utf-8");
  if (c === "iso-8859-1" || c === "latin-1" || c === "latin1") return "latin1";
  if (c === "windows-1252" || c === "cp1252") return "windows-1252";
  return c === "utf-8" ? "utf-8" : "utf-8";
}

function decodeBuffer(buf: Buffer, charset: string): string {
  try {
    if (charset === "latin1") return buf.toString("latin1");
    return new TextDecoder(charset).decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}
