// Busca (busca.js) contra os dados reais.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const B = require("../busca.js");

const DB = B.indexar(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "leveduras.json"), "utf8")));
const primeiro = (q, cat) => (B.buscar(DB, q, cat)[0] || {}).id;

describe("norm", () => {
  test("ignora acento, caixa, hífen e espaço", () => {
    assert.equal(B.norm("SafAle US-05"), "safaleus05");
    assert.equal(B.norm("Kölsch"), "kolsch");
    assert.equal(B.norm(null), "");
  });
});

describe("buscar", () => {
  const casos = {
    "us05": "fermentis-us-05",
    "US-05": "fermentis-us-05",
    "fermentis us-05": "fermentis-us-05",
    "1056": "wyeast-1056",
    "wyeast 1056": "wyeast-1056",
    "wlp001": "white-labs-wlp001",
    "white labs wlp001": "white-labs-wlp001",
    "imperial l17": "imperial-l17",
    "l17 imperial": "imperial-l17",
    "teckbrew 10": "levteck-tb10",
    "levteck 10": "levteck-tb10",
    "smart 528": "smartyeast-smart-528",
    "lalbrew verdant": "lallemand-verdant-ipa",
  };
  for (const [q, esperado] of Object.entries(casos)) {
    test(`"${q}" traz ${esperado} em primeiro`, () => assert.equal(primeiro(q), esperado));
  }

  test("busca pela origem: \"chico\" traz leveduras de origem Chico", () => {
    const r = B.buscar(DB, "chico");
    assert.ok(r.length > 0);
    assert.ok(r.every((y) => y._busca.includes("chico")));
  });

  test("nada encontrado devolve lista vazia", () => {
    assert.deepEqual(B.buscar(DB, "xyzxyz"), []);
  });

  test("categoria filtra (e \"todas\" não filtra)", () => {
    const lager = B.buscar(DB, "", "lager");
    assert.ok(lager.length > 0 && lager.every((y) => y.cat === "lager"));
    assert.equal(B.buscar(DB, "", "todas").length, DB.leveduras.length);
  });

});

describe("resolverId (?levedura=)", () => {
  test("aceita o id", () => assert.equal(B.resolverId(DB, "fermentis-us-05"), "fermentis-us-05"));
  test("aceita só o código", () => assert.equal(B.resolverId(DB, "us-05"), "fermentis-us-05"));
  test("desconhecido devolve null", () => assert.equal(B.resolverId(DB, "nao-existe"), null));
  test("vazio devolve null", () => assert.equal(B.resolverId(DB, ""), null));
});
