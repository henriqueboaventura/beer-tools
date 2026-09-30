/*
 * Cálculo da ferramenta 03 — Speise. Funções puras, sem DOM.
 * Exportadas em window.BFSpeise (navegador) e module.exports (Node, testes).
 *
 * Matemática idêntica à calculadora original (henriqueboaventura/speise):
 * - CO₂ residual no envase pela temperatura (Henry, fórmula em °F);
 * - OG em °Plato (polinômio SG→°P) × atenuação = açúcar fermentável por litro;
 * - açúcar necessário ≈ 4 g/L por volume de CO₂ que falta;
 * - speise = açúcar necessário ÷ açúcar fermentável por litro de mosto;
 *   como a speise sai do próprio lote, mosto principal = volume final − speise.
 */
(function (raiz) {
  "use strict";

  var GARRAFAS_ML = [650, 600, 550, 500, 375, 350, 300];

  function sgParaPlato(sg) {
    return -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;
  }

  // inversa numérica (Newton) do polinômio acima
  function platoParaSg(plato) {
    var sg = 1 + plato / 258.6;
    for (var i = 0; i < 20; i++) {
      var f = sgParaPlato(sg) - plato;
      var df = (sgParaPlato(sg + 1e-6) - sgParaPlato(sg - 1e-6)) / 2e-6;
      sg -= f / df;
    }
    return sg;
  }

  // volumes de CO₂ que continuam dissolvidos na cerveja nessa temperatura
  function co2Residual(tempC) {
    var f = tempC * 9 / 5 + 32;
    return Math.max(3.0378 - 0.050062 * f + 0.00026555 * f * f, 0);
  }

  /*
   * p = { volume (L), og, unidade: "sg" | "plato", atenuacao (%), alvoCO2 (vol), temperatura (°C) }
   * aviso: null | "og-invalida" | "sem-speise" (o CO₂ residual já atinge o alvo)
   */
  function calcular(p) {
    var volume = Number(p.volume) || 0;
    var og = Number(p.og);
    var atenuacao = Number(p.atenuacao) || 0;
    var alvo = Number(p.alvoCO2) || 0;
    var plato = p.unidade === "plato" ? (og || 0) : sgParaPlato(isNaN(og) ? 1 : og);
    var residual = co2Residual(Number(p.temperatura));
    var falta = Math.max(alvo - residual, 0);

    var r = {
      plato: plato, co2Residual: residual, co2Faltante: falta,
      acucarG: 0, extratoFermentavelPorL: 0, speise: 0, principal: volume, aviso: null, garrafas: []
    };

    if (plato <= 0 || atenuacao <= 0) {
      r.aviso = "og-invalida";
    } else {
      if (alvo <= residual) r.aviso = "sem-speise";
      r.acucarG = 4 * volume * falta;
      r.extratoFermentavelPorL = 10 * plato * (atenuacao / 100);
      r.speise = Math.min(r.acucarG / r.extratoFermentavelPorL, volume);
      r.principal = Math.max(volume - r.speise, 0);
    }

    var proporcao = volume > 0 ? r.speise / volume : 0;
    r.garrafas = GARRAFAS_ML.map(function (ml) { return { ml: ml, speiseMl: proporcao * ml }; });
    return r;
  }

  var api = { sgParaPlato: sgParaPlato, platoParaSg: platoParaSg, co2Residual: co2Residual, calcular: calcular, GARRAFAS_ML: GARRAFAS_ML };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.BFSpeise = api;
})(typeof self !== "undefined" ? self : this);
