/*
 * Interface da ferramenta 02 — Decocção.
 * O cálculo tem os próprios testes (decoccao/tests); aqui fica
 * a tela: troca de método, parâmetros salvos, cronômetro e o cronômetro
 * fixo no topo no celular.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { suiteUI } = require("./navegador");

const URL_FERRAMENTA = "decoccao/";

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

  test("passo a passo em texto: uma linha por etapa, segue o método e copia", async () => {
    const { pag } = ctx;
    await abrirLimpo();
    assert.equal(await pag.avaliar("ui.$('#recipeTextBlock').open"), false, "começa fechado");
    const texto = await pag.avaliar("ui.$('#recipeText').value");
    const linhas = texto.split("\n");
    assert.equal(linhas[0], "Programa de mostura — Simples");
    assert.match(linhas[1], /^Tempo total: .* · Volume da mostura: .* L$/);
    const etapas = linhas.filter((l) => /^\d+\. /.test(l));
    assert.equal(etapas.length, await pag.avaliar("ui.$$('.ladder-row').length"));
    assert.match(texto, /Tina de fervura: puxar [\d,]+ L da mostura/);
    assert.doesNotMatch(texto, /\(até \d/, "sem o horário de fim de cada etapa");
    // trocar o método troca o texto
    await pag.avaliar("const s = ui.$('#methodSelect'); s.value = 'pseudo-decoccao'; s.dispatchEvent(new Event('change', { bubbles: true }))");
    await pag.esperar("ui.$('#recipeText').value.startsWith('Programa de mostura — Pseudo-decocção')");
    // copiar: com ou sem permissão de área de transferência, sem erro
    await pag.avaliar("ui.$('#recipeTextBlock').open = true; ui.clicar('#copyRecipeTextBtn')");
    await pag.esperar("ui.texto('#toastText').length > 0");
    assert.deepEqual(pag.erros, []);
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

  test("Brewfather: carrega as receitas e troca a mostura (API falsa)", async () => {
    const { pag } = ctx;
    await abrirLimpo();
    assert.ok(await pag.avaliar("!!ui.$('.advanced-settings .brewfather')"), "painel dentro das configurações avançadas");
    // fetch falso: nada sai para o Brewfather de verdade
    await pag.avaliar(`window.__bf = []; window.fetch = async (url, op = {}) => {
      window.__bf.push({ url, metodo: op.method || 'GET', corpo: op.body, auth: op.headers.authorization });
      const corpo = /recipes\\?/.test(url) ? JSON.stringify([{ _id: 'r2', name: 'Pilsner' }, { _id: 'r1', name: 'Bock' }])
        : op.method === 'PATCH' ? 'Updated' : JSON.stringify({ _id: 'r1', mash: { _id: 'm', name: 'Velha', spargeTemp: 76, steps: [] }, data: { mashWaterAmount: 30.84, mashFermentablesAmount: 5 } });
      return { ok: true, status: 200, text: async () => corpo };
    }; true`);
    await pag.avaliar("ui.clicar('#bfCarregar')");
    assert.match(await pag.avaliar("ui.texto('#bfStatus')"), /Preencha/);
    await pag.avaliar("ui.$('#bfUserId').value = 'u1'; ui.$('#bfApiKey').value = 'k1'; ui.clicar('#bfCarregar')");
    await pag.esperar("!ui.$('#bfReceitaCampo').hidden");
    assert.deepEqual(await pag.avaliar("ui.$$('#bfReceita option').map(o => o.textContent)"), ["Bock", "Pilsner"], "por nome");
    assert.equal(await pag.avaliar("ui.$$('#bfPassos li').length"), 3);
    assert.match(await pag.avaliar("ui.texto('#bfPassos')"), /66 °C · 50 min.*decocção de 6,5 L/);
    await pag.avaliar("const s = ui.$('#bfReceita'); s.value = 'r1'; s.dispatchEvent(new Event('change'))");
    // insumos da receita × os da calculadora (20 L, 5 kg)
    await pag.esperar("!ui.$('#bfInsumos').hidden");
    assert.match(await pag.avaliar("ui.texto('#bfInsumosTexto')"), /A receita usa 30,84 L de água e 5 kg de malte.*20 L e 5 kg/);
    await pag.avaliar("ui.clicar('#bfUsarInsumos')");
    assert.equal(await pag.avaliar("ui.$('#p_waterVolume').value"), "30.84");
    assert.match(await pag.avaliar("ui.texto('#bfInsumosTexto')"), /está com os insumos da receita/);
    assert.equal(await pag.avaliar("ui.$('#bfUsarInsumos').hidden"), true);
    assert.ok(await pag.avaliar("!!ui.$('.advanced-settings .brewfather')"), "o painel continua lá depois de refazer o formulário");
    const litros = await pag.avaliar("parseFloat(ui.texto('#bfPassos li:nth-child(2)').match(/decocção de ([\\d,]+) L/)[1].replace(',', '.'))");
    assert.ok(litros > 6.5, `puxada maior com mais água: ${litros}`);
    await pag.avaliar("ui.clicar('#bfEnviar')");
    await pag.esperar("/atualizada/.test(ui.texto('#bfStatus'))");
    const patch = await pag.avaliar("window.__bf.find(c => c.metodo === 'PATCH')");
    assert.match(patch.url, /\/recipes\/r1$/);
    const mash = JSON.parse(patch.corpo).mash;
    assert.equal(mash.name, "Decocção Simples (Brassagem Forte)");
    assert.equal(mash.spargeTemp, 76, "mantém o resto da mostura");
    assert.deepEqual(mash.steps.map((x) => x.stepTemp), [53, 66, 75]);
    assert.deepEqual([mash.steps[1].decoctionAmountMode, mash.steps[1].decoctionAmount], ["volume", litros]);
    assert.equal(patch.auth, "Basic " + Buffer.from("u1:k1").toString("base64"));
    assert.equal(await pag.avaliar("localStorage.getItem('decoccao:v1:brewfather')"), null, "só lembra se marcar");
    assert.deepEqual(pag.erros, []);
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
