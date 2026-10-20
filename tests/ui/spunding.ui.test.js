/*
 * Interface da ferramenta 05 — Spunding: estilo, fermentador, cerveja, pressão
 * e o plano. Os números esperados vêm do spunding/calculo.js.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { suiteUI } = require("./navegador");
const S = require("../../spunding/calculo.js");

const URL_FERRAMENTA = "spunding/";
const br = (n, casas) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const PADRAO = { grupo: "lager", fermentador: "pet", maxBar: 2.4, capacidade: 30, litros: 20, og: 1.048, fg: 1.010,
  tempC: 18, pressaoFinal: 1, alvo: 2.6, tempFria: 2 };

suiteUI("Spunding (interface)", (ctx) => {
  async function abrir() {
    const { pag } = ctx;
    pag.erros = [];
    await pag.ir(URL_FERRAMENTA);
    await pag.esperar("ui.$('.spd-destaque__valor')");
  }
  const escolher = (id, valor) => ctx.pag.avaliar(`const s = ui.$('#${id}'); s.value = '${valor}'; s.dispatchEvent(new Event('change', { bubbles: true }))`);

  test("abre com a lager no Fermzilla: válvula, densidade para fechar e o plano", async () => {
    const { pag } = ctx;
    await abrir();
    const r = S.calcular(PADRAO);
    assert.equal(await pag.avaliar("ui.texto('.spd-destaque__rotulo')"), "Feche a válvula em");
    assert.equal(await pag.avaliar("ui.texto('.spd-destaque__valor')"), "1,00 bar");
    assert.match(await pag.avaliar("ui.texto('.spd-destaque__sub')"), new RegExp("em " + r.densidadeSubir.toFixed(3).replace(".", "\\.") + " SG"));
    assert.deepEqual(await pag.avaliar("ui.$$('#resumo dd').map(d => d.textContent)"),
      [br(r.volumesQuente, 1) + " vol", br(r.pressaoFria, 2) + " bar", "2,6 vol"]);
    const fases = await pag.avaliar("ui.$$('#fases > li > strong').map(s => s.textContent)");
    assert.deepEqual(fases, ["Inoculação, primeiros 1–2 dias", "Fermentação ativa", "Feche para carbonatar", "Descanso de diacetil", "Cold crash", "Carbonatar"]);
    assert.match(await pag.avaliar("ui.texto('#fases li:nth-child(5)')"), /Ligue o CO₂ antes de começar a resfriar/);
    assert.equal(await pag.avaliar("ui.texto('#segurancaTitulo')"), "Segurança do Fermzilla / PET");
    assert.match(await pag.avaliar("ui.texto('#seguranca')"), /dentro do limite do Fermzilla \/ PET \(máximo 2,40 bar\)/);
    assert.match(await pag.avaliar("ui.texto('#espacoEco')"), /10,0 L/);
    assert.match(await pag.avaliar("ui.texto('#pressaoDica')"), /0,80–1,00 bar.*2,4–2,8 vol \(BYO\)/);
    assert.equal(await pag.avaliar("ui.$$('#avisos .spd-status').length"), 0);
    assert.deepEqual(pag.erros, []);
  });

  test("o estilo preenche temperatura, válvula e alvo", async () => {
    const { pag } = ctx;
    await abrir();
    await escolher("grupo", "lupulada");
    const g = S.grupoPorId("lupulada");
    assert.deepEqual(await pag.avaliar("[ui.$('#tempC').value, ui.$('#pressaoFinal').value, ui.$('#alvo').value]"),
      [String(g.tempC), String(g.fases[2][1]), String(g.alvo)]);
    assert.match(await pag.avaliar("ui.texto('#grupoPorque')"), /aroma do lúpulo/);
    assert.match(await pag.avaliar("ui.texto('#fases')"), /dry hop/);
  });

  test("estilos de ésteres: fermente aberto, e aviso se a válvula passar do estilo", async () => {
    const { pag } = ctx;
    await abrir();
    await escolher("grupo", "belga");
    assert.equal(await pag.avaliar("ui.texto('.spd-destaque__rotulo')"), "Fermente aberto e feche em");
    assert.match(await pag.avaliar("ui.texto('#fases li:nth-child(2) .spd-fase__meta')"), /aberto \(0 bar\)/);
    assert.equal(await pag.avaliar("ui.texto('#fases li:nth-child(3) strong')"), "Feche perto do fim");
    await pag.avaliar("ui.digitar('#pressaoFinal', '0.6')");
    assert.match(await pag.avaliar("ui.texto('#avisos')"), /Pressão alta para este estilo antes do fim/);
  });

  test("o fermentador preenche capacidade e pressão máxima, e o veredito muda", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.clicar('[data-fermentador=\"corny\"]')");
    assert.deepEqual(await pag.avaliar("[ui.$('#capacidade').value, ui.$('#maxBar').value]"), ["19", "4"]);
    assert.equal(await pag.avaliar("ui.texto('#segurancaTitulo')"), "Segurança do barril corny");
    assert.match(await pag.avaliar("ui.texto('#avisos')"), /A cerveja não cabe no fermentador/);
    await pag.avaliar("ui.digitar('#litros', '17.5')");
    assert.match(await pag.avaliar("ui.texto('#avisos')"), /Quase sem espaço vazio/);
    await pag.avaliar("ui.digitar('#maxBar', '0.9')");
    assert.match(await pag.avaliar("ui.texto('#seguranca')"), /acima do limite do barril corny/);
    await pag.avaliar("ui.digitar('#maxBar', '')");
    assert.match(await pag.avaliar("ui.texto('#seguranca')"), /Informe a pressão máxima/);
  });

  test("pressão alta no quente: já carbonatada", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#pressaoFinal', '2.3')");
    assert.equal(await pag.avaliar("ui.$$('#resumo dd')[1].textContent"), "pronta");
    assert.equal(await pag.avaliar("ui.texto('#fases li:last-child strong')"), "Servir ou transferir");
    assert.match(await pag.avaliar("ui.texto('#seguranca')"), /perto do limite/);
  });

  test("números, tabela e meu fermentador agora", async () => {
    const { pag } = ctx;
    await abrir();
    assert.match(await pag.avaliar("ui.texto('#numeros')"), /contando encher os 10,0 L de espaço vazio/);
    assert.equal(await pag.avaliar("ui.texto('#tabelaTitulo')"), "Tabela de carbonatação para 2,6 volumes");
    assert.equal(await pag.avaliar("ui.$$('#tabela tr').length"), 11);
    assert.equal(await pag.avaliar("ui.$$('#tabela tr.spd-atual').length"), 2, "linhas do cold crash e da fermentação");
    assert.match(await pag.avaliar("ui.texto('#agora')"), /Preencha/);
    await pag.avaliar("ui.digitar('#agoraTemp', '2'); ui.digitar('#agoraBar', '0.7')");
    const r = S.calcular({ ...PADRAO, agoraTemp: 2, agoraBar: 0.7 });
    assert.match(await pag.avaliar("ui.texto('#agora')"), new RegExp(br(r.agora.volumes, 2) + " volumes"));
  });

  test("densidade inválida", async () => {
    const { pag } = ctx;
    await abrir();
    await pag.avaliar("ui.digitar('#og', '1.005')");
    assert.match(await pag.avaliar("ui.texto('#resultado')"), /densidade inicial precisa ser maior/);
    assert.equal(await pag.avaliar("ui.$$('#fases li').length"), 0);
  });

  test("carbonatação aponta para o spunding", async () => {
    const { pag } = ctx;
    await pag.ir("carbonatacao/");
    assert.equal(await pag.avaliar("ui.$('#spundingLink a').getAttribute('href')"), "../spunding/");
  });
});
