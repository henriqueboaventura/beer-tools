// Cliente da controladora EZBrew / K60 (firmware v9.0). Esta ferramenta só
// CRIA receita (POST /receita); status/count são só para teste de conexão.
// A controladora libera CORS, então a chamada sai do próprio navegador para
// o IP dela na rede local.

function k60Cliente(baseUrl, fetchFn) {
  const f = fetchFn || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  const base = String(baseUrl || "").replace(/\/+$/, "");
  async function chamar(caminho, opcoes = {}) {
    const res = await f(base + caminho, opcoes);
    const texto = await res.text();
    let corpo = texto;
    try { corpo = texto ? JSON.parse(texto) : null; } catch (e) { /* texto puro */ }
    if (!res.ok) {
      const e = new Error(`A K60 respondeu ${res.status}`);
      e.status = res.status;
      e.corpo = corpo;
      throw e;
    }
    return corpo;
  }
  return {
    status: () => chamar("/status"),
    contarReceitas: () => chamar("/receita/count"),
    // cria a receita
    criarReceita: (receita) => chamar("/receita", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(receita),
    }),
  };
}

const K60Cliente = { k60Cliente };
if (typeof window !== "undefined") window.K60Cliente = K60Cliente;
if (typeof module !== "undefined" && module.exports) module.exports = K60Cliente;
