// Integração com o Brewfather (brewfather.js): conversão do programa em
// passos de mostura e o cliente da API, com um fetch falso (nada sai daqui).
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../methods.js");
const B = require("../brewfather.js");

const programa = (id) => {
  const m = M.getMethod(id);
  return M.computeSchedule(m, M.defaultParams(m));
};

describe("passos do Brewfather", () => {
  // Como o Brew Tracker do Brewfather lê um passo Decoction: depois do
  // passo anterior, puxar, descansar a decocção, ferver por stepTime e
  // devolver, com a mostura parada. O descanso depois da devolução é outro
  // passo (Temperature, mesma temperatura).
  test("Simples: proteína até a puxada, decocção com a fervura, sacarificação e mash out", () => {
    const p = B.passosBrewfather(programa("simples"));
    assert.deepEqual(p.map((x) => [x.type, x.stepTemp, x.stepTime, x.name]), [
      ["Temperature", 53, 20, "Rampa de proteína"],
      ["Decoction", 66, 15, "Decocção (fervura) · 6,5 L"],
      ["Temperature", 66, 50, "Rampa de sacarificação"],
      ["Temperature", 75, 10, "Mash Out"],
    ]);
    assert.equal(p[3].rampTime, 5, "o aquecimento do mash out vira rampa");
    for (const x of p) assert.equal(x.displayStepTemp, x.stepTemp);
  });

  test("Dupla Tradicional: o patamar não conta o tempo da decocção", () => {
    const p = B.passosBrewfather(programa("dupla-tradicional"));
    assert.deepEqual(p.map((x) => [x.type, x.stepTemp, x.stepTime]), [
      ["Temperature", 52, 10], ["Decoction", 65, 30], ["Temperature", 65, 5], ["Decoction", 75, 15], ["Temperature", 75, 15],
    ]);
  });

  test("o passo Decoction leva o nosso volume e o descanso da decocção", () => {
    const sacc = B.passosBrewfather(programa("simples"))[1];
    assert.equal(sacc.decoctionAmountMode, "volume", "senão o Brewfather calcula o volume dele");
    assert.equal(sacc.decoctionAmount, 6.5);
    assert.equal(sacc.decoctionRestTemp, 68);
    assert.equal(sacc.decoctionRestTime, 10);
    // a 2ª do Hochkurz vai direto à fervura, sem descanso
    const h = B.passosBrewfather(programa("hochkurz")).filter((x) => x.type === "Decoction");
    assert.deepEqual(h.map((x) => [x.decoctionAmount, x.decoctionRestTemp, x.decoctionRestTime, x.stepTime]), [[5.5, 71, 10, 8], [4, null, null, 8]]);
    for (const x of B.passosBrewfather(programa("simples")).filter((y) => y.type !== "Decoction")) assert.equal(x.decoctionAmountMode, undefined);
  });

  test("devolução em partes: o resto da decocção não vira outra puxada", () => {
    const p = B.passosBrewfather(programa("dupla-aprimorada"));
    const resto = p.find((x) => /devolver o resto/.test(x.name));
    assert.equal(resto.type, "Temperature");
    assert.equal(resto.stepTemp, 66);
  });

  test("um Decoction por puxada, com a fervura como tempo, seguido do descanso", () => {
    for (const m of M.METHODS) {
      const rows = programa(m.id);
      const puxadas = rows.filter((r) => r.decoctionVolumeL !== undefined);
      const p = B.passosBrewfather(rows);
      const dec = p.filter((x) => x.type === "Decoction");
      assert.equal(dec.length, puxadas.length, m.id);
      dec.forEach((x, i) => {
        assert.equal(x.decoctionAmount, Math.round(puxadas[i].decoctionVolumeL * 10) / 10, m.id);
        const j = p.indexOf(x);
        if (p[j + 1]) assert.ok(p[j + 1].type === "Temperature" || p[j + 1].stepTemp > x.stepTemp, `${m.id}: depois do Decoction`);
      });
    }
  });

  test("passos válidos e temperatura sempre igual ou subindo, a não ser na pseudo", () => {
    for (const m of M.METHODS) {
      const p = B.passosBrewfather(programa(m.id));
      for (const x of p) {
        assert.ok(x.stepTime >= 0 && x.stepTime <= 360, m.id);
        assert.ok(x.rampTime === null || (x.rampTime > 0 && x.rampTime <= 60), m.id);
        assert.ok(["Temperature", "Decoction"].includes(x.type), m.id);
        if (x.type === "Decoction") assert.ok(x.decoctionAmount > 0 && x.stepTime > 0, m.id);
      }
      if (m.id === "pseudo-decoccao") continue;
      for (let i = 1; i < p.length; i++) {
        assert.ok(p[i].stepTemp >= p[i - 1].stepTemp, `${m.id} passo ${i + 1}`);
        // dois passos na mesma temperatura só como Decoction + descanso
        if (p[i].stepTemp === p[i - 1].stepTemp) assert.equal(p[i - 1].type, "Decoction", `${m.id} passo ${i + 1}`);
      }
    }
  });

  test("perda térmica em espera não abre passos novos", () => {
    for (const m of M.METHODS) {
      if (!m.paramSchema.some((p) => p.key === "mashCoolingRate")) continue;
      const sem = B.passosBrewfather(programa(m.id));
      const com = B.passosBrewfather(M.computeSchedule(m, M.sanitizeParams(m, { ...M.defaultParams(m), mashCoolingRate: 0.05 })));
      assert.deepEqual(com.map((x) => [x.type, x.stepTemp, x.stepTime]), sem.map((x) => [x.type, x.stepTemp, x.stepTime]), m.id);
      assert.deepEqual(com.map((x) => x.name.split(" · ")[0]), sem.map((x) => x.name.split(" · ")[0]), m.id);
    }
  });

  test("pseudo-decocção: a adição de água entra no patamar seguinte", () => {
    const p = B.passosBrewfather(programa("pseudo-decoccao"));
    assert.ok(!p.some((x) => /Adição/.test(x.name)));
    assert.ok(p.some((x) => x.stepTemp === 100 && /Fervura/.test(x.name)));
  });

  test("insumos da receita: água e malte da mostura", () => {
    assert.deepEqual(B.insumosDaReceita({ data: { mashWaterAmount: 30.84, mashFermentablesAmount: 5 } }), { waterVolume: 30.84, grainWeight: 5 });
    assert.equal(B.insumosDaReceita({ data: { mashWaterAmount: null, mashFermentablesAmount: 5 } }), null);
    assert.equal(B.insumosDaReceita({}), null);
  });

  test("o perfil novo mantém o resto da mostura da receita", () => {
    const atual = { _id: "x", name: "Antigo", ph: 5.4, spargeTemp: 76, steps: [{ name: "velho" }] };
    const novo = B.mostraBrewfather(atual, [{ name: "n" }], "Simples");
    assert.deepEqual(novo, { _id: "x", name: "Decocção Simples (Brassagem Forte)", ph: 5.4, spargeTemp: 76, steps: [{ name: "n" }] });
    assert.equal(B.mostraBrewfather(undefined, [], "Hochkurz").name, "Decocção Hochkurz (Brassagem Forte)");
  });
});

describe("cliente da API", () => {
  function fetchFalso(respostas) {
    const chamadas = [];
    const f = async (url, opcoes) => {
      chamadas.push({ url, ...opcoes });
      const r = respostas.shift();
      return { ok: r.status < 400, status: r.status, text: async () => (typeof r.corpo === "string" ? r.corpo : JSON.stringify(r.corpo)) };
    };
    return { f, chamadas };
  }

  test("autenticação Basic com user id e API key", async () => {
    const { f, chamadas } = fetchFalso([{ status: 200, corpo: [] }]);
    await B.bfCliente("u1", "k1", f).receitas();
    assert.equal(chamadas[0].headers.authorization, "Basic " + Buffer.from("u1:k1").toString("base64"));
    assert.equal(chamadas[0].url, "https://api.brewfather.app/v2/recipes?limit=50");
  });

  test("lista todas as receitas, paginando pelo _id, e ordena por nome", async () => {
    const pagina1 = Array.from({ length: 50 }, (_, i) => ({ _id: `a${i}`, name: `Z${i}` }));
    const { f, chamadas } = fetchFalso([{ status: 200, corpo: pagina1 }, { status: 200, corpo: [{ _id: "b0", name: "Alt" }] }]);
    const r = await B.bfCliente("u", "k", f).receitas();
    assert.equal(r.length, 51);
    assert.equal(r[0].name, "Alt");
    assert.match(chamadas[1].url, /start_after=a49$/);
  });

  test("atualizar manda só a mostura num PATCH e aceita a resposta em texto", async () => {
    const { f, chamadas } = fetchFalso([{ status: 200, corpo: "Updated" }]);
    const r = await B.bfCliente("u", "k", f).atualizarMostura("abc", { name: "m", steps: [] });
    assert.equal(r, "Updated");
    assert.equal(chamadas[0].method, "PATCH");
    assert.equal(chamadas[0].url, "https://api.brewfather.app/v2/recipes/abc");
    assert.deepEqual(JSON.parse(chamadas[0].body), { mash: { name: "m", steps: [] } });
  });

  test("erros viram mensagens", async () => {
    const { f } = fetchFalso([{ status: 401, corpo: "Unauthorized" }]);
    await assert.rejects(B.bfCliente("u", "k", f).receita("x"), (e) => e.status === 401);
    assert.match(B.bfMensagemErro({ status: 401 }), /errados/);
    assert.match(B.bfMensagemErro({ status: 403 }), /recipes\.write/);
    assert.match(B.bfMensagemErro({ status: 429 }), /Limite/);
    assert.match(B.bfMensagemErro(new TypeError("Failed to fetch")), /internet/);
  });
});
