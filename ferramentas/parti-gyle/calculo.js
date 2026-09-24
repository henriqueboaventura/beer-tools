/*
 * Cálculo da ferramenta 04 — Parti-gyle. Funções puras, sem DOM.
 * Exportadas em window.BFPartiGyle (navegador) e module.exports (Node, testes).
 *
 * Tudo em "pontos de densidade": SG 1.064 = 64 pontos. Pontos se conservam
 * na mistura: volume × pontos de cada parte somam (Beer & Brewing; BYO).
 *
 * Fontes:
 * - BYO, "Introduction to Parti-Gyle Brewing": esquemas de divisão
 *   (1/3 + 2/3; metade/metade 58%/42%; três terços 1,5× / 1× / 0,5×).
 * - BYO, "Parti-Gyle Brewing Techniques": pontos totais = Σ volume × pontos;
 *   1 lb de malte claro por galão = 24 pontos a 65% de eficiência;
 *   ajuste quando o primeiro mosto sai diferente (volume = pontos ÷ alvo).
 * - Craft Beer & Brewing, "Practical Parti-Gyle Brewing": misturar o mosto
 *   forte e o fraco para chegar à densidade de cada cerveja.
 */
(function (raiz) {
  "use strict";

  var LITROS_POR_GALAO = 3.785411784;
  var KG_POR_LIBRA = 0.45359237;
  // 1 PPG (pontos por libra por galão) em pontos por kg por litro
  var PPG_PARA_PKL = LITROS_POR_GALAO / KG_POR_LIBRA; // ≈ 8,3454

  // Esquemas publicados (BYO). fracVolume: parte do volume total, na ordem dos
  // mostos; multiplicador: densidade da cerveja ÷ densidade média do lote.
  var ESQUEMAS = {
    "terco-dois-tercos": {
      nome: "1/3 + 2/3",
      descricao: "Uma cerveja forte com o primeiro terço do mosto e uma mais leve com o resto. O primeiro mosto sai com o dobro da densidade do segundo.",
      fracVolume: [1 / 3, 2 / 3],
      multiplicador: [1.5, 0.75]
    },
    "metade": {
      nome: "Metade / metade",
      descricao: "Dois volumes iguais. O primeiro mosto leva 58% dos pontos e o segundo, 42%.",
      fracVolume: [0.5, 0.5],
      multiplicador: [1.16, 0.84]
    },
    "tres-tercos": {
      nome: "Três terços",
      descricao: "Três volumes iguais: 1,5×, 1× e 0,5× a densidade média do lote.",
      fracVolume: [1 / 3, 1 / 3, 1 / 3],
      multiplicador: [1.5, 1, 0.5]
    }
  };

  function pontos(sg) { return (Number(sg) - 1) * 1000; }
  function sg(p) { return 1 + p / 1000; }
  function sgParaPlato(s) {
    return -616.868 + 1111.14 * s - 630.272 * s * s + 135.997 * s * s * s;
  }

  /*
   * Planejar a divisão.
   * p = { esquema, volume (L), og (SG), definirPor: "media" | "primeira" }
   * "primeira": og é a densidade desejada da 1ª cerveja (a mais forte).
   */
  function planejar(p) {
    var e = ESQUEMAS[p.esquema];
    if (!e) throw new Error("esquema desconhecido: " + p.esquema);
    var volume = Math.max(Number(p.volume) || 0, 0);
    var pts = Math.max(pontos(p.og), 0);
    var mediaPts = p.definirPor === "primeira" ? pts / e.multiplicador[0] : pts;
    var cervejas = e.fracVolume.map(function (f, i) {
      var cp = mediaPts * e.multiplicador[i];
      return { volume: volume * f, og: sg(cp), pontos: cp, fracPontos: f * e.multiplicador[i] };
    });
    return {
      esquema: e,
      ogMedia: sg(mediaPts),
      pontosTotais: volume * mediaPts, // pontos·litro
      cervejas: cervejas
    };
  }

  /*
   * Malte necessário para um total de pontos·litro.
   * eficiencia em %, ppg = potencial do malte em pontos por libra por galão
   * (malte claro ≈ 37). Ex. BYO: 320 pontos·galão a 65% -> ~13 lb.
   */
  function malteNecessario(pontosLitro, eficiencia, ppg) {
    var rendimento = (ppg || 37) * PPG_PARA_PKL * (Number(eficiencia) || 0) / 100; // pontos·L por kg
    return rendimento > 0 ? pontosLitro / rendimento : 0;
  }

  /*
   * Quanto de cada mosto vai para cada cerveja.
   * m = { forte: {volume, og}, fraco: {volume, og}, cervejas: [{volume, og}] }
   * Por cerveja: litros de forte, de fraco e de água. Se o alvo fica abaixo do
   * mosto fraco, completa com água; acima do forte, é impossível só misturando.
   */
  function misturar(m) {
    var fP = pontos(m.forte.og), wP = pontos(m.fraco.og);
    var usadoForte = 0, usadoFraco = 0;
    var cervejas = (m.cervejas || []).map(function (c) {
      var v = Math.max(Number(c.volume) || 0, 0), t = pontos(c.og);
      var r = { volume: v, og: Number(c.og), forte: 0, fraco: 0, agua: 0, problema: null };
      if (!(v > 0) || isNaN(t)) { r.problema = "incompleta"; return r; }
      if (t > fP + 1e-9) { r.problema = "acima-do-forte"; return r; }
      if (fP - wP < 1e-9) { r.problema = "mostos-iguais"; return r; }
      if (t >= wP) {
        r.forte = v * (t - wP) / (fP - wP);
        r.fraco = v - r.forte;
      } else {
        r.fraco = wP > 0 ? v * t / wP : 0;
        r.agua = v - r.fraco;
      }
      usadoForte += r.forte;
      usadoFraco += r.fraco;
      return r;
    });
    var sobraForte = (Number(m.forte.volume) || 0) - usadoForte;
    var sobraFraco = (Number(m.fraco.volume) || 0) - usadoFraco;
    return {
      cervejas: cervejas,
      usadoForte: usadoForte, usadoFraco: usadoFraco,
      sobraForte: sobraForte, sobraFraco: sobraFraco,
      suficiente: sobraForte > -1e-9 && sobraFraco > -1e-9
    };
  }

  /*
   * Primeiro mosto saiu diferente do previsto (BYO): mesmos pontos, novo volume.
   * Ex.: 2 gal a 1.100 com alvo 1.080 -> 200 ÷ 80 = 2,5 gal (diluir com 0,5 gal).
   * Se o mosto ficou mais fraco que o alvo, o volume no alvo é menor
   * (seria preciso ferver mais ou acrescentar extrato).
   */
  function ajustar(volume, og, alvo) {
    var v = Number(volume) || 0, p = pontos(og), t = pontos(alvo);
    var novo = t > 0 ? v * p / t : 0;
    return { volumeNoAlvo: novo, aguaParaDiluir: Math.max(novo - v, 0), fatorLupulo: v > 0 ? novo / v : 0, maisFraco: p < t };
  }

  var api = {
    ESQUEMAS: ESQUEMAS, LITROS_POR_GALAO: LITROS_POR_GALAO, KG_POR_LIBRA: KG_POR_LIBRA, PPG_PARA_PKL: PPG_PARA_PKL,
    pontos: pontos, sg: sg, sgParaPlato: sgParaPlato,
    planejar: planejar, malteNecessario: malteNecessario, misturar: misturar, ajustar: ajustar
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.BFPartiGyle = api;
})(typeof self !== "undefined" ? self : this);
