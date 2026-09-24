(function () {
  "use strict";

  var P = window.BFPartiGyle;
  var esc = BF.esc;
  var $ = function (id) { return document.getElementById(id); };

  // exemplos das fontes (BYO): Wee Heavy + Scottish Export; três terços
  var PADRAO = {
    2: [{ nome: "Wee Heavy", volume: "19", og: "1.096" }, { nome: "Scottish Export", volume: "38", og: "1.048" }],
    3: [{ nome: "Forte", volume: "19", og: "1.096" }, { nome: "Média", volume: "19", og: "1.064" }, { nome: "Leve", volume: "19", og: "1.032" }]
  };

  var state = {
    cervejas: copia(PADRAO[2]),
    medidas: [],       // no dia, na ordem digitada
    editadas: {}       // medidas que o usuário alterou (não sobrescrever com a previsão)
  };
  var plano = null;

  function copia(lista) { return lista.map(function (c) { return { nome: c.nome, volume: c.volume, og: c.og }; }); }
  function num(n, casas) { return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }); }
  function og(s) { return s.toFixed(3); }
  function plato(s) { return num(P.sgParaPlato(s), 1) + " °P"; }
  function val(id) { return parseFloat($(id).value); }
  function nome(c, i) { return c.nome && c.nome.trim() ? c.nome.trim() : "Cerveja " + (i + 1); }

  /* ---------- 01 Suas cervejas ---------- */
  function renderCervejas() {
    $("cervejas").innerHTML = state.cervejas.map(function (c, i) {
      return '<div class="pg-cerveja-entrada" data-i="' + i + '">' +
        '<div class="pg-campo pg-campo--nome"><label for="nome' + i + '">Nome <span>opcional</span></label>' +
          '<input type="text" id="nome' + i + '" data-campo="nome" value="' + esc(c.nome) + '" placeholder="Cerveja ' + (i + 1) + '" maxlength="40"></div>' +
        '<div class="pg-campo"><label for="vol' + i + '">Volume final <span>L</span></label>' +
          '<input type="number" id="vol' + i + '" data-campo="volume" inputmode="decimal" min="0" step="0.5" value="' + esc(c.volume) + '"></div>' +
        '<div class="pg-campo"><label for="og' + i + '">OG final <span>SG</span></label>' +
          '<input type="number" id="og' + i + '" data-campo="og" inputmode="decimal" min="1.000" step="0.001" value="' + esc(c.og) + '"></div>' +
      "</div>";
    }).join("");
  }

  $("cervejas").addEventListener("input", function (e) {
    var linha = e.target.closest("[data-i]");
    if (!linha || !e.target.dataset.campo) return;
    state.cervejas[+linha.dataset.i][e.target.dataset.campo] = e.target.value;
    calcular();
  });
  document.querySelectorAll("[data-quantas]").forEach(function (b) {
    b.addEventListener("click", function () {
      var n = +b.dataset.quantas;
      if (n === state.cervejas.length) return;
      state.cervejas = copia(PADRAO[n]);
      state.medidas = [];
      state.editadas = {};
      document.querySelectorAll("[data-quantas]").forEach(function (x) { x.setAttribute("aria-pressed", String(+x.dataset.quantas === n)); });
      renderCervejas();
      calcular();
    });
  });
  ["eficiencia", "evaporacao", "ppg"].forEach(function (id) { $(id).addEventListener("input", calcular); });

  /* ---------- 02 O plano ---------- */
  function textoAcao(a, alvo, volume) {
    if (a.tipo === "ok") return '<p class="pg-status pg-status--ok">Chega no alvo de ' + og(alvo) + ".</p>";
    if (a.tipo === "agua") {
      return '<p class="pg-status"><b>Para chegar a ' + og(alvo) + ":</b> acrescente " + num(a.agua, 1) +
        " L de água — fica com " + num(a.volumeFinal, 1) + " L em vez de " + num(volume, 1) + " L.</p>";
    }
    return '<p class="pg-status"><b>Para chegar a ' + og(alvo) + ":</b> ferva mais, até " + num(a.volumeFinal, 1) +
      " L (" + num(a.evaporar, 1) + " L a menos que o planejado).</p>";
  }

  function renderPlano() {
    if (!plano.valido) {
      $("plano").innerHTML = '<p class="pg-aviso">Preencha volume e OG (maior que 1.000) de todas as cervejas.</p>';
      return;
    }
    var total = plano.totalColeta;
    var barra = plano.ordemColeta.map(function (c) {
      return '<span class="pg-barra__parte" style="flex-grow:' + c.volumeColeta.toFixed(3) + '" data-ordem="' + c.ordem + '">' +
        '<b>' + c.ordem + "º</b> " + esc(nome(c, c.indice)) + "</span>";
    }).join("");

    var cards = plano.ordemColeta.map(function (c) {
      return '<article class="pg-cerveja" data-ordem="' + c.ordem + '">' +
        '<p class="pg-cerveja__ordem">' + c.ordem + "º a coletar</p>" +
        '<p class="pg-cerveja__nome">' + esc(nome(c, c.indice)) + "</p>" +
        '<p class="pg-cerveja__coleta">' + (c.ordem === 1 ? "Colete os primeiros " : "Colete os próximos ") +
          "<b>" + num(c.volumeColeta, 1) + " L</b> <small>(≈ " + og(c.ogColeta) + " na panela)</small></p>" +
        '<dl class="pg-cerveja__dados">' +
          "<div><dt>Depois da fervura</dt><dd>" + num(c.volume, 1) + " L</dd></div>" +
          "<div><dt>OG prevista</dt><dd>" + og(c.ogPrevista) + "</dd></div>" +
          "<div><dt>Plato</dt><dd>" + plato(c.ogPrevista) + "</dd></div>" +
        "</dl>" +
        textoAcao(c.acao, c.og, c.volume) +
      "</article>";
    }).join("");

    $("plano").innerHTML =
      '<div class="pg-malte"><p class="pg-malte__valor">' + num(plano.malteKg, 1) + " <small>kg de malte</small></p>" +
        '<p class="pg-nota">Malte base para ' + num(plano.pontosTotais, 0) + " pontos·litro (soma de volume × pontos de cada cerveja). " +
        "Com maltes especiais, conte os pontos deles no total.</p></div>" +
      '<p class="pg-subtitulo">Ordem da coleta · ' + num(total, 1) + " L de mosto</p>" +
      '<div class="pg-barra" aria-hidden="true">' + barra + "</div>" +
      '<p class="pg-nota">Os mostos saem de ≈ ' + og(plano.ogPrimeiroMosto) + " (primeiro litro) até ≈ " + og(plano.ogUltimoMosto) + " (último).</p>" +
      '<div class="pg-cervejas">' + cards + "</div>" +
      sugestao();
  }

  function sugestao() {
    var s = plano.sugestao;
    if (!s) return "";
    var f = plano.ordemColeta[0], w = plano.ordemColeta[1];
    var nf = esc(nome(f, f.indice)), nw = esc(nome(w, w.indice));
    var tudoOk = plano.cervejas.every(function (c) { return c.acao.tipo === "ok"; });
    if (s.tipo === "dividir") {
      if (tudoOk) return "";
      return '<div class="pg-dica"><p class="pg-dica__titulo">Quer acertar as duas sem água nem fervura extra?</p>' +
        "<p>Mude a divisão, mantendo o total: <b>" + nf + " com " + num(s.volumeForte, 1) + " L</b> e <b>" + nw + " com " +
        num(s.volumeFraca, 1) + " L</b>. Só coletando, é a única divisão que dá " + og(f.og) + " e " + og(w.og) + ".</p>" +
        '<button type="button" class="bf-btn" id="usarDivisao">Usar essa divisão</button></div>';
    }
    if (s.tipo === "misturar") {
      var m = s.mistura.cervejas;
      return '<div class="pg-dica"><p class="pg-dica__titulo">Suas cervejas são parecidas demais para sair só da coleta</p>' +
        "<p>Só coletando, a primeira sai pelo menos 1,75× mais densa que a segunda (em pontos). Para acertar as duas sem água nem fervura extra, " +
        "colete <b>" + num(f.volumeColeta, 1) + " L</b> na panela A e <b>" + num(w.volumeColeta, 1) + " L</b> na panela B e, antes de ferver, monte:</p>" +
        "<ul><li><b>" + nf + ":</b> " + num(m[0].forte, 1) + " L da panela A + " + num(m[0].fraco, 1) + " L da B</li>" +
        "<li><b>" + nw + ":</b> " + num(m[1].forte, 1) + " L da panela A + " + num(m[1].fraco, 1) + " L da B</li></ul>" +
        '<p class="pg-nota">É o método de misturar os mostos (Craft Beer &amp; Brewing). Precisa de uma panela ou balde a mais para trocar o mosto.</p></div>';
    }
    return '<div class="pg-dica"><p class="pg-dica__titulo">Diferença grande demais para sair só da coleta</p>' +
      "<p>Só coletando, a primeira sai no máximo 4× mais densa que a segunda (em pontos). Use os ajustes acima (água ou fervura) em cada cerveja.</p></div>";
  }

  $("plano").addEventListener("click", function (e) {
    if (e.target.id !== "usarDivisao" || !plano.sugestao) return;
    var f = plano.ordemColeta[0], w = plano.ordemColeta[1];
    state.cervejas[f.indice].volume = plano.sugestao.volumeForte.toFixed(1);
    state.cervejas[w.indice].volume = plano.sugestao.volumeFraca.toFixed(1);
    renderCervejas();
    calcular();
  });

  /* ---------- 03 No dia ---------- */
  function preencherMedidas() {
    if (!plano.valido) return;
    plano.cervejas.forEach(function (c, i) {
      state.medidas[i] = state.medidas[i] || {};
      if (!state.editadas[i + "v"]) state.medidas[i].volume = c.volumeColeta.toFixed(1);
      if (!state.editadas[i + "o"]) state.medidas[i].og = c.ogColeta.toFixed(3);
    });
  }

  function renderDia() {
    if (!plano.valido) { $("dia").innerHTML = ""; return; }
    var resultados = P.noDia({
      cervejas: plano.cervejas.map(function (c) { return { volume: c.volume, og: c.og }; }),
      medidas: state.medidas.map(function (m) { return { volume: parseFloat(m.volume), og: parseFloat(m.og) }; }),
      evaporacao: val("evaporacao")
    });
    $("dia").innerHTML = plano.ordemColeta.map(function (c) {
      var i = c.indice, m = state.medidas[i] || {}, r = resultados[i];
      var saida;
      if (r.problema) saida = '<p class="pg-nota">Informe volume e OG medidos.</p>';
      else {
        saida = '<p class="pg-dia__previsao">Depois da fervura: <b>' + num(r.volumeDepois, 1) + " L a " + og(r.ogDepois) + "</b> (" + plato(r.ogDepois) + ")</p>" +
          textoAcao(r.acao, c.og, r.volumeDepois) +
          (Math.abs(r.fatorLupulo - 1) >= 0.02
            ? '<p class="pg-status"><b>Lúpulo:</b> multiplique as quantidades da receita por ' + num(r.fatorLupulo, 2) + " (o volume final mudou).</p>"
            : "");
      }
      return '<article class="pg-dia" data-i="' + i + '">' +
        '<p class="pg-dia__nome"><b>' + c.ordem + "º</b> " + esc(nome(c, i)) + " <small>alvo " + num(c.volume, 1) + " L a " + og(c.og) + "</small></p>" +
        '<div class="pg-linha">' +
          '<div class="pg-campo"><label for="medVol' + i + '">Volume na panela <span>L</span></label>' +
            '<input type="number" id="medVol' + i + '" data-medida="volume" inputmode="decimal" min="0" step="0.1" value="' + esc(m.volume || "") + '"></div>' +
          '<div class="pg-campo"><label for="medOg' + i + '">OG medida <span>SG</span></label>' +
            '<input type="number" id="medOg' + i + '" data-medida="og" inputmode="decimal" min="1.000" step="0.001" value="' + esc(m.og || "") + '"></div>' +
        "</div>" +
        '<div class="pg-dia__saida">' + saida + "</div>" +
      "</article>";
    }).join("") +
    '<button type="button" class="bf-btn" id="voltarPrevisao">Voltar para a previsão</button>';
  }

  // atualiza só a saída ao digitar (não recria os campos, para não perder o foco)
  $("dia").addEventListener("input", function (e) {
    var bloco = e.target.closest("[data-i]");
    if (!bloco || !e.target.dataset.medida) return;
    var i = +bloco.dataset.i, campo = e.target.dataset.medida;
    state.medidas[i] = state.medidas[i] || {};
    state.medidas[i][campo] = e.target.value;
    state.editadas[i + (campo === "volume" ? "v" : "o")] = true;
    var foco = e.target.id, pos = e.target.selectionStart;
    renderDia();
    var el = $(foco);
    if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (err) { /* number não aceita seleção */ } }
  });
  $("dia").addEventListener("click", function (e) {
    if (e.target.id !== "voltarPrevisao") return;
    state.editadas = {};
    preencherMedidas();
    renderDia();
  });

  /* ---------- ciclo ---------- */
  function calcular() {
    plano = P.planejar({
      cervejas: state.cervejas.map(function (c) { return { nome: c.nome, volume: parseFloat(c.volume), og: parseFloat(c.og) }; }),
      evaporacao: val("evaporacao"),
      eficiencia: val("eficiencia"),
      ppg: val("ppg")
    });
    renderPlano();
    preencherMedidas();
    renderDia();
  }

  BF.rodape("Ferramenta de Henrique Boaventura");
  renderCervejas();
  calcular();
})();
