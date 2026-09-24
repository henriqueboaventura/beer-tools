/*
 * Interface da plataforma: todas as páginas abrem sem erro e sem rolagem
 * lateral no celular; menu, tema, rodapé e service worker funcionam.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { suiteUI } = require("./navegador");

const PAGINAS = [
  "",
  "ferramentas/substituicao-leveduras/",
  "ferramentas/substituicao-leveduras/?levedura=us-05",
  "ferramentas/substituicao-leveduras/levedura/",
  "ferramentas/substituicao-leveduras/levedura/fermentis-us-05/",
  "ferramentas/decoccao/",
  "ferramentas/decoccao/sobre.html",
  "ferramentas/speise/",
  "ferramentas/parti-gyle/",
];

suiteUI("Plataforma (interface)", (ctx) => {
  for (const largura of [360, 1280]) {
    test(`todas as páginas abrem sem erro e sem rolagem lateral (${largura}px)`, async () => {
      const pag = await ctx.nav.pagina({ largura });
      for (const url of PAGINAS) {
        pag.erros = [];
        await pag.ir(url);
        await pag.esperar("document.querySelector('.bf-footer')");
        await new Promise((ok) => setTimeout(ok, 300)); // dados carregados por fetch
        assert.deepEqual(pag.erros, [], `erros em /${url}`);
        assert.ok(await pag.avaliar("ui.semRolagemLateral()"), `rolagem lateral em /${url} (${largura}px)`);
        assert.equal(await pag.avaliar("document.querySelectorAll('h1').length"), 1, `um h1 em /${url}`);
      }
      await pag.fechar();
    });
  }

  test("sem rolagem lateral no celular mesmo se a fonte do site não carregar", async () => {
    // a Archivo é condensada; a fonte reserva (Verdana/DejaVu) é bem mais larga
    const pag = await ctx.nav.pagina({ largura: 360 });
    for (const url of PAGINAS) {
      await pag.ir(url);
      await pag.esperar("document.querySelector('.bf-footer')");
      await new Promise((ok) => setTimeout(ok, 300));
      const ok = await pag.avaliar(`(async () => {
        const st = document.createElement('style');
        st.textContent = '* { font-family: Verdana, "DejaVu Sans", sans-serif !important; }';
        document.head.append(st);
        await new Promise(requestAnimationFrame);
        return ui.semRolagemLateral();
      })()`);
      assert.ok(ok, `rolagem lateral em /${url} com a fonte reserva`);
    }
    await pag.fechar();
  });

  test("início lista as 4 ferramentas com links que abrem", async () => {
    const { pag } = ctx;
    await pag.ir("");
    const links = await pag.avaliar("ui.$$('main a[href^=\"ferramentas/\"]').map(a => a.getAttribute('href'))");
    assert.deepEqual([...new Set(links)], [
      "ferramentas/substituicao-leveduras/", "ferramentas/decoccao/", "ferramentas/speise/", "ferramentas/parti-gyle/",
    ]);
    await pag.avaliar("setTimeout(() => ui.clicar('main a[href=\"ferramentas/parti-gyle/\"]')); true");
    await pag.esperar("location.pathname.endsWith('/ferramentas/parti-gyle/') && document.readyState === 'complete'");
  });

  test("menu abre, lista as ferramentas e fecha com Esc", async () => {
    const { pag } = ctx;
    await pag.ir("ferramentas/speise/");
    assert.equal(await pag.avaliar("ui.$('#bf-menu').hidden"), true);
    await pag.avaliar("ui.clicar('.bf-menu-btn')");
    assert.equal(await pag.avaliar("ui.$('#bf-menu').hidden"), false);
    assert.equal(await pag.avaliar("ui.$('.bf-menu-btn').getAttribute('aria-expanded')"), "true");
    assert.equal(await pag.avaliar("ui.$$('#bf-menu a[href*=\"ferramentas/\"]').length"), 4);
    await pag.avaliar("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
    assert.equal(await pag.avaliar("ui.$('#bf-menu').hidden"), true);
    assert.equal(await pag.avaliar("ui.texto('.bf-menu-btn__text')"), "Menu");
  });

  test("tema alterna e fica salvo depois de recarregar", async () => {
    const { pag } = ctx;
    await pag.ir("");
    await pag.avaliar("localStorage.removeItem('bf-tema')");
    await pag.ir("");
    const escuroAntes = await pag.avaliar("getComputedStyle(document.body).backgroundColor");
    await pag.avaliar("ui.clicar('.bf-theme-btn')");
    const tema = await pag.avaliar("document.documentElement.getAttribute('data-theme')");
    assert.ok(["light", "dark"].includes(tema));
    assert.notEqual(await pag.avaliar("getComputedStyle(document.body).backgroundColor"), escuroAntes);
    await pag.ir("ferramentas/decoccao/");
    assert.equal(await pag.avaliar("document.documentElement.getAttribute('data-theme')"), tema);
    await pag.avaliar("localStorage.removeItem('bf-tema')");
  });

  test("rodapé mostra a versão e o crédito da ferramenta", async () => {
    const { pag } = ctx;
    await pag.ir("ferramentas/parti-gyle/");
    const versao = await pag.avaliar("BF.versao");
    assert.match(await pag.avaliar("ui.texto('.bf-footer')"), new RegExp("Versão " + versao.replace(/\./g, "\\.")));
    assert.match(await pag.avaliar("ui.texto('.bf-footer')"), /Henrique Boaventura/);
  });

  test("service worker instala e guarda o site no cache da versão", async () => {
    const { pag } = ctx;
    await pag.ir("");
    const r = await pag.avaliar(`(async () => {
      const reg = await navigator.serviceWorker.ready;
      const nomes = await caches.keys();
      return { url: reg.active.scriptURL, nomes };
    })()`);
    const versao = await pag.avaliar("BF.versao");
    assert.match(r.url, new RegExp("sw\\.js\\?v=" + versao.replace(/\./g, "\\.")));
    assert.ok(r.nomes.includes("bf-" + versao), "cache bf-" + versao + " criado");
  });
});
