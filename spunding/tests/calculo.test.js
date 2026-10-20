/*
 * Testes do cálculo da ferramenta 05 — Spunding.
 * A física vem da carbonatação (Mr Malty, conferida na spec 06). Os cenários da
 * Bräu Supply (Pressure Fermentation Calculator, bs-calc.js, 2026-10-20) foram
 * convertidos de °F/psi/galões; a fórmula de pressão dela (Zahm & Nagel) dá até
 * 5% menos pressão no quente, por isso a tolerância.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../calculo.js");
const C = require("../../carbonatacao/calculo.js");

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} ${a} ≠ ${b} (±${tol})`);
const base = { grupo: "lager", fermentador: "pet", maxBar: 2.4, capacidade: 30, litros: 20, og: 1.048, fg: 1.010,
  tempC: 18, pressaoFinal: 1.0, alvo: 2.6, tempFria: 2 };
const calc = (mudar) => S.calcular({ ...base, ...mudar });
const PSI = 0.0689476;
const fParaC = (f) => (f - 32) / 1.8;

describe("física da carbonatação", () => {
  test("volumes e pressões iguais aos da carbonatação", () => {
    const r = calc({});
    assert.equal(r.volumesQuente, C.co2PelaPressao(1.0, 18));
    assert.equal(r.pressaoFria, C.pressaoParaVolumes(2.6, 2));
    assert.equal(r.pressaoAlvoQuente, C.pressaoParaVolumes(2.6, 18));
  });

  test("2,5 vol a 20 °C pedem cerca de 2 bar; a 2 °C, cerca de 0,7 bar", () => {
    perto(C.pressaoParaVolumes(2.5, 20), 2.0, 0.01);
    perto(C.pressaoParaVolumes(2.5, 2), 0.69, 0.01);
  });

  test("bate com a tabela da Bräu Supply no frio e fica até 5% acima no quente", () => {
    // carbPsi(T °F, vol) da Bräu Supply
    const carbPsi = (T, V) => -16.6999 - 0.0101059 * T + 0.00116512 * T * T + 0.173354 * T * V + 4.24267 * V - 0.0684226 * V * V;
    for (const [f, v] of [[32, 2.5], [36, 2.5], [40, 2.4], [50, 2.6]]) perto(C.pressaoParaVolumes(v, fParaC(f)), carbPsi(f, v) * PSI, 0.03, `${f} °F ${v} vol`);
    for (const [f, v] of [[64, 2.5], [68, 2.5], [68, 2.0]]) {
      const nos = C.pressaoParaVolumes(v, fParaC(f)), ela = carbPsi(f, v) * PSI;
      assert.ok(nos >= ela && nos <= ela * 1.06, `${f} °F ${v} vol: ${nos} × ${ela}`);
    }
  });

  test("cada ponto de densidade gera cerca de 0,5 volume (Bräu Supply: 0,49)", () => {
    perto(C.CO2_POR_PONTO_GL / C.G_POR_VOL_L, 0.5, 0.01);
  });
});

describe("quando subir a válvula", () => {
  test("sem espaço vazio: só o CO₂ que a cerveja absorve", () => {
    const pts = S.pontosParaSubir(0, 2.0, 20, 0, 20);
    const esperado = (C.co2PelaPressao(2.0, 20) - C.co2PelaPressao(0, 20)) * C.G_POR_VOL_L / C.CO2_POR_PONTO_GL;
    perto(pts, esperado, 1e-9);
    perto(pts, 3.3, 0.1);
  });

  test("o espaço vazio pede mais pontos", () => {
    const sem = S.pontosParaSubir(0, 2.0, 20, 0, 20), com = S.pontosParaSubir(0, 2.0, 20, 10, 20);
    assert.ok(com > sem);
    perto(com - sem, C.hEspaco(10, 20) * 2.0 * C.PSI_POR_BAR / (C.CO2_POR_PONTO_GL * 20), 1e-9);
  });

  test("arredonda para cima e soma 1 ponto de folga", () => {
    const r = calc({ grupo: "limpa", pressaoFinal: 0.8 });
    assert.equal(r.pressaoAtiva, 0.35);
    assert.equal(r.pontosSubir, Math.ceil(r.pontos) + 1);
    perto(r.densidadeSubir, 1.010 + r.pontosSubir / 1000, 1e-9);
  });

  test("no mínimo 2 pontos", () => {
    const r = calc({ capacidade: 20 }); // lager: de 0,7 a 1,0 bar sem espaço vazio
    assert.ok(r.pontos < 1);
    assert.equal(r.pontosSubir, 2);
  });

  test("nunca acima da densidade inicial: sobe desde o começo", () => {
    const r = calc({ grupo: "inglesa", og: 1.012, fg: 1.010, pressaoFinal: 2.0 });
    assert.equal(r.pontosSubir, 2);
    assert.ok(r.subirNaInoculacao);
  });

  test("sem diferença de pressão, não sobe", () => {
    const r = calc({ pressaoFinal: 0.7 });
    assert.equal(r.sobe, false);
    assert.equal(r.pontosSubir, 0);
    assert.ok(Number.isNaN(r.densidadeSubir));
  });

  test("a fase ativa nunca passa da pressão final", () => {
    assert.equal(calc({ pressaoFinal: 0.5 }).pressaoAtiva, 0.5);
  });
});

describe("carbonatação no quente e no frio", () => {
  test("lager a 1 bar e 18 °C não chega em 2,6: completa no frio", () => {
    const r = calc({});
    assert.equal(r.pronta, false);
    assert.ok(r.volumesQuente < 2);
    perto(r.pressaoFria, 0.76, 0.02);
    assert.equal(r.pressaoCrash, Math.min(1.0, r.pressaoFria));
  });

  test("pressão alta no quente: já está carbonatada", () => {
    const r = calc({ pressaoFinal: 2.2, alvo: 2.5, tempC: 18 });
    assert.ok(r.volumesQuente >= 2.45);
    assert.equal(r.pronta, true);
  });

  test("alvo no quente acima do fermentador", () => {
    assert.equal(calc({ alvo: 3.5, tempC: 20 }).alvoQuentePassaMax, true);
    assert.equal(calc({ alvo: 2.0, tempC: 4 }).alvoQuentePassaMax, false);
  });

  test("tabela de carbonatação de 0 a 20 °C", () => {
    const r = calc({});
    assert.deepEqual(r.tabela.map((x) => x.tempC), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    for (const x of r.tabela) perto(x.bar, Math.max(C.pressaoParaVolumes(2.6, x.tempC), 0), 1e-12);
  });
});

describe("meu fermentador agora", () => {
  test("volumes pela temperatura e pelo manômetro", () => {
    const r = calc({ agoraTemp: 2, agoraBar: 0.7 });
    perto(r.agora.volumes, C.co2PelaPressao(0.7, 2), 1e-12);
    perto(r.agora.falta, Math.max(2.6 - r.agora.volumes, 0), 1e-12);
  });
  test("sem os dois campos, nada", () => {
    assert.equal(calc({ agoraTemp: 2 }).agora, null);
    assert.equal(calc({ agoraTemp: "", agoraBar: "" }).agora, null);
  });
});

describe("segurança", () => {
  test("ok, atenção a partir de 80% do máximo e perigo acima do máximo", () => {
    assert.equal(calc({ pressaoFinal: 1.0, maxBar: 2.4 }).risco, "ok");
    assert.equal(calc({ pressaoFinal: 2.0, maxBar: 2.4 }).risco, "atencao");
    assert.equal(calc({ pressaoFinal: 2.6, maxBar: 2.4 }).risco, "perigo");
  });
  test("conta a pressão do frio quando ela é a maior do plano", () => {
    const r = calc({ grupo: "trigo", pressaoFinal: 0.2, alvo: 4.0, maxBar: 1.0 });
    assert.equal(r.pressaoMaxPlano, r.pressaoFria);
    assert.equal(r.risco, "perigo");
  });
  test("sem pressão máxima, não dá para conferir", () => {
    assert.equal(calc({ maxBar: "" }).risco, "desconhecido");
  });
});

describe("avisos", () => {
  const avisos = (m) => calc(m).avisos;
  test("estilo de ésteres com pressão alta antes do fim", () => {
    assert.ok(avisos({ grupo: "belga", pressaoFinal: 0.5 }).includes("esteres"));
    assert.ok(!avisos({ grupo: "belga", pressaoFinal: 0.15 }).includes("esteres"));
  });
  test("lager quente e lager fria", () => {
    assert.ok(avisos({ tempC: 22 }).includes("lager-quente"));
    assert.ok(avisos({ tempC: 10 }).includes("lager-fria"));
    assert.deepEqual(avisos({}), []);
  });
  test("cerveja forte", () => assert.ok(avisos({ grupo: "forte", og: 1.090 }).includes("forte")));
  test("pouco espaço para o krausen e cerveja que não cabe", () => {
    assert.ok(avisos({ capacidade: 21 }).includes("krausen"));
    assert.ok(avisos({ capacidade: 18 }).includes("capacidade"));
  });
  test("alvo acima de 3,5 lembra da garrafa", () => assert.ok(avisos({ alvo: 3.8 }).includes("garrafa")));
});

describe("grupos e fermentadores", () => {
  test("cada grupo tem fases crescentes, faixa e alvo dentro da faixa ou perto", () => {
    for (const g of S.GRUPOS) {
      assert.equal(g.fases.length, 3, g.id);
      for (const f of g.fases) assert.ok(f[0] <= f[1], g.id);
      assert.ok(g.fases[0][1] <= g.fases[2][1] && g.fases[1][0] <= g.fases[2][1], g.id);
      assert.ok(g.alvo >= g.faixa[0] - 0.2 && g.alvo <= g.faixa[1], g.id);
      assert.ok(["sim", "moderada", "leve", "fim"].includes(g.uso), g.id);
    }
  });
  test("estilos de ésteres ficam abertos até o fim", () => {
    for (const g of S.GRUPOS.filter((x) => x.uso === "fim")) assert.deepEqual(g.fases.slice(0, 2), [[0, 0], [0, 0]], g.id);
  });
  test("pressão final sugerida não passa do fermentador", () => {
    assert.equal(S.pressaoFinalSugerida(S.grupoPorId("lager"), 2.4), 1.0);
    assert.equal(S.pressaoFinalSugerida(S.grupoPorId("lager"), 0.6), 0.6);
  });
  test("fermentadores confirmados: Fermzilla 2,4 bar, corny 4 bar", () => {
    assert.equal(S.FERMENTADORES.pet.maxBar, 2.4);
    assert.equal(S.FERMENTADORES.corny.maxBar, 4.0);
  });
});

describe("entradas inválidas", () => {
  test("densidade inicial menor que a final", () => {
    const r = calc({ og: 1.008 });
    assert.equal(r.valido, false);
    assert.equal(r.erro, "densidade");
  });
  test("campo vazio", () => assert.equal(calc({ litros: "" }).valido, false));
});
