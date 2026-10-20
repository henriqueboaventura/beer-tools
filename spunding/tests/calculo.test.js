/*
 * Testes do cálculo da ferramenta 05 — Spunding (quando fechar a válvula).
 * A física vem da carbonatação (Mr Malty, conferida na spec 06). A folga de 1 ponto
 * e o CO₂ por ponto são os da Bräu Supply (Pressure Fermentation Calculator).
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../calculo.js");
const C = require("../../carbonatacao/calculo.js");

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} ${a} ≠ ${b} (±${tol})`);
const base = { modo: "bar", valor: 1.0, tempC: 18, litros: 20, capacidade: 30, fg: 1.010 };
const calc = (mudar) => S.calcular({ ...base, ...mudar });

describe("física", () => {
  test("2,5 vol a 20 °C pedem cerca de 2 bar", () => perto(C.pressaoParaVolumes(2.5, 20), 2.0, 0.01));
  test("cada ponto de densidade gera cerca de 0,5 volume (Bräu Supply: 0,49)", () => {
    perto(C.CO2_POR_PONTO_GL / C.G_POR_VOL_L, 0.5, 0.01);
  });
});

describe("pontos para fechar", () => {
  test("sem espaço vazio: só o CO₂ que a cerveja absorve", () => {
    const pts = S.pontosParaFechar(0, 2.0, 20, 0, 20);
    perto(pts, (C.co2PelaPressao(2.0, 20) - C.co2PelaPressao(0, 20)) * C.G_POR_VOL_L / C.CO2_POR_PONTO_GL, 1e-9);
    perto(pts, 3.3, 0.1);
  });

  test("o espaço vazio pede mais pontos", () => {
    const sem = S.pontosParaFechar(0, 2.0, 20, 0, 20), com = S.pontosParaFechar(0, 2.0, 20, 10, 20);
    perto(com - sem, C.hEspaco(10, 20) * 2.0 * C.PSI_POR_BAR / (C.CO2_POR_PONTO_GL * 20), 1e-9);
    perto(com, 5.1, 0.1);
  });

  test("arredonda para cima e soma 1 ponto de folga", () => {
    const r = calc({});
    assert.equal(r.pontosFechar, Math.ceil(r.pontos) + 1);
    perto(r.densidadeFechar, 1.010 + r.pontosFechar / 1000, 1e-9);
    perto(r.volumes, C.co2PelaPressao(1.0, 18), 1e-12);
    assert.equal(r.espacoVazio, 10);
  });

  test("no mínimo 2 pontos", () => {
    const r = calc({ valor: 0.1, capacidade: "" });
    assert.ok(r.pontos < 1);
    assert.equal(r.pontosFechar, 2);
  });

  test("sem capacidade, ignora o espaço vazio", () => {
    assert.equal(calc({ capacidade: "" }).espacoVazio, 0);
    assert.ok(calc({ capacidade: "" }).pontos < calc({}).pontos);
  });
});

describe("pressão ou carbonatação", () => {
  test("em volumes: converte para a pressão na temperatura da fermentação", () => {
    const r = calc({ modo: "vol", valor: 2.5, tempC: 20 });
    perto(r.bar, C.pressaoParaVolumes(2.5, 20), 1e-12);
    assert.equal(r.volumes, 2.5);
    perto(r.pontos, S.pontosParaFechar(0, r.bar, 20, 10, 20), 1e-12);
  });

  test("bar e volumes equivalentes dão a mesma densidade", () => {
    const b = calc({ valor: 1.2 });
    assert.equal(calc({ modo: "vol", valor: b.volumes }).densidadeFechar, b.densidadeFechar);
  });

  test("volumes que a cerveja já tem aberta: não precisa fechar", () => {
    const r = calc({ modo: "vol", valor: 0.8, tempC: 18 });
    assert.equal(r.valido, false);
    assert.equal(r.erro, "aberta");
  });
});

describe("entradas inválidas", () => {
  test("cerveja maior que o fermentador", () => assert.equal(calc({ capacidade: 18 }).erro, "capacidade"));
  test("campo vazio ou zero", () => {
    assert.equal(calc({ litros: "" }).valido, false);
    assert.equal(calc({ valor: 0 }).valido, false);
    assert.equal(calc({ fg: "" }).valido, false);
  });
});
