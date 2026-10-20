/*
 * Cálculo da ferramenta 05 — Spunding: em que densidade fechar a válvula para a
 * fermentação chegar sozinha a uma pressão (ou carbonatação) escolhida.
 * Funções puras, sem DOM. Exportadas em window.BFSpunding (navegador) e module.exports
 * (Node, para os testes).
 *
 * A física do CO₂ (equilíbrio pressão × temperatura × volumes, espaço vazio, CO₂ por
 * ponto de densidade) é a da carbonatação: carbonatacao/calculo.js, carregado antes
 * desta, em vez de uma cópia. A válvula fica aberta (0 bar) até fechar. O CO₂ que a
 * fermentação precisa fazer depois disso é o que a cerveja absorve mais o que enche o
 * espaço vazio até a pressão; em pontos de densidade, com 1 ponto de folga
 * (Bräu Supply, Pressure Fermentation Calculator).
 *
 * Pressões em bar no manômetro, temperaturas em °C, volumes em L, densidade em SG.
 */
(function (raiz) {
  "use strict";

  var C = typeof module !== "undefined" && module.exports ? require("../carbonatacao/calculo.js") : raiz.BFCarbonatacao;

  // folga em pontos de densidade, e o mínimo de pontos antes da final
  var FOLGA = 1;
  var MINIMO = 2;

  function num(v) { return v === "" || v === null || v === undefined ? NaN : Number(v); }
  function volumes(bar, tempC) { return C.co2PelaPressao(bar, tempC); }

  /*
   * Pontos de densidade que a fermentação precisa para ir de `de` até `ate` bar:
   * o CO₂ que a cerveja absorve mais o que o espaço vazio precisa para chegar na
   * nova pressão (lei dos gases).
   */
  function pontosParaFechar(de, ate, litros, espacoVazio, tempC) {
    var naCerveja = Math.max(volumes(ate, tempC) - volumes(de, tempC), 0) * C.G_POR_VOL_L * litros;
    var noEspaco = C.hEspaco(Math.max(espacoVazio, 0), tempC) * Math.max(ate - de, 0) * C.PSI_POR_BAR;
    return (naCerveja + noEspaco) / (C.CO2_POR_PONTO_GL * litros);
  }

  /*
   * p = { modo: "bar" | "vol", valor, tempC, litros, capacidade (L, opcional), fg (SG) }
   * modo "bar": valor é a pressão no manômetro; "vol": a carbonatação em volumes de CO₂.
   */
  function calcular(p) {
    var modo = p.modo === "vol" ? "vol" : "bar";
    var valor = num(p.valor), tempC = num(p.tempC), litros = num(p.litros), fg = num(p.fg), capacidade = num(p.capacidade);
    var r = { valido: false, modo: modo };

    if (!(valor > 0) || !isFinite(tempC) || !(litros > 0) || !(fg >= 0.99 && fg < 1.2)) { r.erro = "campos"; return r; }
    if (capacidade > 0 && capacidade < litros) { r.erro = "capacidade"; return r; }

    var aberta = volumes(0, tempC);   // o CO₂ que a cerveja já tem com a válvula aberta
    if (modo === "vol" && valor <= aberta + 0.005) { r.erro = "aberta"; r.volumesAberta = aberta; r.tempC = tempC; return r; }

    var bar = modo === "bar" ? valor : C.pressaoParaVolumes(valor, tempC);
    var vazio = capacidade > 0 ? capacidade - litros : 0;

    r.valido = true;
    r.tempC = tempC;
    r.litros = litros;
    r.fg = fg;
    r.espacoVazio = vazio;
    r.bar = bar;
    r.volumes = modo === "vol" ? valor : volumes(bar, tempC);
    r.volumesAberta = aberta;
    r.pontos = pontosParaFechar(0, bar, litros, vazio, tempC);
    r.pontosFechar = Math.max(Math.ceil(r.pontos - 1e-9) + FOLGA, MINIMO);
    r.densidadeFechar = fg + r.pontosFechar / 1000;
    return r;
  }

  var api = { FOLGA: FOLGA, MINIMO: MINIMO, volumes: volumes, pontosParaFechar: pontosParaFechar, calcular: calcular };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.BFSpunding = api;
})(typeof self !== "undefined" ? self : this);
