import { defineEval, includes } from "@cursor/bdk/evals";

export default defineEval({
  tags: ["smoke"],
  cases: [
    {
      id: "fetch-cycle",
      description: "Scheduled-style cycle fetches Brazil news before posting.",
      async test(t) {
        await t.send(
          "Rode um ciclo do canal P Brasil Agora (estilo Topor): busque notícias do Brasil e prepare posts em português sem URLs externas no texto.",
        );
        t.succeeded();
        t.calledTool("fetch_brazil_news");
        t.check(t.reply, includes(/notíc|Brasil|post|public|fonte|RSS|sem novidade|Topor|Inscrever/i));
      },
    },
  ],
});
