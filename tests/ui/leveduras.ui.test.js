/*
 * Interface da ferramenta 01 — Substituição de leveduras.
 * Números de alternativas mudam com os dados; os testes conferem a lógica
 * da tela (contagens batem, filtros filtram, navegação e URL funcionam).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { suiteUI } = require("./navegador");

const URL_FERRAMENTA = "ferramentas/substituicao-leveduras/";

suiteUI("Substituição de leveduras (interface)", (ctx) => {
  async function abrir(query = "") {
    const { pag } = ctx;
    pag.erros = [];
    await pag.ir(URL_FERRAMENTA + query);
    await pag.esperar("!ui.$('#yx-input').disabled || ui.$('#yx-base')");
  }

  test("busca com várias palavras acha a levedura (imperial l17)", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#yx-input', 'imperial l17')");
    assert.deepEqual(await pag.avaliar("ui.$$('#yx-list li').map(l => l.dataset.id)"), ["imperial-l17"]);
    await pag.avaliar("ui.digitar('#yx-input', 'xyzxyz')");
    assert.equal(await pag.avaliar("ui.$('#yx-list').hidden"), true);
    assert.match(await pag.avaliar("ui.texto('#yx-status')"), /Nenhuma levedura encontrada/);
  });

  test("escolher na lista mostra a base, as alternativas e muda a URL", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#yx-input', 'us-05')");
    await pag.avaliar("ui.clicar('#yx-list li[data-id=\"fermentis-us-05\"]')");
    assert.equal(await pag.avaliar("ui.$('#picker').hidden"), true);
    assert.equal(await pag.avaliar("ui.texto('.yx-base__name')"), "SafAle US-05");
    assert.equal(await pag.avaliar("new URLSearchParams(location.search).get('levedura')"), "fermentis-us-05");
    assert.match(await pag.avaliar("document.title"), /^SafAle US-05 — /);
    assert.equal(await pag.avaliar("ui.$('#step-alt').hidden"), false);
    assert.ok(await pag.avaliar("ui.$$('.yx-alt').length") > 0);
    assert.deepEqual(pag.erros, []);
  });

  test("link direto (?levedura=us-05) abre a levedura; Trocar volta para a busca", async () => {
    const { pag } = ctx;
    await abrir("?levedura=us-05");
    await pag.esperar("ui.$('#yx-base')");
    assert.equal(await pag.avaliar("ui.texto('.yx-base__name')"), "SafAle US-05");
    await pag.avaliar("ui.clicar('#btn-trocar')");
    assert.equal(await pag.avaliar("ui.$('#picker').hidden"), false);
    assert.equal(await pag.avaliar("new URLSearchParams(location.search).has('levedura')"), false);
    assert.equal(await pag.avaliar("document.activeElement.id"), "yx-input");
  });

  test("levedura inexistente na URL avisa e mostra a busca", async () => {
    const { pag } = ctx;
    await abrir("?levedura=nao-existe-123");
    assert.equal(await pag.avaliar("ui.$('#base').hidden"), true);
    assert.match(await pag.avaliar("ui.texto('#yx-status')"), /não encontrada/);
  });

  test("contagem e filtro por forma batem com os cards", async () => {
    const { pag } = ctx;
    await abrir("?levedura=us-05");
    await pag.esperar("ui.$('#yx-base')");
    const r = await pag.avaliar(`(() => {
      const n = (s) => +s.match(/\\d+/)[0];
      const botoes = Object.fromEntries(ui.$$('#form-seg button').map(b => [b.dataset.forma, n(b.textContent)]));
      return { total: n(ui.texto('#alt-count')), cards: ui.$$('.yx-alt').length, botoes };
    })()`);
    assert.equal(r.cards, r.total);
    assert.equal(r.botoes.todas, r.total);
    assert.equal(r.botoes.seca + r.botoes.liquida, r.total);
    for (const forma of ["seca", "liquida"]) {
      await pag.avaliar(`ui.clicar('#form-seg [data-forma="${forma}"]')`);
      assert.equal(await pag.avaliar(`ui.$('#form-seg [data-forma="${forma}"]').getAttribute('aria-pressed')`), "true");
      const tags = await pag.avaliar("ui.$$('.yx-alt').map(a => a.querySelector('.yx-alt__tags .bf-tag:last-child').textContent)");
      assert.equal(tags.length, r.botoes[forma]);
      assert.ok(tags.every((t) => t === (forma === "seca" ? "Seca" : "Líquida")), forma);
    }
  });

  test("grupos de similaridade vêm em ordem (equivalente → alternativa) e somam o total", async () => {
    const { pag } = ctx;
    await abrir("?levedura=us-05");
    await pag.esperar("ui.$('#yx-base')");
    const grupos = await pag.avaliar("ui.$$('.yx-group__head').map(h => ({ nivel: +h.className.match(/yx-nivel-(\\d)/)[1], n: +h.querySelector('.n').textContent }))");
    assert.ok(grupos.length > 0);
    const niveis = grupos.map((g) => g.nivel);
    assert.deepEqual(niveis, [...niveis].sort((a, b) => b - a));
    assert.equal(grupos.reduce((a, g) => a + g.n, 0), await pag.avaliar("ui.$$('.yx-alt').length"));
  });

  test("clicar numa alternativa ou em 'não confunda' troca a base; voltar do navegador desfaz", async () => {
    const { pag } = ctx;
    await abrir("?levedura=us-05");
    await pag.esperar("ui.$('#yx-base')");
    const nao = await pag.avaliar("ui.$('.yx-base__not button').dataset.id");
    await pag.avaliar("ui.clicar('.yx-base__not button')");
    assert.equal(await pag.avaliar("new URLSearchParams(location.search).get('levedura')"), nao);
    assert.notEqual(await pag.avaliar("ui.texto('.yx-base__name')"), "SafAle US-05");

    await pag.avaliar("history.back()");
    await pag.esperar("ui.texto('.yx-base__name') === 'SafAle US-05'");

    const alt = await pag.avaliar("ui.$('.yx-alt__name button').dataset.id");
    await pag.avaliar("ui.clicar('.yx-alt__name button')");
    assert.equal(await pag.avaliar("new URLSearchParams(location.search).get('levedura')"), alt);
    assert.deepEqual(pag.erros, []);
  });

  test("filtro 'Só nacionais' mostra só nacionais ou o aviso com Limpar filtros", async () => {
    const { pag } = ctx;
    await abrir("?levedura=us-05");
    await pag.esperar("ui.$('#yx-base')");
    await pag.avaliar("ui.clicar('#btn-nacionais')");
    assert.equal(await pag.avaliar("ui.$('#btn-nacionais').getAttribute('aria-pressed')"), "true");
    const r = await pag.avaliar("({ cards: ui.$$('.yx-alt').length, nacionais: ui.$$('.yx-alt').filter(a => /Nacional/.test(a.querySelector('.yx-alt__tags').textContent)).length, limpar: !!ui.$('[data-limpar]') })");
    assert.equal(r.cards, r.nacionais);
    if (r.limpar) {
      await pag.avaliar("ui.clicar('[data-limpar]')");
      assert.equal(await pag.avaliar("ui.$('#btn-nacionais').getAttribute('aria-pressed')"), "false");
    }
  });

  test("filtro de categoria limita a lista", async () => {
    const { pag } = ctx;
    await abrir();
    const chips = await pag.avaliar("ui.$$('#cat-chips button').map(b => b.textContent)");
    assert.match(chips[0], /^Todas\d+$/);
    await pag.avaliar("ui.clicar('#cat-chips button:nth-child(3)')"); // Lager
    await pag.avaliar("ui.digitar('#yx-input', 'w')");
    const cat = await pag.avaliar("ui.$('#cat-chips button[aria-pressed=\"true\"]').textContent");
    assert.match(cat, /^Lager/);
    assert.ok(await pag.avaliar("ui.$$('#yx-list li').length") > 0);
  });

  test("fontes ficam recolhidas e abrem ao tocar", async () => {
    const { pag } = ctx;
    await abrir();
    const det = "ui.$('#fontes').closest('details')";
    assert.equal(await pag.avaliar(`${det}.open`), false);
    await pag.avaliar(`${det}.querySelector('summary').click()`);
    assert.equal(await pag.avaliar(`${det}.open`), true);
    assert.match(await pag.avaliar("ui.texto('#fontes')"), /Yeast Master/);
  });

  test("página estática da levedura leva para a ferramenta com a levedura escolhida", async () => {
    const { pag } = ctx;
    await pag.ir(URL_FERRAMENTA + "levedura/fermentis-us-05/");
    const href = await pag.avaliar("ui.$$('main a').map(a => a.getAttribute('href')).find(h => /levedura=/.test(h))");
    assert.ok(href, "link para a ferramenta");
    await pag.avaliar(`setTimeout(() => ui.$$('main a').find(a => a.getAttribute('href') === ${JSON.stringify(href)}).click()); true`);
    await pag.esperar("location.search.includes('levedura=') && ui.$('#yx-base')");
    assert.equal(await pag.avaliar("ui.texto('.yx-base__name')"), "SafAle US-05");
  });
});
