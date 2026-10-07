---
description: Use when drafting Telegram posts for P Brasil Agora in Topor Live style (PT-BR).
---

# Formato Topor — P Brasil Agora

## Estrutura

1. **Foto** — use `imageUrl` do feed quando existir.
2. **Título** — uma linha forte; a ferramenta prefixa `⚡️` e aplica negrito.
3. **Corpo** — 2–4 frases; use `useQuote: true` quando for citação/destaque.
4. **CTA** — automático: `👉 P Brasil Agora. Inscrever-se` (só nosso canal).

## Regras duras

- **Nenhuma URL externa** no título ou resumo (nem da matéria).
- Mencione a fonte só pelo nome (`G1`, `Agência Brasil`), sem link.
- Passe `articleLink` só para dedupe interno.
- Um post = uma matéria.
- Português do Brasil, neutro, sem hashtags.

## Exemplo de inputs para `post_to_telegram`

- title: `Dólar volta a R$ 5 após ajuste pós-eleitoral`
- summary: `A cotação reagiu ao cenário externo e ao humor dos mercados no Brasil. Analistas apontam volatilidade nos próximos dias.`
- source: `Agência Brasil`
- articleLink: `(url interna, não sai no post)`
- imageUrl: `(se houver)`
