/*
 * Interface da ferramenta 05 — Spunding: pressão ou carbonatação, a cerveja e em que
 * densidade fechar a válvula. Os números esperados vêm do spunding/calculo.js.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { suiteUI } = require("./navegador");
const S = require("../../spunding/calculo.js");

const URL_FERRAMENTA = "spunding/";
const br = (n, casas) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const PADRAO = { modo: "bar", valor: 1, tempC: 18, litros: 20, capacidade: 30, fg: 1.010 };

suiteUI("Spunding (interface)", (ctx) => {
  async function abrir() {
    const { pag } = ctx;
    pag.erros = [];
    await pag.ir(URL_FERRAMENTA);
    await pag.esperar("ui.$('.spd-destaque__valor')");
  }

  test("abre em 1 bar: densidade para fechar e os volumes", async () => {
    const { pag } = ctx;
    await abrir();
    const r = S.calcular(PADRAO);
    assert.equal(await pag.avaliar("ui.texto('.spd-destaque__rotulo')"), "Feche a válvula em");
    assert.equal(await pag.avaliar("ui.texto('.spd-destaque__valor')"), r.densidadeFechar.toFixed(3) + " SG");
    assert.match(await pag.avaliar("ui.texto('.spd-destaque__sub')"), new RegExp("^" + r.pontosFechar + " pontos antes da final"));
    const det = await pag.avaliar("ui.texto('#detalhe')");
    assert.match(det, new RegExp(br(r.volumes, 2) + " volumes"));
    assert.match(det, /10,0 L de espaço vazio/);
    assert.match(await pag.avaliar("ui.texto('#avisoPressao')"), /pressão que o seu equipamento aguenta/);
    assert.deepEqual(pag.erros, []);
  });

  test("em volumes: troca o rótulo e converte para bar", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.clicar('[data-modo=\"vol\"]')");
    assert.match(await pag.avaliar("ui.texto('#valorRotulo')"), /Carbonatação/);
    assert.equal(await pag.avaliar("ui.$('#valor').value"), "2.5");
    const r = S.calcular({ ...PADRAO, modo: "vol", valor: 2.5 });
    assert.equal(await pag.avaliar("ui.texto('.spd-destaque__valor')"), r.densidadeFechar.toFixed(3) + " SG");
    assert.match(await pag.avaliar("ui.texto('.spd-destaque__sub')"), new RegExp(br(r.bar, 2) + " bar"));
    await pag.avaliar("ui.digitar('#valor', '0.5')");
    assert.match(await pag.avaliar("ui.texto('#resultado')"), /Não precisa fechar/);
  });

  test("entradas inválidas", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#capacidade', '15')");
    assert.match(await pag.avaliar("ui.texto('#resultado')"), /não cabe no fermentador/);
    await pag.avaliar("ui.digitar('#capacidade', '30'); ui.digitar('#fg', '')");
    assert.match(await pag.avaliar("ui.texto('#resultado')"), /Preencha/);
    assert.equal(await pag.avaliar("ui.texto('#detalhe')"), "");
  });

  test("carbonatação aponta para o spunding", async () => {
    const { pag } = ctx;
    await pag.ir("carbonatacao/");
    assert.equal(await pag.avaliar("ui.$('#spundingLink a').getAttribute('href')"), "../spunding/");
  });
});
