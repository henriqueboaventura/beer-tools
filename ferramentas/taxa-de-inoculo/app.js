(function () {
  "use strict";

  var C = window.BFInoculo;
  var $ = function (id) { return document.getElementById(id); };
  var MODELOS = { braukaiser: "Placa agitadora", white: "Sem agitação" };

  var state = {
    unidade: "sg",
    fonte: "liquida",
    sugModelo: "braukaiser",
    passos: [{ litros: "1", sg: "1.036", modelo: "braukaiser" }]
  };
  var ultimo = null; // último cálculo (usado pela sugestão)

  function num(n, casas) { return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }); }
  function bi(n) { return num(n, 0) + " bi"; }
  function val(id) { return parseFloat($(id).value); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function marcar(sel, attr, valor) {
    document.querySelectorAll(sel).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute(attr) === valor)); });
  }
  function status(ok, html) { return '<p class="ti-status' + (ok ? " ti-status--ok" : "") + '">' + html + "</p>"; }

  /* ---------- 01 Sua cerveja ---------- */
  function plato() {
    var og = val("og");
    if (state.unidade === "plato") return og > 0 ? og : NaN;
    return og > 1 ? C.sgParaPlato(og) : NaN;
  }

  function trocarUnidade(nova) {
    if (nova === state.unidade) return;
    var og = $("og"), atual = parseFloat(og.value);
    if (!isNaN(atual)) og.value = nova === "plato" ? C.sgParaPlato(atual).toFixed(1) : C.platoParaSg(atual).toFixed(3);
    state.unidade = nova;
    og.step = nova === "sg" ? "0.001" : "0.1";
    og.min = nova === "sg" ? "1.000" : "0";
    marcar("[data-unidade]", "data-unidade", nova);
    calcular();
  }

  /* ---------- 02 Sua levedura ---------- */
  function fonte() {
    switch (state.fonte) {
      case "liquida": return { tipo: "liquida", pacotes: val("pacotes"), viabilidade: val("viabilidade") };
      case "seca": return { tipo: "seca", gramas: val("gramas"), celulasGrama: val("celulasGrama") };
      case "reaproveitada": return { tipo: "reaproveitada", ml: val("ml"), solidos: val("solidos"), viabilidade: val("viabSlurry") };
      default: return { tipo: "contagem", celulas: val("celulas") };
    }
  }

  function trocarFonte(nova) {
    state.fonte = nova;
    marcar("[data-fonte]", "data-fonte", nova);
    document.querySelectorAll("[data-painel]").forEach(function (p) { p.hidden = p.dataset.painel !== nova; });
    calcular();
  }

  // a data de fabricação preenche a viabilidade (que continua editável)
  function aplicarData() {
    var dias = C.diasEntre($("fabricacao").value, new Date());
    if (dias === null) {
      $("idade").textContent = "Sem data, conta como fresca (100%). Com a data, a viabilidade cai 0,7% por dia.";
      return;
    }
    var v = C.viabilidadeLiquida(dias);
    $("viabilidade").value = Math.round(v);
    $("idade").textContent = "Fabricada há " + dias + (dias === 1 ? " dia" : " dias") + ": viabilidade estimada de " + num(v, 0) + "%." +
      (v < 50 ? " Com viabilidade tão baixa, faça um starter pequeno primeiro para acordar o fermento." : "");
  }

  function textoTem(f, tem, necessario) {
    var falta = necessario - tem;
    var pct = tem / necessario * 100;
    var html = '<p class="ti-tem">Você tem <b>' + bi(tem) + "</b> <small>(" + num(pct, 0) + "% do necessário)</small></p>";
    if (falta <= 0) {
      html += status(true, "Dá para inocular direto, sem starter.");
      return html;
    }
    html += status(false, "<b>Faltam " + bi(falta) + ".</b>");
    var s = C.semStarter(f, necessario);
    if (!s) return html;
    if (f.tipo === "liquida") html += '<p class="ti-nota">Sem starter, seriam ' + s.pacotes + " pacotes com essa viabilidade.</p>";
    if (f.tipo === "seca") html += '<p class="ti-nota">Use <b>' + num(s.gramas, 1) + " g</b> (" + s.saches + (s.saches === 1 ? " sachê" : " sachês") + " de 11 g).</p>";
    if (f.tipo === "reaproveitada") html += '<p class="ti-nota">Sem starter, seriam <b>' + num(s.ml, 0) + " mL</b> desse fermento.</p>";
    return html;
  }

  /* ---------- 03 Starter ---------- */
  function renderPassos() {
    $("passos").innerHTML = state.passos.map(function (p, i) {
      var opcoes = Object.keys(MODELOS).map(function (m) {
        return '<option value="' + m + '"' + (p.modelo === m ? " selected" : "") + ">" + MODELOS[m] + "</option>";
      }).join("");
      return '<article class="ti-passo" data-i="' + i + '">' +
        '<div class="ti-passo__topo"><p class="ti-passo__titulo">Passo ' + (i + 1) + "</p>" +
          '<button type="button" class="ti-remover" data-remover aria-label="Remover passo ' + (i + 1) + '">Remover</button></div>' +
        '<div class="ti-linha">' +
          '<div class="ti-campo"><label for="litros' + i + '">Volume <span>L</span></label>' +
            '<input type="number" id="litros' + i + '" data-campo="litros" inputmode="decimal" min="0" step="0.1" value="' + esc(p.litros) + '"></div>' +
          '<div class="ti-campo"><label for="sg' + i + '">Densidade <span>SG</span></label>' +
            '<input type="number" id="sg' + i + '" data-campo="sg" inputmode="decimal" min="1.001" step="0.001" value="' + esc(p.sg) + '"></div>' +
        "</div>" +
        '<div class="ti-campo"><label for="modelo' + i + '">Agitação</label>' +
          '<select id="modelo' + i + '" data-campo="modelo">' + opcoes + "</select></div>" +
        '<div class="ti-passo__saida"></div>' +
      "</article>";
    }).join("");
  }

  function textoPasso(r) {
    if (!r.valido) return '<p class="ti-nota">Informe volume e densidade.</p>';
    var html = '<dl class="ti-passo__dados">' +
      "<div><dt>Começa com</dt><dd>" + bi(r.inicio) + "</dd></div>" +
      "<div><dt>Termina com</dt><dd>" + bi(r.fim) + "</dd></div>" +
      "<div><dt>DME</dt><dd>" + num(r.dme, 0) + " g</dd></div>" +
      "</dl>" +
      '<p class="ti-nota">Inoculação de ' + num(r.inoculacao, 0) + " milhões/mL" +
        (r.inicio > 0 ? " · a levedura cresce " + num(r.fator, 1) + "×" : "") + ".</p>";
    if (r.avisos.indexOf("sem-crescimento") > -1) html += status(false, "Starter pequeno demais para tanta levedura: não cresce. Aumente o volume.");
    if (r.avisos.indexOf("inoculacao") > -1) {
      html += status(false, r.inoculacao < C.INOCULACAO_IDEAL[0]
        ? "Pouca levedura para esse volume: a curva sem agitação é otimista abaixo de 25 milhões/mL. Faça um passo menor antes."
        : "Muita levedura para esse volume: acima de 100 milhões/mL cresce pouco. Aumente o volume.");
    }
    if (r.avisos.indexOf("densidade") > -1) html += status(false, "Use starter entre 1.030 e 1.040: mais denso estressa a levedura, mais fraco rende menos.");
    return html;
  }

  function lerPassos() {
    return state.passos.map(function (p) { return { litros: parseFloat(p.litros), sg: parseFloat(p.sg), modelo: p.modelo }; });
  }

  /* ---------- ciclo ---------- */
  function calcular() {
    var litros = val("volume"), P = plato(), taxa = val("taxa");
    var necessario = C.celulasNecessarias(litros, P, taxa);
    marcar("[data-taxa]", "data-taxa", String(taxa));

    var f = fonte();
    var tem = C.celulasDisponiveis(f);
    ultimo = { necessario: necessario, tem: tem, litros: litros, plato: P, taxa: taxa };

    var seca = state.fonte === "seca";
    $("semStarterSeca").hidden = !seca;
    $("starter").hidden = seca;

    if (!(necessario > 0)) {
      $("necessario").textContent = "—";
      $("necessarioSub").textContent = "Preencha volume, OG e taxa.";
      $("tem").innerHTML = "";
      $("final").innerHTML = "";
      document.querySelectorAll(".ti-passo__saida").forEach(function (s) { s.innerHTML = ""; });
      return;
    }
    $("necessario").textContent = num(necessario, 0);
    $("necessarioSub").textContent = num(taxa, 2) + " milhões/mL/°P × " + num(litros, 1) + " L × " + num(P, 1) + " °P";
    $("tem").innerHTML = tem > 0 ? textoTem(f, tem, necessario) : '<p class="ti-nota">Informe quanto fermento você tem.</p>';

    if (seca) return;
    var resultados = C.propagar(tem, lerPassos());
    document.querySelectorAll(".ti-passo").forEach(function (el, i) {
      el.querySelector(".ti-passo__saida").innerHTML = textoPasso(resultados[i]);
    });

    var final = resultados.length ? resultados[resultados.length - 1].fim : tem;
    if (!resultados.length || !(tem > 0)) { $("final").innerHTML = ""; return; }
    var taxaFinal = C.taxaObtida(final, litros, P);
    $("final").innerHTML = '<div class="ti-final">' +
      '<p class="ti-final__rotulo">Depois de ' + resultados.length + (resultados.length === 1 ? " passo" : " passos") + ", inocule</p>" +
      '<p class="ti-final__valor">' + num(final, 0) + " <small>bilhões</small></p>" +
      '<p class="ti-final__sub">Taxa de ' + num(taxaFinal, 2) + " milhões/mL/°P · " + num(final / necessario * 100, 0) + "% do alvo</p>" +
      "</div>" +
      (final >= necessario
        ? status(true, "Chega no alvo.")
        : status(false, "<b>Faltam " + bi(necessario - final) + ".</b> Aumente um passo, acrescente outro ou use mais fermento."));
  }

  /* ---------- eventos ---------- */
  document.querySelectorAll("[data-unidade]").forEach(function (b) {
    b.addEventListener("click", function () { trocarUnidade(b.dataset.unidade); });
  });
  document.querySelectorAll("[data-taxa]").forEach(function (b) {
    b.addEventListener("click", function () { $("taxa").value = b.dataset.taxa; calcular(); });
  });
  document.querySelectorAll("[data-fonte]").forEach(function (b) {
    b.addEventListener("click", function () { trocarFonte(b.dataset.fonte); });
  });
  document.querySelectorAll("[data-sug-modelo]").forEach(function (b) {
    b.addEventListener("click", function () { state.sugModelo = b.dataset.sugModelo; marcar("[data-sug-modelo]", "data-sug-modelo", state.sugModelo); });
  });
  ["volume", "og", "taxa", "pacotes", "viabilidade", "gramas", "celulasGrama", "ml", "solidos", "viabSlurry", "celulas"].forEach(function (id) {
    $(id).addEventListener("input", calcular);
  });
  $("fabricacao").addEventListener("input", function () { aplicarData(); calcular(); });

  // passos: atualiza só as saídas ao digitar (não recria os campos, para não perder o foco)
  $("passos").addEventListener("input", function (e) {
    var bloco = e.target.closest("[data-i]");
    if (!bloco || !e.target.dataset.campo) return;
    state.passos[+bloco.dataset.i][e.target.dataset.campo] = e.target.value;
    calcular();
  });
  $("passos").addEventListener("change", function (e) {
    if (e.target.dataset.campo !== "modelo") return;
    state.passos[+e.target.closest("[data-i]").dataset.i].modelo = e.target.value;
    calcular();
  });
  $("passos").addEventListener("click", function (e) {
    if (!e.target.closest("[data-remover]")) return;
    state.passos.splice(+e.target.closest("[data-i]").dataset.i, 1);
    renderPassos();
    calcular();
  });
  $("adicionar").addEventListener("click", function () {
    var ant = state.passos[state.passos.length - 1];
    state.passos.push(ant ? { litros: ant.litros, sg: ant.sg, modelo: ant.modelo } : { litros: "1", sg: "1.036", modelo: "braukaiser" });
    renderPassos();
    calcular();
    var novo = $("litros" + (state.passos.length - 1));
    if (novo) novo.focus();
  });

  $("sugerir").addEventListener("click", function () {
    var msg = $("sugMsg");
    if (!ultimo || !(ultimo.necessario > 0)) { msg.textContent = "Preencha a cerveja primeiro."; return; }
    var sg = val("sugSg");
    var s = C.sugerirPassos(ultimo.tem, ultimo.necessario, val("frasco"), state.sugModelo, sg);
    if (s.motivo === "incompleta") { msg.textContent = "Informe o fermento, o tamanho do starter e a densidade."; return; }
    if (s.motivo === "suficiente") { msg.textContent = "Você já tem levedura suficiente: não precisa de starter."; return; }
    state.passos = s.passos.map(function (p) { return { litros: p.litros.toFixed(1), sg: sg.toFixed(3), modelo: p.modelo }; });
    renderPassos();
    calcular();
    msg.textContent = s.motivo === "ok"
      ? (s.passos.length === 1 ? "Um starter basta." : s.passos.length + " passos, um depois do outro.")
      : "Com starters de até " + num(val("frasco"), 1) + " L não chega: um frasco maior ou mais fermento resolve. Estes são os passos que ainda valem a pena.";
  });

  BF.rodape("Ferramenta de Henrique Boaventura");
  renderPassos();
  calcular();
})();
