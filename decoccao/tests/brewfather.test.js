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
  test("Simples: proteína, sacarificação pela decocção e mash out", () => {
    const p = B.passosBrewfather(programa("simples"));
    assert.deepEqual(p.map((x) => [x.type, x.stepTemp]), [["Temperature", 53], ["Decoction", 66], ["Temperature", 75]]);
    assert.match(p[0].name, /^Rampa de proteína$/);
    assert.match(p[1].name, /^Rampa de sacarificação · decocção de 6,5 L, fervura 15 min$/);
    assert.equal(p[2].rampTime, 5, "o aquecimento do mash out vira rampa");
    assert.equal(p[2].stepTime, 10);
    for (const x of p) assert.equal(x.displayStepTemp, x.stepTemp);
  });

  test("o passo Decoction leva o nosso volume e o descanso da decocção", () => {
    const [, sacc] = B.passosBrewfather(programa("simples"));
    assert.equal(sacc.decoctionAmountMode, "volume", "senão o Brewfather calcula o volume dele");
    assert.equal(sacc.decoctionAmount, 6.5);
    assert.equal(sacc.decoctionRestTemp, 68);
    assert.equal(sacc.decoctionRestTime, 10);
    // a 2ª do Hochkurz vai direto à fervura, sem descanso
    const h = B.passosBrewfather(programa("hochkurz")).filter((x) => x.type === "Decoction");
    assert.deepEqual(h.map((x) => [x.decoctionAmount, x.decoctionRestTemp, x.decoctionRestTime]), [[5.5, 71, 10], [4, null, null]]);
    for (const x of B.passosBrewfather(programa("simples")).filter((y) => y.type !== "Decoction")) assert.equal(x.decoctionAmountMode, undefined);
  });

  test("devolução em partes: o resto da decocção não vira outra puxada", () => {
    const p = B.passosBrewfather(programa("dupla-aprimorada"));
    const resto = p.find((x) => /devolver o resto/.test(x.name));
    assert.equal(resto.type, "Temperature");
    assert.equal(resto.stepTemp, 66);
  });

  test("o tempo da decocção conta no patamar em que a mostura espera", () => {
    for (const m of M.METHODS) {
      const rows = programa(m.id);
      const total = rows[rows.length - 1].totalMin;
      const soma = B.passosBrewfather(rows).reduce((s, x) => s + x.stepTime + (x.rampTime || 0), 0);
      assert.ok(Math.abs(soma - total) <= rows.length * 0.5, `${m.id}: ${soma} × ${total}`);
    }
  });

  test("um passo por temperatura da mostura, sem repetir", () => {
    for (const m of M.METHODS) {
      const p = B.passosBrewfather(programa(m.id));
      for (let i = 1; i < p.length; i++) assert.ok(Math.abs(p[i].stepTemp - p[i - 1].stepTemp) > 1, `${m.id} passo ${i + 1}`);
      for (const x of p) {
        assert.ok(x.stepTime >= 0 && x.stepTime <= 360, m.id);
        assert.ok(x.rampTime === null || (x.rampTime > 0 && x.rampTime <= 60), m.id);
        assert.ok(["Temperature", "Decoction"].includes(x.type), m.id);
        if (x.type === "Decoction") assert.ok(x.decoctionAmount > 0, m.id);
      }
    }
  });

  test("cada decocção aparece uma vez, no passo que ela alcança", () => {
    for (const m of M.METHODS) {
      const rows = programa(m.id);
      const puxadas = rows.filter((r) => r.decoctionVolumeL !== undefined).length;
      const p = B.passosBrewfather(rows);
      assert.equal(p.filter((x) => /decocção de/.test(x.name)).length, puxadas, m.id);
      assert.equal(p.filter((x) => x.type === "Decoction").length, puxadas, m.id);
      for (const x of p.filter((y) => /decocção de/.test(y.name))) assert.equal(x.type, "Decoction", m.id);
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
