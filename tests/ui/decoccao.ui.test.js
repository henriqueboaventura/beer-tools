/*
 * Interface da ferramenta 02 — Decocção.
 * O cálculo tem os próprios testes (ferramentas/decoccao/tests); aqui fica
 * a tela: troca de método, parâmetros salvos, cronômetro e o cronômetro
 * fixo no topo no celular.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { suiteUI } = require("./navegador");

const URL_FERRAMENTA = "ferramentas/decoccao/";

suiteUI("Decocção (interface)", (ctx) => {
  async function abrirLimpo() {
    const { pag } = ctx;
    await pag.ir(URL_FERRAMENTA);
    await pag.avaliar("Object.keys(localStorage).filter(k => k.startsWith('decoccao:')).forEach(k => localStorage.removeItem(k))");
    pag.erros = [];
    await pag.ir(URL_FERRAMENTA);
    await pag.esperar("ui.$$('.ladder-row').length > 0");
  }
  const resumo = () => ctx.pag.avaliar(`({
    metodo: ui.$('#methodSelect').value,
    linhas: ui.$$('.ladder-row').length,
    etapas: +ui.texto('#stepCount'),
    total: ui.texto('#totalTime'),
    puxada: ui.texto('#maxPull'),
  })`);

  test("abre no método Simples com o programa calculado", async () => {
    await abrirLimpo();
    const r = await resumo();
    assert.equal(r.metodo, "simples");
    assert.ok(r.linhas > 0);
    assert.equal(r.etapas, r.linhas);
    assert.match(r.total, /\d/);
    assert.match(r.puxada, /L$/);
    assert.equal(await ctx.pag.avaliar("ui.$$('#chart *').length > 0"), true, "gráfico desenhado");
    assert.deepEqual(ctx.pag.erros, []);
  });

  test("trocar o método (seletor do celular) recalcula e fica salvo", async () => {
    const { pag } = ctx;
    await abrirLimpo();
    const antes = await resumo();
    await pag.avaliar("const s = ui.$('#methodSelect'); s.value = 'tripla-tradicional'; s.dispatchEvent(new Event('change', { bubbles: true }))");
    const depois = await resumo();
    assert.equal(depois.metodo, "tripla-tradicional");
    assert.ok(depois.linhas > antes.linhas, "tripla tem mais etapas que a simples");
    assert.equal(await pag.avaliar("ui.$('#tab_tripla-tradicional').getAttribute('aria-selected')"), "true");
    await pag.ir(URL_FERRAMENTA);
    await pag.esperar("ui.$$('.ladder-row').length > 0");
    assert.equal((await resumo()).metodo, "tripla-tradicional");
  });

  test("todos os métodos calculam sem erro", async () => {
    const { pag } = ctx;
    await abrirLimpo();
    const ids = await pag.avaliar("ui.$$('#methodSelect option').map(o => o.value)");
    assert.ok(ids.length >= 8);
    for (const id of ids) {
      await pag.avaliar(`ui.clicar('#tab_${id}')`);
      const r = await resumo();
      assert.equal(r.metodo, id);
      const pseudoFora = await pag.avaliar("!ui.$('#pseudoUnreachable').hidden");
      if (!pseudoFora) assert.ok(r.linhas > 0, `${id} tem etapas`);
    }
    assert.deepEqual(pag.erros, []);
  });

  test("mudar um parâmetro recalcula e fica salvo no aparelho", async () => {
    const { pag } = ctx;
    await abrirLimpo();
    const antes = await resumo();
    await pag.avaliar("ui.digitar('#p_waterVolume', '30')");
    const depois = await resumo();
    assert.notEqual(depois.puxada, antes.puxada, "puxada acompanha o volume de água");
    await pag.ir(URL_FERRAMENTA);
    await pag.esperar("ui.$$('.ladder-row').length > 0");
    assert.equal(await pag.avaliar("ui.$('#p_waterVolume').value"), "30");
    assert.equal((await resumo()).puxada, depois.puxada);
  });

  test("cronômetro: iniciar, pausar, continuar e resetar", async () => {
    const { pag } = ctx;
    await abrirLimpo();
    assert.equal(await pag.avaliar("ui.texto('#timerToggleBtn')"), "Iniciar");
    await pag.avaliar("ui.clicar('#timerToggleBtn')");
    assert.equal(await pag.avaliar("ui.texto('#timerToggleBtn')"), "Pausar");
    assert.equal(await pag.avaliar("ui.$$('.ladder-row.is-active').length"), 1, "etapa atual destacada");
    await pag.esperar("ui.texto('#timerClock') !== '00:00'", 3000);
    await pag.avaliar("ui.clicar('#timerToggleBtn')");
    assert.equal(await pag.avaliar("ui.texto('#timerToggleBtn')"), "Continuar");
    const parado = await pag.avaliar("ui.texto('#timerClock')");
    await new Promise((ok) => setTimeout(ok, 1200));
    assert.equal(await pag.avaliar("ui.texto('#timerClock')"), parado, "pausado não conta");

    // o estado sobrevive a recarregar a página
    await pag.ir(URL_FERRAMENTA);
    await pag.esperar("ui.$$('.ladder-row').length > 0");
    assert.equal(await pag.avaliar("ui.texto('#timerToggleBtn')"), "Continuar");

    await pag.avaliar("ui.clicar('#timerResetBtn')");
    if (await pag.avaliar("ui.$('#resetModal').open")) await pag.avaliar("ui.clicar('#confirmResetBtn')");
    assert.equal(await pag.avaliar("ui.texto('#timerClock')"), "00:00");
    assert.equal(await pag.avaliar("ui.texto('#timerToggleBtn')"), "Iniciar");
    assert.deepEqual(pag.erros, []);
  });

  test("no celular, o cronômetro fica fixo logo abaixo do cabeçalho ao rolar", async () => {
    const { pag } = ctx;
    await abrirLimpo();
    const topo = await pag.avaliar(`(async () => {
      const painel = ui.$('.timer-panel');
      window.scrollTo(0, painel.getBoundingClientRect().top + scrollY + 600);
      await new Promise(requestAnimationFrame);
      return { painel: painel.getBoundingClientRect().top, header: ui.$('.bf-header').getBoundingClientRect().bottom };
    })()`);
    assert.ok(Math.abs(topo.painel - topo.header) <= 2, `painel logo abaixo do cabeçalho (${topo.painel} × ${topo.header})`);
  });

  test("no computador, as abas substituem o seletor", async () => {
    const pag = await ctx.nav.pagina({ largura: 1280 });
    await pag.ir(URL_FERRAMENTA);
    await pag.esperar("ui.$$('.method-tab').length > 0");
    assert.notEqual(await pag.avaliar("getComputedStyle(ui.$('#methodTabs')).display"), "none");
    assert.equal(await pag.avaliar("getComputedStyle(ui.$('#methodSelect')).display"), "none");
    await pag.fechar();
  });
});
