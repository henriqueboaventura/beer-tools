/*
 * Testes do cálculo da ferramenta 06 — Carbonatação.
 * Os valores esperados saíram das funções da Priming Sugar Calculator do Mr Malty
 * (código da própria página, https://mrmalty.com/priming-sugar-calculator.html,
 * 2026-10-01), rodadas com as mesmas entradas convertidas para °F, galões e psi.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const C = require("../calculo.js");
const Speise = require("../../speise/calculo.js");

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} ${a} ≠ ${b} (±${tol})`);
const base = { envase: "vidro", litros: 20, tempC: 20, alvo: 2.4, acucar: "milho", inicio: "fermentada" };
const calc = (mudar) => C.calcular({ ...base, ...mudar });

describe("bate com o Mr Malty", () => {
  // [litros, °C, alvo, espaço vazio (L), manômetro (bar), °C de armazenamento] →
  // [CO₂ residual, açúcar de milho (g), pressão no armazenamento (bar)], das funções do Mr Malty
  const casos = [
    [[20, 20, 2.4, 0, 0, 20], [0.861, 136.1, 2.892]],
    [[20, 4, 2.6, 0, 0, 20], [1.483, 98.8, 3.191]],
    [[19, 25, 3.5, 0, 0, 30], [0.757, 230.5, 5.512]],
    [[40, 18, 2.5, 0, 0, 18], [0.915, 280.4, 2.843]],
    [[19, 20, 2.4, 2, 0, 25], [0.861, 152.8, 3.292]],
    [[19, 10, 2.4, 5, 0, 25], [1.199, 145.9, 3.108]],
    [[19, 12, 2.5, 2, 1.2, 20], [2.334, 33.8, 2.980]],
    [[5, 22, 1.5, 0, 0, 22], [0.815, 15.2, 1.913]],
  ];
  for (const [[litros, tempC, alvo, espacoVazio, pressaoBar, tempArmazenamento], [res, g, bar]] of casos) {
    test(`${litros} L a ${tempC} °C, alvo ${alvo}${espacoVazio ? `, barril com ${espacoVazio} L vazios` : ""}${pressaoBar ? `, ${pressaoBar} bar` : ""}`, () => {
      const r = calc({ envase: espacoVazio ? "barril" : "vidro", litros, tempC, alvo, espacoVazio,
        inicio: pressaoBar ? "pressao" : "fermentada", pressaoBar, tempArmazenamento });
      perto(r.residual, res, 0.0006, "residual");
      perto(r.gramas, g, 0.06, "açúcar de milho");
      perto(r.pressao.total, bar, 0.0006, "pressão");
    });
  }
});

describe("CO₂ residual e rendimentos", () => {
  test("o CO₂ residual é o mesmo da calculadora de speise", () => {
    for (let t = 0; t <= 30; t += 2.5) perto(C.co2Residual(t), Speise.co2Residual(t), 1e-12, `${t} °C`);
  });
  test("as garrafas são as mesmas da calculadora de speise", () => {
    assert.deepEqual(C.GARRAFAS_ML, Speise.GARRAFAS_ML);
  });
  test("1 volume = 1,964 g/L; açúcar = CO₂ ÷ rendimento", () => {
    const r = calc({ acucar: "sacarose" });
    perto(r.gramas, (2.4 - r.residual) * 1.964 * 20 / 0.514, 1e-9);
    perto(r.co2PorLitro, 2.4 * 1.964, 1e-12);
  });
  test("rendimentos estequiométricos: sacarose > dextrose anidra > açúcar de milho", () => {
    const y = (id) => C.acucarPorId(id).rendimento;
    assert.equal(y("sacarose"), 0.514);
    assert.equal(y("dextrose"), 0.489);
    assert.equal(y("milho"), 0.444);
    const g = (id) => calc({ acucar: id }).gramas;
    assert.ok(g("sacarose") < g("dextrose") && g("dextrose") < g("milho"));
  });
  test("sem maple, gyle/speise, candi e turbinado/demerara", () => {
    const nomes = C.ACUCARES.map((a) => a.id + " " + a.nome.toLowerCase()).join(" | ");
    for (const fora of ["maple", "gyle", "speise", "candi", "turbinado", "demerara"]) assert.ok(!nomes.includes(fora), fora);
  });
  test("rendimento editado substitui o padrão", () => {
    const r = calc({ acucar: "dme", rendimento: 0.5 });
    assert.equal(r.rendimento, 0.5);
    perto(r.gramas, r.co2 / 0.5, 1e-9);
  });
});

describe("total e por garrafa", () => {
  test("dose por garrafa = total × volume da garrafa ÷ volume do lote", () => {
    const r = calc({});
    assert.deepEqual(r.garrafas.map((g) => g.ml), Speise.GARRAFAS_ML);
    for (const g of r.garrafas) {
      perto(g.gramas, r.gramas * g.ml / 20000, 1e-9, `${g.ml} mL`);
      assert.equal(g.quantas, Math.floor(20000 / g.ml));
    }
  });
  test("barril não tem dose por garrafa e pede mais açúcar que a garrafa (espaço vazio)", () => {
    const garrafa = calc({ litros: 19 }), barril = calc({ litros: 19, envase: "barril", espacoVazio: 2 });
    assert.deepEqual(barril.garrafas, []);
    assert.ok(barril.gramas > garrafa.gramas * 1.1, `${barril.gramas} × ${garrafa.gramas}`);
  });
  test("espaço vazio só conta no barril", () => {
    assert.equal(calc({ espacoVazio: 5 }).espacoVazio, 0);
  });
});

describe("casos especiais", () => {
  test("cerveja fria o tempo todo já tem CO₂ suficiente: sem priming", () => {
    const r = calc({ tempC: 0, alvo: 1.6 });
    assert.equal(r.semPriming, true);
    assert.equal(r.gramas, 0);
  });
  test("cerveja sob pressão (spunding): parte do manômetro e pede menos açúcar", () => {
    const solta = calc({ tempC: 12 }), presa = calc({ tempC: 12, inicio: "pressao", pressaoBar: 1 });
    assert.ok(presa.residual > solta.residual);
    assert.ok(presa.gramas < solta.gramas);
    perto(C.co2PelaPressao(C.pressaoParaVolumes(2.5, 4), 4), 2.5, 1e-9, "ida e volta pressão ↔ volumes");
  });
  test("carbonatação natural: pontos de densidade e válvula de spunding", () => {
    const r = calc({ acucar: "natural", densidadeFinal: 1.010 });
    perto(C.CO2_POR_PONTO_GL, 0.989, 0.001);
    perto(r.pontos, r.co2 / (C.CO2_POR_PONTO_GL * 20), 1e-12);
    perto(r.densidadeFechar, 1.010 + r.pontos / 1000, 1e-12);
    perto(C.co2PelaPressao(r.valvulaBar, 20), 2.4, 1e-9, "a válvula segura o alvo");
    assert.ok(isNaN(r.gramas));
    assert.deepEqual(r.garrafas, []);
  });
  test("risco de estourar: vidro comum a partir de 2,9 (atenção) e 3,5 (perigo); reforçada aguenta mais", () => {
    assert.equal(calc({ alvo: 2.8 }).risco, "ok");
    assert.equal(calc({ alvo: 3.0 }).risco, "atencao");
    assert.equal(calc({ alvo: 3.6 }).risco, "perigo");
    assert.equal(calc({ alvo: 3.6, envase: "vidro-reforcado" }).risco, "ok");
    assert.equal(calc({ alvo: 3.0, envase: "lata" }).risco, "atencao");
  });
  test("armazenar mais quente aumenta a pressão", () => {
    assert.ok(calc({ tempArmazenamento: 30 }).pressao.total > calc({ tempArmazenamento: 20 }).pressao.total);
  });
  test("entradas incompletas não calculam", () => {
    assert.equal(calc({ litros: "" }).valido, false);
    assert.equal(calc({ alvo: 0 }).valido, false);
    assert.equal(calc({ tempC: "" }).valido, false);
  });
});
