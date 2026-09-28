/*
 * Interface da ferramenta 05 — Taxa de inóculo: 01 Sua cerveja → 02 Sua
 * levedura → 03 Starter (passos manuais e sugeridos).
 * Os números esperados vêm do calculo.js (testado à parte, contra as fontes).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { suiteUI } = require("./navegador");
const C = require("../../ferramentas/taxa-de-inoculo/calculo.js");

const URL_FERRAMENTA = "ferramentas/taxa-de-inoculo/";
const br = (n, casas) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const NECESSARIO = C.celulasNecessarias(20, C.sgParaPlato(1.05), 0.75); // exemplo padrão: 186 bi

suiteUI("Taxa de inóculo (interface)", (ctx) => {
  async function abrir() {
    const { pag } = ctx;
    pag.erros = [];
    await pag.ir(URL_FERRAMENTA);
    await pag.esperar("ui.texto('#necessario') !== '0'");
  }
  const passos = () => ctx.pag.avaliar(`ui.$$('.ti-passo').map(p => ({
    litros: p.querySelector('[data-campo="litros"]').value,
    dados: [...p.querySelectorAll('.ti-passo__dados dd')].map(d => d.textContent),
    status: [...p.querySelectorAll('.ti-status')].map(s => s.textContent).join(' '),
  }))`);

  test("abre com o exemplo: 186 bi necessários, 1 pacote fresco e um starter de 1 L", async () => {
    const { pag } = ctx;
    await abrir();
    assert.equal(await pag.avaliar("ui.texto('#necessario')"), br(NECESSARIO, 0));
    assert.match(await pag.avaliar("ui.texto('#tem')"), /Você tem 100 bi/);
    assert.match(await pag.avaliar("ui.texto('#tem')"), /Faltam 86 bi/);
    // bloco em destaque: barra proporcional e cor de atenção
    assert.equal(await pag.avaliar("ui.$('#tem .ti-placar').classList.contains('ti-placar--ok')"), false);
    assert.equal(await pag.avaliar("ui.$('#tem .ti-placar__barra span').style.width"), (100 / NECESSARIO * 100).toFixed(1) + "%");
    assert.match(await pag.avaliar("ui.texto('#tem .ti-placar__pct')"), /54% do necessário \(186 bi\)/);
    const [p] = C.propagar(100, [{ litros: 1, sg: 1.036, modelo: "braukaiser" }]);
    const ps = await passos();
    assert.equal(ps.length, 1);
    assert.deepEqual(ps[0].dados, ["100 bi", br(p.fim, 0) + " bi", br(p.dme, 0) + " g"]);
    assert.match(await pag.avaliar("ui.texto('#final')"), /Chega no alvo, com 45 bi de folga/);
    // placar final: mesmo componente do "Você tem", verde quando chega
    assert.equal(await pag.avaliar("ui.$('#final .ti-placar').classList.contains('ti-placar--ok')"), true);
    assert.match(await pag.avaliar("ui.texto('#final .ti-placar__rotulo')"), /Depois de 1 passo, inocule/);
    assert.match(await pag.avaliar("ui.texto('#final')"), /Taxa de 0,93 milhões\/mL\/°P/);
    assert.deepEqual(pag.erros, []);
  });

  test("taxa: os chips preenchem o campo e o campo livre recalcula", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.clicar('[data-taxa=\"1.5\"]')");
    assert.equal(await pag.avaliar("ui.$('#taxa').value"), "1.5");
    assert.equal(await pag.avaliar("ui.$('[data-taxa=\"1.5\"]').getAttribute('aria-pressed')"), "true");
    assert.equal(await pag.avaliar("ui.texto('#necessario')"), br(NECESSARIO * 2, 0));
    await pag.avaliar("ui.digitar('#taxa', '0.5')");
    assert.equal(await pag.avaliar("ui.$$('[data-taxa][aria-pressed=\"true\"]').length"), 0, "taxa livre não marca chip");
    assert.equal(await pag.avaliar("ui.texto('#necessario')"), br(NECESSARIO * 0.5 / 0.75, 0));
  });

  test("trocar para °P converte a OG e mantém o resultado", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.clicar('[data-unidade=\"plato\"]')");
    assert.equal(await pag.avaliar("ui.$('#og').value"), C.sgParaPlato(1.05).toFixed(1));
    const n = +(await pag.avaliar("ui.texto('#necessario')"));
    assert.ok(Math.abs(n - NECESSARIO) <= 1, `${n} × ${NECESSARIO}`);
  });

  test("data de fabricação preenche a viabilidade (0,7% por dia)", async () => {
    const { pag } = ctx;
    await abrir();
    const data = await pag.avaliar(`(() => {
      const d = new Date(); d.setDate(d.getDate() - 44);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    })()`);
    await pag.avaliar(`ui.digitar('#fabricacao', '${data}')`);
    assert.equal(await pag.avaliar("ui.$('#viabilidade').value"), "69");
    assert.match(await pag.avaliar("ui.texto('#idade')"), /Fabricada há 44 dias: viabilidade estimada de 69%/);
    assert.match(await pag.avaliar("ui.texto('#tem')"), /Você tem 69 bi/);
  });

  test("seca: sem starter, diz quantos gramas e sachês usar", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.clicar('[data-fonte=\"seca\"]')");
    assert.equal(await pag.avaliar("ui.$('[data-painel=\"seca\"]').hidden"), false);
    assert.equal(await pag.avaliar("ui.$('[data-painel=\"liquida\"]').hidden"), true);
    assert.equal(await pag.avaliar("ui.$('#starter').hidden"), true, "sem passos de starter para seca");
    assert.equal(await pag.avaliar("ui.$('#semStarterSeca').hidden"), false);
    const s = C.semStarter({ tipo: "seca", celulasGrama: 15 }, NECESSARIO);
    const tem = await pag.avaliar("ui.texto('#tem')");
    assert.match(tem, /Você tem 165 bi/);
    assert.ok(tem.includes(br(s.gramas, 1) + " g (2 sachês de 11 g)"), tem);
    await pag.avaliar("ui.digitar('#gramas', '22')");
    assert.match(await pag.avaliar("ui.texto('#tem')"), /Dá para inocular direto/);
  });

  test("reaproveitada e contagem própria", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.clicar('[data-fonte=\"reaproveitada\"]')");
    assert.match(await pag.avaliar("ui.texto('#tem')"), /Você tem 203 bi/); // 200 mL × 4,5 × 25% × 90%
    assert.match(await pag.avaliar("ui.texto('#tem')"), /Dá para inocular direto/);
    assert.equal(await pag.avaliar("ui.$('#tem .ti-placar').classList.contains('ti-placar--ok')"), true, "verde quando basta");
    assert.equal(await pag.avaliar("ui.$('#tem .ti-placar__barra span').style.width"), "100%", "barra não passa do fim");
    await pag.avaliar("ui.clicar('[data-fonte=\"contagem\"]')");
    await pag.avaliar("ui.digitar('#celulas', '50')");
    assert.match(await pag.avaliar("ui.texto('#tem')"), /Você tem 50 bi/);
    assert.equal(await pag.avaliar("ui.$$('.ti-passo').length"), 1, "starter continua disponível");
  });

  test("passos: adicionar encadeia, remover desfaz, e digitar não perde o foco", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#volume', '60')");
    await pag.avaliar("ui.clicar('#adicionar')");
    assert.equal(await pag.avaliar("document.activeElement.id"), "litros1", "foco vai para o passo novo");
    await pag.avaliar("ui.digitar('#litros1', '4')");
    assert.equal(await pag.avaliar("document.activeElement.id"), "litros1", "foco continua no campo");
    const ps = await passos();
    assert.equal(ps.length, 2);
    assert.equal(ps[1].dados[0], ps[0].dados[1], "o passo 2 começa com o que o passo 1 terminou");
    const esperado = C.propagar(100, [{ litros: 1, sg: 1.036, modelo: "braukaiser" }, { litros: 4, sg: 1.036, modelo: "braukaiser" }]);
    assert.equal(ps[1].dados[1], br(esperado[1].fim, 0) + " bi");
    assert.match(await pag.avaliar("ui.texto('#final')"), /Depois de 2 passos/);

    await pag.avaliar("ui.clicar('.ti-passo[data-i=\"0\"] [data-remover]')");
    const depois = await passos();
    assert.equal(depois.length, 1);
    assert.equal(depois[0].litros, "4");
    assert.equal(depois[0].dados[0], "100 bi");
  });

  test("agitação: sem agitação usa a curva de White e avisa inoculação fora da faixa", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("const s = ui.$('#modelo0'); s.value = 'white'; s.dispatchEvent(new Event('change', { bubbles: true }))");
    const [r] = C.propagar(100, [{ litros: 1, sg: 1.036, modelo: "white" }]);
    const [p] = await passos();
    assert.equal(p.dados[1], br(r.fim, 0) + " bi");
    assert.equal(p.status, "", "100 M/mL está na faixa");
    await pag.avaliar("ui.digitar('#litros0', '0.3')");
    assert.match((await passos())[0].status, /Muita levedura para esse volume/);
    await pag.avaliar("ui.digitar('#sg0', '1.060')");
    assert.match((await passos())[0].status, /entre 1\.030 e 1\.040/);
  });

  test("sugerir passos: chega no alvo com o frasco dado, ou explica por que não", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#volume', '40'); ui.clicar('[data-taxa=\"1.5\"]'); ui.digitar('#og', '1.060')");
    await pag.avaliar("ui.$('#sugerirBox').open = true; ui.clicar('#sugerir')");
    assert.match(await pag.avaliar("ui.texto('#sugMsg')"), /não chega/);
    assert.match(await pag.avaliar("ui.texto('#final')"), /Faltam/);
    assert.equal(await pag.avaliar("ui.$('#final .ti-placar').classList.contains('ti-placar--ok')"), false, "âmbar quando não chega");

    await pag.avaliar("ui.digitar('#frasco', '5'); ui.clicar('#sugerir')");
    const need = C.celulasNecessarias(40, C.sgParaPlato(1.06), 1.5);
    const s = C.sugerirPassos(100, need, 5, "braukaiser", 1.036);
    assert.equal(s.motivo, "ok");
    const ps = await passos();
    assert.deepEqual(ps.map((p) => p.litros), s.passos.map((p) => p.litros.toFixed(1)));
    assert.match(await pag.avaliar("ui.texto('#sugMsg')"), new RegExp(s.passos.length === 1 ? "Um starter basta" : s.passos.length + " passos"));
    assert.match(await pag.avaliar("ui.texto('#final')"), /Chega no alvo/);

    await pag.avaliar("ui.clicar('[data-fonte=\"contagem\"]'); ui.digitar('#celulas', '2000'); ui.clicar('#sugerir')");
    assert.match(await pag.avaliar("ui.texto('#sugMsg')"), /não precisa de starter/);
    assert.deepEqual(pag.erros, []);
  });

  test("placa agitadora (Mr Malty): no passo e na sugestão, chega onde o Braukaiser não chega", async () => {
    const { pag } = ctx;
    await abrir();
    assert.deepEqual(await pag.avaliar("ui.$$('#modelo0 option').map(o => o.value)"), C.MODELOS);
    assert.deepEqual(await pag.avaliar("ui.$$('#sugModelo option').map(o => o.value)"), C.MODELOS);
    assert.match(await pag.avaliar("ui.texto('#modelo0')"), /Agitação manual \(Mr Malty\)/);
    await pag.avaliar("const s = ui.$('#modelo0'); s.value = 'mm-placa'; s.dispatchEvent(new Event('change', { bubbles: true }))");
    const [r] = C.propagar(100, [{ litros: 1, sg: 1.036, modelo: "mm-placa" }]);
    assert.equal((await passos())[0].dados[1], br(r.fim, 0) + " bi");

    await pag.avaliar("ui.digitar('#volume', '40'); ui.clicar('[data-taxa=\"1.5\"]'); ui.digitar('#og', '1.060')");
    await pag.avaliar("ui.$('#sugerirBox').open = true; ui.$('#sugModelo').value = 'mm-placa'; ui.clicar('#sugerir')");
    assert.match(await pag.avaliar("ui.texto('#sugMsg')"), /4 passos/);
    assert.deepEqual(await pag.avaliar("ui.$$('.ti-passo select').map(s => s.value)"), ["mm-placa", "mm-placa", "mm-placa", "mm-placa"]);
    assert.match(await pag.avaliar("ui.texto('#final')"), /Chega no alvo/);
    assert.deepEqual(pag.erros, []);
  });

  test("\"Qual técnica escolher?\": abre pelo link do passo e a tabela sai dos modelos", async () => {
    const { pag } = ctx;
    await abrir();
    assert.equal(await pag.avaliar("ui.$('#tecnicas').open"), false, "fechada até pedir");
    await pag.avaliar("ui.clicar('.ti-passo [data-abrir-tecnicas]')");
    assert.equal(await pag.avaliar("ui.$('#tecnicas').open"), true);
    const tabela = await pag.avaliar("ui.$$('#tecnicasTabela td').map(td => [td.dataset.modelo, +td.dataset.celulas, td.textContent])");
    assert.equal(tabela.length, C.MODELOS.length * 2);
    for (const [m, c, texto] of tabela) assert.equal(texto, br(c + C.crescimento(m, c, 1, 1.036), 0), `${m} ${c}`);
    // o caso que mostra a divergência entre as duas placas agitadoras
    const placa = (m) => tabela.find((t) => t[0] === m && t[1] === 300)[2];
    assert.ok(+placa("mm-placa") > +placa("braukaiser"), "starter concentrado: Mr Malty prevê mais");
    assert.deepEqual(pag.erros, []);
  });

  test("campo vazio pede para preencher, sem erro", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#og', '')");
    assert.equal(await pag.avaliar("ui.texto('#necessario')"), "—");
    assert.match(await pag.avaliar("ui.texto('#necessarioSub')"), /Preencha/);
    assert.equal(await pag.avaliar("ui.texto('#final')"), "");
    assert.deepEqual(pag.erros, []);
  });
});
