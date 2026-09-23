(function () {
  "use strict";

  var S = window.BFSpeise;
  var $ = function (id) { return document.getElementById(id); };
  var unidade = "sg";

  // números no formato brasileiro: 1,32
  function fmt(n, casas) {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }

  function ler() {
    return {
      volume: parseFloat($("volume").value),
      og: parseFloat($("og").value),
      unidade: unidade,
      atenuacao: parseFloat($("atenuacao").value),
      alvoCO2: parseFloat($("alvo").value),
      temperatura: parseFloat($("temperatura").value)
    };
  }

  function calcular() {
    var p = ler();
    var r = S.calcular(p);
    $("atenuacaoValor").textContent = (p.atenuacao || 0) + "%";

    var aviso = $("aviso");
    if (r.aviso === "og-invalida") {
      aviso.textContent = unidade === "sg"
        ? "A densidade original precisa ser maior que 1.000."
        : "A densidade original precisa ser maior que 0 °P.";
    } else if (r.aviso === "sem-speise") {
      aviso.textContent = "O CO₂ residual estimado (" + fmt(r.co2Residual, 2) +
        " vol) já atinge o alvo nessa temperatura. Speise não é necessária.";
    }
    aviso.hidden = !r.aviso;

    $("speise").textContent = fmt(r.speise, 2);
    $("speise2").textContent = fmt(r.speise, 2) + " L";
    $("principal").textContent = fmt(r.principal, 2) + " L";
    $("garrafas").innerHTML = r.garrafas.map(function (g) {
      return "<tr><td>" + g.ml + " ml</td><td>" + fmt(g.speiseMl, 0) + " ml</td></tr>";
    }).join("");
  }

  function trocarUnidade(nova) {
    if (nova === unidade) return;
    var og = $("og");
    var atual = parseFloat(og.value);
    if (!isNaN(atual)) og.value = nova === "plato" ? S.sgParaPlato(atual).toFixed(1) : S.platoParaSg(atual).toFixed(3);
    unidade = nova;
    og.step = nova === "sg" ? "0.001" : "0.1";
    og.min = nova === "sg" ? "1.000" : "0";
    document.querySelectorAll("[data-unidade]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.unidade === nova));
    });
    calcular();
  }

  document.querySelectorAll("input").forEach(function (el) { el.addEventListener("input", calcular); });
  document.querySelectorAll("[data-unidade]").forEach(function (b) {
    b.addEventListener("click", function () { trocarUnidade(b.dataset.unidade); });
  });
  BF.rodape("Ferramenta de Henrique Boaventura");
  calcular();
})();
