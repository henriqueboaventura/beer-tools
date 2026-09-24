(function () {
  "use strict";

  var P = window.BFPartiGyle;
  var esc = BF.esc;
  var $ = function (id) { return document.getElementById(id); };
  var MAX_ALVOS = 4;
  var ORDEM = ["primeiros mostos", "segundos mostos", "terceiros mostos"];

  var state = {
    esquema: "terco-dois-tercos",
    definirPor: "media",
    // exemplo da Craft Beer & Brewing, em litros (≈ 2, 4 e 4 galões)
    alvos: [{ volume: 7.5, og: "1.070" }, { volume: 15, og: "1.050" }, { volume: 15, og: "1.040" }]
  };

  function num(n, casas) {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }
  function og(s) { return s.toFixed(3); }
  function plato(s) { return num(P.sgParaPlato(s), 1) + " °P"; }
  function val(id) { return parseFloat($(id).value); }

  /* ---------- 01 Planejar ---------- */
  function renderEsquemas() {
    $("esquemas").innerHTML = Object.keys(P.ESQUEMAS).map(function (id) {
      return '<button type="button" class="bf-chip" data-esquema="' + id + '" aria-pressed="' + (id === state.esquema) + '">' +
        esc(P.ESQUEMAS[id].nome) + "</button>";
    }).join("");
    $("esquemaDescricao").textContent = P.ESQUEMAS[state.esquema].descricao;
  }

  function planejar() {
    var r = P.planejar({ esquema: state.esquema, volume: val("volumeTotal"), og: val("ogPlano"), definirPor: state.definirPor });
    var valido = val("ogPlano") > 1 && val("volumeTotal") > 0;
    $("planoCervejas").innerHTML = !valido
      ? '<p class="pg-aviso">Informe o volume total e uma OG maior que 1.000.</p>'
      : r.cervejas.map(function (c, i) {
        return '<article class="pg-cerveja">' +
          '<p class="pg-cerveja__nome">Cerveja ' + (i + 1) + " <small>" + ORDEM[i] + "</small></p>" +
          '<p class="pg-cerveja__og">' + og(c.og) + "</p>" +
          '<dl class="pg-cerveja__dados">' +
            "<div><dt>Volume</dt><dd>" + num(c.volume, 1) + " L</dd></div>" +
            "<div><dt>Plato</dt><dd>" + plato(c.og) + "</dd></div>" +
            "<div><dt>Pontos</dt><dd>" + num(c.fracPontos * 100, 0) + "%</dd></div>" +
          "</dl></article>";
      }).join("") +
      '<p class="pg-media">OG média do lote: <b>' + og(r.ogMedia) + "</b> (" + plato(r.ogMedia) + ") · " +
        num(r.pontosTotais, 0) + " pontos·litro</p>";

    var kg = valido ? P.malteNecessario(r.pontosTotais, val("eficiencia"), val("ppg")) : 0;
    $("malteKg").textContent = num(kg, 1);
    $("malteTotal").textContent = valido ? num(val("volumeTotal"), 1) + " L a " + og(r.ogMedia) : "o lote";
  }

  $("esquemas").addEventListener("click", function (e) {
    var b = e.target.closest("[data-esquema]");
    if (!b) return;
    state.esquema = b.dataset.esquema;
    renderEsquemas();
    planejar();
  });
  document.querySelectorAll("[data-definir]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (state.definirPor === b.dataset.definir) return;
      // mantém o lote igual: converte o valor digitado entre média e 1ª cerveja
      var m = P.ESQUEMAS[state.esquema].multiplicador[0];
      var pts = P.pontos(val("ogPlano"));
      if (!isNaN(pts)) $("ogPlano").value = og(P.sg(b.dataset.definir === "primeira" ? pts * m : pts / m));
      state.definirPor = b.dataset.definir;
      document.querySelectorAll("[data-definir]").forEach(function (x) {
        x.setAttribute("aria-pressed", String(x.dataset.definir === state.definirPor));
      });
      $("ogPlanoRotulo").innerHTML = (state.definirPor === "primeira" ? "OG da 1ª cerveja" : "OG média") + " <span>SG</span>";
      planejar();
    });
  });
  ["volumeTotal", "ogPlano", "eficiencia", "ppg"].forEach(function (id) { $(id).addEventListener("input", planejar); });

  /* ---------- 02 No dia ---------- */
  function renderAlvos() {
    $("alvos").innerHTML = state.alvos.map(function (a, i) {
      return '<div class="pg-alvo" data-i="' + i + '">' +
        '<p class="pg-alvo__nome">Cerveja ' + (i + 1) + "</p>" +
        '<div class="pg-campo"><label for="alvoVol' + i + '">Volume <span>L</span></label>' +
          '<input type="number" id="alvoVol' + i + '" data-campo="volume" inputmode="decimal" min="0" step="0.5" value="' + esc(a.volume) + '"></div>' +
        '<div class="pg-campo"><label for="alvoOg' + i + '">OG <span>SG</span></label>' +
          '<input type="number" id="alvoOg' + i + '" data-campo="og" inputmode="decimal" min="1.000" step="0.001" value="' + esc(a.og) + '"></div>' +
        (state.alvos.length > 1
          ? '<button type="button" class="pg-remover" data-remover="' + i + '" aria-label="Remover cerveja ' + (i + 1) + '">✕</button>'
          : "") +
      "</div>";
    }).join("");
    $("adicionar").hidden = state.alvos.length >= MAX_ALVOS;
  }

  var PROBLEMA = {
    "acima-do-forte": "Mais densa que o mosto forte: não dá só misturando. Ferva mais essa parte, use menos volume ou acrescente extrato.",
    "mostos-iguais": "Os dois mostos têm a mesma densidade — não há o que misturar.",
    incompleta: "Informe volume e OG."
  };

  function misturar() {
    var r = P.misturar({
      forte: { volume: val("forteVol"), og: val("forteOg") },
      fraco: { volume: val("fracoVol"), og: val("fracoOg") },
      cervejas: state.alvos.map(function (a) { return { volume: parseFloat(a.volume), og: parseFloat(a.og) }; })
    });
    var html = r.cervejas.map(function (c, i) {
      var cab = '<p class="pg-receita__nome">Cerveja ' + (i + 1) +
        (c.volume > 0 && c.og > 1 ? " <small>" + num(c.volume, 1) + " L a " + og(c.og) + " · " + plato(c.og) + "</small>" : "") + "</p>";
      if (c.problema) return '<article class="pg-receita pg-receita--erro">' + cab + '<p class="pg-receita__erro">' + PROBLEMA[c.problema] + "</p></article>";
      var partes = [["Forte", c.forte], ["Fraco", c.fraco], ["Água", c.agua]].filter(function (p) { return p[1] > 0.005; });
      return '<article class="pg-receita">' + cab + '<dl class="pg-receita__partes">' +
        partes.map(function (p) { return "<div><dt>" + p[0] + "</dt><dd>" + num(p[1], 2) + " L</dd></div>"; }).join("") +
        "</dl></article>";
    }).join("");

    function linha(nome, usado, total, sobra) {
      var falta = sobra < -0.005;
      return '<p class="pg-total' + (falta ? " pg-total--falta" : "") + '"><b>' + nome + ":</b> usa " + num(usado, 2) + " de " + num(total || 0, 1) + " L · " +
        (falta ? "faltam " + num(-sobra, 2) + " L" : "sobram " + num(sobra, 2) + " L") + "</p>";
    }
    html += '<div class="pg-totais">' +
      linha("Mosto forte", r.usadoForte, val("forteVol"), r.sobraForte) +
      linha("Mosto fraco", r.usadoFraco, val("fracoVol"), r.sobraFraco) +
      (r.suficiente ? "" : '<p class="pg-aviso">Não há mosto suficiente para tudo. Reduza o volume de alguma cerveja ou baixe a densidade da mais forte.</p>') +
      "</div>";
    $("mistura").innerHTML = html;
  }

  $("alvos").addEventListener("input", function (e) {
    var linha = e.target.closest("[data-i]");
    if (!linha || !e.target.dataset.campo) return;
    state.alvos[+linha.dataset.i][e.target.dataset.campo] = e.target.value;
    misturar();
  });
  $("alvos").addEventListener("click", function (e) {
    var b = e.target.closest("[data-remover]");
    if (!b) return;
    state.alvos.splice(+b.dataset.remover, 1);
    renderAlvos();
    misturar();
  });
  $("adicionar").addEventListener("click", function () {
    if (state.alvos.length >= MAX_ALVOS) return;
    state.alvos.push({ volume: 10, og: "1.045" });
    renderAlvos();
    misturar();
    $("alvoVol" + (state.alvos.length - 1)).focus();
  });
  ["forteVol", "forteOg", "fracoVol", "fracoOg"].forEach(function (id) { $(id).addEventListener("input", misturar); });

  /* ---------- 03 Ajuste ---------- */
  function ajustar() {
    var v = val("ajVol"), m = val("ajOg"), a = val("ajAlvo");
    if (!(v > 0) || !(m > 1) || !(a > 1)) { $("ajuste").textContent = "Informe o volume coletado e as duas densidades."; return; }
    var r = P.ajustar(v, m, a);
    $("ajuste").innerHTML = r.maisFraco
      ? "O mosto saiu <b>mais fraco</b> que o alvo: no alvo ele renderia só <b>" + num(r.volumeNoAlvo, 2) + " L</b>. Para manter o volume, ferva por mais tempo ou acrescente extrato."
      : "Diluindo até " + og(a) + ", rende <b>" + num(r.volumeNoAlvo, 2) + " L</b>: acrescente <b>" + num(r.aguaParaDiluir, 2) + " L</b> de água (ou de mosto fraco, refazendo a conta da mistura). " +
        "Multiplique o lúpulo dessa cerveja por <b>" + num(r.fatorLupulo, 2) + "</b>.";
  }
  ["ajVol", "ajOg", "ajAlvo"].forEach(function (id) { $(id).addEventListener("input", ajustar); });

  BF.rodape("Ferramenta de Henrique Boaventura");
  renderEsquemas();
  planejar();
  renderAlvos();
  misturar();
  ajustar();
})();
