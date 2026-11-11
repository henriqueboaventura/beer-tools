// Ferramenta interna Brewfather → K60. Amarra: origem da receita (Brewfather
// ou JSON colado), opções, prévia do mapeamento e envio do POST /receita.
(function () {
  "use strict";
  const { mapear, requisicao, comandoCurl, abreviarNome } = window.K60Mapa;
  const { bfCliente, bfMensagemErro, BF_CRED_KEY } = window.BrewfatherK60;
  const { k60Cliente } = window.K60Cliente;

  const $ = (id) => document.getElementById(id);
  let receitaAtual = null; // objeto de receita do Brewfather em uso

  // ---------- credenciais lembradas ----------
  function lerCred() { try { return JSON.parse(localStorage.getItem(BF_CRED_KEY)) || {}; } catch (e) { return {}; } }
  const cred = lerCred();
  $("bfUserId").value = cred.userId || "";
  $("bfApiKey").value = cred.apiKey || "";
  $("bfLembrar").checked = !!cred.userId;
  if (cred.base) $("base").value = cred.base;

  function guardarCred() {
    const dados = { userId: $("bfUserId").value.trim(), apiKey: $("bfApiKey").value.trim(), base: $("base").value.trim() };
    try {
      if ($("bfLembrar").checked) localStorage.setItem(BF_CRED_KEY, JSON.stringify(dados));
      else localStorage.removeItem(BF_CRED_KEY);
    } catch (e) { /* sem localStorage */ }
  }

  function status(el, txt, tipo) { el.textContent = txt; el.dataset.tipo = tipo || ""; }

  // ---------- opções ----------
  function opcoes() {
    const o = { decoccaoAlerta: $("optDecoccao").value };
    const p = parseFloat($("optPitch").value);
    if (Number.isFinite(p)) o.tempPitch = p;
    const nm = $("nomeK60").value.trim();
    if (nm) o.nome = nm; // campo editável; vazio = deixa o mapa abreviar sozinho
    return o;
  }

  // ---------- nome na K60 (editável, máx 18) ----------
  function atualizarContador() { $("nomeContador").textContent = $("nomeK60").value.length; }

  // prefixa o campo com a abreviação sugerida do nome da receita carregada
  function sugerirNome() {
    const bruto = receitaAtual && receitaAtual.name ? receitaAtual.name : "";
    $("nomeK60").value = abreviarNome(bruto);
    atualizarContador();
  }

  $("nomeK60").addEventListener("input", () => { atualizarContador(); renderizar(); });

  // ---------- prévia ----------
  function escapar(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

  function renderizar() {
    const previa = $("previa");
    if (!receitaAtual) {
      previa.hidden = true;
      $("previaVazia").hidden = false;
      $("btnEnviar").disabled = true;
      return;
    }
    const { receita, avisos } = mapear(receitaAtual, opcoes());
    $("previaVazia").hidden = true;
    previa.hidden = false;
    $("previaNome").textContent = "Receita: " + receita.nome + " · " + receita.etapas.length + " etapas";

    const adicoes = receita.adicoes || [];
    $("previaEtapas").innerHTML = receita.etapas.map((e, i) => {
      const linha = `<tr>
        <td>${i}</td>
        <td>${escapar(e.tipo)}</td>
        <td>${escapar(e.nome)}</td>
        <td>${e.iTemperatura || "—"}</td>
        <td>${e.iTempo || "—"}</td>
        <td>${e.iDosagem || "—"}</td>
        <td>${e.bPump ? "P" : "·"}/${e.bBeep ? "B" : "·"}/${e.bActive ? "A" : "·"}</td>
      </tr>`;
      const da = adicoes.filter((a) => a.id_etapa === i);
      if (!da.length) return linha;
      const ad = da.map((a) => `${escapar(a.nome)} @ ${a.tempo}′`).join(" · ");
      return linha + `<tr class="k60-adrow"><td></td><td colspan="6">↳ ${ad}</td></tr>`;
    }).join("");

    $("previaAvisos").innerHTML = avisos.map((a) => {
      const dec = /DECOC/i.test(a) ? " k60-aviso--dec" : "";
      return `<p class="k60-aviso${dec}">${escapar(a)}</p>`;
    }).join("");

    const base = $("base").value.trim() || "http://ezbrew.local";
    $("previaJson").textContent = JSON.stringify(receita, null, 2);
    $("previaCurl").textContent = comandoCurl(base, receita);
    $("btnEnviar").disabled = false;
  }

  // ---------- origem: alternância ----------
  document.querySelectorAll("[data-origem]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-origem]").forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
      const bf = btn.dataset.origem === "brewfather";
      $("origemBrewfather").hidden = !bf;
      $("origemJson").hidden = bf;
    });
  });

  // ---------- Brewfather ----------
  function clienteBf() { return bfCliente($("bfUserId").value.trim(), $("bfApiKey").value.trim()); }

  $("bfLembrar").addEventListener("change", guardarCred);

  $("btnCarregar").addEventListener("click", async () => {
    const st = $("statusConexao");
    if (!$("bfUserId").value.trim() || !$("bfApiKey").value.trim()) { status(st, "Preencha User ID e API key.", "erro"); return; }
    guardarCred();
    status(st, "Carregando receitas…");
    $("btnCarregar").disabled = true;
    try {
      const receitas = await clienteBf().receitas();
      const sel = $("bfReceita");
      sel.innerHTML = receitas.map((r) => `<option value="${r._id}">${escapar(r.name || "(sem nome)")}</option>`).join("");
      $("bfReceitaCampo").hidden = !receitas.length;
      status(st, receitas.length ? `${receitas.length} receitas. Escolha uma.` : "Nenhuma receita nessa conta.", receitas.length ? "ok" : "erro");
      if (receitas.length) carregarReceitaBf();
    } catch (e) {
      status(st, bfMensagemErro(e), "erro");
    } finally {
      $("btnCarregar").disabled = false;
    }
  });

  async function carregarReceitaBf() {
    const id = $("bfReceita").value;
    if (!id) return;
    const st = $("statusConexao");
    status(st, "Carregando receita…");
    try {
      receitaAtual = await clienteBf().receita(id);
      status(st, "Receita carregada.", "ok");
      sugerirNome();
      renderizar();
    } catch (e) {
      status(st, bfMensagemErro(e), "erro");
    }
  }
  $("bfReceita").addEventListener("change", carregarReceitaBf);

  // ---------- JSON colado ----------
  $("btnJson").addEventListener("click", () => {
    const st = $("statusEnvio");
    try {
      receitaAtual = JSON.parse($("jsonReceita").value);
      status(st, "JSON carregado.", "ok");
      sugerirNome();
      renderizar();
    } catch (e) {
      receitaAtual = null;
      renderizar();
      status(st, "JSON inválido: " + e.message, "erro");
    }
  });

  // reage a mudança de opções
  ["optPitch", "optDecoccao", "base"].forEach((id) => $(id).addEventListener("change", renderizar));

  // ---------- testar conexão ----------
  $("btnStatus").addEventListener("click", async () => {
    const st = $("statusConexao");
    const base = $("base").value.trim();
    if (!base) { status(st, "Informe o endereço da K60.", "erro"); return; }
    guardarCred();
    status(st, "Testando…");
    try {
      const s = await k60Cliente(base).status();
      const fw = s && s.versaoFW ? ` (FW ${s.versaoFW})` : "";
      const t = s && s.temperaturaMosto != null ? ` · mosto ${s.temperaturaMosto} °C` : "";
      status(st, "Conectado" + fw + t + ".", "ok");
    } catch (e) {
      status(st, "Não conectou: " + (e.message || "erro") + ". Confira IP e se está na mesma rede.", "erro");
    }
  });

  // ---------- enviar ----------
  $("btnEnviar").addEventListener("click", async () => {
    const st = $("statusEnvio");
    if (!receitaAtual) return;
    const { receita } = mapear(receitaAtual, opcoes());
    const base = $("base").value.trim();
    if (!base) { status(st, "Informe o endereço da K60.", "erro"); return; }
    if (!window.confirm(`Criar a receita "${receita.nome}" (${receita.etapas.length} etapas) na K60 em ${base}?`)) return;
    $("btnEnviar").disabled = true;
    status(st, "Enviando…");
    try {
      const resp = await k60Cliente(base).criarReceita(receita);
      const msg = resp && resp.message ? " " + resp.message : "";
      status(st, "Receita criada." + msg, "ok");
    } catch (e) {
      const corpo = e.corpo && e.corpo.message ? " — " + e.corpo.message : "";
      status(st, "Falhou: " + (e.message || "erro") + corpo, "erro");
    } finally {
      $("btnEnviar").disabled = false;
    }
  });
})();
