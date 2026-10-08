export type CredibilityResult = {
  ok: boolean;
  score: number;
  reasons: string[];
  sourceTier: "trusted" | "unknown" | "blocked";
};

const TRUSTED_SOURCES = new Set([
  "agência brasil",
  "agencia brasil",
  "bbc brasil",
  "bbc latin america",
  "folha",
  "folha poder",
  "folha mundo",
  "folha de s.paulo",
  "uol",
  "estadão",
  "estadao",
  "metrópoles",
  "metropoles",
  "nexo",
  "carta capital",
  "infomoney",
  "money times",
  "exame",
  "gazeta do povo",
  "gazeta economia",
  "revista oeste",
  "jovem pan",
  "o antagonista",
  "poder360",
  "crusoé",
  "crusoe",
  "brasil 247",
  "el país brasil",
  "el pais brasil",
  "dw brasil",
  "the guardian",
  "france 24",
  "nyt americas",
  "reuters",
  "associated press",
]);

const BLOCKED_HOST_HINTS = [
  "whatsapp",
  "t.me/",
  "bit.ly",
  "tinyurl",
  "blogspot",
  "wordpress.com",
  "rumor",
  "boato",
];

/** Hard reject — TV roundups, empty video posts, non-news junk. */
const LOW_INFO_PATTERNS = [
  /^\s*v[íi]deos?\s*:/i,
  /\bv[íi]deo\s*:\s*/i,
  /\bassista\s+(a\s+)?(um\s+)?v[íi]deo\b/i,
  /\bassista\s+(ao|à)\s+/i,
  /\bao\s+vivo\b/i,
  /\bloterias?\b/i,
  /\b(quina|lotof[aá]cil|mega[- ]?sena|timemania|dupla[- ]?sena)\b/i,
  /\bconcurso\s+\d+\b/i,
  /\bresultado do concurso\b/i,
  /\bprogramação da\b/i,
  /\btelejornais?\b/i,
  /\bjornal\s+(nacional|hoje|da\s+globo|da\s+record)\b/i,
  /\b(mg2|sptv|rj2|df2|bom\s+dia)\b/i,
  /\bprincipais notícias do (estado|dia)\b/i,
  /\bresumo do dia\b/i,
  /\bgiro de notícias\b/i,
  /\bveja\s+como\s+foi\b/i,
  /\bconfira\s+os\s+destaques\b/i,
  /\bplaylist\b/i,
  /\benquete\b/i,
  /\bhoróscopo\b/i,
  /\bprevisão do tempo\b/i,
  /\bprevisao do tempo\b/i,
  /\bonde assistir\b/i,
  /\bescalações?\b/i,
  /\bescalacoes?\b/i,
  /\bsensitiva\b/i,
  /\bhoróscopo\b/i,
  /\bastroloy|\bastrolog/i,
  /\bveja fotos\b/i,
  /\bnovela\b/i,
  /\bbb?b\b/i,
  /\bfamosos?\b/i,
  /\bcelebridad/i,
  /\bcelebrities\b/i,
  /\bmansão\b|\bmansao\b/i,
  /\bbastidores da festa\b/i,
  /\blooks?\b/i,
  /\breality\b/i,
  /\bmasterchef\b/i,
  /\ba fazenda\b/i,
  /\bcoluna social\b/i,
  /\bplacar ao vivo\b/i,
  /\bpalpites?\b/i,
  /\bodds\b/i,
  /\bapostas?\b/i,
  /\bquarta-feira,?\s+\d/i, // "MG2, quarta-feira, 7 de outubro..."
  /\bsegunda-feira,?\s+\d/i,
  /\bterça-feira,?\s+\d/i,
  /\bterca-feira,?\s+\d/i,
  /\bquinta-feira,?\s+\d/i,
  /\bsexta-feira,?\s+\d/i,
  /\bsábado,?\s+\d/i,
  /\bsabado,?\s+\d/i,
  /\bdomingo,?\s+\d/i,
];

const FAKE_PHRASES = [
  /boato\b/i,
  /\bfake news\b/i,
  /\bdesinform/i,
  /\bclickbait\b/i,
  /\bsensacional/i,
  /\burgen?te[!!]{2,}/i,
  /\bcompartilhe antes\b/i,
  /\bmídia não mostra\b/i,
  /\beles não querem que você saiba\b/i,
  /\bchocante[!]/i,
  /\bvoce nao vai acreditar\b/i,
  /\bvocê não vai acreditar\b/i,
];

export function assessCredibility(input: {
  title: string;
  summary: string;
  source?: string;
  articleLink: string;
}): CredibilityResult {
  const reasons: string[] = [];
  let score = 50;
  const sourceNorm = (input.source ?? "").toLowerCase().trim();
  const host = safeHost(input.articleLink);
  const title = input.title.trim();
  const summary = input.summary.trim();
  const text = `${title}\n${summary}`;
  const path = safePath(input.articleLink);

  let sourceTier: CredibilityResult["sourceTier"] = "unknown";
  if (TRUSTED_SOURCES.has(sourceNorm)) {
    sourceTier = "trusted";
    score += 35;
    reasons.push("fonte_confiavel");
  } else if (hostMatchesTrusted(host)) {
    sourceTier = "trusted";
    score += 30;
    reasons.push("dominio_confiavel");
  } else {
    score -= 10;
    reasons.push("fonte_nao_listada");
  }

  for (const hint of BLOCKED_HOST_HINTS) {
    if (host.includes(hint) || input.articleLink.toLowerCase().includes(hint)) {
      sourceTier = "blocked";
      score -= 50;
      reasons.push(`host_suspeito:${hint}`);
    }
  }

  // URL shapes that are almost never useful channel posts.
  if (/\/ao-vivo\//i.test(path) || /\/playlist\//i.test(path) || /\/video\//i.test(path)) {
    score -= 50;
    reasons.push("url_video_ou_ao_vivo");
  }

  for (const re of LOW_INFO_PATTERNS) {
    if (re.test(text)) {
      score -= 55;
      reasons.push(`baixa_info:${re.source}`);
      break;
    }
  }

  for (const re of FAKE_PHRASES) {
    if (re.test(text)) {
      score -= 25;
      reasons.push(`frase_risco:${re.source}`);
    }
  }

  if ((title.match(/!/g) ?? []).length >= 2) {
    score -= 10;
    reasons.push("excesso_exclamacao");
  }
  if (title === title.toUpperCase() && title.length > 12) {
    score -= 15;
    reasons.push("titulo_caps");
  }

  // Informative body: need concrete length and at least one fact-ish signal.
  if (summary.length < 80) {
    score -= 25;
    reasons.push("resumo_curto");
  } else if (summary.length >= 140) {
    score += 8;
    reasons.push("resumo_substantivo");
  }

  if (!hasFactSignal(summary)) {
    score -= 20;
    reasons.push("resumo_vazio");
  }

  // Prefer national desk over random local TV catch-alls.
  if (sourceNorm === "g1 política" || sourceNorm === "agência brasil" || sourceNorm === "agencia brasil") {
    score += 5;
  }

  score = Math.max(0, Math.min(100, score));
  const hardReject = reasons.some((r) =>
    r.startsWith("baixa_info:") ||
    r === "url_video_ou_ao_vivo" ||
    r.startsWith("host_suspeito:")
  );
  const ok = !hardReject && sourceTier !== "blocked" && score >= 70;
  reasons.push(ok ? "aprovado" : "reprovado");

  return { ok, score, reasons, sourceTier };
}

function hasFactSignal(summary: string): boolean {
  // Numbers, money, names with verbs, or multi-sentence substance.
  if (/\d/.test(summary)) return true;
  if (/R\$\s*\d/i.test(summary)) return true;
  if (summary.split(/[.!?]/).filter((s) => s.trim().length > 30).length >= 2) {
    return true;
  }
  // At least one past/present news verb in PT.
  return /\b(disse|afirmou|anunciou|decidiu|aprovou|morreu|venceu|subiu|caiu|recebeu|confirmou|negou|elevou|reduziu|investiga|prendeu)\b/i.test(
    summary,
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function hostMatchesTrusted(host: string): boolean {
  const trustedHosts = [
    "agenciabrasil.ebc.com.br",
    "bbc.com",
    "bbci.co.uk",
    "folha.uol.com.br",
    "www1.folha.uol.com.br",
    "noticias.uol.com.br",
    "estadao.com.br",
    "metropoles.com",
    "nexojornal.com.br",
    "cartacapital.com.br",
    "infomoney.com.br",
    "moneytimes.com.br",
    "exame.com",
    "gazetadopovo.com.br",
    "revistaoeste.com",
    "jovempan.com.br",
    "oantagonista.com.br",
    "oantagonista.com",
    "poder360.com.br",
    "crusoe.com.br",
    "brasil247.com",
    "elpais.com",
    "brasil.elpais.com",
    "dw.com",
    "theguardian.com",
    "france24.com",
    "nytimes.com",
    "reuters.com",
    "apnews.com",
  ];
  return trustedHosts.some((h) => host === h || host.endsWith(`.${h}`));
}
