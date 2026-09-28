/*
 * Cálculo da ferramenta 05 — Taxa de inóculo. Funções puras, sem DOM.
 * Exportadas em window.BFInoculo (navegador) e module.exports (Node, testes).
 *
 * Unidades: volumes em LITROS, células em BILHÕES, taxa em milhões de
 * células por mL por °P. Uma conveniência: bilhões por litro = milhões por mL.
 *
 * QUANTO PRECISA (Mr Malty, Brewers Friend, Craft Beer & Brewing — igual nas três)
 *   células = taxa × volume (mL) × °P ÷ 1000  →  em litros: taxa × litros × °P
 *
 * O QUE VOCÊ TEM
 *   - líquida: 100 bi por pacote × viabilidade; viabilidade = 100% − 0,7% por
 *     dia desde a fabricação (Brewers Friend; o "clássico" do Mr Malty é quase
 *     igual, ≈ 0,72%/dia).
 *   - seca: gramas × bilhões por grama (padrão 15; as fontes vão de 10 a 20).
 *   - reaproveitada: mL × 4,5 bi/mL de sólidos × % de sólidos × viabilidade (Mr Malty).
 *   - contagem própria: o número informado.
 *
 * CRESCIMENTO NO STARTER (três modelos)
 *   - Chris White, sem agitação: novas células por célula inicial
 *       r = 12,54793776 · I^−0,4594858324 − 0,9994994906
 *     com I = inoculação em milhões de células/mL.
 *   - Braukaiser (Kai Troester), placa agitadora: por grama de extrato,
 *       x = células iniciais ÷ gramas de extrato
 *       x < 1,4        → cresce 1,4 bi por grama
 *       1,4 ≤ x < 3,5  → cresce (2,33 − 0,67·x) bi por grama
 *       x ≥ 3,5        → não cresce
 *     extrato (g) = litros × °P × SG × 10.
 *   - Mr Malty, placa agitadora: a mesma curva de White, com o starter
 *     "valendo" 2 ÷ 0,75 ≈ 2,67 vezes o volume. É o fator do próprio Mr Malty
 *     (placa agitadora 2,0; starter simples 0,75). Validado contra a
 *     calculadora de passos dele: ±10% na maioria dos passos.
 *   Os dois modelos de placa discordam: com pouca levedura por litro, o da
 *   Braukaiser cresce mais; com muita, cresce menos e para acima de 3,5 bi/g,
 *   enquanto o do Mr Malty continua crescendo.
 *   Cada passo começa com as células do anterior (decantado).
 *
 * DME do starter: 45 PPG (Brewers Friend).
 */
(function (raiz) {
  "use strict";

  var CELULAS_PACOTE = 100;          // bi por pacote/vial líquido fresco
  var PERDA_DIA = 0.7;               // % de viabilidade perdida por dia (líquida)
  var CELULAS_GRAMA_SECA = 15;       // bi por grama (padrão, editável)
  var CELULAS_ML_SOLIDOS = 4.5;      // bi por mL de sólidos de levedura (slurry)
  var SACHE_G = 11;
  var DME_PPG = 45;
  var PPG_PARA_PKL = 3.785411784 / 0.45359237; // PPG → pontos por kg por litro (≈ 8,3454)
  var WHITE = { a: 12.54793776, k: 0.4594858324, d: 0.9994994906 };
  var INOCULACAO_IDEAL = [25, 100];  // milhões/mL — fora disso a curva de White extrapola
  var FATOR_PLACA_MRMALTY = 2 / 0.75; // volume "efetivo" da placa agitadora no Mr Malty
  // modelos de crescimento, na ordem em que aparecem na tela
  var MODELOS = ["braukaiser", "mrmalty", "white"];
  var TAXAS = [
    { id: "ale", valor: 0.75, rotulo: "Ale" },
    { id: "ale-forte", valor: 1, rotulo: "Ale forte" },
    { id: "lager", valor: 1.5, rotulo: "Lager" },
    { id: "lager-forte", valor: 2, rotulo: "Lager forte" }
  ];

  function sgParaPlato(s) {
    return -616.868 + 1111.14 * s - 630.272 * s * s + 135.997 * s * s * s;
  }
  function platoParaSg(p) {
    return 1 + p / (258.6 - (p / 258.2) * 227.1);
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : NaN; }

  /* ---------- quanto precisa ---------- */
  function celulasNecessarias(litros, plato, taxa) {
    litros = num(litros); plato = num(plato); taxa = num(taxa);
    if (!(litros > 0) || !(plato > 0) || !(taxa > 0)) return NaN;
    return taxa * litros * plato;
  }
  // taxa que uma quantidade de células dá no lote (milhões/mL/°P)
  function taxaObtida(celulas, litros, plato) {
    return litros > 0 && plato > 0 ? celulas / (litros * plato) : NaN;
  }

  /* ---------- o que você tem ---------- */
  function viabilidadeLiquida(dias) {
    dias = Math.max(0, num(dias) || 0);
    return Math.max(0, Math.min(100, 100 - PERDA_DIA * dias));
  }
  function diasEntre(dataIso, hoje) {
    if (!dataIso) return null;
    var d = new Date(dataIso + "T00:00:00");
    if (isNaN(d)) return null;
    var h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    return Math.max(0, Math.round((h - d) / 86400000));
  }

  /*
   * f = { tipo: "liquida" | "seca" | "reaproveitada" | "contagem", ... }
   *   liquida:        pacotes, viabilidade (%)
   *   seca:           gramas, celulasGrama (bi/g)
   *   reaproveitada:  ml, solidos (%), viabilidade (%)
   *   contagem:       celulas (bi)
   */
  function celulasDisponiveis(f) {
    switch (f.tipo) {
      case "liquida": return Math.max(0, num(f.pacotes) || 0) * CELULAS_PACOTE * (num(f.viabilidade) || 0) / 100;
      case "seca": return Math.max(0, num(f.gramas) || 0) * (num(f.celulasGrama) || CELULAS_GRAMA_SECA);
      case "reaproveitada":
        return Math.max(0, num(f.ml) || 0) * CELULAS_ML_SOLIDOS * (num(f.solidos) || 0) / 100 * (num(f.viabilidade) || 0) / 100;
      case "contagem": return Math.max(0, num(f.celulas) || 0);
      default: return 0;
    }
  }

  // sem starter: quanto de cada fonte bate o necessário
  function semStarter(f, necessario) {
    if (!(necessario > 0)) return null;
    switch (f.tipo) {
      case "liquida": {
        var porPacote = CELULAS_PACOTE * (num(f.viabilidade) || 0) / 100;
        return porPacote > 0 ? { pacotes: Math.ceil(necessario / porPacote - 1e-9) } : null;
      }
      case "seca": {
        var g = necessario / (num(f.celulasGrama) || CELULAS_GRAMA_SECA);
        return { gramas: g, saches: Math.ceil(g / SACHE_G - 1e-9) };
      }
      case "reaproveitada": {
        var porMl = CELULAS_ML_SOLIDOS * (num(f.solidos) || 0) / 100 * (num(f.viabilidade) || 0) / 100;
        return porMl > 0 ? { ml: necessario / porMl } : null;
      }
      default: return null;
    }
  }

  /* ---------- crescimento ---------- */
  function extratoGramas(litros, sg) {
    return litros * sgParaPlato(sg) * sg * 10;
  }
  function dmeGramas(litros, sg) {
    return litros * (sg - 1) * 1000 / (DME_PPG * PPG_PARA_PKL) * 1000;
  }

  // inoculação que entra na curva de White: a real, ou a "efetiva" no modelo de placa do Mr Malty
  function inoculacaoWhite(modelo, celulas, litros) {
    return celulas / (modelo === "mrmalty" ? litros * FATOR_PLACA_MRMALTY : litros);
  }

  // novas células (bi) num passo
  function crescimento(modelo, celulas, litros, sg) {
    if (!(celulas > 0) || !(litros > 0)) return 0;
    if (modelo === "white" || modelo === "mrmalty") {
      var I = inoculacaoWhite(modelo, celulas, litros); // milhões/mL
      var r = WHITE.a * Math.pow(I, -WHITE.k) - WHITE.d;
      return Math.max(0, r) * celulas;
    }
    // braukaiser (placa agitadora)
    if (!(sg > 1)) return 0;
    var E = extratoGramas(litros, sg);
    var x = celulas / E;
    if (x < 1.4) return 1.4 * E;
    if (x < 3.5) return Math.max(0, (2.33 - 0.67 * x) * E);
    return 0;
  }

  /*
   * Propaga por passos. passos = [{ litros, sg, modelo: "braukaiser" | "mrmalty" | "white" }]
   * Devolve um resultado por passo: inicio, fim, novas, inoculacao (milhões/mL),
   * fator (fim ÷ início), dme (g) e avisos.
   */
  function propagar(inicial, passos) {
    var c = Math.max(0, num(inicial) || 0);
    return (passos || []).map(function (p) {
      var litros = num(p.litros), sg = num(p.sg), modelo = MODELOS.indexOf(p.modelo) > -1 ? p.modelo : "braukaiser";
      if (!(litros > 0) || !(sg > 1)) return { valido: false, inicio: c, fim: c };
      var novas = crescimento(modelo, c, litros, sg);
      var I = c / litros;
      var avisos = [];
      if (sg < 1.030 || sg > 1.040) avisos.push("densidade");
      var Iw = inoculacaoWhite(modelo, c, litros);
      if (modelo !== "braukaiser" && c > 0 && (Iw < INOCULACAO_IDEAL[0] || Iw > INOCULACAO_IDEAL[1])) avisos.push("inoculacao");
      if (novas <= 0 && c > 0) avisos.push("sem-crescimento");
      var r = { valido: true, modelo: modelo, litros: litros, sg: sg, inicio: c, novas: novas, fim: c + novas,
        inoculacao: I, inoculacaoWhite: Iw, fator: c > 0 ? (c + novas) / c : NaN, dme: dmeGramas(litros, sg), avisos: avisos };
      c = r.fim;
      return r;
    });
  }

  /*
   * Sugere passos até chegar em `necessario`, com starters de no máximo
   * `frasco` litros. Cada passo usa o menor volume (múltiplo de 0,1 L) que
   * basta; se nem o frasco cheio basta, enche o frasco e passa ao próximo.
   * Para quando um frasco cheio já não cresce 10% ("frasco-pequeno") ou em
   * 10 passos ("passos-demais").
   */
  function sugerirPassos(inicial, necessario, frasco, modelo, sg) {
    var c = num(inicial), alvo = num(necessario), max = num(frasco);
    sg = num(sg) || 1.036;
    if (!(c > 0) || !(alvo > 0) || !(max > 0)) return { passos: [], motivo: "incompleta" };
    if (c >= alvo) return { passos: [], motivo: "suficiente" };
    var passos = [];
    for (var i = 0; i < 10 && c < alvo; i++) {
      var cheio = c + crescimento(modelo, c, max, sg);
      // passo que cresce menos de 10% não vale a pena: o frasco é pequeno para tanta levedura
      if (cheio < c * 1.1) return { passos: passos, motivo: "frasco-pequeno" };
      var litros = max;
      if (cheio >= alvo) {
        // menor volume que basta (o crescimento só aumenta com o volume)
        var lo = 0, hi = max;
        for (var k = 0; k < 60; k++) {
          var m = (lo + hi) / 2;
          if (c + crescimento(modelo, c, m, sg) >= alvo) hi = m; else lo = m;
        }
        litros = Math.min(max, Math.ceil(hi * 10 - 1e-9) / 10);
      }
      passos.push({ litros: litros, sg: sg, modelo: modelo });
      c += crescimento(modelo, c, litros, sg);
    }
    return { passos: passos, motivo: c >= alvo ? "ok" : "passos-demais" };
  }

  var api = {
    CELULAS_PACOTE: CELULAS_PACOTE, PERDA_DIA: PERDA_DIA, CELULAS_GRAMA_SECA: CELULAS_GRAMA_SECA,
    CELULAS_ML_SOLIDOS: CELULAS_ML_SOLIDOS, SACHE_G: SACHE_G, DME_PPG: DME_PPG, WHITE: WHITE,
    INOCULACAO_IDEAL: INOCULACAO_IDEAL, FATOR_PLACA_MRMALTY: FATOR_PLACA_MRMALTY, MODELOS: MODELOS, TAXAS: TAXAS,
    sgParaPlato: sgParaPlato, platoParaSg: platoParaSg,
    celulasNecessarias: celulasNecessarias, taxaObtida: taxaObtida,
    viabilidadeLiquida: viabilidadeLiquida, diasEntre: diasEntre,
    celulasDisponiveis: celulasDisponiveis, semStarter: semStarter,
    extratoGramas: extratoGramas, dmeGramas: dmeGramas, crescimento: crescimento,
    propagar: propagar, sugerirPassos: sugerirPassos
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.BFInoculo = api;
})(typeof self !== "undefined" ? self : this);
