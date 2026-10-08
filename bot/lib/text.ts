/** Decode HTML/XML entities (including double-encoded &amp;#8220;). */
export function decodeEntities(text: string): string {
  let cur = text;
  for (let i = 0; i < 6; i++) {
    const prev = cur;
    cur = cur
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/gi, " ")
      .replace(/&ldquo;|&laquo;|&#8220;/gi, "“")
      .replace(/&rdquo;|&raquo;|&#8221;/gi, "”")
      .replace(/&lsquo;|&#8216;/gi, "‘")
      .replace(/&rsquo;|&#8217;/gi, "’")
      .replace(/&ndash;|&#8211;/gi, "–")
      .replace(/&mdash;|&#8212;/gi, "—")
      .replace(/&ccedil;/gi, "ç")
      .replace(/&Ccedil;/g, "Ç")
      .replace(/&atilde;/gi, "ã")
      .replace(/&otilde;/gi, "õ")
      .replace(/&aacute;/gi, "á")
      .replace(/&eacute;/gi, "é")
      .replace(/&iacute;/gi, "í")
      .replace(/&oacute;/gi, "ó")
      .replace(/&uacute;/gi, "ú")
      .replace(/&acirc;/gi, "â")
      .replace(/&ecirc;/gi, "ê")
      .replace(/&ocirc;/gi, "ô")
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
        const code = Number.parseInt(h, 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : _;
      })
      .replace(/&#(\d+);/g, (_, n) => {
        const code = Number(n);
        return Number.isFinite(code) ? String.fromCodePoint(code) : _;
      });
    if (cur === prev) break;
  }
  return cur;
}

/** Remove "read more" tails and site chrome — the channel must be self-contained. */
export function stripReadMoreBoilerplate(text: string): string {
  return text
    .replace(
      /\b(leia\s+mais|continue\s+lendo|saiba\s+mais|leia\s+a\s+matéria|leia\s+a\s+materia|ler\s+mais|read\s+more|click\s+here)\b[\s\S]*$/i,
      "",
    )
    .replace(/\(\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–—]?\s*\d{1,2}h\d{0,2}\s*\)/gi, "")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–—]\s*\d{1,2}h\d{0,2}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function stripHtml(text: string): string {
  return stripReadMoreBoilerplate(
    decodeEntities(text)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** Final cleanup before publishing to Telegram. */
export function sanitizePostText(text: string): string {
  return stripReadMoreBoilerplate(
    decodeEntities(text)
      .replace(/\uFFFD/g, "") // drop replacement chars if any slipped through
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.!?;:])/g, "$1")
      .trim(),
  );
}
