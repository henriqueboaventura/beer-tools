/*
 * Cálculo da ferramenta 04 — Parti-gyle. Funções puras, sem DOM.
 * Exportadas em window.BFPartiGyle (navegador) e module.exports (Node, testes).
 *
 * Tudo em "pontos de densidade": SG 1.064 = 64 pontos. Volume × pontos se
 * conserva na fervura e na mistura (a água não tem pontos).
 *
 * MODELO DA COLETA (parti-gyle "clássico": só coletar, sem misturar)
 * Os mostos saem cada vez mais fracos. Aqui a densidade cai em linha reta do
 * primeiro ao último litro: g(s) = G · (1 − B · s/R), com s = litros já
 * coletados, R = total coletado e B = 6/7. Esse B é o único que reproduz
 * EXATAMENTE duas regras publicadas na BYO ("Introduction to Parti-Gyle
 * Brewing"):
 *   - 1/3 + 2/3: o primeiro terço sai com o dobro da densidade do resto;
 *   - três terços: 1,5× / 1× / 0,5× a densidade média.
 * A terceira regra do mesmo artigo (metade/metade = 58% e 42% dos pontos) é
 * incompatível com essas duas — nenhuma curva que só desce satisfaz as três —
 * e fica de fora. É uma previsão: no dia, mede-se e corrige-se (passo 03).
 *
 * Consequência: só coletando, a 1ª de duas cervejas sai entre 1,75× e 4× mais
 * densa (em pontos) que a 2ª. Mais próximas que isso, só misturando mostos
 * (Craft Beer & Brewing, "Practical Parti-Gyle Brewing").
 *
 * Outras fontes: BYO, "Parti-Gyle Brewing Techniques" (malte: 1 lb/gal de
 * malte claro = 24 pontos a 65%; ajuste por diluição, volume = pontos ÷ alvo).
 */
(function (raiz) {
  "use strict";

  var B = 6 / 7;
  var RAZAO_MIN = 1 / (1 - B / 2);   // 1,75: 1ª cerveja com volume ~0
  var RAZAO_MAX = (1 - B / 2) / (1 - B); // 4: 2ª cerveja com volume ~0
  var LITROS_POR_GALAO = 3.785411784;
  var KG_POR_LIBRA = 0.45359237;
  var PPG_PARA_PKL = LITROS_POR_GALAO / KG_POR_LIBRA; // PPG -> pontos por kg por litro (≈ 8,3454)

  function pontos(sg) { return (Number(sg) - 1) * 1000; }
  function sg(p) { return 1 + p / 1000; }
  function sgParaPlato(s) {
    return -616.868 + 1111.14 * s - 630.272 * s * s + 135.997 * s * s * s;
  }

  // densidade média (em pontos) do trecho [a, c] da coleta, com G = 1
  function mediaTrecho(a, c, total) {
    return 1 - B * (a + c) / (2 * total);
  }

  function malteNecessario(pontosLitro, eficiencia, ppg) {
    var rendimento = (ppg || 37) * PPG_PARA_PKL * (Number(eficiencia) || 0) / 100; // pontos·L por kg
    return rendimento > 0 ? pontosLitro / rendimento : 0;
  }

  /*
   * Acertar a densidade mantendo os pontos (BYO): diluir com água ou ferver mais.
   * Devolve o volume final em que a cerveja chega ao alvo.
   */
  function acao(volume, pontosAtuais, pontosAlvo) {
    if (!(pontosAlvo > 0) || !(volume > 0)) return { tipo: "incompleta" };
    var final = volume * pontosAtuais / pontosAlvo;
    // diferença menor que 0,5% do volume: não precisa mexer (volumeFinal continua exato)
    if (Math.abs(final - volume) < 0.005 * volume) return { tipo: "ok", volumeFinal: final };
    if (final > volume) return { tipo: "agua", agua: final - volume, volumeFinal: final };
    return { tipo: "ferver", evaporar: volume - final, volumeFinal: final };
  }

  /*
   * Plano.
   * p = { cervejas: [{nome, volume (L final), og (SG final desejada)}],
   *       evaporacao (% do volume perdido na fervura), eficiencia (%), ppg }
   * A cerveja de maior OG recebe os primeiros mostos (ordem de coleta).
   * O malte é o que dá o total de pontos pedido (Σ volume × OG); cada cerveja
   * então sai um pouco acima ou abaixo do alvo, e `acao` diz como acertar.
   */
  function planejar(p) {
    var e = Math.min(Math.max(Number(p.evaporacao) || 0, 0), 60) / 100;
    var lista = (p.cervejas || []).map(function (c, i) {
      return { indice: i, nome: c.nome || "", volume: Math.max(Number(c.volume) || 0, 0), og: Number(c.og) };
    });
    var validas = lista.length >= 2 && lista.every(function (c) { return c.volume > 0 && c.og > 1; });
    if (!validas) return { valido: false, cervejas: lista };

    var ordem = lista.slice().sort(function (a, b) { return b.og - a.og || a.indice - b.indice; });
    var totalColeta = 0;
    ordem.forEach(function (c) { c.volumeColeta = c.volume / (1 - e); totalColeta += c.volumeColeta; });

    // pontos·litro pedidos (iguais antes e depois da fervura)
    var pontosTotais = lista.reduce(function (a, c) { return a + c.volume * pontos(c.og); }, 0);
    var G = pontosTotais / (totalColeta * (1 - B / 2)); // densidade do primeiro litro, em pontos

    var s = 0;
    ordem.forEach(function (c, k) {
      c.ordem = k + 1;
      c.coletaInicio = s;
      c.coletaFim = s + c.volumeColeta;
      c.pontosColeta = G * mediaTrecho(c.coletaInicio, c.coletaFim, totalColeta);
      c.ogColeta = sg(c.pontosColeta);
      c.pontosPrevistos = c.pontosColeta / (1 - e); // depois da fervura
      c.ogPrevista = sg(c.pontosPrevistos);
      c.acao = acao(c.volume, c.pontosPrevistos, pontos(c.og));
      s = c.coletaFim;
    });

    return {
      valido: true,
      evaporacao: e,
      cervejas: lista,               // na ordem digitada, com os campos acima
      ordemColeta: ordem,            // na ordem de coleta
      totalColeta: totalColeta,
      pontosTotais: pontosTotais,
      ogPrimeiroMosto: sg(G),
      ogUltimoMosto: sg(G * (1 - B)),
      malteKg: malteNecessario(pontosTotais, p.eficiencia, p.ppg),
      sugestao: ordem.length === 2 ? sugestaoDuas(ordem, totalColeta, e) : null
    };
  }

  /*
   * Duas cervejas: como acertar as duas SEM diluir nem ferver mais.
   * - razão de pontos entre 1,75 e 4: basta mudar a divisão dos volumes
   *   (mantendo o total);
   * - abaixo de 1,75 (cervejas parecidas): coletar nas duas panelas e trocar
   *   mosto entre elas;
   * - acima de 4: não dá só coletando.
   */
  function sugestaoDuas(ordem, totalColeta, e) {
    var forte = ordem[0], fraca = ordem[1];
    var r = pontos(forte.og) / pontos(fraca.og);
    if (r >= RAZAO_MIN && r <= RAZAO_MAX) {
      // f = fração da coleta para a 1ª: (1 − B f/2) / (1 − B(1+f)/2) = r
      var f = 2 * (r * (1 - B / 2) - 1) / (B * (r - 1));
      return {
        tipo: "dividir",
        razao: r,
        volumeForte: f * totalColeta * (1 - e),
        volumeFraca: (1 - f) * totalColeta * (1 - e),
        coletaForte: f * totalColeta,
        coletaFraca: (1 - f) * totalColeta
      };
    }
    if (r < RAZAO_MIN) {
      // coleta pelos volumes pedidos; depois cada cerveja leva parte de cada panela
      var alvoF = pontos(forte.og) * (1 - e), alvoW = pontos(fraca.og) * (1 - e); // na coleta
      var m = misturar({
        forte: { volume: forte.volumeColeta, og: forte.ogColeta },
        fraco: { volume: fraca.volumeColeta, og: fraca.ogColeta },
        cervejas: [{ volume: forte.volumeColeta, og: sg(alvoF) }, { volume: fraca.volumeColeta, og: sg(alvoW) }]
      });
      return { tipo: "misturar", razao: r, mistura: m };
    }
    return { tipo: "impossivel", razao: r };
  }

  /*
   * Misturar dois mostos (Craft Beer & Brewing): litros de cada para cada cerveja.
   * m = { forte: {volume, og}, fraco: {volume, og}, cervejas: [{volume, og}] }
   * Alvo abaixo do fraco: completa com água. Acima do forte: impossível.
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
    return { cervejas: cervejas, usadoForte: usadoForte, usadoFraco: usadoFraco,
      sobraForte: sobraForte, sobraFraco: sobraFraco, suficiente: sobraForte > -1e-9 && sobraFraco > -1e-9 };
  }

  /*
   * No dia: o que foi medido em cada panela ANTES da fervura.
   * d = { cervejas: [{volume (L final planejado), og (alvo)}], medidas: [{volume, og}], evaporacao (%) }
   * Para cada uma: OG prevista depois da fervura, ação para acertar e quanto
   * multiplicar o lúpulo (proporcional ao volume final — BYO).
   */
  function noDia(d) {
    var e = Math.min(Math.max(Number(d.evaporacao) || 0, 0), 60) / 100;
    return (d.cervejas || []).map(function (c, i) {
      var med = (d.medidas || [])[i] || {};
      var vMed = Number(med.volume), pMed = pontos(med.og), alvo = pontos(c.og), vPlan = Number(c.volume);
      if (!(vMed > 0) || !(pMed > 0) || !(alvo > 0)) return { problema: "incompleta" };
      var volumeFervido = vMed * (1 - e);
      var pontosDepois = pMed / (1 - e);
      var a = acao(volumeFervido, pontosDepois, alvo);
      return {
        problema: null,
        volumeDepois: volumeFervido,
        ogDepois: sg(pontosDepois),
        acao: a,
        fatorLupulo: vPlan > 0 ? a.volumeFinal / vPlan : 1
      };
    });
  }

  var api = {
    B: B, RAZAO_MIN: RAZAO_MIN, RAZAO_MAX: RAZAO_MAX,
    LITROS_POR_GALAO: LITROS_POR_GALAO, KG_POR_LIBRA: KG_POR_LIBRA, PPG_PARA_PKL: PPG_PARA_PKL,
    pontos: pontos, sg: sg, sgParaPlato: sgParaPlato, mediaTrecho: mediaTrecho,
    malteNecessario: malteNecessario, acao: acao, planejar: planejar, misturar: misturar, noDia: noDia
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.BFPartiGyle = api;
})(typeof self !== "undefined" ? self : this);
