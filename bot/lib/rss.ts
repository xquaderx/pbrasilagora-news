import { decodeEntities, stripHtml, stripReadMoreBoilerplate } from "./text.js";

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
  source: string;
  imageUrl: string | null;
};

/** Decode RSS body using XML/HTTP charset (Folha is often ISO-8859-1). */
export async function readFeedText(response: Response): Promise<string> {
  const buf = Buffer.from(await response.arrayBuffer());
  const httpCs =
    response.headers.get("content-type")?.match(/charset=([^\s;]+)/i)?.[1] ??
    "";
  const head = buf.subarray(0, 400).toString("latin1");
  const xmlCs = head.match(/encoding=["']([^"']+)["']/i)?.[1] ?? "";
  const raw = (xmlCs || httpCs || "utf-8").trim().toLowerCase();
  if (raw.includes("8859-1") || raw.includes("latin")) {
    return buf.toString("latin1");
  }
  try {
    return new TextDecoder("utf-8").decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

function tagContent(block: string, tag: string): string | null {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
    "i",
  );
  const match = block.match(re);
  return match ? decodeEntities(match[1]!).trim() : null;
}

function unwrapRedirectLink(link: string): string {
  // Folha: https://redir.folha.../*https://www1.folha...
  const starred = link.match(/\*(https?:\/\/\S+)/i);
  if (starred?.[1]) return starred[1];
  return link;
}

function linkFromItem(block: string): string | null {
  const tagged = tagContent(block, "link");
  if (tagged && /^https?:\/\//i.test(tagged)) return unwrapRedirectLink(tagged);
  const atom = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atom?.[1] && /^https?:\/\//i.test(atom[1])) {
    return unwrapRedirectLink(atom[1]);
  }
  const guid = tagContent(block, "guid");
  if (guid && /^https?:\/\//i.test(guid)) return unwrapRedirectLink(guid);
  return null;
}

function imageFromItem(block: string): string | null {
  const media =
    block.match(
      /<(?:media:content|media:thumbnail|enclosure)[^>]+url=["']([^"']+)["']/i,
    ) ??
    block.match(
      /<(?:media:content|media:thumbnail|enclosure)[^>]+url=([^\s>]+)/i,
    );
  if (media?.[1] && /^https?:\/\//i.test(media[1])) return media[1];

  const img = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img?.[1] && /^https?:\/\//i.test(img[1])) return img[1];

  return null;
}

export function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ??
    [];

  for (const block of blocks) {
    const title = stripHtml(tagContent(block, "title") ?? "");
    const link = linkFromItem(block);
    if (!title || !link) continue;

    const summaryRaw =
      tagContent(block, "content:encoded") ??
      tagContent(block, "description") ??
      tagContent(block, "summary") ??
      tagContent(block, "content") ??
      "";
    const publishedAt =
      tagContent(block, "pubDate") ??
      tagContent(block, "updated") ??
      tagContent(block, "published") ??
      null;

    items.push({
      id: link,
      title: stripReadMoreBoilerplate(title),
      link,
      summary: stripReadMoreBoilerplate(stripHtml(summaryRaw)).slice(0, 900),
      publishedAt,
      source,
      imageUrl: imageFromItem(block),
    });
  }

  return items;
}

export type BrazilFeed = {
  source: string;
  url: string;
  /**
   * When true, keep only items clearly about Brazil
   * (for world/international feeds covering Brazil from outside).
   */
  requireBrazilMention?: boolean;
};

export const BRAZIL_FEEDS: ReadonlyArray<BrazilFeed> = [
  // Mainstream BR
  {
    source: "G1 Política",
    url: "https://g1.globo.com/rss/g1/politica/",
  },
  {
    source: "G1 Economia",
    url: "https://g1.globo.com/rss/g1/economia/",
  },
  {
    source: "Agência Brasil",
    url: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml",
  },
  {
    source: "Folha Poder",
    url: "https://feeds.folha.uol.com.br/poder/rss091.xml",
  },
  {
    source: "CNN Brasil",
    url: "https://www.cnnbrasil.com.br/feed/",
  },
  {
    source: "Estadão",
    url: "https://www.estadao.com.br/arc/outboundfeeds/rss/?outputType=xml",
  },
  {
    source: "Metrópoles",
    url: "https://www.metropoles.com/feed",
  },

  // Opposition / critical BR outlets
  {
    source: "Gazeta do Povo",
    url: "https://www.gazetadopovo.com.br/feed/rss/republica.xml",
  },
  {
    source: "Gazeta Economia",
    url: "https://www.gazetadopovo.com.br/feed/rss/economia.xml",
  },
  {
    source: "Revista Oeste",
    url: "https://revistaoeste.com/feed/",
  },
  {
    source: "Jovem Pan",
    url: "https://jovempan.com.br/feed/",
  },
  {
    source: "Veja",
    url: "https://veja.abril.com.br/feed/",
  },
  {
    source: "Poder360",
    url: "https://www.poder360.com.br/feed/",
  },
  {
    source: "Crusoé",
    url: "https://crusoe.com.br/feed/",
  },

  // World media (Brazil angle)
  {
    source: "BBC Brasil",
    url: "https://feeds.bbci.co.uk/portuguese/rss.xml",
    requireBrazilMention: true,
  },
  {
    source: "El País Brasil",
    url: "https://feeds.elpais.com/mrss-s/pages/ep/site/brasil.elpais.com/portada",
    requireBrazilMention: true,
  },
  {
    source: "G1 Mundo",
    url: "https://g1.globo.com/rss/g1/mundo/",
    requireBrazilMention: true,
  },
  {
    source: "Folha Mundo",
    url: "https://feeds.folha.uol.com.br/mundo/rss091.xml",
    requireBrazilMention: true,
  },
  {
    source: "The Guardian",
    url: "https://www.theguardian.com/world/brazil/rss",
    requireBrazilMention: true,
  },
  {
    source: "BBC Latin America",
    url: "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml",
    requireBrazilMention: true,
  },
  {
    source: "France 24",
    url: "https://www.france24.com/en/americas/rss",
    requireBrazilMention: true,
  },
  {
    source: "NYT Americas",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml",
    requireBrazilMention: true,
  },
];

/** True when the story is about Brazil (domestic or abroad). */
export function isAboutBrazil(title: string, summary: string): boolean {
  const text = `${title}\n${summary}`;
  return (
    /\bbrasil\b/i.test(text) ||
    /\bbrazil\b/i.test(text) ||
    /\bbrasileir[oa]s?\b/i.test(text) ||
    /\bbrazilian/i.test(text) ||
    /\bbrasília\b|\brasilia\b/i.test(text) ||
    /\bsão paulo\b|\bsao paulo\b/i.test(text) ||
    /\bplanalto\b/i.test(text) ||
    /\b(stf|stj|tse|tcu)\b/i.test(text) ||
    /\b(lula|bolsonaro|janja)\b/i.test(text) ||
    /\bbanco central\b|\bcentral bank of brazil\b/i.test(text) ||
    /\bitamaraty\b/i.test(text) ||
    /\bamason(ia|as)?\b|\bamazon\b/i.test(text)
  );
}

/** Heuristic: body looks like Portuguese (channel language). */
export function looksPortuguese(text: string): boolean {
  if (/[áàâãéêíóôõúç]/i.test(text)) return true;
  return /\b(não|também|após|você|estão|política|governo|eleição|eleições|brasil)\b/i.test(
    text,
  );
}

/** Prepare title/summary for the PT channel when source is foreign-language. */
export function localizeForChannel(input: {
  title: string;
  summary: string;
}): { title: string; summary: string } {
  const blob = `${input.title}\n${input.summary}`;
  if (looksPortuguese(blob)) return input;
  return {
    title: input.title,
    summary:
      `Repercussão internacional sobre o Brasil. ${input.summary}`.slice(0, 500),
  };
}

/** Prefer recent items; drop entries older than maxAgeMs when date parses. */
export function isFreshEnough(
  publishedAt: string | null,
  maxAgeMs = 1000 * 60 * 60 * 24 * 3,
  now = Date.now(),
): boolean {
  if (!publishedAt) return true;
  const ts = Date.parse(publishedAt);
  if (Number.isNaN(ts)) return true;
  return now - ts <= maxAgeMs;
}

export function publishedSortKey(publishedAt: string | null): number {
  if (!publishedAt) return 0;
  const ts = Date.parse(publishedAt);
  return Number.isNaN(ts) ? 0 : ts;
}
