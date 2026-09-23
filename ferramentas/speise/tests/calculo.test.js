// Cálculo da speise. Valores conferidos à mão (contas no comentário de cada teste),
// não copiados do que o código devolve.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../calculo.js");

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);

describe("conversões", () => {
  test("SG 1.050 ≈ 12,39 °P (polinômio: -616,868 + 1111,14·1,05 − 630,272·1,1025 + 135,997·1,157625)", () => {
    perto(S.sgParaPlato(1.05), 12.3869, 0.001, "°P");
  });

  test("SG 1.000 ≈ 0 °P", () => perto(S.sgParaPlato(1.0), 0, 0.01, "°P"));

  test("°P -> SG é a inversa de SG -> °P", () => {
    for (const sg of [1.03, 1.05, 1.08, 1.1]) perto(S.platoParaSg(S.sgParaPlato(sg)), sg, 1e-6, `sg ${sg}`);
  });
});

describe("CO₂ residual", () => {
  test("20 °C (68 °F): 3,0378 − 0,050062·68 + 0,00026555·68² = 0,8615 vol", () => {
    perto(S.co2Residual(20), 0.8615, 0.0005, "vol");
  });

  test("mais frio retém mais CO₂", () => {
    assert.ok(S.co2Residual(5) > S.co2Residual(20));
  });

  test("nunca negativo", () => {
    for (const t of [-10, 0, 30, 60, 100]) assert.ok(S.co2Residual(t) >= 0, `t=${t}`);
  });
});

describe("calcular", () => {
  const base = { volume: 20, og: 1.05, unidade: "sg", atenuacao: 75, alvoCO2: 2.4, temperatura: 20 };

  test("caso típico: 20 L, OG 1.050, 75%, 2,4 vol a 20 °C -> 1,325 L de speise e 18,675 L de mosto principal", () => {
    // falta = 2,4 − 0,8615 = 1,5385 vol; açúcar = 4·20·1,5385 = 123,08 g
    // extrato fermentável = 10·12,3869·0,75 = 92,90 g/L; speise = 123,08 / 92,90 = 1,3249 L
    const r = S.calcular(base);
    assert.equal(r.aviso, null);
    perto(r.acucarG, 123.08, 0.05, "açúcar");
    perto(r.extratoFermentavelPorL, 92.90, 0.02, "extrato/L");
    perto(r.speise, 1.3249, 0.001, "speise");
    perto(r.principal, 18.6751, 0.001, "principal");
    perto(r.speise + r.principal, 20, 1e-9, "speise + principal = volume final");
  });

  test("OG em °Plato dá o mesmo resultado que em SG", () => {
    const emPlato = S.calcular({ ...base, og: S.sgParaPlato(1.05), unidade: "plato" });
    perto(emPlato.speise, S.calcular(base).speise, 1e-9, "speise");
  });

  test("proporcional ao volume do lote", () => {
    perto(S.calcular({ ...base, volume: 40 }).speise, 2 * S.calcular(base).speise, 1e-9, "speise");
  });

  test("mais carbonatação pede mais speise; mais atenuação pede menos", () => {
    assert.ok(S.calcular({ ...base, alvoCO2: 3 }).speise > S.calcular(base).speise);
    assert.ok(S.calcular({ ...base, atenuacao: 85 }).speise < S.calcular(base).speise);
  });

  test("CO₂ residual já no alvo: aviso sem-speise e 0 L", () => {
    const r = S.calcular({ ...base, alvoCO2: 0.5 });
    assert.equal(r.aviso, "sem-speise");
    assert.equal(r.speise, 0);
    assert.equal(r.principal, 20);
  });

  test("OG inválida (SG 1.000 ou 0 °P) ou atenuação 0: aviso og-invalida, sem NaN", () => {
    for (const p of [{ og: 1.0 }, { og: 0, unidade: "plato" }, { atenuacao: 0 }, { og: "" }]) {
      const r = S.calcular({ ...base, ...p });
      assert.equal(r.aviso, "og-invalida", JSON.stringify(p));
      assert.equal(r.speise, 0);
      assert.ok(!Number.isNaN(r.principal));
    }
  });

  test("speise nunca passa do volume do lote", () => {
    const r = S.calcular({ ...base, og: 1.005, atenuacao: 40, alvoCO2: 5, temperatura: 30 });
    assert.ok(r.speise <= 20 && r.principal >= 0);
  });

  test("dosagem por garrafa: proporção speise/lote × tamanho (600 ml -> 600 · 1,3249/20 = 39,7 ml)", () => {
    const r = S.calcular(base);
    assert.deepEqual(r.garrafas.map((g) => g.ml), [650, 600, 550, 500, 375, 350, 300]);
    perto(r.garrafas.find((g) => g.ml === 600).speiseMl, 39.75, 0.05, "600 ml");
  });
});
