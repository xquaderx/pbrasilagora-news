export type CredibilityResult = {
  ok: boolean;
  score: number;
  reasons: string[];
  sourceTier: "trusted" | "unknown" | "blocked";
};

const TRUSTED_SOURCES = new Set([
  "g1",
  "g1 política",
  "agência brasil",
  "agencia brasil",
  "bbc brasil",
  "folha",
  "folha de s.paulo",
  "uol",
  "cnn brasil",
  "estadão",
  "estadao",
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
      score -= 40;
      reasons.push(`host_suspeito:${hint}`);
    }
  }

  const text = `${input.title}\n${input.summary}`;
  for (const re of FAKE_PHRASES) {
    if (re.test(text)) {
      score -= 25;
      reasons.push(`frase_risco:${re.source}`);
    }
  }

  if ((input.title.match(/!/g) ?? []).length >= 2) {
    score -= 10;
    reasons.push("excesso_exclamacao");
  }
  if (input.title === input.title.toUpperCase() && input.title.length > 12) {
    score -= 15;
    reasons.push("titulo_caps");
  }

  // Thin / empty summary is riskier for channel quality.
  if (input.summary.trim().length < 40) {
    score -= 10;
    reasons.push("resumo_curto");
  }

  score = Math.max(0, Math.min(100, score));
  const ok = sourceTier !== "blocked" && score >= 60;
  if (ok) reasons.push("aprovado");
  else reasons.push("reprovado");

  return { ok, score, reasons, sourceTier };
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function hostMatchesTrusted(host: string): boolean {
  const trustedHosts = [
    "g1.globo.com",
    "globo.com",
    "agenciabrasil.ebc.com.br",
    "bbc.com",
    "bbci.co.uk",
    "folha.uol.com.br",
    "www1.folha.uol.com.br",
    "noticias.uol.com.br",
    "cnnbrasil.com.br",
    "estadao.com.br",
    "reuters.com",
    "apnews.com",
  ];
  return trustedHosts.some((h) => host === h || host.endsWith(`.${h}`));
}
