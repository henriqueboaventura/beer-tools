// Invariantes do data/leveduras.json (gerado por scripts/gerar_leveduras.py)
// e casos conferidos à mão contra as fontes.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PASTA = path.join(__dirname, "..");
const RAIZ = path.join(PASTA, "..", "..");
const DB = JSON.parse(fs.readFileSync(path.join(PASTA, "data", "leveduras.json"), "utf8"));
const porId = new Map(DB.leveduras.map((y) => [y.id, y]));
const FONTES = new Set(Object.keys(DB.fontes));
const CATEGORIAS = new Set(DB.categorias.map((c) => c.id));

function rel(a, b) {
  return (DB.relacoes[a] || []).find((r) => r[0] === b);
}

describe("estrutura", () => {
  test("ids únicos", () => {
    assert.equal(porId.size, DB.leveduras.length);
  });

  test("toda levedura tem fabricante conhecido, nome, categoria e fonte válidos", () => {
    for (const y of DB.leveduras) {
      assert.ok(DB.fabricantes[y.fab], `${y.id}: fabricante ${y.fab}`);
      assert.ok(y.nome && y.nome.trim(), `${y.id}: sem nome`);
      assert.ok(CATEGORIAS.has(y.cat), `${y.id}: categoria ${y.cat}`);
      assert.ok(["seca", "liquida", undefined].includes(y.forma), `${y.id}: forma ${y.forma}`);
      assert.ok(y.fontes.length > 0, `${y.id}: sem fonte`);
      for (const f of y.fontes) assert.ok(FONTES.has(f), `${y.id}: fonte ${f}`);
    }
  });

  test("faixas numéricas coerentes (atenuação e temperatura)", () => {
    for (const y of DB.leveduras) {
      if (y.aten) assert.ok(y.aten[0] <= y.aten[1] && y.aten[0] >= 40 && y.aten[1] <= 100, `${y.id}: aten ${y.aten}`);
      if (y.atenYm) assert.ok(y.atenYm >= 40 && y.atenYm <= 100, `${y.id}: atenYm ${y.atenYm}`);
      if (y.temp) assert.ok(y.temp[0] <= y.temp[1] && y.temp[0] >= 0 && y.temp[1] <= 45, `${y.id}: temp ${y.temp}`);
    }
  });

  test("relações apontam para leveduras que existem, com nível 1–3 e fontes válidas", () => {
    for (const [a, lista] of Object.entries(DB.relacoes)) {
      assert.ok(porId.has(a), `relação de ${a}, que não existe`);
      for (const [b, nivel, fontes] of lista) {
        assert.ok(porId.has(b), `${a} -> ${b} não existe`);
        assert.notEqual(a, b, `${a} ligada a si mesma`);
        assert.ok([1, 2, 3].includes(nivel), `${a} -> ${b}: nível ${nivel}`);
        for (const f of fontes) assert.ok(FONTES.has(f), `${a} -> ${b}: fonte ${f}`);
      }
    }
  });

  test("relações são simétricas e com o mesmo nível nos dois sentidos", () => {
    for (const [a, lista] of Object.entries(DB.relacoes)) {
      for (const [b, nivel] of lista) {
        const volta = rel(b, a);
        assert.ok(volta, `${a} -> ${b} sem volta`);
        assert.equal(volta[1], nivel, `${a} <-> ${b}: níveis diferentes`);
      }
    }
  });

  test("sem relação duplicada", () => {
    for (const [a, lista] of Object.entries(DB.relacoes)) {
      const alvos = lista.map((r) => r[0]);
      assert.equal(new Set(alvos).size, alvos.length, `${a} tem alvo repetido`);
    }
  });

  test('"não confunda" aponta para leveduras que existem e nunca é também uma relação', () => {
    for (const [a, lista] of Object.entries(DB.naoConfundir)) {
      assert.ok(porId.has(a));
      for (const b of lista) {
        assert.ok(porId.has(b), `naoConfundir ${a} -> ${b}`);
        assert.equal(rel(a, b), undefined, `${a} x ${b} está nas duas listas`);
      }
    }
  });

  test("inferências não revisadas nunca passam de Provável", () => {
    for (const lista of Object.values(DB.relacoes)) {
      for (const [, nivel, fontes] of lista) {
        if (fontes.length === 1 && (fontes[0] === "inferida" || fontes[0] === "curadoria")) assert.ok(nivel <= 2);
      }
    }
  });
});

describe("casos conferidos à mão contra as fontes", () => {
  test("WLP001 ≡ Omega OYL-004 (Yeast Master, AEB, Imperial)", () => {
    const r = rel("white-labs-wlp001", "omega-oyl-004");
    assert.equal(r[1], 3);
    assert.deepEqual(r[2], ["aeb", "imperial", "ym"]);
  });

  test("US-05 × WLP001: AEB diz equivalente, Yeast Master diz que não -> Alternativa com nota", () => {
    const r = rel("fermentis-us-05", "white-labs-wlp001");
    assert.equal(r[1], 1);
    assert.match(r[3], /Yeast Master indica que são cepas diferentes/);
  });

  test('US-05 "não confunda" inclui LalBrew BRY-97', () => {
    assert.ok(DB.naoConfundir["fermentis-us-05"].includes("lallemand-bry-97"));
  });

  test("W-34/70 × Imperial L13: contradição do Yeast Master rebaixa para Alternativa", () => {
    assert.equal(rel("fermentis-w-34-70", "imperial-l13")[1], 1);
  });

  test("Levteck TB10 -> Wyeast 1272: curadoria + tabela do fabricante, Provável", () => {
    const r = rel("levteck-tb10", "wyeast-1272");
    assert.equal(r[1], 2);
    assert.deepEqual(r[2], ["curadoria", "levteck"]);
  });

  test("Levteck TB10 -> US-05 só pela tabela do fabricante: Alternativa", () => {
    const r = rel("levteck-tb10", "fermentis-us-05");
    assert.equal(r[1], 1);
    assert.deepEqual(r[2], ["levteck"]);
  });

  test("Levteck TB07 existe, fora do catálogo", () => {
    const y = porId.get("levteck-tb07");
    assert.ok(y && y.foraCatalogo);
  });

  test("Smartyeast é líquida e nacional", () => {
    for (const y of DB.leveduras.filter((l) => l.fab === "smartyeast")) assert.equal(y.forma, "liquida");
    assert.equal(DB.fabricantes.smartyeast.nacional, true);
  });

  test("vínculo incerto (SMART-568 -> S-33) não se propaga para as equivalentes da S-33", () => {
    assert.equal(DB.relacoes["smartyeast-smart-568"].length, 1);
  });

  test("Bio4 só tem vínculos não revisados", () => {
    for (const y of DB.leveduras.filter((l) => l.fab === "bio4")) {
      for (const [, , fontes] of DB.relacoes[y.id] || []) assert.deepEqual(fontes, ["inferida"], y.id);
    }
  });
});

describe("fontes transcritas (dados/leveduras/*.json)", () => {
  const REF = /^[a-z0-9-]+:[^|]+(\|.+)?$/;
  const fabs = new Set(Object.keys(DB.fabricantes));
  const refsDe = (obj) => JSON.stringify(obj).match(/"[a-z0-9-]+:[^"]*"/g).map((s) => s.slice(1, -1));

  for (const arq of ["aeb.json", "imperial.json", "nacionais.json"]) {
    test(`${arq}: JSON válido e referências "fabricante:CÓDIGO" com fabricante conhecido`, () => {
      const dados = JSON.parse(fs.readFileSync(path.join(RAIZ, "dados", "leveduras", arq), "utf8"));
      for (const r of refsDe(dados.linhas || dados.leveduras)) {
        if (/^https?:/.test(r)) continue;
        assert.match(r, REF, r);
        assert.ok(fabs.has(r.split(":")[0]), `${arq}: fabricante de ${r}`);
      }
    });
  }
});
