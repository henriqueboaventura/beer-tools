// Parti-gyle: cenários de uso da ferramenta e invariantes que valem para
// QUALQUER entrada (casos aleatórios com semente fixa, sempre os mesmos).
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../calculo.js");

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);
const og3 = (sg) => sg.toFixed(3);
function aleatorio(semente) {
  let s = semente >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const entre = (r, a, b) => a + r() * (b - a);

describe("cenários — plano", () => {
  const padrao = { evaporacao: 10, eficiencia: 70, ppg: 37 };

  test("valores iniciais da ferramenta (19 L a 1.096 + 38 L a 1.048, 10% de fervura): acerta sem ajuste, 16,9 kg", () => {
    const r = P.planejar({ ...padrao, cervejas: [{ volume: 19, og: 1.096 }, { volume: 38, og: 1.048 }] });
    assert.deepEqual(r.cervejas.map((c) => c.acao.tipo), ["ok", "ok"]);
    assert.equal(r.malteKg.toFixed(1), "16.9");
    // coleta antes da fervura: 19/0,9 e 38/0,9
    assert.deepEqual(r.ordemColeta.map((c) => c.volumeColeta.toFixed(2)), ["21.11", "42.22"]);
  });

  test("a cerveja de maior OG recebe os primeiros mostos, mesmo digitada por último", () => {
    const r = P.planejar({ ...padrao, cervejas: [{ nome: "Leve", volume: 38, og: 1.048 }, { nome: "Forte", volume: 19, og: 1.096 }] });
    assert.deepEqual(r.ordemColeta.map((c) => c.nome), ["Forte", "Leve"]);
    assert.deepEqual(r.cervejas.map((c) => c.ordem), [2, 1]);
    assert.deepEqual(r.cervejas.map((c) => c.acao.tipo), ["ok", "ok"]);
  });

  test("pedido fora da curva (20 L a 1.090 + 40 L a 1.050): diz como acertar cada uma e a divisão que acertaria sem ajuste", () => {
    const r = P.planejar({ ...padrao, cervejas: [{ volume: 20, og: 1.09 }, { volume: 40, og: 1.05 }] });
    assert.equal(og3(r.cervejas[0].ogPrevista), "1.095");
    assert.equal(r.cervejas[0].acao.tipo, "agua");
    assert.equal(r.cervejas[1].acao.tipo, "ferver");
    assert.equal(r.sugestao.tipo, "dividir");
    perto(r.sugestao.volumeForte + r.sugestao.volumeFraca, 60, 1e-9, "mesmo total");
    // com a divisão sugerida, as duas acertam sem ajuste
    const r2 = P.planejar({ ...padrao, cervejas: [{ volume: r.sugestao.volumeForte, og: 1.09 }, { volume: r.sugestao.volumeFraca, og: 1.05 }] });
    assert.deepEqual(r2.cervejas.map((c) => c.acao.tipo), ["ok", "ok"]);
  });

  test("cervejas parecidas (1.060 e 1.045, razão < 1,75): sugere trocar mosto entre as panelas, e a troca fecha", () => {
    const r = P.planejar({ ...padrao, cervejas: [{ volume: 20, og: 1.06 }, { volume: 20, og: 1.045 }] });
    assert.equal(r.sugestao.tipo, "misturar");
    const m = r.sugestao.mistura;
    assert.equal(m.suficiente, true);
    perto(m.sobraForte, 0, 1e-6, "sem sobra no forte");
    perto(m.sobraFraco, 0, 1e-6, "sem sobra no fraco");
    assert.ok(m.cervejas.every((c) => c.agua === 0 && c.problema === null));
  });

  test("razão acima de 4 (1.100 e 1.020): não dá só coletando", () => {
    const r = P.planejar({ ...padrao, cervejas: [{ volume: 10, og: 1.1 }, { volume: 10, og: 1.02 }] });
    assert.equal(r.sugestao.tipo, "impossivel");
  });

  test("três cervejas não têm sugestão de divisão (só as ações por cerveja)", () => {
    const r = P.planejar({ ...padrao, cervejas: [{ volume: 19, og: 1.096 }, { volume: 19, og: 1.064 }, { volume: 19, og: 1.032 }] });
    assert.equal(r.sugestao, null);
    assert.ok(r.cervejas.every((c) => c.acao.tipo === "ok"));
  });

  test("entradas incompletas: plano inválido, sem erro", () => {
    for (const cervejas of [[], [{ volume: 10, og: 1.05 }], [{ volume: 10, og: 1.05 }, { volume: "", og: 1.04 }], [{ volume: 10, og: 1.05 }, { volume: 10, og: 1.0 }]]) {
      assert.equal(P.planejar({ ...padrao, cervejas }).valido, false);
    }
  });
});

describe("cenários — no dia", () => {
  test("coletou exatamente o previsto: tudo ok, lúpulo × 1", () => {
    const cervejas = [{ volume: 19, og: 1.096 }, { volume: 38, og: 1.048 }];
    const r = P.planejar({ cervejas, evaporacao: 10, eficiencia: 70 });
    const dia = P.noDia({ cervejas, evaporacao: 10, medidas: r.cervejas.map((c) => ({ volume: c.volumeColeta, og: c.ogColeta })) });
    assert.deepEqual(dia.map((d) => d.acao.tipo), ["ok", "ok"]);
    for (const d of dia) perto(d.fatorLupulo, 1, 0.006, "lúpulo");
  });

  test("primeiro mosto saiu mais denso: diluir e aumentar o lúpulo na mesma proporção (BYO)", () => {
    // sem fervura: 2 gal a 1.100 para alvo 1.080 -> 2,5 gal, lúpulo × 1,25
    const [d] = P.noDia({ cervejas: [{ volume: 2, og: 1.08 }], evaporacao: 0, medidas: [{ volume: 2, og: 1.1 }] });
    assert.equal(d.acao.tipo, "agua");
    perto(d.acao.volumeFinal, 2.5, 1e-9, "volume");
    perto(d.fatorLupulo, 1.25, 1e-9, "lúpulo");
  });

  test("a fervura concentra: 20 L a 1.045 com 10% de perda -> 18 L a 1.050", () => {
    const [d] = P.noDia({ cervejas: [{ volume: 18, og: 1.05 }], evaporacao: 10, medidas: [{ volume: 20, og: 1.045 }] });
    perto(d.volumeDepois, 18, 1e-9, "volume");
    assert.equal(og3(d.ogDepois), "1.050");
    assert.equal(d.acao.tipo, "ok");
  });

  test("medida incompleta não quebra", () => {
    const [d] = P.noDia({ cervejas: [{ volume: 18, og: 1.05 }], evaporacao: 10, medidas: [{ volume: "", og: "" }] });
    assert.equal(d.problema, "incompleta");
  });
});

describe("invariantes — plano (500 casos aleatórios)", () => {
  const r = aleatorio(20260924);

  test("pontos se conservam, a ordem de coleta desce, e cada ação leva exatamente ao alvo", () => {
    for (let k = 0; k < 500; k++) {
      const n = r() < 0.5 ? 2 : 3;
      const cervejas = Array.from({ length: n }, () => ({ volume: entre(r, 5, 60), og: 1 + entre(r, 25, 110) / 1000 }));
      const evaporacao = entre(r, 0, 20);
      const res = P.planejar({ cervejas, evaporacao, eficiencia: 70 });
      assert.equal(res.valido, true);
      // Σ volume × pontos previstos = Σ volume × pontos pedidos
      const previstos = res.cervejas.reduce((a, c) => a + c.volume * c.pontosPrevistos, 0);
      perto(previstos, res.pontosTotais, 1e-6, `pontos caso ${k}`);
      for (let i = 1; i < res.ordemColeta.length; i++) {
        assert.ok(res.ordemColeta[i].ogPrevista < res.ordemColeta[i - 1].ogPrevista, `ordem caso ${k}`);
      }
      for (const c of res.cervejas) {
        // depois da ação, a densidade é o alvo (pontos conservados)
        perto(c.acao.volumeFinal * P.pontos(c.og), c.volume * c.pontosPrevistos, 1e-6, `ação caso ${k}`);
        assert.ok(c.volumeColeta >= c.volume - 1e-9, "coleta antes da fervura ≥ volume final");
      }
      perto(res.ordemColeta.reduce((a, c) => a + c.volumeColeta, 0), res.totalColeta, 1e-9, "total coletado");
    }
  });

  test("sugestão de divisão (2 cervejas): quando existe, acerta as duas sem ajuste e mantém o total", () => {
    let testadas = 0;
    for (let k = 0; k < 300; k++) {
      const cervejas = [{ volume: entre(r, 5, 40), og: 1 + entre(r, 60, 110) / 1000 }, { volume: entre(r, 5, 60), og: 1 + entre(r, 15, 60) / 1000 }];
      const res = P.planejar({ cervejas, evaporacao: 10, eficiencia: 70 });
      if (!res.sugestao || res.sugestao.tipo !== "dividir") continue;
      testadas++;
      perto(res.sugestao.volumeForte + res.sugestao.volumeFraca, cervejas[0].volume + cervejas[1].volume, 1e-6, "total");
      const r2 = P.planejar({ cervejas: [{ volume: res.sugestao.volumeForte, og: cervejas[0].og }, { volume: res.sugestao.volumeFraca, og: cervejas[1].og }], evaporacao: 10, eficiencia: 70 });
      assert.deepEqual(r2.cervejas.map((c) => c.acao.tipo), ["ok", "ok"], `caso ${k}`);
    }
    assert.ok(testadas > 30, `poucos casos testados (${testadas})`);
  });

  test("troca de mosto (cervejas parecidas): sempre fecha exatamente, sem água", () => {
    let testadas = 0;
    for (let k = 0; k < 300; k++) {
      const og2 = 1 + entre(r, 30, 60) / 1000;
      const og1 = P.sg(P.pontos(og2) * entre(r, 1.01, 1.74));
      const res = P.planejar({ cervejas: [{ volume: entre(r, 5, 40), og: og1 }, { volume: entre(r, 5, 40), og: og2 }], evaporacao: entre(r, 0, 15) });
      assert.equal(res.sugestao.tipo, "misturar", `caso ${k}`);
      const m = res.sugestao.mistura;
      perto(m.sobraForte, 0, 1e-6, "sobra forte");
      perto(m.sobraFraco, 0, 1e-6, "sobra fraco");
      assert.ok(m.cervejas.every((c) => c.problema === null && c.agua < 1e-9), `caso ${k}`);
      testadas++;
    }
    assert.equal(testadas, 300);
  });
});

describe("invariantes — misturar e no dia (aleatórios)", () => {
  const r = aleatorio(4242);

  test("toda mistura possível sai na densidade e no volume pedidos, sem litros negativos", () => {
    for (let k = 0; k < 500; k++) {
      const fraco = { volume: entre(r, 5, 60), og: 1 + entre(r, 5, 40) / 1000 };
      const forte = { volume: entre(r, 5, 60), og: fraco.og + entre(r, 5, 80) / 1000 };
      const cervejas = Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ volume: entre(r, 1, 30), og: 1 + entre(r, 1, P.pontos(forte.og)) / 1000 }));
      const res = P.misturar({ forte, fraco, cervejas });
      for (const c of res.cervejas) {
        assert.equal(c.problema, null);
        assert.ok(c.forte >= -1e-9 && c.fraco >= -1e-9 && c.agua >= -1e-9, `negativo caso ${k}`);
        perto(c.forte + c.fraco + c.agua, c.volume, 1e-9, "volume");
        perto((c.forte * P.pontos(forte.og) + c.fraco * P.pontos(fraco.og)) / c.volume, P.pontos(c.og), 1e-6, "densidade");
      }
    }
  });

  test("no dia: a ação sempre leva ao alvo e o lúpulo acompanha o volume final", () => {
    for (let k = 0; k < 300; k++) {
      const alvo = { volume: entre(r, 5, 40), og: 1 + entre(r, 30, 100) / 1000 };
      const medida = { volume: entre(r, 5, 50), og: 1 + entre(r, 20, 110) / 1000 };
      const e = entre(r, 0, 20);
      const [d] = P.noDia({ cervejas: [alvo], medidas: [medida], evaporacao: e });
      perto(d.acao.volumeFinal * P.pontos(alvo.og), medida.volume * P.pontos(medida.og), 1e-6, `pontos caso ${k}`);
      perto(d.fatorLupulo, d.acao.volumeFinal / alvo.volume, 1e-9, "lúpulo");
    }
  });
});
