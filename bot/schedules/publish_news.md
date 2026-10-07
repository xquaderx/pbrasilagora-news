---
cron: "0 */4 * * *"
---

Publique o próximo ciclo do canal Telegram de notícias do Brasil.

1. Chame `fetch_brazil_news` (limit 12, includePosted false).
2. Selecione até 3 matérias novas e relevantes para o Brasil.
3. Para cada uma, redija título + resumo em português do Brasil
   (skill `news-format`) e chame `post_to_telegram`.
4. Responda com um breve relatório: o que publicou, o que pulou e por quê.
   Se não houver novidade, diga isso sem postar.
