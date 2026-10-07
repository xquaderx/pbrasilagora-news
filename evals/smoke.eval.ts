import { defineEval, includes } from "@cursor/bdk/evals";

export default defineEval({
  tags: ["smoke"],
  cases: [
    {
      id: "fetch-cycle",
      description: "Scheduled-style cycle fetches Brazil news before posting.",
      async test(t) {
        await t.send(
          "Rode um ciclo do canal: busque notícias novas sobre o Brasil e, se houver algo relevante, prepare posts em português. Não invente links.",
        );
        t.succeeded();
        t.calledTool("fetch_brazil_news");
        t.check(t.reply, includes(/notíc|Brasil|post|public|fonte|RSS|sem novidade/i));
      },
    },
  ],
});
