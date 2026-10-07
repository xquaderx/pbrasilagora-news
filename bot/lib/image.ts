const UA = "brasil-noticias-bdk/1.0 (+cursor-agent)";

/** Resolve a usable public image for a news item (RSS first, then page meta). */
export async function resolveNewsImage(input: {
  imageUrl?: string | null;
  articleLink: string;
}): Promise<string | null> {
  if (input.imageUrl && isLikelyImageUrl(input.imageUrl)) {
    return absoluteUrl(input.imageUrl, input.articleLink);
  }

  try {
    const response = await fetch(input.articleLink, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!response.ok) return null;
    const html = await response.text();
    const fromMeta = pickMetaImage(html);
    if (!fromMeta) return null;
    return absoluteUrl(fromMeta, input.articleLink);
  } catch {
    return null;
  }
}

function pickMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtml(m[1]);
  }
  return null;
}

function absoluteUrl(url: string, base: string): string | null {
  try {
    const abs = new URL(url, base).toString();
    return isLikelyImageUrl(abs) ? abs : null;
  } catch {
    return null;
  }
}

function isLikelyImageUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (url.includes("svg")) return false;
  return true;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
