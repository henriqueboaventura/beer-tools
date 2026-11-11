// Cliente de leitura do Brewfather (API v2). Autenticação Basic com
// "userid:apikey"; a API libera CORS, então roda no navegador e as
// credenciais só vão para api.brewfather.app. Precisa do escopo
// recipes.read. (Esta ferramenta só LÊ do Brewfather.)

const BF_API = "https://api.brewfather.app/v2";
const BF_CRED_KEY = "brewfather-k60:v1:cred";

function bfCliente(userId, apiKey, fetchFn) {
  const f = fetchFn || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  const auth = "Basic " + btoa(`${userId}:${apiKey}`);
  async function chamar(caminho) {
    const res = await f(BF_API + caminho, { headers: { authorization: auth } });
    if (!res.ok) {
      const e = new Error(`Brewfather respondeu ${res.status}`);
      e.status = res.status;
      throw e;
    }
    return res.json();
  }
  return {
    async receitas() {
      const todas = [];
      let depois = null;
      for (let i = 0; i < 20; i++) {
        const p = await chamar(`/recipes?limit=50${depois ? `&start_after=${encodeURIComponent(depois)}` : ""}`);
        todas.push(...p);
        if (p.length < 50) break;
        depois = p[p.length - 1]._id;
      }
      return todas.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
    },
    receita: (id) => chamar(`/recipes/${encodeURIComponent(id)}`),
  };
}

function bfMensagemErro(e) {
  if (e.status === 401) return "User ID ou API key errados.";
  if (e.status === 403) return "A API key não tem permissão de ler receitas (recipes.read).";
  if (e.status === 404) return "Receita não encontrada.";
  if (e.status === 429) return "Limite de chamadas do Brewfather atingido. Espere alguns minutos.";
  if (e.status) return `O Brewfather recusou o pedido (${e.status}).`;
  return "Não deu para falar com o Brewfather. Confira a internet.";
}

const BrewfatherK60 = { bfCliente, bfMensagemErro, BF_CRED_KEY };
if (typeof window !== "undefined") window.BrewfatherK60 = BrewfatherK60;
if (typeof module !== "undefined" && module.exports) module.exports = BrewfatherK60;
