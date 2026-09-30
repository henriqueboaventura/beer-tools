// Parti-gyle: o modelo de coleta e as regras publicadas (BYO; Craft Beer & Brewing).
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../calculo.js");

const GAL = P.LITROS_POR_GALAO;
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);
const og3 = (sg) => sg.toFixed(3);
const plano = (cervejas, extra = {}) => P.planejar({ cervejas, evaporacao: 0, eficiencia: 70, ...extra });

describe("modelo de coleta reproduz as regras da BYO (Introduction to Parti-Gyle Brewing)", () => {
  test("1/3 + 2/3: 15 gal a 1.064 médio -> 5 gal a 1.096 + 10 gal a 1.048, sem ajuste", () => {
    const r = plano([{ volume: 5 * GAL, og: 1.096 }, { volume: 10 * GAL, og: 1.048 }]);
    assert.deepEqual(r.cervejas.map((c) => og3(c.ogPrevista)), ["1.096", "1.048"]);
    assert.deepEqual(r.cervejas.map((c) => c.acao.tipo), ["ok", "ok"]);
  });

  test("1/3 + 2/3: o primeiro terço tem o dobro da densidade do resto (qualquer OG)", () => {
    for (const media of [1.04, 1.064, 1.09]) {
      const pts = P.pontos(media);
      // com as OGs na proporção 2:1 e o mesmo total, o plano não pede ajuste
      const r = plano([{ volume: 10, og: P.sg(1.5 * pts) }, { volume: 20, og: P.sg(0.75 * pts) }]);
      perto(r.cervejas[0].pontosPrevistos, 2 * r.cervejas[1].pontosPrevistos, 1e-9, `média ${media}`);
    }
  });

  test("três terços: 1.090 / 1.060 / 1.030 (1,5× / 1× / 0,5× a média), sem ajuste", () => {
    const r = plano([{ volume: 2 * GAL, og: 1.09 }, { volume: 2 * GAL, og: 1.06 }, { volume: 2 * GAL, og: 1.03 }]);
    assert.deepEqual(r.cervejas.map((c) => og3(c.ogPrevista)), ["1.090", "1.060", "1.030"]);
    assert.ok(r.cervejas.every((c) => c.acao.tipo === "ok"));
  });

  test("limites só coletando: a 1ª de duas sai entre 1,75× e 4× mais densa (em pontos)", () => {
    perto(P.RAZAO_MIN, 1.75, 1e-12, "mínimo");
    perto(P.RAZAO_MAX, 4, 1e-12, "máximo");
    for (const f of [0.01, 0.2, 1 / 3, 0.5, 0.8, 0.99]) {
      const r = P.mediaTrecho(0, f, 1) / P.mediaTrecho(f, 1, 1);
      assert.ok(r > P.RAZAO_MIN && r < P.RAZAO_MAX, `f=${f}: ${r}`);
    }
  });

  test("a densidade dos mostos cai do primeiro ao último litro (último = 1/7 do primeiro)", () => {
    const r = plano([{ volume: 10, og: 1.09 }, { volume: 20, og: 1.045 }]);
    perto(P.pontos(r.ogUltimoMosto), P.pontos(r.ogPrimeiroMosto) / 7, 1e-9, "1/7");
  });
});

describe("quanto malte (BYO, Parti-Gyle Brewing Techniques)", () => {
  test("1 lb de malte claro por galão a 65% = 24 pontos (37 PPG × 0,65)", () => {
    perto(P.malteNecessario(24 * GAL, 65, 37) / P.KG_POR_LIBRA, 0.998, 0.005, "≈ 1 lb");
  });

  test("2 gal a 1.080 + 4 gal a 1.040 = 320 pontos·galão -> ~13 lb a 65%", () => {
    const r = P.planejar({ cervejas: [{ volume: 2 * GAL, og: 1.08 }, { volume: 4 * GAL, og: 1.04 }], evaporacao: 0, eficiencia: 65 });
    perto(r.pontosTotais, 320 * GAL, 1e-9, "pontos");
    perto(r.malteKg / P.KG_POR_LIBRA, 13.3, 0.1, "libras");
  });

  test("eficiência 0 não divide por zero", () => assert.equal(P.malteNecessario(1000, 0), 0));
});

describe("acertar a densidade mantendo os pontos (BYO)", () => {
  test("2 gal a 1.100 com alvo 1.080 -> 2,5 gal: diluir com 0,5 gal", () => {
    const a = P.acao(2, 100, 80);
    assert.equal(a.tipo, "agua");
    perto(a.volumeFinal, 2.5, 1e-9, "volume");
    perto(a.agua, 0.5, 1e-9, "água");
  });

  test("mais fraco que o alvo -> ferver até um volume menor", () => {
    const a = P.acao(10, 45, 50);
    assert.equal(a.tipo, "ferver");
    perto(a.volumeFinal, 9, 1e-9, "volume");
    perto(a.evaporar, 1, 1e-9, "evaporar");
  });

  test("diferença menor que 0,5% do volume conta como ok", () => {
    assert.equal(P.acao(20, 60.1, 60).tipo, "ok");
  });
});

describe("misturar dois mostos (Craft Beer & Brewing, Practical Parti-Gyle Brewing)", () => {
  const base = { forte: { volume: 5, og: 1.08 }, fraco: { volume: 5, og: 1.02 } };

  test("IPA 2 gal a 1.070 = 1,67 forte + 0,33 fraco; Pale 4 gal a 1.050 = 2 + 2; Saison 4 gal a 1.040 = 1,33 + 2,67", () => {
    const r = P.misturar({ ...base, cervejas: [{ volume: 2, og: 1.07 }, { volume: 4, og: 1.05 }, { volume: 4, og: 1.04 }] });
    const partes = r.cervejas.map((c) => [c.forte.toFixed(2), c.fraco.toFixed(2)]);
    assert.deepEqual(partes, [["1.67", "0.33"], ["2.00", "2.00"], ["1.33", "2.67"]]);
    perto(r.usadoForte, 5, 1e-9, "usa todo o forte");
    perto(r.usadoFraco, 5, 1e-9, "usa todo o fraco");
  });

  test("abaixo do fraco completa com água; acima do forte é impossível", () => {
    const r = P.misturar({ ...base, cervejas: [{ volume: 2, og: 1.012 }, { volume: 2, og: 1.09 }] });
    perto(r.cervejas[0].agua, 0.8, 1e-9, "água");
    assert.equal(r.cervejas[1].problema, "acima-do-forte");
  });
});

describe("conversões", () => {
  test("SG 1.064 = 64 pontos e volta", () => {
    perto(P.pontos(1.064), 64, 1e-9, "pontos");
    perto(P.sg(64), 1.064, 1e-12, "sg");
  });
  test("SG 1.050 ≈ 12,39 °P", () => perto(P.sgParaPlato(1.05), 12.387, 0.001, "°P"));
});
