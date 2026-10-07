---
cron: "*/20 * * * *"
---

Ciclo de 20 minutos do canal **P Brasil Agora**.

1. `fetch_brazil_news` com limit 8, requireImage true.
2. Pegue **1** matéria com `publishable: true` (tem imagem, não é duplicata, score ok).
3. `check_news_credibility` nessa matéria.
4. Se `publishable`, `post_to_telegram` com title/summary PT-BR, `articleLink`, `imageUrl`/`resolvedImageUrl`, source — sem URLs no texto.
5. No máximo **1 post** por ciclo. Se nada passar nos filtros, não poste e diga o motivo.
