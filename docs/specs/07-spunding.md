# Spec 07 — Spunding

Status: **implementada** (versão 1.18.0, simplificada; a 1.17 tinha plano por estilo e fases)
Diretório: `/spunding/` · Número: `05`
Autor: Henrique Boaventura
Atualizado: 2026-10-20

## 1. Problema

Spunding é fermentar com o fermentador fechado e uma válvula de alívio (válvula de spunding) segurando a pressão: o CO₂ da própria fermentação fica na cerveja, e o excesso sai pela válvula.

A ferramenta responde uma pergunta só: **em que densidade fechar a válvula** para o resto da fermentação levar o fermentador até a pressão (ou a carbonatação) escolhida.

A versão 1.17 também montava um plano por estilo (pressão em cada fase, cold crash, segurança do fermentador, avisos, tabela). Henrique achou complexa demais para o uso (2026-10-20), e ela foi reduzida a esta conta. A pressão de CO₂ depois do cold crash fica na calculadora de carbonatação (06).

## 2. Referências

- **Mr Malty ([Priming Sugar Calculator](https://mrmalty.com/priming-sugar-calculator.html)):** a física, já portada e validada na spec 06. Curva de equilíbrio pressão × temperatura × volumes (`co2PelaPressao`, `pressaoParaVolumes`), espaço vazio (`hEspaco`) e CO₂ por ponto de densidade (`CO2_POR_PONTO_GL`, cerca de 0,50 vol por ponto).
- **Bräu Supply ([Pressure Fermentation Calculator](https://brausupply.com/pages/pressure-fermentation-calculator)), lida em 2026-10-20:** a mesma conta de quando fechar (0,49 vol por ponto, igual ao nosso), arredondada para cima com **1 ponto de folga** e mínimo de 2. Fechar cedo não estraga: a válvula solta o excesso.

## 3. Cálculo

A ferramenta carrega `../carbonatacao/calculo.js` em vez de copiar as fórmulas. O que é novo fica em `spunding/calculo.js`.

- **Entrada em bar ou em volumes** (decisão de Henrique, 2026-10-20). Em volumes, a pressão é `pressaoParaVolumes(vol, tempFerm)`; em bar, os volumes são `co2PelaPressao(bar, tempFerm)`.
- **A válvula fica aberta (0 bar) até fechar** (decisão de Henrique, 2026-10-20).
- **Pontos para fechar:**
  - CO₂ (g) = (vol na pressão − vol a 0 bar) × 1,964 × litros + CO₂ que o espaço vazio precisa para ir de 0 até a pressão (`hEspaco`);
  - pontos = CO₂ ÷ (`CO2_POR_PONTO_GL` × litros);
  - fechar em FG + pontos arredondados para cima + 1 (folga), no mínimo 2.
  - Exemplo: 20 L a 20 °C, até 2,0 bar, sem espaço vazio ≈ 3,3 pontos → fechar em FG + 5. Com 10 L de espaço vazio ≈ 5,1 pontos → FG + 7.
- **Sem capacidade**, a conta ignora o espaço vazio.
- **Erros:** campo vazio ou zero; cerveja maior que o fermentador; em volumes, alvo que a cerveja já tem com a válvula aberta ("não precisa fechar").

## 4. Interface

1. **01 Aonde chegar:** chips "Pressão (bar)" e "Carbonatação (vol)", o valor e a temperatura da fermentação.
2. **02 A cerveja:** volume, capacidade do fermentador e densidade final esperada.
3. **03 Quando fechar:** destaque "Feche a válvula em 1,014 SG", com "N pontos antes da final, com a válvula regulada em X bar", e uma linha com os volumes de CO₂, os pontos sem folga e o espaço vazio.

Abaixo do resultado, um aviso fixo: regular a válvula abaixo da pressão máxima de trabalho do fermentador, das conexões e da válvula, com válvula de alívio; balde e bombona comuns não são para pressão.

Padrão: 1 bar, 18 °C, 20 L num fermentador de 30 L, FG 1,010. Ao trocar para volumes, o valor vira 2,5.

## 5. Outras ferramentas

- **Carbonatação (06):** a opção "Carbonatação natural" aponta para esta ferramenta ("diz em que densidade fechar a válvula").
- **Registro:** `05` em `FERRAMENTAS` (`assets/js/shell.js`), `index.html`, `404.html`, `manifest.webmanifest`, `sw.js`, `sitemap.xml` e README.

## 6. Testes

- **`spunding/tests/calculo.test.js`:** física igual à da carbonatação; pontos sem e com espaço vazio; folga e mínimo de 2; sem capacidade; bar × volumes equivalentes; "não precisa fechar"; entradas inválidas.
- **`tests/ui/spunding.ui.test.js`:** resultado padrão, troca para volumes, erros e o link da carbonatação.

## 7. Fora de escopo

- Pressão por estilo e plano por fases (eram da 1.17).
- Pressão durante a fermentação ativa antes de fechar.
- Cold crash e carbonatação no frio (calculadora de carbonatação).
- Conferir a pressão contra o fermentador (só o aviso fixo).
- Altitude e unidades imperiais.
