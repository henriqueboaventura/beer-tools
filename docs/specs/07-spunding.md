# Spec 07 — Spunding

Status: **implementada** (versão 1.17.0)
Diretório: `/spunding/` · Número: `05`
Autor: Henrique Boaventura
Atualizado: 2026-10-20

## 1. Problema

Spunding é fermentar com o fermentador fechado e uma válvula de alívio (válvula de spunding) segurando a pressão: o CO₂ da própria fermentação fica na cerveja, e o excesso sai pela válvula. Serve para duas coisas:

- **carbonatar** sem açúcar e sem cilindro, ou com menos CO₂ de cilindro;
- **mudar o sabor**: a pressão segura ésteres e álcoois superiores, o que permite, por exemplo, fermentar lager a 18 °C e ficar limpa.

O cervejeiro precisa saber:

1. **que pressão usar em cada fase**, de acordo com o estilo;
2. **quando fechar a válvula**, ou seja, quantos pontos de densidade ainda precisam faltar para o resto da fermentação encher o fermentador até a pressão final;
3. **quanto a cerveja carbonata** na temperatura da fermentação com essa pressão. Quase nunca chega no alvo: a 20 °C, 2,5 vol pedem 2,0 bar, mais do que muito fermentador aguenta;
4. **que pressão de CO₂ colocar depois do cold crash** para completar a carbonatação;
5. **se o fermentador aguenta.**

A calculadora de carbonatação (06) já tem "Carbonatação natural (fechar antes do fim)" como fonte de açúcar, pensando no envase. Esta ferramenta é usada **durante a fermentação** e cobre o processo inteiro.

## 2. Referências

### Mr Malty ([Priming Sugar Calculator](https://mrmalty.com/priming-sugar-calculator.html))

Já portada e validada na spec 06 (diferença zero em 8 cenários). Para spunding, o que interessa é a curva de equilíbrio pressão × temperatura × volumes (`co2PelaPressao`, `pressaoParaVolumes`). Não tem plano por fase nem conta de quando fechar.

### Bräu Supply ([Pressure Fermentation Calculator](https://brausupply.com/pages/pressure-fermentation-calculator)), lida em 2026-10-20

O cálculo roda no navegador (`bs-calc.js`). O que ela faz:

- **Plano por fase e por estilo:** inoculação (1–2 dias), fermentação ativa, fim da fermentação, descanso de diacetil, cold crash e carbonatação. Cada fase tem uma faixa de pressão e um critério para passar para a próxima ("a densidade chega em X", "a densidade fica 2 dias em FG").
- **Grupos de estilo**, com pressão por fase (psi, convertida para bar) e carbonatação típica:

  | Grupo | 1–2 dias | Ativa | Fim | Vol | Usa pressão? |
  |---|---|---|---|---|---|
  | Lager fermentada quente (17–20 °C) | 0–0,15 | 0,7–1,0 | 0,8–1,0 | 2,5–2,7 | Sim, o melhor caso |
  | Kölsch, cream ale, blonde | 0–0,05 | 0,35–0,7 | 0,55–0,8 | 2,4–2,7 | Sim |
  | Pale ale, IPA, hazy | 0–0,05 | 0,35–0,55 | 0,55–0,7, depois do último dry hop | 2,4–2,6 | Moderada |
  | Amber, brown, red, scottish | 0–0,05 | 0,15–0,3 | 0,35–0,55 | 2,0–2,3 | Leve |
  | Stout e porter | 0–0,05 | 0,3–0,4 | 0,4–0,55 | 2,0–2,4 | Moderada |
  | Imperial stout, barleywine, DIPA | 0–0,05 | 0,3–0,4 | 0,4–0,55 | 2,0–2,3 | Sim, menos fusel |
  | Inglesas | 0 | 0 | 0,05–0,15 | 1,8–2,0 | Só no fim |
  | Belgas e saison | 0 | 0 | 0,05–0,15 | 2,6–3,0 | Só no fim |
  | Weizen e witbier | 0 | 0 | 0,05–0,2 | 3,0+ | Só no fim |

  As faixas por estilo são recomendação de uma loja, não física. Henrique aprovou usar como sugestão editável (2026-10-20), e a tela diz que são sugestões.
- **Quando fechar a válvula:** CO₂ para ir da pressão da fase ativa até a final (diferença de volumes dissolvidos) + CO₂ para encher o espaço vazio, dividido por 0,49 vol por ponto. Arredonda para cima e soma **1 ponto de folga** (mínimo 2). Fechar cedo não estraga cerveja limpa: a válvula solta o excesso.
- **Carbonatação no quente × no frio:** mostra quantos volumes a cerveja tem com a pressão final na temperatura da fermentação e, se não chegou no alvo, a pressão de CO₂ depois do cold crash.
- **Cold crash:** a pressão cai ao resfriar (a cerveja fria absorve mais CO₂ e o gás do espaço vazio contrai). Sem CO₂ ligado, o fermentador pode ficar em vácuo e puxar ar (oxigênio). Ligue o CO₂ antes de começar a resfriar.
- **"Meu fermentador agora":** temperatura + manômetro → volumes dissolvidos, com o aviso de que só vale depois de um dia parado naquela condição.
- **Avisos:** acima da pressão de trabalho do fermentador; estilos de ésteres com pressão alta antes do fim; lager acima de ~20 °C ganha ésteres mesmo sob pressão; espaço vazio menor que 10% do volume (krausen); cerveja forte (OG ≥ 1,080) precisa de muito fermento antes de pressurizar.
- **Tabela de carbonatação** para o alvo, de 0 a 20 °C.

### Carbonatação por estilo (BYO, tabela enviada por Henrique em 2026-10-20)

| Grupo | Volumes |
|---|---|
| Britânicas tradicionais / cask (bitter, mild, ESB) | 1,0–2,2 |
| Porter e stout (sem nitro) | 1,5–2,3 |
| Lagers americanas e europeias, kölsch | 2,4–2,8 |
| Ales americanas e IPA (pale, IPA, amber) | 2,2–2,7 |
| Belgas (tripel, saison, golden strong) | 2,4–4,5 |
| Trigo alemãs e lambics (hefeweizen, berliner, lambic de fruta) | 3,0–5,1 |

Uso na ferramenta:

- **Faixa típica** de cada grupo de estilo vem desta tabela (mais larga que a da Bräu Supply nas belgas e de trigo).
- **Alvo padrão** continua sendo o ponto médio do Mr Malty (`ESTILOS` da carbonatação), para as duas ferramentas sugerirem o mesmo número.
- Alvo acima do que o fermentador segura no quente é normal nas belgas e de trigo: o plano completa no frio. Acima de ~3,5 vol, a ferramenta lembra que garrafa comum não aguenta e aponta a calculadora de carbonatação (garrafa reforçada).

**Comparação da física.** Ela usa a regressão comum (Zahm & Nagel) em vez da do Mr Malty. Dá a mesma pressão no frio (0–10 °C) e até 5% menos no quente (2,5 vol a 20 °C: 1,91 × 2,00 bar). O CO₂ por ponto bate: 0,49 vol (ela) × 0,50 vol (nós, 0,989 g/L ÷ 1,964). Ficamos com o Mr Malty, como na carbonatação.

## 3. Cálculo

A física é a mesma da carbonatação. A ferramenta carrega `../carbonatacao/calculo.js` em vez de copiar as fórmulas, então uma correção vale para as duas. O que é novo fica em `spunding/calculo.js`.

- **Volumes com a válvula:** `co2PelaPressao(bar, tempFerm)`.
- **Pontos para fechar a válvula:**
  - CO₂ (g) = (vol na pressão final − vol na pressão da fase ativa) × 1,964 × litros + CO₂ que o espaço vazio precisa para ir de uma pressão à outra (lei dos gases, `hEspaco`);
  - pontos = CO₂ ÷ (`CO2_POR_PONTO_GL` × litros);
  - fechar em FG + arredondado para cima + 1 (folga), no mínimo 2, e nunca acima da OG.
  - Exemplo: 20 L a 20 °C, de aberto até 2,0 bar, sem espaço vazio ≈ 3,3 pontos → fechar em FG + 5 pontos. Com 10 L de espaço vazio ≈ 6,0 pontos.
- **Pressão para o alvo no quente:** `pressaoParaVolumes(alvo, tempFerm)`. Se passar da pressão máxima do fermentador, a ferramenta explica que o resto vem no frio.
- **Depois do cold crash:** `pressaoParaVolumes(alvo, tempFria)` é a pressão de CO₂ para completar. Se a cerveja já tem o alvo, só manter. Exemplo: 2,5 vol a 2 °C ≈ 0,7 bar.
- **Durante o cold crash:** CO₂ ligado na menor entre a pressão da válvula e a do alvo no frio, para o fermentador não puxar ar.
- **Meu fermentador agora:** `co2PelaPressao(manômetro, temp)`.
- **Segurança:** a maior pressão do plano contra a pressão máxima de trabalho do fermentador. Acima de 80%: atenção. Acima de 100%: perigo, e a ferramenta sugere baixar a pressão e completar no frio.

### Fermentadores (confirmados por Henrique em 2026-10-20)

| Fermentador | Pressão máxima de trabalho |
|---|---|
| Fermzilla / PET pressurizável | 2,4 bar (35 psi) |
| Barril corny (válvula de alívio) | ~4 bar |
| Inox pressurizável (unitank) | conforme o fabricante (o da Bräu Supply: 2,0 bar, com válvula de alívio de 1,0 bar) |
| Outro | campo livre, em bar |

## 4. Interface

1. **01 Estilo:** grupo de estilo (tabela acima), que preenche as pressões por fase, a temperatura e o alvo; tudo editável.
2. **02 Fermentador:** tipo, que preenche a pressão máxima (editável), e a capacidade total em L.
3. **03 A cerveja:** volume (o espaço vazio aparece como informação), OG e FG esperada, temperatura da fermentação.
4. **04 Pressão e carbonatação:** pressão final da válvula, alvo em volumes e temperatura do cold crash (padrão 2 °C).
5. **05 Plano:**
   - destaque: "Feche a válvula em X bar, em Y SG" (ou "Fermente aberto e feche no fim", nos estilos de ésteres);
   - "No quente a cerveja fica com X vol" e "Depois do cold crash, CO₂ em Y bar" (ou "Já está carbonatada");
   - fase a fase: nome, temperatura, pressão e "passe para a próxima quando…";
   - "Segurança do <fermentador>", com o veredito;
   - avisos (seção 2);
   - recolhíveis: "Os números do plano", "Tabela de carbonatação para X vol" e "Meu fermentador agora" (temperatura + manômetro → volumes).

Em telas pequenas, os passos ficam um embaixo do outro, como nas outras calculadoras.

## 5. Mudanças em outras ferramentas

- **Carbonatação (06):** a opção "Carbonatação natural" ganha um link "Fazendo spunding? Use a calculadora de spunding". A conta continua lá.
- **Registro:** entra em `FERRAMENTAS` (`assets/js/shell.js`) como `05`, logo depois de carbonatação (parti-gyle vira 06 e taxa de inóculo 07), no menu, `index.html`, `404.html`, `manifest.webmanifest`, `sw.js`, `sitemap.xml` e README.

## 6. Testes

- **`spunding/tests/calculo.test.js`:**
  - volumes e pressão iguais aos da carbonatação nos mesmos cenários;
  - pontos para fechar a válvula sem e com espaço vazio, folga, mínimo de 2 e teto na OG;
  - cenários da Bräu Supply (convertidos), aceitando a diferença conhecida da fórmula no quente;
  - pressão depois do cold crash e "já está carbonatada";
  - "meu fermentador agora";
  - segurança: ok, atenção e perigo.
- **`tests/ui/spunding.ui.test.js`:** estilo preenche o plano, fermentador preenche o máximo, estilos de ésteres, avisos, recolhíveis, sem rolagem lateral em 390 px.

## 7. Fora de escopo

- Altitude (a Bräu Supply corrige; nós não, como na carbonatação).
- Curva de fermentação ao longo do tempo (prever o dia de fechar a válvula).
- Carbonatação forçada com pedra (tempo × pressão).
- Balanceamento da linha de chope.
- Unidades imperiais.
