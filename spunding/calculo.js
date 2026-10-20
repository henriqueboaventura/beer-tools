/*
 * Cálculo da ferramenta 05 — Spunding (fermentar sob pressão).
 * Funções puras, sem DOM. Exportadas em window.BFSpunding (navegador) e module.exports
 * (Node, para os testes).
 *
 * A física do CO₂ (equilíbrio pressão × temperatura × volumes, espaço vazio, CO₂ por
 * ponto de densidade) é a da carbonatação: carbonatacao/calculo.js, carregado antes
 * desta, em vez de uma cópia. O que é novo aqui:
 *
 * - grupos de estilo com a pressão de cada fase (Bräu Supply, Pressure Fermentation
 *   Calculator) e a faixa de carbonatação (BYO), com o alvo padrão do Mr Malty;
 * - quando fechar a válvula: o CO₂ para ir da pressão da fase ativa até a final, na
 *   cerveja e no espaço vazio, em pontos de densidade, com 1 ponto de folga;
 * - quanto a cerveja carbonata no quente e a pressão de CO₂ depois do cold crash;
 * - segurança contra a pressão máxima do fermentador.
 *
 * Pressões em bar no manômetro, temperaturas em °C, volumes em L, densidade em SG.
 */
(function (raiz) {
  "use strict";

  var C = typeof module !== "undefined" && module.exports ? require("../carbonatacao/calculo.js") : raiz.BFCarbonatacao;

  // atenção a partir desta fração da pressão máxima do fermentador
  var FRACAO_ATENCAO = 0.8;
  // sem mudança de válvula abaixo desta diferença (bar)
  var DIFERENCA_MINIMA = 0.03;

  /*
   * Grupos de estilo.
   * fases: faixas de pressão (bar) nos 1–2 primeiros dias, na fermentação ativa e no fim
   *   (Bräu Supply, convertidas de psi). [0, 0] = aberto.
   * faixa: carbonatação típica em volumes (BYO; "big", que a BYO não lista, vem da Bräu Supply).
   * alvo: ponto médio do Mr Malty, o mesmo que a carbonatação sugere.
   * uso: "sim" | "moderada" | "leve" | "fim" (fermente aberto e feche só no fim).
   */
  var GRUPOS = [
    { id: "lager", nome: "Lager fermentada quente", exemplos: "Pilsner, helles, märzen, vienna, lager mexicana",
      tempC: 18, fases: [[0, 0.15], [0.7, 1.0], [0.8, 1.0]], faixa: [2.4, 2.8], alvo: 2.6, uso: "sim",
      porque: "O melhor caso para pressão: 0,7 a 1 bar mantém a levedura lager limpa a 17–20 °C, e a cerveja fica pronta em cerca de duas semanas em vez de seis." },
    { id: "limpa", nome: "Kölsch, cream ale e blonde ale", exemplos: "Ales limpas, que você quer secas e neutras",
      tempC: 18, fases: [[0, 0.05], [0.35, 0.7], [0.55, 0.8]], faixa: [2.4, 2.8], alvo: 2.5, uso: "sim",
      porque: "A pressão segura os ésteres: a ale limpa continua limpa mesmo se o fermentador esquentar alguns graus." },
    { id: "lupulada", nome: "Pale ale, IPA e hazy IPA", exemplos: "Qualquer ale com lúpulo em destaque",
      tempC: 19, fases: [[0, 0.05], [0.35, 0.55], [0.55, 0.7]], faixa: [2.2, 2.7], alvo: 2.5, uso: "moderada", lupulo: true,
      porque: "Pressão moderada no meio da fermentação mantém o aroma do lúpulo na cerveja em vez de ele sair com o CO₂. Pressão demais atrapalha a biotransformação: fique perto de 0,35–0,55 bar até o último dry hop." },
    { id: "maltada", nome: "Amber, brown, red e scottish ale", exemplos: "Ales com o malte em destaque",
      tempC: 19, fases: [[0, 0.05], [0.15, 0.3], [0.35, 0.55]], faixa: [2.2, 2.7], alvo: 2.3, uso: "leve",
      porque: "Aceitam bem pressão leve. Mantenha baixa enquanto a levedura trabalha mais e feche perto do fim." },
    { id: "escura", nome: "Stout e porter", exemplos: "Dry stout, oatmeal stout, robust porter",
      tempC: 19, fases: [[0, 0.05], [0.3, 0.4], [0.4, 0.55]], faixa: [1.5, 2.3], alvo: 2.1, uso: "moderada",
      porque: "Pressão moderada combina com cervejas escuras e pode suavizar o torrado áspero." },
    { id: "forte", nome: "Cervejas fortes", exemplos: "Imperial stout, barleywine, double IPA, strong ale",
      tempC: 18, fases: [[0, 0.05], [0.3, 0.4], [0.4, 0.55]], faixa: [2.0, 2.3], fonteFaixa: "Bräu Supply", alvo: 2.2, uso: "sim",
      porque: "A pressão reduz os álcoois superiores que deixam a cerveja forte \"quente\" quando nova. Use bastante levedura saudável: levedura estressada com pressão cedo pode travar a fermentação." },
    { id: "inglesa", nome: "Inglesas", exemplos: "Bitter, ESB, mild, English IPA",
      tempC: 19, fases: [[0, 0], [0, 0], [0.05, 0.15]], faixa: [1.0, 2.2], alvo: 1.9, uso: "fim",
      porque: "A levedura inglesa faz os ésteres frutados desses estilos, e a pressão achata isso. Deixe a válvula aberta até o fim e feche só para carbonatar e proteger do oxigênio." },
    { id: "belga", nome: "Belgas e saison", exemplos: "Saison, dubbel, tripel, belgian blond",
      tempC: 20, fases: [[0, 0], [0, 0], [0.05, 0.15]], faixa: [2.4, 4.5], alvo: 3.0, uso: "fim",
      porque: "As leveduras belgas e de saison tiram a fruta e o condimentado dos ésteres e fenóis, e a pressão apaga isso. Fermente aberto até quase o fim." },
    { id: "trigo", nome: "Weizen e witbier", exemplos: "Hefeweizen, dunkelweizen, witbier",
      tempC: 18, fases: [[0, 0], [0, 0], [0.05, 0.2]], faixa: [3.0, 5.1], alvo: 3.5, uso: "fim",
      porque: "Banana e cravo vêm de ésteres e fenóis que a pressão segura. Fermente aberto e feche perto do fim." }
  ];

  /*
   * Fermentadores: pressão máxima de trabalho (bar) e capacidade padrão (L).
   * Confirme sempre na placa ou no manual do seu.
   */
  var FERMENTADORES = {
    "pet": { nome: "Fermzilla / PET pressurizável", maxBar: 2.4, capacidade: 30,
      nota: "Fermentadores de PET pressurizáveis, como o Fermzilla, trabalham até 2,4 bar. Confira no manual do seu." },
    "corny": { nome: "Barril corny", maxBar: 4.0, capacidade: 19,
      nota: "A válvula de alívio do barril abre por volta de 4 bar. Sobra pouco espaço para o krausen: encha menos." },
    "inox": { nome: "Inox pressurizável (unitank)", maxBar: 2.0, capacidade: 30,
      nota: "Varia muito de fabricante para fabricante: muitos trabalham a 2 bar com válvula de alívio de 1 bar. Use o valor da placa do seu." },
    "outro": { nome: "Outro", maxBar: null, capacidade: null,
      nota: "Balde, garrafão e a maioria dos fermentadores de plástico não aguentam pressão. Só use um fermentador com pressão de trabalho declarada e válvula de alívio." }
  };

  // campo vazio é "não informado", não zero
  function num(v) { if (v === "" || v === null || v === undefined) return NaN; var n = Number(v); return isFinite(n) ? n : NaN; }

  function grupoPorId(id) {
    for (var i = 0; i < GRUPOS.length; i++) if (GRUPOS[i].id === id) return GRUPOS[i];
    return GRUPOS[0];
  }

  // pressão final sugerida: o topo da faixa do fim, sem passar do fermentador
  function pressaoFinalSugerida(grupo, maxBar) {
    var p = grupo.fases[2][1];
    return maxBar > 0 ? Math.min(p, maxBar) : p;
  }

  // volumes dissolvidos com a válvula em `bar` a tempC (aberto = 0 bar)
  function volumes(bar, tempC) { return C.co2PelaPressao(Math.max(bar, 0), tempC); }

  /*
   * Pontos de densidade que a fermentação precisa para ir de `de` até `ate` bar:
   * o CO₂ que a cerveja absorve mais o que o espaço vazio precisa para chegar na
   * nova pressão (lei dos gases).
   */
  function pontosParaSubir(de, ate, litros, espacoVazio, tempC) {
    var naCerveja = Math.max(volumes(ate, tempC) - volumes(de, tempC), 0) * C.G_POR_VOL_L * litros;
    var noEspaco = C.hEspaco(Math.max(espacoVazio, 0), tempC) * Math.max(ate - de, 0) * C.PSI_POR_BAR;
    return (naCerveja + noEspaco) / (C.CO2_POR_PONTO_GL * litros);
  }

  /*
   * p = {
   *   grupo: id de GRUPOS, fermentador: chave de FERMENTADORES, maxBar, capacidade (L),
   *   litros, og, fg (SG), tempC (fermentação), pressaoFinal (bar), alvo (vol),
   *   tempFria (°C do cold crash), agoraTemp, agoraBar (opcional: "meu fermentador agora")
   * }
   */
  function calcular(p) {
    var grupo = grupoPorId(p.grupo);
    var ferm = FERMENTADORES[p.fermentador] || FERMENTADORES.outro;
    var litros = num(p.litros), og = num(p.og), fg = num(p.fg), tempC = num(p.tempC);
    var ps = num(p.pressaoFinal), alvo = num(p.alvo), tempFria = num(p.tempFria);
    var maxBar = num(p.maxBar), capacidade = num(p.capacidade);
    var r = { valido: false, grupo: grupo, fermentador: ferm };

    if (!(litros > 0) || !isFinite(tempC) || !(ps >= 0) || !(alvo > 0) || !isFinite(tempFria)) { r.erro = "campos"; return r; }
    if (!(og > 1 && fg >= 0.99 && fg < og)) { r.erro = "densidade"; return r; }

    var vazio = capacidade > 0 ? Math.max(capacidade - litros, 0) : 0;
    var pm = Math.min(grupo.fases[1][0], ps);              // pressão da fase ativa (o piso da faixa)
    var sobe = ps > pm + DIFERENCA_MINIMA;
    var pontosDisponiveis = Math.round((og - fg) * 10000) / 10;   // 1.012 − 1.010 = 2 pontos, sem o 1,9999 do ponto flutuante

    r.valido = true;
    r.litros = litros;
    r.espacoVazio = vazio;
    r.og = og;
    r.fg = fg;
    r.tempC = tempC;
    r.tempFria = tempFria;
    r.alvo = alvo;
    r.pressaoAtiva = pm;
    r.pressaoFinal = ps;
    r.sobe = sobe;
    r.volumesAtiva = volumes(pm, tempC);
    r.volumesQuente = volumes(ps, tempC);

    // quando fechar a válvula: arredonda para cima, +1 de folga, no mínimo 2, sem passar da OG
    r.pontos = sobe ? pontosParaSubir(pm, ps, litros, vazio, tempC) : 0;
    var subir = Math.max(Math.ceil(r.pontos - 1e-9) + 1, 2);
    if (subir > pontosDisponiveis) subir = Math.floor(pontosDisponiveis);
    r.pontosSubir = sobe ? subir : 0;
    r.densidadeSubir = sobe ? fg + subir / 1000 : NaN;
    r.subirNaInoculacao = sobe && subir >= pontosDisponiveis;

    // carbonatação: no quente com a válvula, e o que falta no frio
    r.pressaoAlvoQuente = Math.max(C.pressaoParaVolumes(alvo, tempC), 0);
    r.pronta = r.volumesQuente >= alvo - 0.05;
    r.pressaoFria = Math.max(C.pressaoParaVolumes(alvo, tempFria), 0);
    // no cold crash, CO₂ ligado na pressão da válvula, sem passar da que dá o alvo no frio
    r.pressaoCrash = Math.min(ps, r.pressaoFria);

    // segurança: a maior pressão do plano contra o máximo do fermentador
    r.maxBar = maxBar > 0 ? maxBar : NaN;
    r.pressaoMaxPlano = Math.max(ps, r.pressaoFria);
    if (!(maxBar > 0)) r.risco = "desconhecido";
    else if (r.pressaoMaxPlano > maxBar + 1e-9) r.risco = "perigo";
    else if (r.pressaoMaxPlano > FRACAO_ATENCAO * maxBar + 1e-9) r.risco = "atencao";
    else r.risco = "ok";
    r.alvoQuentePassaMax = maxBar > 0 && r.pressaoAlvoQuente > maxBar;

    // avisos (códigos; o texto fica na interface)
    var a = [];
    if (grupo.uso === "fim" && ps > grupo.fases[2][1] + 0.01) a.push("esteres");
    if (grupo.id === "lager" && tempC > 20.5) a.push("lager-quente");
    if (grupo.id === "lager" && tempC < 13) a.push("lager-fria");
    if (grupo.id === "forte" && og >= 1.080) a.push("forte");
    if (capacidade > 0 && capacidade < litros) a.push("capacidade");
    else if (capacidade > 0 && capacidade < litros * 1.1) a.push("krausen");
    if (alvo > 3.5) a.push("garrafa");
    r.avisos = a;

    // meu fermentador agora
    var at = num(p.agoraTemp), ab = num(p.agoraBar);
    r.agora = isFinite(at) && ab >= 0 ? { volumes: volumes(ab, at), falta: Math.max(alvo - volumes(ab, at), 0) } : null;

    // tabela de carbonatação para o alvo
    r.tabela = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(function (t) {
      return { tempC: t, bar: Math.max(C.pressaoParaVolumes(alvo, t), 0) };
    });
    return r;
  }

  var api = {
    GRUPOS: GRUPOS, FERMENTADORES: FERMENTADORES, FRACAO_ATENCAO: FRACAO_ATENCAO,
    grupoPorId: grupoPorId, pressaoFinalSugerida: pressaoFinalSugerida, volumes: volumes,
    pontosParaSubir: pontosParaSubir, calcular: calcular
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.BFSpunding = api;
})(typeof self !== "undefined" ? self : this);
