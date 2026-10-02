/*
 * Cálculo da ferramenta 06 — Carbonatação (açúcar de priming). Funções puras,
 * sem DOM. Exportadas em window.BFCarbonatacao (navegador) e module.exports
 * (Node, testes).
 *
 * Mesma física da Priming Sugar Calculator do Mr Malty
 * (https://mrmalty.com/priming-sugar-calculator.html), em unidades métricas,
 * ao nível do mar (sem correção de altitude):
 *
 * - CO₂ residual: a cerveja que saiu da fermentação guarda CO₂ dissolvido,
 *   definido pela temperatura MAIS ALTA que ela atingiu depois da fermentação:
 *     vol = 3,0378 − 0,050062·T + 0,00026555·T²   (T em °F; a mesma da speise)
 *   Se ela já estava sob pressão (spunding), lê-se o manômetro:
 *     vol = k(T)·(manômetro + atmosfera) − 0,003342,
 *     k(T) = 0,01821 + 0,090115·e^(−(T−32)/43,11)   (pressão em psi absoluto)
 * - 1 volume de CO₂ = 1,964 g/L. CO₂ a acrescentar = (alvo − residual) × 1,964 × litros.
 * - Açúcar = CO₂ ÷ rendimento (g de CO₂ por g de açúcar).
 * - Barril: o espaço vazio também guarda CO₂ (lei dos gases), então pede mais
 *   açúcar para chegar no mesmo alvo dissolvido. Em garrafa e lata é desprezível.
 * - Pressão na temperatura de armazenamento: o CO₂ total se redistribui entre a
 *   cerveja e o espaço vazio, mais o ar preso na embalagem.
 * - Risco: a pressão no armazenamento contra a pressão que os limites da
 *   embalagem (em volumes) dariam nas mesmas condições. Conta o CO₂ que a
 *   embalagem realmente tem, mesmo quando a cerveja já passou do alvo.
 * - Carbonatação natural (fechar antes do fim): cada ponto de densidade
 *   aparente fermentado gera 0,989 g/L de CO₂.
 */
(function (raiz) {
  "use strict";

  var G_POR_VOL_L = 1.964;   // g de CO₂ por litro por volume
  var PSI_ATM = 14.695;      // atmosfera ao nível do mar, psi
  var PSI_POR_BAR = 14.5037738;
  var R = 8.314, M_CO2 = 44.01;
  var C_OFF = 0.003342;
  // temperatura fixa da conferência de segurança: um armário no verão
  var TEMP_SEGURANCA_C = 30;
  // CO₂ por ponto de densidade aparente fermentado (Mr Malty: ABV por ponto → etanol → CO₂)
  var CO2_POR_PONTO_GL = (0.13125 / 100) * 1000 * 0.789 * (44.01 / 46.07); // ≈ 0,989 g/L

  // as mesmas garrafas da calculadora de speise
  var GARRAFAS_ML = [650, 600, 550, 500, 375, 350, 300];

  /*
   * Fontes de açúcar: rendimento em g de CO₂ por g.
   * "confirmado" = estequiométrico; "estimativa" = depende de quanto fermenta.
   */
  var ACUCARES = [
    { id: "sacarose", nome: "Açúcar refinado ou cristal (sacarose)", rendimento: 0.514, confirmado: true,
      nota: "O açúcar comum. É o que mais rende CO₂ por grama." },
    { id: "milho", nome: "Açúcar de milho (dextrose monoidratada)", rendimento: 0.444, confirmado: true,
      nota: "O açúcar de priming mais comum. Cerca de um décimo do peso é água de cristalização, por isso rende menos que o açúcar comum." },
    { id: "dextrose", nome: "Dextrose anidra", rendimento: 0.489, confirmado: true,
      nota: "Dextrose sem a água de cristalização: rende entre o açúcar de milho e o comum." },
    { id: "mascavo", nome: "Açúcar mascavo", rendimento: 0.500, confirmado: true,
      nota: "Quase sacarose, com melaço: deixa uma nota leve de caramelo. O Brewers Friend usa 0,437, o que pede cerca de 14% mais açúcar: o mascavo brasileiro, menos refinado, tende a ficar mais perto desse valor." },
    { id: "dme", nome: "Extrato de malte seco (DME claro)", rendimento: 0.40, confirmado: false,
      nota: "Estimativa para um DME claro que fermenta cerca de 80%. Carbonata um pouco mais devagar e dá mais corpo. O Brewers Friend usa 0,334, o que pede cerca de 20% mais DME." },
    { id: "mel", nome: "Mel", rendimento: 0.41, confirmado: false,
      nota: "Estimativa: cerca de 80% de açúcares fermentáveis. Varia de mel para mel. O Brewers Friend usa 0,364, o que pede cerca de 13% mais mel." },
    { id: "natural", nome: "Carbonatação natural (fechar antes do fim)", rendimento: null, confirmado: true,
      nota: "Sem açúcar: feche o barril ou fermentador enquanto a cerveja ainda está alguns pontos acima da densidade final, e o resto da fermentação carbonata." }
  ];

  /*
   * Envases. atencao/perigo = volumes de CO₂ em que vale atenção e em que é perigoso.
   * espacoVazio: só o barril considera o espaço vazio na conta.
   * porGarrafa: mostra a dose por embalagem.
   */
  var ENVASES = {
    "vidro": { nome: "Garrafa de vidro", atencao: 2.9, perigo: 3.5, espacoVazio: false, porGarrafa: true },
    "vidro-reforcado": { nome: "Garrafa reforçada (champanhe)", atencao: 4.5, perigo: 5.5, espacoVazio: false, porGarrafa: true },
    "pet": { nome: "Garrafa PET", atencao: 4.0, perigo: 5.0, espacoVazio: false, porGarrafa: true },
    "lata": { nome: "Lata", atencao: 2.7, perigo: 3.2, espacoVazio: false, porGarrafa: true },
    "barril": { nome: "Barril", atencao: 3.6, perigo: 4.2, espacoVazio: true, porGarrafa: false }
  };

  // volumes de CO₂ típicos por estilo (pontos médios, Mr Malty)
  var ESTILOS = [
    { grupo: "Britânicas e irlandesas", itens: [
      ["Bitter / ESB", 1.9], ["Mild", 1.6], ["English brown ale", 2.0], ["English porter", 1.9],
      ["Dry / Irish stout", 1.9], ["Sweet / oatmeal stout", 2.0], ["Scottish ale", 1.8],
      ["English IPA", 2.0], ["Barleywine / old ale", 1.9]] },
    { grupo: "Americanas", itens: [
      ["American pale ale", 2.4], ["IPA / double IPA", 2.5], ["Amber / red ale", 2.4],
      ["American brown", 2.3], ["American porter", 2.3], ["American stout", 2.3],
      ["American wheat", 2.7], ["Cream ale", 2.5], ["California common", 2.6]] },
    { grupo: "Lagers", itens: [
      ["Pilsner / lager clara", 2.6], ["Helles", 2.5], ["Märzen / Oktoberfest", 2.5],
      ["Bock / doppelbock", 2.5], ["Schwarzbier", 2.5], ["Lager escura / âmbar", 2.5]] },
    { grupo: "Trigo alemãs", itens: [
      ["Hefeweizen", 3.6], ["Dunkelweizen", 3.6], ["Weizenbock", 3.5], ["Kristallweizen", 3.6]] },
    { grupo: "Belgas e francesas", itens: [
      ["Belgian blond / pale", 2.6], ["Dubbel", 2.6], ["Tripel", 3.2], ["Belgian strong", 3.4],
      ["Saison", 3.4], ["Witbier", 2.8], ["Belgian IPA", 2.6], ["Bière de garde", 2.6]] },
    { grupo: "Ácidas e selvagens", itens: [
      ["Berliner Weisse", 3.4], ["Gose", 3.0], ["Gueuze", 3.8], ["Flanders red / brown", 2.4], ["Fruit sour", 3.2]] },
    { grupo: "Outras", itens: [
      ["Kölsch", 2.5], ["Altbier", 2.3], ["Fruit beer", 2.6], ["Rauchbier", 2.4]] }
  ];

  // campo vazio é "não informado", não zero
  function num(v) { if (v === "" || v === null || v === undefined) return NaN; var n = Number(v); return isFinite(n) ? n : NaN; }
  function cParaF(c) { return c * 9 / 5 + 32; }
  function kelvin(c) { return c + 273.15; }
  function kT(tf) { return 0.01821 + 0.090115 * Math.exp(-(tf - 32) / 43.11); }

  // volumes que continuam dissolvidos depois da fermentação, pela temperatura mais alta (°C)
  function co2Residual(tempC) {
    var f = cParaF(tempC);
    return Math.max(3.0378 - 0.050062 * f + 0.00026555 * f * f, 0);
  }
  // volumes dissolvidos numa cerveja sob pressão (manômetro em bar) à temperatura tempC
  function co2PelaPressao(bar, tempC) {
    return Math.max(0, kT(cParaF(tempC)) * (bar * PSI_POR_BAR + PSI_ATM) - C_OFF);
  }
  // pressão (bar, manométrica) que mantém `vol` volumes dissolvidos a tempC
  function pressaoParaVolumes(vol, tempC) {
    return ((vol + C_OFF) / kT(cParaF(tempC)) - PSI_ATM) / PSI_POR_BAR;
  }
  // g de CO₂ que o espaço vazio guarda por psi absoluto
  function hEspaco(litrosVazio, tempC) {
    return (6894.76 * (litrosVazio / 1000) / (R * kelvin(tempC))) * M_CO2;
  }

  // CO₂ (g) a acrescentar para o equilíbrio dissolvido chegar no alvo
  function co2Necessario(alvo, residual, litros, litrosVazio, tempC) {
    var k = kT(cParaF(tempC)), H = hEspaco(litrosVazio, tempC);
    var total = alvo * (G_POR_VOL_L * litros + H / k) + H * C_OFF / k;
    return total - residual * G_POR_VOL_L * litros;
  }
  // volumes dissolvidos no equilíbrio com um CO₂ acrescentado (0 = sem priming)
  function volumesEquilibrio(co2Acrescentado, residual, litros, litrosVazio, tempC) {
    var k = kT(cParaF(tempC)), H = hEspaco(litrosVazio, tempC);
    var total = residual * G_POR_VOL_L * litros + co2Acrescentado;
    return (total - H * C_OFF / k) / (G_POR_VOL_L * litros + H / k);
  }
  // pressão manométrica (bar) na embalagem à temperatura de armazenamento, com o ar preso
  function pressaoArmazenamento(co2Acrescentado, residual, litros, litrosVazio, tempCond, tempArm) {
    var total = residual * G_POR_VOL_L * litros + co2Acrescentado;
    var fw = cParaF(tempArm), kw = kT(fw), Hw = hEspaco(litrosVazio, tempArm);
    var dissolvido = (total - Hw * C_OFF / kw) / (G_POR_VOL_L * litros + Hw / kw);
    var pCo2 = (Math.max(dissolvido, 0) + C_OFF) / kw;          // psi absoluto
    var pAr = PSI_ATM * (kelvin(tempArm) / kelvin(tempCond));   // ar fechado no envase, aquecido
    return { dissolvido: dissolvido, co2: (pCo2 - PSI_ATM) / PSI_POR_BAR, total: (pCo2 + pAr - PSI_ATM) / PSI_POR_BAR };
  }

  function acucarPorId(id) {
    for (var i = 0; i < ACUCARES.length; i++) if (ACUCARES[i].id === id) return ACUCARES[i];
    return null;
  }

  /*
   * p = {
   *   envase: chave de ENVASES, litros, tempC (mais alta depois da fermentação),
   *   inicio: "fermentada" | "pressao", pressaoBar (manômetro, se "pressao"),
   *   alvo (volumes), acucar: id de ACUCARES, rendimento (opcional, g/g),
   *   espacoVazio (L, só barril), tempArmazenamento (°C, padrão = tempC),
   *   densidadeFinal (SG, carbonatação natural)
   * }
   */
  function calcular(p) {
    var envase = ENVASES[p.envase] || ENVASES.vidro;
    var litros = num(p.litros), tempC = num(p.tempC), alvo = num(p.alvo);
    var r = { valido: false, envase: envase };
    if (!(litros > 0) || !isFinite(tempC) || !(alvo > 0)) return r;

    var vazio = envase.espacoVazio ? Math.max(num(p.espacoVazio) || 0, 0) : 0;
    var pressao = p.inicio === "pressao";
    var residual = pressao ? co2PelaPressao(num(p.pressaoBar) || 0, tempC) : co2Residual(tempC);
    var co2 = co2Necessario(alvo, residual, litros, vazio, tempC);
    var semPriming = co2 <= 0.05;
    var acucar = acucarPorId(p.acucar) || ACUCARES[0];
    var rendimento = num(p.rendimento) > 0 ? num(p.rendimento) : acucar.rendimento;
    var tempArm = isFinite(num(p.tempArmazenamento)) ? num(p.tempArmazenamento) : tempC;
    var co2Real = semPriming ? 0 : co2;

    r.valido = true;
    r.residual = residual;
    r.alvo = alvo;
    r.litros = litros;
    r.espacoVazio = vazio;
    r.co2 = co2Real;
    r.co2PorLitro = alvo * G_POR_VOL_L;
    r.semPriming = semPriming;
    r.acucar = acucar;
    r.rendimento = rendimento;
    r.semPrimingEquilibrio = volumesEquilibrio(0, residual, litros, vazio, tempC);
    r.pressao = pressaoArmazenamento(co2Real, residual, litros, vazio, tempC, tempArm);
    r.tempArmazenamento = tempArm;
    // limites em bar: a pressão que os volumes-limite dariam nas mesmas condições
    var limiteBar = function (vol) {
      return pressaoArmazenamento(Math.max(co2Necessario(vol, residual, litros, vazio, tempC), 0), residual, litros, vazio, tempC, tempArm).total;
    };
    r.limiteAtencaoBar = limiteBar(envase.atencao);
    r.limitePerigoBar = limiteBar(envase.perigo);
    var bar = r.pressao.total, folga = 1e-9;
    r.risco = bar >= r.limitePerigoBar - folga ? "perigo" : bar >= r.limiteAtencaoBar - folga ? "atencao" : "ok";

    if (acucar.id === "natural") {
      var dfin = num(p.densidadeFinal);
      r.pontos = co2Real / (CO2_POR_PONTO_GL * litros);
      r.densidadeFechar = dfin > 0.9 ? dfin + r.pontos / 1000 : NaN;
      r.valvulaBar = Math.max(0, pressaoParaVolumes(alvo, tempC));
      r.gramas = NaN;
      r.garrafas = [];
    } else {
      r.gramas = co2Real / rendimento;
      r.gramasPorLitro = r.gramas / litros;
      r.garrafas = envase.porGarrafa ? GARRAFAS_ML.map(function (ml) {
        return { ml: ml, gramas: r.gramas * (ml / 1000) / litros, quantas: Math.floor(litros * 1000 / ml) };
      }) : [];
      // a mesma carbonatação em cada açúcar
      r.outros = ACUCARES.filter(function (a) { return a.rendimento; }).map(function (a) {
        return { id: a.id, nome: a.nome, rendimento: a.rendimento, gramas: co2Real / a.rendimento };
      });
    }
    return r;
  }

  var api = {
    G_POR_VOL_L: G_POR_VOL_L, TEMP_SEGURANCA_C: TEMP_SEGURANCA_C, PSI_POR_BAR: PSI_POR_BAR, CO2_POR_PONTO_GL: CO2_POR_PONTO_GL,
    GARRAFAS_ML: GARRAFAS_ML, ACUCARES: ACUCARES, ENVASES: ENVASES, ESTILOS: ESTILOS,
    co2Residual: co2Residual, co2PelaPressao: co2PelaPressao, pressaoParaVolumes: pressaoParaVolumes,
    co2Necessario: co2Necessario, volumesEquilibrio: volumesEquilibrio, pressaoArmazenamento: pressaoArmazenamento,
    acucarPorId: acucarPorId, calcular: calcular
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.BFCarbonatacao = api;
})(typeof self !== "undefined" ? self : this);
