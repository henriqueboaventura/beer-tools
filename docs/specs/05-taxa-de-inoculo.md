# Spec 05 — Taxa de inóculo

Status: **implementada** (versão 1.7.0)
Diretório: `/ferramentas/taxa-de-inoculo/` · Número: `05`
Autor: Henrique Boaventura
Atualizado: 2026-09-28

## 1. Problema

Antes de inocular, o cervejeiro precisa saber:

1. quantas células de levedura a cerveja precisa;
2. quantas ele tem (pacote líquido velho, sachê seco, fermento reaproveitado);
3. se faltar, que starter fazer, em um ou mais passos, para chegar lá.

Tudo em **litros**, sempre.

## 2. Comparação das calculadoras de referência

Antes de criar, comparamos três calculadoras. O Mr Malty roda o cálculo num servidor (API) e não publica as fórmulas: os números abaixo saíram de alguns cálculos de teste enviados à API. O Brewers Friend bloqueia acesso automático: os números vêm de uma cópia em PDF da página e das fontes que ela cita.

| | Mr Malty | Brewers Friend | Craft Beer & Brewing |
|---|---|---|---|
| Células necessárias | taxa × mL × °P ÷ 1000 | igual | igual |
| Taxas (milhões/mL/°P) | ale 0,75 · híbrida 1,0 · lager 1,5 | 0,35 (mínimo do fabricante) · 0,75 · 1,0 · 1,5 · 2,0 | ale 0,75 · alta densidade 1,0 · lager 1,5 |
| Pacote líquido | 100 bi | 100 bi | 100 bi |
| Viabilidade líquida | "clássico" ≈ 96% − 0,72%/dia (mínimo 10%); modelos por fabricante (White Labs ≈ −0,13%/dia, Wyeast ≈ −0,67%/dia) | 100% − 0,7%/dia (44 dias → 69%) | não considera |
| Levedura seca | 20 bi/g | 10 bi/g (estudo citado: 8 a 18) | ≈ 18 bi/g (200 bi por sachê de 11 g) |
| Reaproveitada | 4,5 bi/mL de sólidos × % sólidos × viabilidade | slurry com densidade configurável | não tem |
| Crescimento | curva no formato da de Chris White, com constantes próprias (ajuste nosso: 12,585·I^−0,432 − 1,005), calibrada para "simples com O₂"; outros tipos dividem o volume (simples 0,75 · agitação intermitente 1,3 · aeração contínua 1,5 · placa agitadora 2,0) | Chris White sem agitação (fórmula publicada) e Braukaiser na placa agitadora | "1 L dobra o pacote": starter = células ÷ 100 − 1 |
| Passos | automáticos, a partir do frasco máximo (no servidor) | até 3, manuais, com DME | não tem |

Exemplo comum (20 L a 1.050, ale, 1 pacote fresco, precisa de 186 bi):

| Modelo | Starter |
|---|---|
| Braukaiser, placa agitadora, mosto a 1.040 | 0,63 L |
| Mr Malty, placa agitadora | 0,64 L (1,27 L ÷ 2) |
| Chris White, sem agitação | 1,56 L |
| Mr Malty, starter simples | 1,69 L |
| Craft Beer & Brewing | 0,86 L (e ignora a viabilidade) |

Conclusão: os modelos **publicados** concordam com o Mr Malty. A ferramenta usa só fórmulas citáveis. A regra da Craft Beer & Brewing é regra de bolso e foi descartada como modelo.

## 3. Decisões (Henrique, 2026-09-28)

- Crescimento: **Chris White** (sem agitação) + **Braukaiser** (placa agitadora).
- Levedura seca: **15 bi/g** como padrão, editável.
- Passos: **manuais**, sem limite, com um botão que **sugere** a sequência.
- Fontes de levedura: líquida, seca, reaproveitada e contagem própria.

## 4. Cálculo (`calculo.js`)

Unidades: litros, bilhões de células, taxa em milhões/mL/°P (bilhões por litro = milhões por mL).

- **`celulasNecessarias(litros, °P, taxa)`** = taxa × litros × °P.
- **`viabilidadeLiquida(dias)`** = 100 − 0,7 × dias, entre 0 e 100.
- **`celulasDisponiveis(fonte)`**:
  - líquida: pacotes × 100 × viabilidade;
  - seca: gramas × bi/g;
  - reaproveitada: mL × 4,5 × % sólidos × viabilidade;
  - contagem: o número informado.
- **`semStarter(fonte, necessário)`**: pacotes, gramas e sachês de 11 g, ou mL.
- **`crescimento(modelo, células, litros, SG)`**, novas células num passo:
  - `white`: I = células ÷ litros (milhões/mL); r = 12,54793776 · I^−0,4594858324 − 0,9994994906 (mínimo 0); novas = r × células.
  - `braukaiser`: extrato E = litros × °P × SG × 10 g; x = células ÷ E; x < 1,4 → 1,4·E; 1,4 ≤ x < 3,5 → (2,33 − 0,67·x)·E; x ≥ 3,5 → 0.
- **`propagar(inicial, passos)`**: cada passo começa com o fim do anterior. Devolve começo, fim, inoculação, fator, DME (45 PPG) e avisos:
  - densidade fora de 1.030–1.040;
  - inoculação fora de 25–100 milhões/mL na curva de White (fora dessa faixa a curva extrapola);
  - starter que não cresce.
- **`sugerirPassos(inicial, necessário, frasco, modelo, SG)`**: cada passo usa o menor volume (múltiplo de 0,1 L) que basta; se nem o frasco cheio basta, enche o frasco e segue. Para com `frasco-pequeno` quando um frasco cheio cresce menos de 10%, ou com `passos-demais` depois de 10 passos.

## 5. Interface

1. **01 Sua cerveja:** volume, OG (SG ou °P), taxa (chips + campo livre). Bloco com as células necessárias e a conta.
2. **02 Sua levedura:** Líquida · Seca · Reaproveitada · Contagem. A data de fabricação preenche a viabilidade (que continua editável). Mostra quanto tem, a % do necessário e, se faltar, a alternativa sem starter.
3. **03 Starter:** escondido para levedura seca (não se faz starter com seca). Tem a caixa "Sugerir passos" (maior starter, densidade, agitação), os cartões de passo (volume, densidade, agitação, com começo, fim e DME) e o resultado final (células, taxa obtida, % do alvo).
4. **Fontes:** bloco recolhível.

## 6. Testes

- **`tests/calculo.test.js`:**
  - o exemplo publicado do Brewers Friend: 44 dias → 69%; 69 bi num starter de 2,5 L a 1.036, sem agitação → inoculação 27,6 milhões/mL, crescimento 1,7×, 189 bi, 239,7 g de DME;
  - o modelo da Braukaiser (faixas e continuidade);
  - o Mr Malty na placa agitadora (~0,63 L);
  - a sugestão de passos, com invariantes em 300 casos aleatórios de semente fixa.
- **`tests/ui/taxa-de-inoculo.ui.test.js`:** o fluxo na tela: taxas, SG/°P, data → viabilidade, as quatro fontes, passos (adicionar, remover, foco, encadeamento), avisos e sugestão.

## 7. Fora de escopo

- Viabilidade do fermento reaproveitado pela data da coleta (o Mr Malty tem um modelo, mas não é publicado; aqui ela é informada).
- Modelos de viabilidade por fabricante.
- Vitalidade e oxigenação do mosto.
