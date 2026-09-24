// Parti-gyle: os casos de teste são os exemplos numéricos publicados nas fontes
// (BYO e Craft Beer & Brewing), convertidos de galão para litro quando preciso.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../calculo.js");

const GAL = P.LITROS_POR_GALAO;
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);

describe("esquemas publicados (BYO, Introduction to Parti-Gyle Brewing)", () => {
  test("cada esquema reparte 100% do volume e 100% dos pontos", () => {
    for (const [id, e] of Object.entries(P.ESQUEMAS)) {
      perto(e.fracVolume.reduce((a, b) => a + b, 0), 1, 1e-9, `${id} volume`);
      perto(e.fracVolume.reduce((a, f, i) => a + f * e.multiplicador[i], 0), 1, 1e-9, `${id} pontos`);
    }
  });

  test("1/3 + 2/3: 15 gal a 1.064 -> 5 gal a 1.096 + 10 gal a 1.048", () => {
    const r = P.planejar({ esquema: "terco-dois-tercos", volume: 15 * GAL, og: 1.064 });
    perto(r.cervejas[0].volume, 5 * GAL, 1e-9, "vol 1");
    perto(r.cervejas[1].volume, 10 * GAL, 1e-9, "vol 2");
    perto(r.cervejas[0].og, 1.096, 1e-9, "OG 1");
    perto(r.cervejas[1].og, 1.048, 1e-9, "OG 2");
  });

  test("1/3 + 2/3: o primeiro mosto tem o dobro da densidade do segundo e metade dos pontos", () => {
    const r = P.planejar({ esquema: "terco-dois-tercos", volume: 30, og: 1.06 });
    perto(r.cervejas[0].pontos, 2 * r.cervejas[1].pontos, 1e-9, "dobro");
    perto(r.cervejas[0].fracPontos, 0.5, 1e-9, "50% dos pontos");
  });

  test("metade/metade: 10 gal a 1.060 -> 1.070 e 1.050 (58% e 42% dos pontos)", () => {
    const r = P.planejar({ esquema: "metade", volume: 10 * GAL, og: 1.06 });
    perto(r.cervejas[0].fracPontos, 0.58, 1e-9, "58%");
    perto(r.cervejas[1].fracPontos, 0.42, 1e-9, "42%");
    assert.equal(Math.round(P.pontos(r.cervejas[0].og)), 70);
    assert.equal(Math.round(P.pontos(r.cervejas[1].og)), 50);
  });

  test("três terços: 6 gal a 1.060 -> 2 gal a 1.090, 1.060 e 1.030", () => {
    const r = P.planejar({ esquema: "tres-tercos", volume: 6 * GAL, og: 1.06 });
    assert.deepEqual(r.cervejas.map((c) => Math.round(P.pontos(c.og))), [90, 60, 30]);
    for (const c of r.cervejas) perto(c.volume, 2 * GAL, 1e-9, "2 gal");
  });

  test("definir pela 1ª cerveja: 1.096 no esquema 1/3 + 2/3 dá média 1.064", () => {
    const r = P.planejar({ esquema: "terco-dois-tercos", volume: 57, og: 1.096, definirPor: "primeira" });
    perto(r.ogMedia, 1.064, 1e-9, "média");
    perto(r.cervejas[0].og, 1.096, 1e-9, "1ª");
  });

  test("pontos totais = volume × pontos médios (e = Σ volume × pontos de cada cerveja)", () => {
    const r = P.planejar({ esquema: "tres-tercos", volume: 30, og: 1.06 });
    perto(r.pontosTotais, 30 * 60, 1e-9, "total");
    perto(r.cervejas.reduce((a, c) => a + c.volume * c.pontos, 0), r.pontosTotais, 1e-9, "soma");
  });

  test("esquema desconhecido dá erro", () => {
    assert.throws(() => P.planejar({ esquema: "xyz", volume: 10, og: 1.05 }));
  });
});

describe("quanto malte (BYO, Parti-Gyle Brewing Techniques)", () => {
  test("1 lb de malte claro por galão a 65% = 24 pontos (37 PPG × 0,65)", () => {
    const kg = P.malteNecessario(24 * GAL, 65, 37);
    perto(kg / P.KG_POR_LIBRA, 0.998, 0.005, "≈ 1 lb");
  });

  test("2 gal a 1.080 + 4 gal a 1.040 = 320 pontos·galão -> ~13 lb de malte a 65%", () => {
    const pontosLitro = (2 * 80 + 4 * 40) * GAL;
    const lb = P.malteNecessario(pontosLitro, 65, 37) / P.KG_POR_LIBRA;
    perto(lb, 13.3, 0.1, "libras");
  });

  test("eficiência 0 não divide por zero", () => {
    assert.equal(P.malteNecessario(1000, 0), 0);
  });
});

describe("misturar mostos (Craft Beer & Brewing, Practical Parti-Gyle Brewing)", () => {
  // 5 gal de mosto forte a 1.080 e 5 gal de fraco a 1.020
  const base = { forte: { volume: 5, og: 1.08 }, fraco: { volume: 5, og: 1.02 } };

  test("IPA 2 gal a 1.070 = 1,67 gal forte + 0,33 gal fraco", () => {
    const [ipa] = P.misturar({ ...base, cervejas: [{ volume: 2, og: 1.07 }] }).cervejas;
    perto(ipa.forte, 1.667, 0.001, "forte");
    perto(ipa.fraco, 0.333, 0.001, "fraco");
    assert.equal(ipa.agua, 0);
  });

  test("Pale Ale 4 gal a 1.050 = 2 + 2 gal", () => {
    const [pa] = P.misturar({ ...base, cervejas: [{ volume: 4, og: 1.05 }] }).cervejas;
    perto(pa.forte, 2, 1e-9, "forte");
    perto(pa.fraco, 2, 1e-9, "fraco");
  });

  test("Saison 4 gal a 1.040 = 1,33 forte + 2,67 fraco", () => {
    const [s] = P.misturar({ ...base, cervejas: [{ volume: 4, og: 1.04 }] }).cervejas;
    perto(s.forte, 1.333, 0.001, "forte");
    perto(s.fraco, 2.667, 0.001, "fraco");
  });

  test("as três juntas usam exatamente os 5 + 5 gal (nada sobra, nada falta)", () => {
    const r = P.misturar({ ...base, cervejas: [{ volume: 2, og: 1.07 }, { volume: 4, og: 1.05 }, { volume: 4, og: 1.04 }] });
    perto(r.usadoForte, 5, 1e-9, "forte");
    perto(r.usadoFraco, 5, 1e-9, "fraco");
    assert.equal(r.suficiente, true);
  });

  test("cada mistura atinge exatamente a densidade pedida", () => {
    const r = P.misturar({ ...base, cervejas: [{ volume: 3, og: 1.055 }, { volume: 2, og: 1.012 }] });
    for (const c of r.cervejas) {
      const pts = (c.forte * 80 + c.fraco * 20) / c.volume;
      perto(pts, P.pontos(c.og), 1e-9, `OG ${c.og}`);
      perto(c.forte + c.fraco + c.agua, c.volume, 1e-9, "volume");
    }
  });

  test("alvo abaixo do mosto fraco: completa com água (2 gal a 1.012 = 1,2 fraco + 0,8 água)", () => {
    const [c] = P.misturar({ ...base, cervejas: [{ volume: 2, og: 1.012 }] }).cervejas;
    perto(c.fraco, 1.2, 1e-9, "fraco");
    perto(c.agua, 0.8, 1e-9, "água");
    assert.equal(c.forte, 0);
  });

  test("alvo acima do mosto forte é impossível só misturando", () => {
    const [c] = P.misturar({ ...base, cervejas: [{ volume: 2, og: 1.09 }] }).cervejas;
    assert.equal(c.problema, "acima-do-forte");
    assert.equal(c.forte + c.fraco + c.agua, 0);
  });

  test("pedir mais do que há de mosto: suficiente = false e sobra negativa", () => {
    const r = P.misturar({ ...base, cervejas: [{ volume: 8, og: 1.07 }] });
    assert.equal(r.suficiente, false);
    assert.ok(r.sobraForte < 0);
  });

  test("mostos com a mesma densidade não travam o cálculo", () => {
    const [c] = P.misturar({ forte: { volume: 5, og: 1.05 }, fraco: { volume: 5, og: 1.05 }, cervejas: [{ volume: 2, og: 1.05 }] }).cervejas;
    assert.equal(c.problema, "mostos-iguais");
  });
});

describe("ajuste quando o primeiro mosto sai diferente (BYO)", () => {
  test("2 gal a 1.100 com alvo 1.080 -> 2,5 gal (diluir 0,5 gal); lúpulo × 1,25", () => {
    const r = P.ajustar(2, 1.1, 1.08);
    perto(r.volumeNoAlvo, 2.5, 1e-9, "volume");
    perto(r.aguaParaDiluir, 0.5, 1e-9, "água");
    perto(r.fatorLupulo, 1.25, 1e-9, "lúpulo");
    assert.equal(r.maisFraco, false);
  });

  test("mosto mais fraco que o alvo: volume menor e aviso", () => {
    const r = P.ajustar(10, 1.075, 1.08);
    assert.ok(r.volumeNoAlvo < 10);
    assert.equal(r.aguaParaDiluir, 0);
    assert.equal(r.maisFraco, true);
  });
});

describe("conversões", () => {
  test("SG 1.064 = 64 pontos e volta", () => {
    perto(P.pontos(1.064), 64, 1e-9, "pontos");
    perto(P.sg(64), 1.064, 1e-12, "sg");
  });
  test("SG 1.050 ≈ 12,39 °P", () => perto(P.sgParaPlato(1.05), 12.387, 0.001, "°P"));
});
