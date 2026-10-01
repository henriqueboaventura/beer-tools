/*
 * Interface da ferramenta 06 — Carbonatação: envase, cerveja, alvo, açúcar e
 * o resultado no lote todo ou por garrafa. Os números esperados vêm do
 * calculo.js (conferido contra o Mr Malty à parte).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { suiteUI } = require("./navegador");
const C = require("../../carbonatacao/calculo.js");

const URL_FERRAMENTA = "carbonatacao/";
const br = (n, casas) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const PADRAO = { envase: "vidro", litros: 20, tempC: 20, alvo: 2.4, acucar: "milho", inicio: "fermentada" };

suiteUI("Carbonatação (interface)", (ctx) => {
  async function abrir() {
    const { pag } = ctx;
    pag.erros = [];
    await pag.ir(URL_FERRAMENTA);
    await pag.esperar("ui.$('.cb-destaque__valor')");
  }
  const destaque = () => ctx.pag.avaliar("ui.texto('.cb-destaque__valor')");

  test("abre com o exemplo: 20 L a 20 °C, 2,4 volumes, açúcar de milho no lote todo", async () => {
    const { pag } = ctx;
    await abrir();
    const r = C.calcular(PADRAO);
    assert.equal(await destaque(), br(r.gramas, 0) + " g");
    assert.match(await pag.avaliar("ui.texto('#residualEco')"), /0,86 volumes/);
    assert.deepEqual(await pag.avaliar("ui.$$('#resumo dd').map(d => d.textContent)"), ["0,86 vol", "60 g de CO₂", "2,40 vol"]);
    assert.match(await pag.avaliar("ui.texto('#pressao')"), new RegExp("^" + br(r.pressao.total, 1) + " bar"));
    assert.equal(await pag.avaliar("ui.$('#modo').hidden"), false);
    assert.deepEqual(pag.erros, []);
  });

  test("cada botão de envase tem um ícone", async () => {
    const { pag } = ctx;
    await abrir();
    const r = await pag.avaliar("ui.$$('[data-envase]').map(b => [b.dataset.envase, !!b.querySelector('svg.cb-icone[aria-hidden=\"true\"]'), b.textContent.trim()])");
    assert.deepEqual(r.map((x) => x[0]), Object.keys(C.ENVASES));
    for (const [id, icone, texto] of r) { assert.ok(icone, `${id} sem ícone`); assert.ok(texto.length > 2, `${id} sem texto`); }
  });

  test("por garrafa: as garrafas da speise, com a dose de cada uma", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.clicar('[data-modo=\"garrafa\"]')");
    assert.equal(await pag.avaliar("ui.$('[data-modo=\"garrafa\"]').getAttribute('aria-pressed')"), "true");
    const linhas = await pag.avaliar("ui.$$('.cb-tabela--garrafas tbody tr').map(tr => [...tr.cells].map(c => c.textContent))");
    const r = C.calcular(PADRAO);
    assert.deepEqual(linhas, r.garrafas.map((x) => [x.ml + " mL", br(x.gramas, 2) + " g", String(x.quantas)]));
    assert.deepEqual(linhas.map((l) => parseInt(l[0], 10)), require("../../speise/calculo.js").GARRAFAS_ML);
    // trocar o açúcar mantém a visão por garrafa
    await pag.avaliar("const s = ui.$('#acucar'); s.value = 'sacarose'; s.dispatchEvent(new Event('change', { bubbles: true }))");
    const g500 = await pag.avaliar("ui.$('.cb-tabela--garrafas tr[data-ml=\"500\"] td:nth-child(2)').textContent");
    assert.equal(g500, br(C.calcular({ ...PADRAO, acucar: "sacarose" }).garrafas.find((x) => x.ml === 500).gramas, 2) + " g");
  });

  test("barril: sem dose por garrafa, com espaço vazio, e pede mais açúcar", async () => {
    const { pag } = ctx;
    await abrir();
    const garrafa = await destaque();
    await pag.avaliar("ui.clicar('[data-modo=\"garrafa\"]'); ui.clicar('[data-envase=\"barril\"]')");
    assert.equal(await pag.avaliar("ui.$('#modo').hidden"), true, "barril não tem 'por garrafa'");
    assert.equal(await pag.avaliar("ui.$('#espacoVazioCampo').hidden"), false);
    const r = C.calcular({ ...PADRAO, envase: "barril", espacoVazio: 2 });
    assert.equal(await destaque(), br(r.gramas, 0) + " g", "volta para o lote todo");
    assert.ok(parseInt(await destaque(), 10) > parseInt(garrafa, 10));
  });

  test("temperatura e alvo pelo estilo recalculam; editar o alvo limpa o estilo", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#tempC', '4')");
    assert.match(await pag.avaliar("ui.texto('#residualEco')"), /1,48 volumes/);
    assert.equal(await pag.avaliar("ui.$('#tempArmazenamento').value"), "4", "armazenamento acompanha até ser editado");
    await pag.avaliar("const s = ui.$('#estilo'); s.value = '3.6'; s.dispatchEvent(new Event('change', { bubbles: true }))");
    assert.equal(await pag.avaliar("ui.$('#alvo').value"), "3.6");
    assert.match(await pag.avaliar("ui.texto('#alvoEco')"), /7,1 g de CO₂ por litro/);
    await pag.avaliar("ui.digitar('#alvo', '2.5')");
    assert.equal(await pag.avaliar("ui.$('#estilo').value"), "");
  });

  test("risco de estourar: vidro comum alerta; reforçada aguenta", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#alvo', '3.6')");
    assert.match(await pag.avaliar("ui.texto('#avisos')"), /Risco de garrafa estourar/);
    assert.ok(await pag.avaliar("!!ui.$('#pressao .cb-status--perigo')"));
    await pag.avaliar("ui.clicar('[data-envase=\"vidro-reforcado\"]')");
    assert.doesNotMatch(await pag.avaliar("ui.texto('#avisos')"), /estourar/);
    assert.ok(await pag.avaliar("!!ui.$('#pressao .cb-status--ok')"));
  });

  test("armazenar mais quente sobe a pressão", async () => {
    const { pag } = ctx;
    await abrir();
    const antes = parseFloat((await pag.avaliar("ui.texto('.cb-pressao__valor')")).replace(",", "."));
    await pag.avaliar("ui.digitar('#tempArmazenamento', '32')");
    const depois = parseFloat((await pag.avaliar("ui.texto('.cb-pressao__valor')")).replace(",", "."));
    assert.ok(depois > antes, `${antes} → ${depois}`);
    await pag.avaliar("ui.digitar('#tempC', '18')");
    assert.equal(await pag.avaliar("ui.$('#tempArmazenamento').value"), "32", "depois de editado, não acompanha mais");
  });

  test("sob pressão (spunding): usa o manômetro e pede menos açúcar", async () => {
    const { pag } = ctx;
    await abrir();
    const solta = parseInt(await destaque(), 10);
    await pag.avaliar("ui.clicar('[data-inicio=\"pressao\"]')");
    assert.equal(await pag.avaliar("ui.$('#pressaoCampo').hidden"), false);
    const r = C.calcular({ ...PADRAO, inicio: "pressao", pressaoBar: 1 });
    assert.match(await pag.avaliar("ui.texto('#residualEco')"), new RegExp(br(r.residual, 2) + " volumes"));
    assert.ok(parseInt(await destaque(), 10) < solta);
  });

  test("carbonatação natural: densidade para fechar e válvula", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("const s = ui.$('#acucar'); s.value = 'natural'; s.dispatchEvent(new Event('change', { bubbles: true }))");
    assert.equal(await pag.avaliar("ui.$('#rendimentoCampo').hidden"), true);
    assert.equal(await pag.avaliar("ui.$('#naturalCampo').hidden"), false);
    const r = C.calcular({ ...PADRAO, acucar: "natural", densidadeFinal: 1.010 });
    assert.equal(await destaque(), r.densidadeFechar.toFixed(3) + " SG");
    assert.match(await pag.avaliar("ui.texto('#resultado')"), new RegExp("válvula de spunding em " + br(r.valvulaBar, 1) + " bar"));
    assert.equal(await pag.avaliar("ui.$('#outrosBloco').hidden"), true);
  });

  test("cerveja que já está no alvo: não precisa de açúcar", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#tempC', '0'); ui.digitar('#alvo', '1.6')");
    assert.equal(await destaque(), "0 g");
    assert.match(await pag.avaliar("ui.texto('#resultado')"), /Não precisa de açúcar/);
  });

  test("com outro açúcar: a mesma carbonatação em cada um, com o atual destacado", async () => {
    const { pag } = ctx;
    await abrir();
    const r = C.calcular(PADRAO);
    const linhas = await pag.avaliar("ui.$$('#outros tr').map(tr => [tr.dataset.acucar, tr.cells[1].textContent, tr.classList.contains('cb-atual')])");
    assert.equal(linhas.length, r.outros.length);
    for (const [id, texto, atual] of linhas) {
      const o = r.outros.find((x) => x.id === id);
      assert.equal(texto, (o.gramas >= 100 ? br(o.gramas, 0) : br(o.gramas, 1)) + " g", id);
      assert.equal(atual, id === "milho");
    }
  });

  test("campo vazio pede para preencher, sem erro", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#litros', '')");
    assert.match(await pag.avaliar("ui.texto('#resultado')"), /Preencha volume, temperatura e alvo/);
    assert.deepEqual(pag.erros, []);
  });
});
