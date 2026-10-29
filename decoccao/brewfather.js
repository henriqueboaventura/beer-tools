// Integração com o Brewfather (experimental): troca a mostura de uma
// receita do Brewfather pelo programa calculado aqui.
//
// API v2 (https://docs.brewfather.app/api): autenticação Basic com
// "userid:apikey", PATCH /recipes/:id faz merge raso — mandar `mash`
// substitui o perfil de mostura inteiro. A chave precisa dos escopos
// recipes.read e recipes.write. A API libera CORS, então tudo roda no
// navegador: o user id e a chave só vão para api.brewfather.app.
//
// Duas partes:
// - `passosBrewfather(rows)`: pura, testada em Node. O Brewfather descreve
//   a mostura pela tina principal (um passo = uma temperatura), então as
//   etapas da decocção que acontecem só na tina de fervura (puxar, aquecer,
//   ferver) viram tempo do patamar em que a mostura está esperando, e a
//   decocção entra no nome do passo.
// - `montarPainel(opts)`: o bloco da interface, só no navegador.

const BF_API = "https://api.brewfather.app/v2";
const BF_CREDENCIAIS_KEY = "decoccao:v1:brewfather";
// diferença de temperatura da mostura que abre um passo novo (°C)
const BF_TOLERANCIA_C = 1;

function bfArred(n, casas) {
  const f = Math.pow(10, casas);
  return Math.round(n * f) / f;
}

function bfNum(n, casas = 1) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

// aquecimento da própria mostura (sem decocção na fervura): vira rampa
function bfEhRampa(r) {
  return /aquecimento/i.test(r.label) && (r.boil === null || r.boil === undefined);
}

// etapa da tina de fervura ou transferência: não dá nome ao passo. A
// decocção na fervura está acima da temperatura do patamar; compara com
// ela, não com a mostura da linha (que é a do fim da etapa e cai com a
// perda térmica em espera).
function bfEhAuxiliar(r, tempPatamar) {
  return /transfer|aquecimento|adição/i.test(r.label) ||
    (r.boil !== null && r.boil !== undefined && r.boil > tempPatamar + BF_TOLERANCIA_C);
}

function passosBrewfather(rows) {
  const comMostura = rows.filter((r) => r.mash !== null && r.mash !== undefined);
  const grupos = [];
  let atual = null;
  comMostura.forEach((r, i) => {
    // a adição de água da pseudo-decocção é o começo do patamar seguinte
    // (a mistura ainda não chegou na temperatura dele)
    const temp = r.pseudoWaterAddL !== undefined && comMostura[i + 1] ? comMostura[i + 1].mash : r.mash;
    // Passo novo só quando alguém muda a temperatura da mostura: devolução
    // de decocção, aquecimento, adição (pseudo) — ou uma subida. A queda
    // da perda térmica em espera (mashCoolingRate) é o mesmo patamar
    // esfriando, não um passo.
    const evento = r.returnsDecoction || bfEhRampa(r) || r.pseudoWaterAddL !== undefined || r.pseudoMaltAddKg !== undefined;
    const muda = atual && Math.abs(temp - atual.temp) > BF_TOLERANCIA_C && (evento || temp > atual.ultima + BF_TOLERANCIA_C);
    if (!atual || muda) {
      atual = { temp, rows: [] };
      grupos.push(atual);
    }
    atual.ultima = r.mash;
    atual.rows.push(r);
  });

  // Decocção: a puxada acontece num patamar e a devolução abre o próximo.
  // No Brewfather o passo "Decoction" é o que a decocção alcança, então o
  // volume e a fervura vão para ele.
  let pendente = null;
  for (const g of grupos) {
    if (pendente && g.rows[0].returnsDecoction) { g.decoccao = pendente; pendente = null; }
    const puxada = g.rows.find((r) => r.decoctionVolumeL !== undefined);
    if (puxada) {
      const fervura = g.rows
        .filter((r) => r.boil !== null && r.boil !== undefined && r.boil >= 95 && !/aquecimento/i.test(r.label))
        .reduce((s, r) => s + r.duration, 0);
      // descanso de sacarificação da decocção, antes de ferver (nem todo
      // método tem: a 2ª do Hochkurz vai direto à fervura)
      const descanso = g.rows.find((r) => /sacarifica/i.test(r.label) && !/aquecimento/i.test(r.label) && r.boil !== null && r.boil !== undefined && r.boil > g.temp + BF_TOLERANCIA_C);
      pendente = { litros: puxada.decoctionVolumeL, fervura, descanso };
    }
  }

  return grupos.map((g) => {
    let rampa = 0;
    let tempo = 0;
    let iniciando = true;
    for (const r of g.rows) {
      if (iniciando && bfEhRampa(r)) { rampa += r.duration; continue; }
      iniciando = false;
      tempo += r.duration;
    }
    const descansos = g.rows.filter((r) => !bfEhAuxiliar(r, g.temp));
    const principal = descansos.length
      ? descansos.reduce((a, b) => (b.duration > a.duration ? b : a))
      : g.rows[0];
    let nome = principal.label;
    if (g.decoccao) {
      nome += ` · decocção de ${bfNum(g.decoccao.litros)} L` + (g.decoccao.fervura > 0 ? `, fervura ${bfNum(g.decoccao.fervura)} min` : "");
    }
    // Devolução do resto de uma decocção já contada (devolução em partes,
    // Dupla Aprimorada): o Brewfather não tem como dizer isso num passo
    // Decoction (ele puxaria de novo), então fica Temperature.
    const decoccao = !!g.decoccao;
    if (!decoccao && g.rows[0].returnsDecoction) nome += " · devolver o resto da decocção";
    const temp = bfArred(g.temp, 1);
    const passo = {
      name: nome,
      type: decoccao ? "Decoction" : "Temperature",
      stepTemp: temp,
      displayStepTemp: temp,
      stepTime: Math.min(Math.round(tempo), 360),
      rampTime: rampa > 0 ? Math.min(Math.round(rampa), 60) : null,
    };
    if (decoccao) {
      // "volume": o Brewfather usa o volume puxado daqui em vez de calcular
      // o dele ("calculated", que parte dos insumos da receita). A API só
      // aceita calculated, volume e percent; outro valor vira calculated.
      passo.decoctionAmountMode = "volume";
      passo.decoctionAmount = bfArred(g.decoccao.litros, 1);
      const d = g.decoccao.descanso;
      passo.decoctionRestTemp = d ? bfArred(d.boil, 1) : null;
      passo.displayDecoctionRestTemp = passo.decoctionRestTemp;
      passo.decoctionRestTime = d ? Math.round(d.duration) : null;
    }
    return passo;
  });
}

// Água e malte da mostura da receita, como o Brewfather calcula
// (recipe.data, preenchido pelo app ao salvar). null se faltar algum.
function insumosDaReceita(receita) {
  const d = receita && receita.data;
  const agua = d && Number(d.mashWaterAmount);
  const malte = d && Number(d.mashFermentablesAmount);
  if (!(agua > 0) || !(malte > 0)) return null;
  return { waterVolume: bfArred(agua, 2), grainWeight: bfArred(malte, 3) };
}

// O perfil novo: o que a receita já tinha (pH, sparge, notas) com outro
// nome e os passos daqui.
function mostraBrewfather(mashAtual, passos, nomeMetodo) {
  const base = mashAtual && typeof mashAtual === "object" ? mashAtual : {};
  return { ...base, name: `Decocção ${nomeMetodo} (Brassagem Forte)`, steps: passos };
}

function bfCliente(userId, apiKey, fetchFn) {
  const f = fetchFn || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  const auth = "Basic " + btoa(`${userId}:${apiKey}`);
  async function chamar(caminho, opcoes = {}) {
    const res = await f(BF_API + caminho, {
      ...opcoes,
      headers: { authorization: auth, "content-type": "application/json", ...(opcoes.headers || {}) },
    });
    if (!res.ok) {
      const erro = new Error(`Brewfather respondeu ${res.status}`);
      erro.status = res.status;
      throw erro;
    }
    // o PATCH responde texto puro ("Updated"), não JSON
    const texto = await res.text();
    try { return texto ? JSON.parse(texto) : null; } catch (e) { return texto; }
  }
  return {
    // todas as receitas, de 50 em 50 (limite da API). A paginação é por
    // _id (start_after só aceita _id); a ordem por nome fica aqui.
    async receitas() {
      const todas = [];
      let depois = null;
      for (let i = 0; i < 20; i++) {
        const pagina = await chamar(`/recipes?limit=50${depois ? `&start_after=${encodeURIComponent(depois)}` : ""}`);
        todas.push(...pagina);
        if (pagina.length < 50) break;
        depois = pagina[pagina.length - 1]._id;
      }
      return todas.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
    },
    receita: (id) => chamar(`/recipes/${encodeURIComponent(id)}`),
    atualizarMostura: (id, mash) => chamar(`/recipes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ mash }) }),
  };
}

function bfMensagemErro(e) {
  if (e.status === 401) return "User ID ou API key errados.";
  if (e.status === 403) return "A API key não tem permissão. Gere uma com os escopos de ler e editar receitas (recipes.read e recipes.write).";
  if (e.status === 404) return "Receita não encontrada.";
  if (e.status === 429) return "Limite de chamadas do Brewfather atingido. Espere alguns minutos.";
  if (e.status) return `O Brewfather recusou o pedido (${e.status}).`;
  return "Não deu para falar com o Brewfather. Confira a internet.";
}

/* ---------- interface (navegador) ---------- */

// opts.atual(): { rows, methodName, params } do programa na tela, ou null
// se ele não está calculável. opts.usarInsumos({ waterVolume, grainWeight })
// troca os insumos da calculadora.
function montarPainel(opts) {
  const lerSalvo = () => {
    try { return JSON.parse(localStorage.getItem(BF_CREDENCIAIS_KEY)) || {}; } catch (e) { return {}; }
  };
  const salvo = lerSalvo();
  const wrap = document.createElement("div");
  wrap.className = "param-group brewfather";
  wrap.innerHTML = `
    <p class="param-group__title">Brewfather (experimental)</p>
    <p class="brewfather__nota">Troca a mostura de uma receita do Brewfather pelo programa desta página. A API key precisa ler e editar receitas. Gere em Brewfather → Configurações → API.</p>
    <div class="field"><div class="field__label"><label for="bfUserId">User ID</label></div>
      <div class="field__control"><input type="text" id="bfUserId" autocomplete="off" spellcheck="false"></div></div>
    <div class="field"><div class="field__label"><label for="bfApiKey">API key</label></div>
      <div class="field__control"><input type="password" id="bfApiKey" autocomplete="off" spellcheck="false"></div></div>
    <label class="brewfather__lembrar"><input type="checkbox" id="bfLembrar"> Lembrar neste navegador</label>
    <button class="btn" type="button" id="bfCarregar">Carregar receitas</button>
    <div class="field" id="bfReceitaCampo" hidden><div class="field__label"><label for="bfReceita">Receita</label></div>
      <div class="field__control"><select id="bfReceita"></select></div></div>
    <div class="brewfather__insumos" id="bfInsumos" hidden>
      <p id="bfInsumosTexto"></p>
      <button class="btn" type="button" id="bfUsarInsumos">Usar os insumos da receita</button>
    </div>
    <ol class="brewfather__passos" id="bfPassos" hidden></ol>
    <button class="btn btn--primary" type="button" id="bfEnviar" hidden>Atualizar mostura no Brewfather</button>
    <p class="brewfather__status" id="bfStatus" role="status" aria-live="polite"></p>`;

  const $ = (id) => wrap.querySelector("#" + id);
  $("bfUserId").value = salvo.userId || "";
  $("bfApiKey").value = salvo.apiKey || "";
  $("bfLembrar").checked = !!salvo.userId;

  const status = (txt, tipo) => {
    $("bfStatus").textContent = txt;
    $("bfStatus").dataset.tipo = tipo || "";
  };
  const credenciais = () => ({ userId: $("bfUserId").value.trim(), apiKey: $("bfApiKey").value.trim() });
  const guardar = () => {
    try {
      if ($("bfLembrar").checked) localStorage.setItem(BF_CREDENCIAIS_KEY, JSON.stringify(credenciais()));
      else localStorage.removeItem(BF_CREDENCIAIS_KEY);
    } catch (e) { /* sem localStorage: só não lembra */ }
  };
  const cliente = () => {
    const c = credenciais();
    return bfCliente(c.userId, c.apiKey, opts.fetch);
  };

  function prever() {
    const a = opts.atual();
    const lista = $("bfPassos");
    if (!a || !a.rows.length) {
      lista.hidden = true;
      $("bfEnviar").disabled = true;
      return null;
    }
    const passos = passosBrewfather(a.rows);
    lista.innerHTML = passos.map((p) =>
      `<li><b>${bfNum(p.stepTemp)} °C · ${p.stepTime} min</b>${p.rampTime ? ` <span>(rampa ${p.rampTime} min)</span>` : ""}<br>${p.name.replace(/</g, "&lt;")}</li>`).join("");
    lista.hidden = $("bfReceitaCampo").hidden;
    $("bfEnviar").disabled = false;
    mostrarInsumos();
    return { passos, methodName: a.methodName };
  }

  // insumos da receita escolhida × os da calculadora
  let insumos = null;
  let insumosDe = null;
  function mostrarInsumos() {
    const a = opts.atual();
    const caixa = $("bfInsumos");
    if (!insumos || !a || !a.params) { caixa.hidden = true; return; }
    const iguais = Math.abs(a.params.waterVolume - insumos.waterVolume) < 0.05 && Math.abs(a.params.grainWeight - insumos.grainWeight) < 0.005;
    caixa.hidden = false;
    caixa.dataset.iguais = iguais ? "1" : "0";
    $("bfInsumosTexto").innerHTML = iguais
      ? `A calculadora está com os insumos da receita: <b>${bfNum(insumos.waterVolume, 2)} L</b> de água e <b>${bfNum(insumos.grainWeight, 2)} kg</b> de malte.`
      : `A receita usa <b>${bfNum(insumos.waterVolume, 2)} L</b> de água e <b>${bfNum(insumos.grainWeight, 2)} kg</b> de malte na mostura; a calculadora está com ${bfNum(a.params.waterVolume, 2)} L e ${bfNum(a.params.grainWeight, 2)} kg. Os volumes das decocções só batem com os mesmos insumos.`;
    $("bfUsarInsumos").hidden = iguais;
  }
  async function carregarInsumos() {
    const id = $("bfReceita").value;
    insumos = null;
    insumosDe = id;
    mostrarInsumos();
    if (!id) return;
    try {
      const r = await cliente().receita(id);
      if (insumosDe !== id) return; // trocou de receita no meio
      insumos = insumosDaReceita(r);
    } catch (e) {
      status(bfMensagemErro(e), "erro");
    }
    mostrarInsumos();
  }

  $("bfLembrar").addEventListener("change", guardar);
  $("bfCarregar").addEventListener("click", async () => {
    const c = credenciais();
    if (!c.userId || !c.apiKey) { status("Preencha o User ID e a API key.", "erro"); return; }
    guardar();
    status("Carregando receitas…");
    $("bfCarregar").disabled = true;
    try {
      const receitas = await cliente().receitas();
      const sel = $("bfReceita");
      sel.innerHTML = receitas.map((r) => `<option value="${r._id}">${String(r.name || "(sem nome)").replace(/</g, "&lt;")}</option>`).join("");
      if (salvo.receita && receitas.some((r) => r._id === salvo.receita)) sel.value = salvo.receita;
      $("bfReceitaCampo").hidden = !receitas.length;
      $("bfEnviar").hidden = !receitas.length;
      status(receitas.length ? `${receitas.length} receitas. Escolha a receita e confira os passos antes de enviar.` : "Nenhuma receita nessa conta.", receitas.length ? "ok" : "erro");
      prever();
      if (receitas.length) carregarInsumos();
    } catch (e) {
      status(bfMensagemErro(e), "erro");
    } finally {
      $("bfCarregar").disabled = false;
    }
  });
  $("bfUsarInsumos").addEventListener("click", () => {
    if (!insumos || !opts.usarInsumos) return;
    opts.usarInsumos(insumos);
    status("Insumos da receita aplicados. Confira os passos e envie.", "ok");
  });
  $("bfReceita").addEventListener("change", () => {
    carregarInsumos();
    salvo.receita = $("bfReceita").value;
    try {
      const s = lerSalvo();
      if (s.userId) localStorage.setItem(BF_CREDENCIAIS_KEY, JSON.stringify({ ...s, receita: salvo.receita }));
    } catch (e) { /* ignora */ }
  });
  $("bfEnviar").addEventListener("click", async () => {
    const p = prever();
    const id = $("bfReceita").value;
    if (!p || !id) { status("Corrija o programa antes de enviar.", "erro"); return; }
    const nome = $("bfReceita").selectedOptions[0].textContent;
    $("bfEnviar").disabled = true;
    status(`Atualizando "${nome}"…`);
    try {
      const c = cliente();
      const receita = await c.receita(id);
      await c.atualizarMostura(id, mostraBrewfather(receita.mash, p.passos, p.methodName));
      status(`Mostura de "${nome}" atualizada com ${p.passos.length} passos. Abra a receita no Brewfather para conferir.`, "ok");
    } catch (e) {
      status(bfMensagemErro(e), "erro");
    } finally {
      $("bfEnviar").disabled = false;
    }
  });

  return { elemento: wrap, atualizar: prever };
}

const DecoccaoBrewfatherExports = { passosBrewfather, mostraBrewfather, insumosDaReceita, bfCliente, bfMensagemErro, montarPainel, BF_CREDENCIAIS_KEY };
if (typeof window !== "undefined") window.DecoccaoBrewfather = DecoccaoBrewfatherExports;
if (typeof module !== "undefined" && module.exports) module.exports = DecoccaoBrewfatherExports;
