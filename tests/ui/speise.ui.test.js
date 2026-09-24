/*
 * Interface da ferramenta 03 — Speise.
 * Os números esperados vêm do próprio calculo.js (testado à parte): aqui se
 * confere que a tela lê os campos, mostra o resultado e avisa certo.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { suiteUI } = require("./navegador");
const S = require("../../ferramentas/speise/calculo.js");

const URL_FERRAMENTA = "ferramentas/speise/";
const br = (n, casas) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

suiteUI("Speise (interface)", (ctx) => {
  async function abrir() {
    const { pag } = ctx;
    pag.erros = [];
    await pag.ir(URL_FERRAMENTA);
    await pag.esperar("ui.texto('#speise') !== '0'");
  }

  test("abre com o exemplo e o resultado do cálculo", async () => {
    const { pag } = ctx;
    await abrir();
    const r = S.calcular({ volume: 20, og: 1.05, unidade: "sg", atenuacao: 75, alvoCO2: 2.4, temperatura: 20 });
    assert.equal(await pag.avaliar("ui.texto('#speise')"), br(r.speise, 2));
    assert.equal(await pag.avaliar("ui.texto('#speise2')"), br(r.speise, 2) + " L");
    assert.equal(await pag.avaliar("ui.texto('#principal')"), br(r.principal, 2) + " L");
    assert.equal(await pag.avaliar("ui.$('#aviso').hidden"), true);
    assert.equal(await pag.avaliar("ui.$$('#garrafas tr').length"), S.GARRAFAS_ML.length);
    assert.deepEqual(pag.erros, []);
  });

  test("mudar os campos recalcula na hora", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#volume', '40'); ui.digitar('#alvo', '2.8'); ui.digitar('#temperatura', '12')");
    await pag.avaliar("const a = ui.$('#atenuacao'); a.value = '80'; a.dispatchEvent(new Event('input', { bubbles: true }))");
    const r = S.calcular({ volume: 40, og: 1.05, unidade: "sg", atenuacao: 80, alvoCO2: 2.8, temperatura: 12 });
    assert.equal(await pag.avaliar("ui.texto('#speise')"), br(r.speise, 2));
    assert.equal(await pag.avaliar("ui.texto('#atenuacaoValor')"), "80%");
  });

  test("trocar para °P converte a OG e mantém o resultado", async () => {
    const { pag } = ctx;
    await abrir();
    const antes = await pag.avaliar("ui.texto('#speise')");
    await pag.avaliar("ui.clicar('[data-unidade=\"plato\"]')");
    assert.equal(await pag.avaliar("ui.$('[data-unidade=\"plato\"]').getAttribute('aria-pressed')"), "true");
    assert.equal(await pag.avaliar("ui.$('#og').value"), S.sgParaPlato(1.05).toFixed(1));
    const depois = await pag.avaliar("ui.texto('#speise')");
    assert.ok(Math.abs(parseFloat(depois.replace(",", ".")) - parseFloat(antes.replace(",", "."))) < 0.02, `${antes} × ${depois}`);
    await pag.avaliar("ui.clicar('[data-unidade=\"sg\"]')");
    assert.equal(await pag.avaliar("ui.$('#og').value"), "1.050");
  });

  test("avisa OG inválida e quando a speise não é necessária", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#og', '0.990')");
    assert.equal(await pag.avaliar("ui.$('#aviso').hidden"), false);
    assert.match(await pag.avaliar("ui.texto('#aviso')"), /maior que 1\.000/);

    await pag.avaliar("ui.digitar('#og', '1.050'); ui.digitar('#alvo', '0.5')");
    assert.equal(await pag.avaliar("ui.$('#aviso').hidden"), false);
    assert.match(await pag.avaliar("ui.texto('#aviso')"), /Speise não é necessária/);
    assert.equal(await pag.avaliar("ui.texto('#speise')"), "0,00");

    await pag.avaliar("ui.digitar('#alvo', '2.4')");
    assert.equal(await pag.avaliar("ui.$('#aviso').hidden"), true);
    assert.deepEqual(pag.erros, []);
  });
});
