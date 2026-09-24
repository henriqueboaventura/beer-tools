// Parti-gyle: cenários de uso (os mesmos do roteiro de teste manual) e
// invariantes que precisam valer para QUALQUER entrada.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../calculo.js");

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);
const og3 = (sg) => sg.toFixed(3);

// gerador pseudoaleatório com semente fixa: os casos são sempre os mesmos
function aleatorio(semente) {
  let s = semente >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const entre = (r, a, b) => a + r() * (b - a);

describe("roteiro — 01 Planejar (57 L a 1.064)", () => {
  const base = { volume: 57, og: 1.064 };

  test("1/3 + 2/3: 1.096 com 19 L e 1.048 com 38 L", () => {
    const r = P.planejar({ ...base, esquema: "terco-dois-tercos" });
    assert.deepEqual(r.cervejas.map((c) => og3(c.og)), ["1.096", "1.048"]);
    perto(r.cervejas[0].volume, 19, 1e-9, "vol 1");
    perto(r.cervejas[1].volume, 38, 1e-9, "vol 2");
  });

  test("16,9 kg de malte a 70% e 37 PPG; 18,2 kg a 65%", () => {
    const r = P.planejar({ ...base, esquema: "terco-dois-tercos" });
    assert.equal(P.malteNecessario(r.pontosTotais, 70, 37).toFixed(1), "16.9");
    assert.equal(P.malteNecessario(r.pontosTotais, 65, 37).toFixed(1), "18.2");
  });

  test("metade/metade: 1.074 e 1.054, 28,5 L cada", () => {
    const r = P.planejar({ ...base, esquema: "metade" });
    assert.deepEqual(r.cervejas.map((c) => og3(c.og)), ["1.074", "1.054"]);
    for (const c of r.cervejas) perto(c.volume, 28.5, 1e-9, "vol");
  });

  test("três terços: 1.096 / 1.064 / 1.032, 19 L cada", () => {
    const r = P.planejar({ ...base, esquema: "tres-tercos" });
    assert.deepEqual(r.cervejas.map((c) => og3(c.og)), ["1.096", "1.064", "1.032"]);
    for (const c of r.cervejas) perto(c.volume, 19, 1e-9, "vol");
  });

  test("definir pela 1ª cerveja (1.096) dá exatamente o mesmo plano que a média 1.064", () => {
    const porMedia = P.planejar({ ...base, esquema: "terco-dois-tercos" });
    const porPrimeira = P.planejar({ volume: 57, og: 1.096, definirPor: "primeira", esquema: "terco-dois-tercos" });
    porMedia.cervejas.forEach((c, i) => perto(porPrimeira.cervejas[i].pontos, c.pontos, 1e-9, `cerveja ${i + 1}`));
  });
});

describe("roteiro — 02 No dia (19 L a 1.080 + 19 L a 1.020)", () => {
  const mostos = { forte: { volume: 19, og: 1.08 }, fraco: { volume: 19, og: 1.02 } };
  const alvos = [{ volume: 7.5, og: 1.07 }, { volume: 15, og: 1.05 }, { volume: 15, og: 1.04 }];

  test("valores iniciais: 6,25 + 1,25 / 7,50 + 7,50 / 5,00 + 10,00; sobram 0,25 L de cada", () => {
    const r = P.misturar({ ...mostos, cervejas: alvos });
    const partes = r.cervejas.map((c) => [c.forte.toFixed(2), c.fraco.toFixed(2), c.agua.toFixed(2)]);
    assert.deepEqual(partes, [["6.25", "1.25", "0.00"], ["7.50", "7.50", "0.00"], ["5.00", "10.00", "0.00"]]);
    perto(r.sobraForte, 0.25, 1e-9, "sobra forte");
    perto(r.sobraFraco, 0.25, 1e-9, "sobra fraco");
    assert.equal(r.suficiente, true);
  });

  test("cerveja 3 a 1.012: fraco 9,00 L + água 6,00 L", () => {
    const r = P.misturar({ ...mostos, cervejas: [alvos[0], alvos[1], { volume: 15, og: 1.012 }] });
    const c = r.cervejas[2];
    assert.deepEqual([c.forte, c.fraco.toFixed(2), c.agua.toFixed(2)], [0, "9.00", "6.00"]);
  });

  test("cerveja 1 a 1.090: impossível, mais densa que o mosto forte", () => {
    const r = P.misturar({ ...mostos, cervejas: [{ volume: 7.5, og: 1.09 }, alvos[1], alvos[2]] });
    assert.equal(r.cervejas[0].problema, "acima-do-forte");
    assert.equal(r.cervejas[1].problema, null, "as outras continuam calculadas");
  });

  test("cerveja 2 com 30 L: falta mosto", () => {
    const r = P.misturar({ ...mostos, cervejas: [alvos[0], { volume: 30, og: 1.05 }, alvos[2]] });
    assert.equal(r.suficiente, false);
    assert.ok(r.sobraForte < 0 && r.sobraFraco < 0);
  });
});

describe("roteiro — 03 Primeiro mosto diferente (7,5 L)", () => {
  test("a 1.100 com alvo 1.080: rende 9,38 L, +1,88 L de água, lúpulo × 1,25", () => {
    const r = P.ajustar(7.5, 1.1, 1.08);
    assert.deepEqual([r.volumeNoAlvo.toFixed(2), r.aguaParaDiluir.toFixed(2), r.fatorLupulo.toFixed(2)], ["9.38", "1.88", "1.25"]);
  });

  test("a 1.075 com alvo 1.080: mais fraco que o alvo", () => {
    assert.equal(P.ajustar(7.5, 1.075, 1.08).maisFraco, true);
  });
});

describe("invariantes — planejar (500 casos aleatórios)", () => {
  const r = aleatorio(20260924);
  const casos = Array.from({ length: 500 }, () => ({
    esquema: Object.keys(P.ESQUEMAS)[Math.floor(r() * 3)],
    volume: entre(r, 5, 200),
    og: 1 + entre(r, 20, 120) / 1000,
    definirPor: r() < 0.5 ? "media" : "primeira",
  }));

  test("volumes somam o total, pontos se conservam, 1ª cerveja é a mais forte e a densidade cai em ordem", () => {
    for (const p of casos) {
      const res = P.planejar(p);
      const vol = res.cervejas.reduce((a, c) => a + c.volume, 0);
      const pts = res.cervejas.reduce((a, c) => a + c.volume * c.pontos, 0);
      perto(vol, p.volume, 1e-6, `volume ${JSON.stringify(p)}`);
      perto(pts, res.pontosTotais, 1e-6, `pontos ${JSON.stringify(p)}`);
      for (let i = 1; i < res.cervejas.length; i++) {
        assert.ok(res.cervejas[i].og < res.cervejas[i - 1].og, `ordem ${JSON.stringify(p)}`);
      }
      if (p.definirPor === "primeira") perto(res.cervejas[0].og, p.og, 1e-9, "1ª = informada");
      else perto(res.ogMedia, p.og, 1e-9, "média = informada");
    }
  });

  test("malte é proporcional aos pontos e inversamente à eficiência", () => {
    for (const p of casos.slice(0, 100)) {
      const pts = P.planejar(p).pontosTotais;
      perto(P.malteNecessario(2 * pts, 70), 2 * P.malteNecessario(pts, 70), 1e-9, "dobro");
      perto(P.malteNecessario(pts, 50), P.malteNecessario(pts, 100) * 2, 1e-9, "metade da eficiência");
    }
  });
});

describe("invariantes — misturar (500 casos aleatórios)", () => {
  const r = aleatorio(4242);

  test("cada cerveja possível sai exatamente na densidade e no volume pedidos, sem litros negativos", () => {
    for (let k = 0; k < 500; k++) {
      const fraco = { volume: entre(r, 5, 60), og: 1 + entre(r, 5, 40) / 1000 };
      const forte = { volume: entre(r, 5, 60), og: fraco.og + entre(r, 5, 80) / 1000 };
      const cervejas = Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({
        volume: entre(r, 1, 30),
        og: 1 + entre(r, 1, P.pontos(forte.og)) / 1000,
      }));
      const res = P.misturar({ forte, fraco, cervejas });
      let usadoF = 0, usadoW = 0;
      for (const c of res.cervejas) {
        assert.equal(c.problema, null, `caso ${k}`);
        assert.ok(c.forte >= -1e-9 && c.fraco >= -1e-9 && c.agua >= -1e-9, `negativo no caso ${k}`);
        perto(c.forte + c.fraco + c.agua, c.volume, 1e-9, `volume caso ${k}`);
        const pts = (c.forte * P.pontos(forte.og) + c.fraco * P.pontos(fraco.og)) / c.volume;
        perto(pts, P.pontos(c.og), 1e-6, `densidade caso ${k}`);
        if (c.agua > 1e-9) assert.equal(c.forte, 0, `água só entra sem mosto forte (caso ${k})`);
        usadoF += c.forte; usadoW += c.fraco;
      }
      perto(res.usadoForte, usadoF, 1e-9, "total forte");
      perto(res.usadoFraco, usadoW, 1e-9, "total fraco");
      perto(res.sobraForte, forte.volume - usadoF, 1e-9, "sobra forte");
      assert.equal(res.suficiente, res.sobraForte > -1e-9 && res.sobraFraco > -1e-9);
    }
  });

  test("alvo acima do mosto forte é sempre recusado, e não consome mosto", () => {
    for (let k = 0; k < 100; k++) {
      const forte = { volume: 20, og: 1 + entre(r, 40, 90) / 1000 };
      const res = P.misturar({ forte, fraco: { volume: 20, og: 1.02 }, cervejas: [{ volume: 10, og: forte.og + 0.001 }] });
      assert.equal(res.cervejas[0].problema, "acima-do-forte");
      assert.equal(res.usadoForte + res.usadoFraco, 0);
    }
  });

  test("entradas vazias ou inválidas não geram NaN", () => {
    const res = P.misturar({ forte: { volume: "", og: "" }, fraco: { volume: "", og: "" }, cervejas: [{ volume: "", og: "" }] });
    assert.equal(res.cervejas[0].problema, "incompleta");
    for (const v of [res.usadoForte, res.usadoFraco, res.sobraForte, res.sobraFraco]) assert.ok(!Number.isNaN(v));
  });
});

describe("invariantes — ajustar (300 casos aleatórios)", () => {
  const r = aleatorio(7);

  test("os pontos se conservam: volume × pontos = volume no alvo × pontos do alvo", () => {
    for (let k = 0; k < 300; k++) {
      const v = entre(r, 1, 40), og = 1 + entre(r, 20, 120) / 1000, alvo = 1 + entre(r, 20, 120) / 1000;
      const res = P.ajustar(v, og, alvo);
      perto(res.volumeNoAlvo * P.pontos(alvo), v * P.pontos(og), 1e-6, `caso ${k}`);
      assert.equal(res.maisFraco, og < alvo);
      assert.ok(res.aguaParaDiluir >= 0);
      perto(res.fatorLupulo, res.volumeNoAlvo / v, 1e-9, "fator do lúpulo");
    }
  });
});
