"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const M = require("../mapa.js");

const TIPOS = new Set(M.TIPOS);
const SUBTIPOS = new Set(M.MOSTURA_SUBTIPOS);

const NOMES_ADICAO = new Set(M.ADICAO_NOMES);

// adições de uma etapa (por índice), do array top-level receita.adicoes
function adicoesDa(receita, idx) {
  return (receita.adicoes || []).filter((a) => a.id_etapa === idx);
}

// invariantes de validação do firmware que todo payload precisa respeitar
function conferirInvariantes(receita) {
  assert.ok(receita.etapas.length >= 1, "precisa de ao menos uma etapa");
  assert.ok(receita.nome.length <= M.MAX_NOME_RECEITA);
  for (const e of receita.etapas) {
    assert.ok(TIPOS.has(e.tipo), `tipo inválido: ${e.tipo}`);
    assert.notStrictEqual(e.nome, "Mostura", "nome nunca 'Mostura'");
    if (e.tipo === "Mostura") {
      assert.ok(SUBTIPOS.has(e.nome), `sub-tipo inválido: ${e.nome}`);
    } else {
      assert.strictEqual(e.nome, e.tipo, "não-mostura: nome == tipo");
    }
    for (const k of ["iTemperatura", "iTempo", "iRampa"]) assert.ok(Number.isInteger(e[k]));
  }
  // adições: array top-level, cada uma aponta uma etapa válida por índice
  assert.ok(Array.isArray(receita.adicoes));
  for (const a of receita.adicoes) {
    assert.ok(NOMES_ADICAO.has(a.nome), `nome de adição inválido: ${a.nome}`);
    assert.ok(a.nome.length <= 18, "nomeAdicao <= 18 chars");
    assert.ok(Number.isInteger(a.tempo), "tempo inteiro");
    assert.ok(Number.isInteger(a.id_etapa) && a.id_etapa >= 0 && a.id_etapa < receita.etapas.length, `id_etapa fora de faixa: ${a.id_etapa}`);
    assert.strictEqual(a.bActive, true);
    assert.strictEqual(a.executed, false);
  }
}

test("mostura: sub-tipo por temperatura", () => {
  assert.strictEqual(M.subtipoMosturaPorTemp(52), "Protease");
  assert.strictEqual(M.subtipoMosturaPorTemp(63), "Beta-Amilase");
  assert.strictEqual(M.subtipoMosturaPorTemp(67), "Beta&Alfa Amilase");
  assert.strictEqual(M.subtipoMosturaPorTemp(72), "Alfa-Amilase");
  assert.strictEqual(M.subtipoMosturaPorTemp(78), "Mash Out");
});

test("mostura: sub-tipo pelo NOME do passo no Brewfather (fallback temperatura)", () => {
  // nome bate com sub-tipo -> usa o nome, mesmo contra a faixa de temperatura
  assert.strictEqual(M.subtipoMostura("Mash Out", 67), "Mash Out");
  assert.strictEqual(M.subtipoMostura("Protein Rest", 55), "Protease");
  assert.strictEqual(M.subtipoMostura("Sacarificação", 67), "Beta&Alfa Amilase");
  assert.strictEqual(M.subtipoMostura("Mash In", 50), "Infusao");
  assert.strictEqual(M.subtipoMostura("Beta Amilase", 67), "Beta-Amilase");
  // nome vazio/desconhecido -> cai na temperatura
  assert.strictEqual(M.subtipoMostura("", 72), "Alfa-Amilase");
  assert.strictEqual(M.subtipoMostura("Passo 1", 52), "Protease");
});

test("receita simples: mostura única + fervura + resfriamento", () => {
  const recipe = {
    name: "American Pale Ale",
    mash: { steps: [{ type: "Temperature", stepTemp: 67, stepTime: 60 }] },
    boilTime: 60,
    hops: [],
    fermentation: { steps: [{ stepTemp: 18 }] },
  };
  const { receita, avisos } = M.mapear(recipe);
  conferirInvariantes(receita);
  const tipos = receita.etapas.map((e) => e.tipo);
  assert.deepStrictEqual(tipos, ["Mostura", "Fervura", "Resfriamento"]);
  assert.strictEqual(receita.etapas[0].iTemperatura, 67);
  assert.strictEqual(receita.etapas[0].iTempo, 60);
  assert.strictEqual(receita.etapas[1].iTempo, 60); // fervura
  assert.strictEqual(receita.etapas[2].iTemperatura, 18); // pitch
  assert.strictEqual(avisos.length, 0);
});

test("fervura: UMA etapa com lúpulos em adicoes[] (tempo = min restantes)", () => {
  const recipe = {
    name: "IPA",
    mash: { steps: [{ stepTemp: 66, stepTime: 60 }] },
    boilTime: 60,
    hops: [
      { name: "Magnum", use: "Boil", time: 60 },
      { name: "Cascade", use: "Boil", time: 15 },
      { name: "Citra", use: "Boil", time: 5 },
    ],
    miscs: [{ name: "Whirlfloc", use: "Boil", time: 10 }],
    fermentation: { steps: [{ stepTemp: 19 }] },
  };
  const { receita } = M.mapear(recipe);
  conferirInvariantes(receita);
  const fervuras = receita.etapas.filter((e) => e.tipo === "Fervura");
  assert.strictEqual(fervuras.length, 1);
  assert.strictEqual(fervuras[0].iTempo, 60);
  const idxF = receita.etapas.indexOf(fervuras[0]);
  const ad = adicoesDa(receita, idxF);
  assert.deepStrictEqual(ad.map((a) => [a.nome, a.tempo]), [
    ["Lplo Amargor", 60],
    ["Lplo Amargor/Sabor", 15],
    ["Add. Clarificante", 10],
    ["Lupulo Sabor", 5],
  ]);
});

test("sais/ácidos vão na 1ª etapa; vários sais viram uma só adição", () => {
  const recipe = {
    name: "NEIPA",
    mash: { steps: [{ stepTemp: 66, stepTime: 60 }] },
    boilTime: 60,
    hops: [{ name: "Citra", use: "Boil", time: 10 }],
    miscs: [
      { name: "Gypsum", use: "Mash", time: 0 },
      { name: "Calcium Chloride", use: "Mash", time: 0 },
      { name: "Epsom Salt", use: "Sparge", time: 0 },
      { name: "Lactic Acid", use: "Mash", time: 0 },
      { name: "Whirlfloc", use: "Boil", time: 10 },
    ],
  };
  const { receita } = M.mapear(recipe);
  conferirInvariantes(receita);
  const nomes = adicoesDa(receita, 0).map((a) => a.nome);
  // uma única Add. Sais e um Add. Acido, ambos na 1ª etapa
  assert.strictEqual(nomes.filter((n) => n === "Add. Sais").length, 1);
  assert.strictEqual(nomes.filter((n) => n === "Add. Acido").length, 1);
  // não aparecem na fervura
  const idxF = receita.etapas.findIndex((e) => e.tipo === "Fervura");
  const adF = adicoesDa(receita, idxF);
  assert.ok(adF.every((a) => !["Add. Sais", "Add. Acido"].includes(a.nome)));
  // o Whirlfloc (clarificante) continua na fervura
  assert.ok(adF.some((a) => a.nome === "Add. Clarificante"));
});

test("decocção vira mostura base + aviso", () => {
  const recipe = {
    name: "Bock",
    mash: { steps: [
      { type: "Temperature", stepTemp: 50, stepTime: 15 },
      { type: "Decoction", stepTemp: 64, stepTime: 30, name: "Decocção 1" },
      { type: "Decoction", stepTemp: 72, stepTime: 20, name: "Decocção 2" },
    ] },
    boilTime: 90,
    hops: [],
  };
  const { receita, avisos } = M.mapear(recipe);
  conferirInvariantes(receita);
  const mosturas = receita.etapas.filter((e) => e.tipo === "Mostura");
  assert.strictEqual(mosturas.length, 3); // todas viram mostura base
  const avisosDec = avisos.filter((a) => /DECOC/i.test(a));
  assert.strictEqual(avisosDec.length, 2);
  // sem opção de alerta: nenhuma adição apontando as mosturas
  const idxsMostura = receita.etapas.map((e, i) => e.tipo === "Mostura" ? i : -1).filter((i) => i >= 0);
  assert.ok(idxsMostura.every((i) => adicoesDa(receita, i).length === 0));
});

test("decocção com alerta crava adição no patamar", () => {
  const recipe = {
    name: "Bock",
    mash: { steps: [
      { type: "Temperature", stepTemp: 50, stepTime: 15 },
      { type: "Decoction", stepTemp: 64, stepTime: 30, name: "Decocção 1" },
    ] },
    boilTime: 90, hops: [],
  };
  const { receita } = M.mapear(recipe, { decoccaoAlerta: "Mexer Cama Malte" });
  conferirInvariantes(receita);
  const idxDec = receita.etapas.findIndex((e) => e.tipo === "Mostura" && e.iTemperatura === 64);
  assert.deepStrictEqual(adicoesDa(receita, idxDec).map((a) => [a.nome, a.tempo]), [["Mexer Cama Malte", 30]]);
  // o patamar sem decocção continua sem adição
  const idxBase = receita.etapas.findIndex((e) => e.iTemperatura === 50);
  assert.strictEqual(adicoesDa(receita, idxBase).length, 0);
});

test("first wort hop e hop stand viram etapas próprias", () => {
  const recipe = {
    name: "Pils",
    mash: { steps: [{ stepTemp: 72, stepTime: 30 }] },
    boilTime: 60,
    hops: [
      { name: "Saaz FWH", use: "First Wort", time: 60 },
      { name: "Saaz WP", use: "Aroma", time: 20, temp: 80 },
    ],
  };
  const { receita } = M.mapear(recipe);
  conferirInvariantes(receita);
  const tipos = receita.etapas.map((e) => e.tipo);
  assert.ok(tipos.includes("First Wort Hop"));
  const idxHs = receita.etapas.findIndex((e) => e.tipo === "Hop Stand");
  assert.ok(idxHs >= 0);
  const hs = receita.etapas[idxHs];
  assert.strictEqual(hs.iTemperatura, 80);
  assert.strictEqual(hs.iTempo, 20);
  assert.deepStrictEqual(adicoesDa(receita, idxHs).map((a) => a.nome), ["Lupulo Aroma"]);
});

test("recirculação desligada em whirlpool/resfriamento", () => {
  const e = M.etapa("Resfriamento", { iTemperatura: 20 });
  assert.strictEqual(e.bPump, false);
  const m = M.etapa("Mostura", { nome: "Infusao", iTemperatura: 65, iTempo: 10 });
  assert.strictEqual(m.bPump, true);
});

test("nome de receita longo é cortado com aviso", () => {
  const recipe = {
    name: "Uma Receita Com Nome Absurdamente Longo Que Nao Cabe",
    mash: { steps: [{ stepTemp: 65, stepTime: 60 }] },
    boilTime: 60, hops: [],
  };
  const { receita, avisos } = M.mapear(recipe);
  assert.ok(receita.nome.length <= M.MAX_NOME_RECEITA);
  assert.ok(avisos.some((a) => /caracteres/i.test(a)));
});

test("abreviarNome: cabe em 18, de-vowel das palavras longas, corte no fim", () => {
  assert.strictEqual(M.MAX_NOME_RECEITA, 18);
  // já cabe -> intacto (só normaliza espaços)
  assert.strictEqual(M.abreviarNome("Golden Ale"), "Golden Ale");
  assert.strictEqual(M.abreviarNome("  Hazy   IPA  "), "Hazy IPA");
  // estoura -> abrevia pra <= 18 e continua legível
  const a = M.abreviarNome("American Pale Ale");
  assert.ok(a.length <= 18, a);
  assert.ok(/A/.test(a)); // mantém iniciais
  // nome gigante numa palavra só -> corta
  const b = M.abreviarNome("Barleywineimperialstout");
  assert.ok(b.length <= 18);
});

test("opts.nome sobrescreve o nome (campo editável da UI)", () => {
  const recipe = {
    name: "Um Nome Enorme De Receita Que Nao Cabe",
    mash: { steps: [{ stepTemp: 66, stepTime: 60 }] },
    boilTime: 60, hops: [],
  };
  const { receita, avisos } = M.mapear(recipe, { nome: "Minha IPA" });
  assert.strictEqual(receita.nome, "Minha IPA");
  // com nome manual, não avisa sobre corte do nome do Brewfather
  assert.ok(!avisos.some((a) => /caracteres/i.test(a)));
  // nome manual gigante ainda é cortado em 18 por segurança
  const r2 = M.mapear(recipe, { nome: "ABCDEFGHIJKLMNOPQRSTUV" });
  assert.ok(r2.receita.nome.length <= 18);
});

test("requisicao e curl apontam para /receita", () => {
  const req = M.requisicao("http://192.168.0.50/", { nomeReceita: "x", etapas: [] });
  assert.strictEqual(req.url, "http://192.168.0.50/receita");
  assert.strictEqual(req.method, "POST");
  assert.match(M.comandoCurl("http://192.168.0.50", { nomeReceita: "x", etapas: [] }), /curl -X POST/);
});
