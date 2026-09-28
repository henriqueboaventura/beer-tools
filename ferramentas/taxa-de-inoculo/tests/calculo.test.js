/*
 * Testes do cálculo da ferramenta 05 — Taxa de inóculo.
 * Os valores esperados vêm das fontes (Brewers Friend, Mr Malty, Braukaiser)
 * e estão citados em cada teste.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const I = require("../calculo.js");

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} ${a} ≠ ${b} (±${tol})`);
const plato = (sg) => I.sgParaPlato(sg);

describe("quanto precisa", () => {
  test("20 L a 1.050, ale (0,75): 186 bi — igual ao Mr Malty", () => {
    perto(I.celulasNecessarias(20, plato(1.05), 0.75), 186, 0.5);
  });
  test("lager pede o dobro da ale", () => {
    assert.equal(I.celulasNecessarias(20, 12, 1.5), 2 * I.celulasNecessarias(20, 12, 0.75));
  });
  test("entradas vazias ou zero dão NaN", () => {
    assert.ok(isNaN(I.celulasNecessarias(0, 12, 0.75)));
    assert.ok(isNaN(I.celulasNecessarias(20, "", 0.75)));
    assert.ok(isNaN(I.celulasNecessarias(20, 12, 0)));
  });
  test("taxa obtida é o inverso: 186 bi em 20 L a 12,39 °P = 0,75", () => {
    perto(I.taxaObtida(185.8, 20, plato(1.05)), 0.75, 0.001);
  });
  test("SG ↔ °P ida e volta", () => {
    for (const sg of [1.030, 1.050, 1.080, 1.100]) perto(I.platoParaSg(plato(sg)), sg, 0.0005, String(sg));
  });
});

describe("o que você tem", () => {
  test("líquida com 44 dias: 69% de viabilidade (exemplo do Brewers Friend)", () => {
    perto(I.viabilidadeLiquida(44), 69, 0.5);
    perto(I.celulasDisponiveis({ tipo: "liquida", pacotes: 1, viabilidade: I.viabilidadeLiquida(44) }), 69, 0.5);
  });
  test("viabilidade: fresca 100%, nunca negativa, nunca acima de 100%", () => {
    assert.equal(I.viabilidadeLiquida(0), 100);
    assert.equal(I.viabilidadeLiquida(500), 0);
    assert.equal(I.viabilidadeLiquida(-3), 100);
  });
  test("dias desde a fabricação", () => {
    assert.equal(I.diasEntre("2026-08-15", new Date(2026, 8, 28)), 44);
    assert.equal(I.diasEntre("2026-10-01", new Date(2026, 8, 28)), 0, "data futura conta como fresca");
    assert.equal(I.diasEntre("", new Date()), null);
  });
  test("seca: gramas × bi/g (padrão 15)", () => {
    assert.equal(I.celulasDisponiveis({ tipo: "seca", gramas: 11 }), 165);
    assert.equal(I.celulasDisponiveis({ tipo: "seca", gramas: 11, celulasGrama: 10 }), 110);
  });
  test("reaproveitada: 4,5 bi/mL de sólidos × sólidos × viabilidade (Mr Malty)", () => {
    perto(I.celulasDisponiveis({ tipo: "reaproveitada", ml: 200, solidos: 25, viabilidade: 90 }), 202.5, 1e-9);
  });
  test("contagem própria é o número informado", () => {
    assert.equal(I.celulasDisponiveis({ tipo: "contagem", celulas: 250 }), 250);
  });
  test("sem starter: pacotes, gramas/sachês e mL necessários", () => {
    assert.deepEqual(I.semStarter({ tipo: "liquida", viabilidade: 100 }, 186), { pacotes: 2 });
    assert.deepEqual(I.semStarter({ tipo: "liquida", viabilidade: 100 }, 200), { pacotes: 2 });
    const s = I.semStarter({ tipo: "seca", celulasGrama: 15 }, 186);
    perto(s.gramas, 12.4, 0.01);
    assert.equal(s.saches, 2);
    perto(I.semStarter({ tipo: "reaproveitada", solidos: 25, viabilidade: 90 }, 202.5).ml, 200, 1e-9);
  });
});

describe("crescimento — Chris White, sem agitação", () => {
  // Brewers Friend: 69 bi, starter 2,5 L a 1.036, "C. White - No Agitation":
  // inoculação 27,6 M/mL, growth rate 1,7, termina com 189 bi, DME 239,7 g
  const [p] = I.propagar(69, [{ litros: 2.5, sg: 1.036, modelo: "white" }]);
  test("reproduz o exemplo do Brewers Friend", () => {
    perto(p.inoculacao, 27.6, 1e-9, "inoculação");
    perto(p.novas / p.inicio, 1.7, 0.05, "taxa de crescimento");
    perto(p.fim, 189, 0.6, "células no fim");
    perto(p.dme, 239.7, 0.1, "DME");
  });
  test("bate com o Mr Malty (starter simples) passo a passo, dentro de ±12% entre 20 e 180 M/mL (o Mr Malty arredonda as células)", () => {
    // Passos devolvidos pela calculadora de starter em passos do Mr Malty
    // (mrmalty.com/pitching-stepped-starter-preview.html, "Simple Starter"), 2026-09-28:
    // [litros, células no começo, células no fim]
    const mrMalty = [
      [1.60, 100, 186], [4.00, 96, 270], [2.00, 96, 200], [2.00, 200, 303], [1.86, 303, 372],
      [2.00, 192, 296], [1.92, 296, 372], [5.00, 223, 480], [5.00, 480, 740], [4.27, 740, 884],
    ];
    for (const [l, ini, fim] of mrMalty) {
      const novas = I.crescimento("white", ini, l, 1.036);
      const razao = novas / (fim - ini);
      assert.ok(razao > 0.88 && razao < 1.12, `${l} L, ${ini}→${fim}: nosso cresce ${novas.toFixed(0)} (${(razao * 100).toFixed(0)}%)`);
    }
  });
  test("acima de ~244 M/mL não cresce (nunca encolhe)", () => {
    assert.equal(I.crescimento("white", 300, 1, 1.036), 0);
  });
  test("avisa quando a inoculação sai da faixa de 25–100 M/mL", () => {
    assert.deepEqual(I.propagar(100, [{ litros: 2, sg: 1.036, modelo: "white" }])[0].avisos, []);
    assert.ok(I.propagar(10, [{ litros: 2, sg: 1.036, modelo: "white" }])[0].avisos.includes("inoculacao"));
    assert.ok(I.propagar(250, [{ litros: 2, sg: 1.036, modelo: "white" }])[0].avisos.includes("inoculacao"));
  });
});

describe("crescimento — Braukaiser, placa agitadora", () => {
  const E = I.extratoGramas(1, 1.040); // ≈ 104 g por litro a 1.040
  test("extrato: litros × °P × SG × 10", () => perto(E, 103.9, 0.1));
  test("abaixo de 1,4 bi/g: cresce 1,4 bi por grama de extrato", () => {
    perto(I.crescimento("braukaiser", 50, 1, 1.040), 1.4 * E, 1e-9);
  });
  test("entre 1,4 e 3,5 bi/g: (2,33 − 0,67·x) por grama, contínuo nas duas pontas", () => {
    const x = 2;
    perto(I.crescimento("braukaiser", x * E, 1, 1.040), (2.33 - 0.67 * x) * E, 1e-9);
    perto(I.crescimento("braukaiser", 1.4 * E - 1e-6, 1, 1.040), I.crescimento("braukaiser", 1.4 * E, 1, 1.040), 0.01 * E);
    perto(I.crescimento("braukaiser", 3.5 * E - 1e-6, 1, 1.040), 0, 0.01 * E);
  });
  test("acima de 3,5 bi/g: não cresce", () => {
    assert.equal(I.crescimento("braukaiser", 4 * E, 1, 1.040), 0);
  });
  test("diverge do Mr Malty: cresce mais com pouca levedura por litro, menos com muita, e para acima de 3,5 bi/g", () => {
    // passos da calculadora de passos do Mr Malty (placa agitadora), 2026-09-28
    const baixa = I.crescimento("braukaiser", 58, 5, 1.036);   // 12 M/mL — Mr Malty: +283
    const media = I.crescimento("braukaiser", 93, 1, 1.036);   // 93 M/mL — Mr Malty: +129
    const alta = I.crescimento("braukaiser", 597, 2, 1.036);   // 299 M/mL — Mr Malty: +265
    assert.ok(baixa > 2 * 283, `baixa: ${baixa}`);
    perto(media, 129, 0.05 * 129, "média");
    assert.ok(alta < 0.2 * 265, `alta: ${alta}`);
    assert.equal(I.crescimento("braukaiser", 862, 1.31, 1.036), 0, "658 M/mL — Mr Malty ainda cresce 22");
  });
  test("avisa densidade fora de 1.030–1.040", () => {
    assert.ok(I.propagar(100, [{ litros: 1, sg: 1.060, modelo: "braukaiser" }])[0].avisos.includes("densidade"));
    assert.ok(!I.propagar(100, [{ litros: 1, sg: 1.036, modelo: "braukaiser" }])[0].avisos.includes("densidade"));
  });
});

describe("crescimento — Mr Malty, placa agitadora", () => {
  // Passos devolvidos pela calculadora de starter em passos do Mr Malty
  // (mrmalty.com/pitching-stepped-starter-preview.html, "Stir Plate"), 2026-09-28:
  // [litros, células no começo, células no fim]
  const mrMalty = [
    [2.00, 58, 230], [2.00, 230, 501], [2.00, 501, 781], [0.60, 100, 186], [1.62, 96, 279],
    [2.00, 96, 306], [0.69, 306, 372], [1.27, 192, 372], [1.75, 306, 557], [5.00, 58, 341],
    [4.41, 341, 884], [2.00, 100, 313], [2.00, 313, 597], [2.00, 597, 862], [1.00, 20, 93],
    [1.00, 93, 222], [0.64, 222, 300], [0.50, 50, 116], [0.50, 116, 186],
  ];
  test("curva de White com o volume × 2 ÷ 0,75 (fatores do Mr Malty)", () => {
    perto(I.FATOR_PLACA_MRMALTY, 2.667, 0.001);
    perto(I.crescimento("mrmalty", 100, 0.6, 1.036), I.crescimento("white", 100, 1.6, 1.036), 1e-9);
  });
  test("reproduz os passos do Mr Malty dentro de ±12%", () => {
    for (const [l, ini, fim] of mrMalty) {
      const razao = I.crescimento("mrmalty", ini, l, 1.036) / (fim - ini);
      assert.ok(razao > 0.88 && razao < 1.12, `${l} L, ${ini}→${fim}: ${(razao * 100).toFixed(0)}%`);
    }
  });
  test("exemplo padrão: 100 bi → 186 bi num starter de 0,6 L, como no Mr Malty", () => {
    const s = I.sugerirPassos(100, 186, 2, "mrmalty", 1.036);
    assert.deepEqual(s.passos.map((p) => p.litros), [0.6]);
  });
  test("lager de 884 bi com 1 pacote e frasco de 2 L: chega em 4 passos, como no Mr Malty", () => {
    const s = I.sugerirPassos(100, 884, 2, "mrmalty", 1.036);
    assert.equal(s.motivo, "ok");
    assert.equal(s.passos.length, 4);
    assert.equal(I.sugerirPassos(100, 884, 2, "braukaiser", 1.036).motivo, "frasco-pequeno", "o Braukaiser não chega");
  });
  test("aviso de inoculação usa o volume efetivo (faixa de ~67 a ~267 M/mL reais)", () => {
    assert.deepEqual(I.propagar(200, [{ litros: 1, sg: 1.036, modelo: "mrmalty" }])[0].avisos, []);
    assert.ok(I.propagar(300, [{ litros: 1, sg: 1.036, modelo: "mrmalty" }])[0].avisos.includes("inoculacao"));
  });
});

describe("passos", () => {
  test("cada passo começa com o que o anterior terminou", () => {
    const r = I.propagar(50, [
      { litros: 0.5, sg: 1.036, modelo: "braukaiser" },
      { litros: 2, sg: 1.036, modelo: "white" },
      { litros: 4, sg: 1.036, modelo: "braukaiser" },
    ]);
    assert.equal(r[0].inicio, 50);
    for (let i = 1; i < r.length; i++) assert.equal(r[i].inicio, r[i - 1].fim);
    assert.ok(r.every((p) => p.fim >= p.inicio));
  });
  test("passo incompleto não quebra a cadeia", () => {
    const r = I.propagar(50, [{ litros: "", sg: 1.036 }, { litros: 1, sg: 1.036 }]);
    assert.equal(r[0].valido, false);
    assert.equal(r[1].inicio, 50);
  });
  test("sugestão: já tem o suficiente, ou falta dado", () => {
    assert.equal(I.sugerirPassos(200, 186, 2, "braukaiser", 1.036).motivo, "suficiente");
    assert.equal(I.sugerirPassos(0, 186, 2, "braukaiser", 1.036).motivo, "incompleta");
  });
  test("sugestão: lager grande com pacote velho e frasco de 2 L não chega; com 5 L chega em 2 passos", () => {
    const need = I.celulasNecessarias(40, plato(1.06), 1.5); // ≈ 884 bi
    const pouco = I.sugerirPassos(58, need, 2, "braukaiser", 1.036);
    assert.equal(pouco.motivo, "frasco-pequeno");
    assert.ok(I.propagar(58, pouco.passos).pop().fim < need);
    const cinco = I.sugerirPassos(58, need, 5, "braukaiser", 1.036);
    assert.equal(cinco.motivo, "ok");
    assert.equal(cinco.passos.length, 2);
  });
});

describe("invariantes (casos aleatórios, semente fixa)", () => {
  let semente = 42;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const casos = Array.from({ length: 300 }, () => ({
    inicial: 5 + rnd() * 300,
    alvo: 50 + rnd() * 1500,
    frasco: [0.5, 1, 2, 3, 5][Math.floor(rnd() * 5)],
    modelo: I.MODELOS[Math.floor(rnd() * 3)],
    sg: 1.030 + Math.round(rnd() * 10) / 1000,
  }));

  test("crescimento nunca é negativo e aumenta com o volume do starter", () => {
    for (const c of casos) {
      const a = I.crescimento(c.modelo, c.inicial, 1, c.sg), b = I.crescimento(c.modelo, c.inicial, 2, c.sg);
      assert.ok(a >= 0 && b >= a - 1e-9, JSON.stringify(c));
    }
  });

  test("sugestão: respeita o frasco, volumes em 0,1 L, e quando diz ok chega no alvo com o menor volume", () => {
    for (const c of casos) {
      const s = I.sugerirPassos(c.inicial, c.alvo, c.frasco, c.modelo, c.sg);
      const r = I.propagar(c.inicial, s.passos);
      for (const p of s.passos) {
        assert.ok(p.litros <= c.frasco + 1e-9, "cabe no frasco");
        perto(p.litros * 10, Math.round(p.litros * 10), 1e-6, "múltiplo de 0,1 L");
      }
      if (s.motivo === "ok") {
        assert.ok(r[r.length - 1].fim >= c.alvo - 1e-6, "chega no alvo " + JSON.stringify(c));
        const ult = s.passos[s.passos.length - 1];
        if (ult.litros > 0.1 + 1e-9) {
          const menor = I.propagar(r[r.length - 1].inicio, [{ ...ult, litros: ult.litros - 0.1 }])[0].fim;
          assert.ok(menor < c.alvo, "0,1 L a menos não chegaria " + JSON.stringify(c));
        }
      } else if (c.inicial < c.alvo) {
        assert.ok(["frasco-pequeno", "passos-demais"].includes(s.motivo), s.motivo);
      }
    }
  });
});
