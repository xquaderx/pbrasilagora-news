---
cron: "0 */4 * * *"
---

Publique o próximo ciclo do canal **P Brasil Agora** (estilo Topor Live).

1. Chame `fetch_brazil_news` (limit 12, includePosted false).
2. Selecione até 3 matérias novas e relevantes para o Brasil.
3. Para cada uma, chame `post_to_telegram` com:
   - title + summary em PT-BR (skill `news-format`)
   - `articleLink` da matéria (só dedupe — nunca no texto)
   - `imageUrl` quando o feed trouxer
   - sem qualquer URL no title/summary
4. Responda com relatório: o que publicou / pulou.
   Se não houver novidade, diga isso sem postar.
