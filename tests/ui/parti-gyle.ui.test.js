/*
 * Interface da ferramenta 04 — Parti-gyle: o fluxo guiado
 * (01 Suas cervejas → 02 O plano → 03 No dia) como o cervejeiro usa.
 * O exemplo padrão (BYO: Wee Heavy 19 L a 1.096 + Scottish Export 38 L a
 * 1.048) tem números fixos; nos outros cenários o esperado vem do calculo.js.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { suiteUI } = require("./navegador");
const P = require("../../ferramentas/parti-gyle/calculo.js");

const URL_FERRAMENTA = "ferramentas/parti-gyle/";
const br = (n, casas) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

suiteUI("Parti-gyle (interface)", (ctx) => {
  async function abrir() {
    const { pag } = ctx;
    pag.erros = [];
    await pag.ir(URL_FERRAMENTA);
    await pag.esperar("ui.$('.pg-malte__valor')");
  }
  const cards = () => ctx.pag.avaliar(`ui.$$('#plano .pg-cerveja').map(c => ({
    nome: c.querySelector('.pg-cerveja__nome').textContent,
    coleta: c.querySelector('.pg-cerveja__coleta').textContent.replace(/\\s+/g, ' '),
    status: c.querySelector('.pg-status').textContent,
    ok: c.querySelector('.pg-status').classList.contains('pg-status--ok'),
  }))`);
  const cervejas = (lista) => ctx.pag.avaliar(`(() => {
    ${JSON.stringify(lista)}.forEach((c, i) => { ui.digitar('#vol' + i, String(c[0])); ui.digitar('#og' + i, String(c[1])); });
    return true;
  })()`);

  test("exemplo padrão: malte, ordem da coleta e as duas no alvo", async () => {
    const { pag } = ctx;
    await abrir();
    assert.equal(await pag.avaliar("ui.$('[data-quantas=\"2\"]').getAttribute('aria-pressed')"), "true");
    assert.equal(await pag.avaliar("ui.texto('.pg-malte__valor')"), "16,9 kg de malte");
    const c = await cards();
    assert.deepEqual(c.map((x) => x.nome), ["Wee Heavy", "Scottish Export"]);
    assert.match(c[0].coleta, /^Colete os primeiros 21,1 L/);
    assert.match(c[1].coleta, /^Colete os próximos 42,2 L/);
    assert.ok(c.every((x) => x.ok), "as duas chegam no alvo");
    assert.equal(await pag.avaliar("ui.$('.pg-dica')"), null, "sem dica quando tudo está no alvo");
    assert.equal(await pag.avaliar("ui.$$('.pg-barra__parte').map(p => p.dataset.ordem).join()"), "1,2");
    assert.deepEqual(pag.erros, []);
  });

  test("no dia vem preenchido com a previsão", async () => {
    const { pag } = ctx;
    await abrir();
    assert.equal(await pag.avaliar("ui.$('#medVol0').value"), "21.1");
    assert.equal(await pag.avaliar("ui.$('#medOg0').value"), "1.086");
    assert.equal(await pag.avaliar("ui.$$('#dia .pg-status--ok').length"), 2);
    assert.equal(await pag.avaliar("ui.$$('#dia .pg-dia').map(d => d.dataset.i).join()"), "0,1", "na ordem da coleta");
  });

  test("pedido fora da curva: ajuste por cerveja e a divisão sugerida", async () => {
    const { pag } = ctx;
    await abrir();
    await cervejas([[20, "1.090"], [40, "1.050"]]);
    const c = await cards();
    assert.match(c[0].status, /acrescente 1,1 L de água/);
    assert.match(c[1].status, /ferva mais, até 38,0 L/);
    assert.ok(c.every((x) => !x.ok));
    const dica = await pag.avaliar("ui.texto('.pg-dica')");
    assert.match(dica, /Wee Heavy com 5,0 L/);
    assert.match(dica, /Scottish Export com 55,0 L/);

    await pag.avaliar("ui.clicar('#usarDivisao')");
    assert.equal(await pag.avaliar("ui.$('#vol0').value"), "5.0");
    assert.equal(await pag.avaliar("ui.$('#vol1').value"), "55.0");
    assert.ok((await cards()).every((x) => x.ok), "com a divisão sugerida, as duas no alvo");
    assert.equal(await pag.avaliar("ui.$('.pg-dica')"), null);
  });

  test("a ordem da coleta segue a OG, não a ordem digitada", async () => {
    const { pag } = ctx;
    await abrir();
    await cervejas([[38, "1.048"], [19, "1.096"]]);
    const c = await cards();
    // os nomes ficam nos campos: a 2ª digitada (Scottish Export) agora é a mais densa
    assert.equal(c[0].nome, "Scottish Export", "a mais densa (digitada em 2º) é coletada primeiro");
    assert.match(c[0].coleta, /^Colete os primeiros/);
  });

  test("cervejas parecidas: explica a troca de mosto entre panelas", async () => {
    const { pag } = ctx;
    await abrir();
    await cervejas([[19, "1.060"], [38, "1.045"]]);
    const plano = P.planejar({ cervejas: [{ volume: 19, og: 1.06 }, { volume: 38, og: 1.045 }], evaporacao: 10, eficiencia: 70, ppg: 37 });
    assert.equal(plano.sugestao.tipo, "misturar");
    const dica = await pag.avaliar("ui.texto('.pg-dica')");
    assert.match(dica, /parecidas demais/i);
    const m = plano.sugestao.mistura.cervejas[0];
    assert.ok(dica.includes(br(m.forte, 1) + " L da panela A + " + br(m.fraco, 1) + " L da B"), dica);
  });

  test("diferença grande demais: avisa que não sai só da coleta", async () => {
    const { pag } = ctx;
    await abrir();
    await cervejas([[19, "1.100"], [38, "1.020"]]);
    assert.match(await pag.avaliar("ui.texto('.pg-dica')"), /grande demais/i);
    assert.equal(await pag.avaliar("ui.$('#usarDivisao')"), null);
  });

  test("no dia: medida diferente mostra ajuste e lúpulo, sem perder o foco", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#medOg0', '1.095')");
    assert.equal(await pag.avaliar("document.activeElement.id"), "medOg0", "foco continua no campo");
    const saida = await pag.avaliar("ui.texto('#dia .pg-dia[data-i=\"0\"] .pg-dia__saida')");
    assert.match(saida, /acrescente [\d,]+ L de água/);
    assert.match(saida, /Lúpulo: multiplique as quantidades da receita por [\d,]+/);
    const [r] = P.noDia({ cervejas: [{ volume: 19, og: 1.096 }], medidas: [{ volume: 21.1, og: 1.095 }], evaporacao: 10 });
    assert.ok(saida.includes("por " + br(r.fatorLupulo, 2)), saida);

    // recalcular o plano não apaga o que foi medido
    await pag.avaliar("ui.digitar('#eficiencia', '75')");
    assert.equal(await pag.avaliar("ui.$('#medOg0').value"), "1.095");

    await pag.avaliar("ui.clicar('#voltarPrevisao')");
    assert.equal(await pag.avaliar("ui.$('#medOg0').value"), "1.086");
    assert.equal(await pag.avaliar("ui.$$('#dia .pg-status--ok').length"), 2, "de volta à previsão, as duas no alvo");
  });

  test("3 cervejas: Forte, Média e Leve, todas no alvo", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.clicar('[data-quantas=\"3\"]')");
    assert.equal(await pag.avaliar("ui.$('[data-quantas=\"3\"]').getAttribute('aria-pressed')"), "true");
    const c = await cards();
    assert.deepEqual(c.map((x) => x.nome), ["Forte", "Média", "Leve"]);
    assert.ok(c.every((x) => x.ok));
    assert.equal(await pag.avaliar("ui.$('.pg-dica')"), null, "dica só existe para 2 cervejas");
    assert.equal(await pag.avaliar("ui.$$('#dia .pg-dia').length"), 3);
  });

  test("campo vazio pede para preencher; voltar para 2 restaura o exemplo", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.clicar('[data-quantas=\"3\"]')");
    await pag.avaliar("ui.digitar('#og1', '')");
    assert.match(await pag.avaliar("ui.texto('#plano')"), /Preencha volume e OG/);
    assert.equal(await pag.avaliar("ui.texto('#dia')"), "");
    await pag.avaliar("ui.clicar('[data-quantas=\"2\"]')");
    assert.deepEqual((await cards()).map((x) => x.nome), ["Wee Heavy", "Scottish Export"]);
    assert.deepEqual(pag.erros, []);
  });

  test("sem rolagem lateral no celular com 3 cervejas e ajustes na tela", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.clicar('[data-quantas=\"3\"]')");
    await pag.avaliar("ui.digitar('#og0', '1.110'); ui.digitar('#medOg1', '1.070')");
    assert.ok(await pag.avaliar("ui.semRolagemLateral()"));
  });
});
