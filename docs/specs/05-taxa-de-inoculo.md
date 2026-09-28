# Spec 05 — Taxa de inóculo

Status: **implementada** (versão 1.8.0: dois modelos de placa agitadora)
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
| Braukaiser, placa agitadora, mosto a 1.040 | 0,63 L (a sugestão arredonda para 0,7 L) |
| Mr Malty, placa agitadora | 0,64 L na calculadora simples (1,27 L ÷ 2); 0,60 L na de passos |
| Chris White, sem agitação | 1,56 L |
| Mr Malty, starter simples | 1,69 L |
| Craft Beer & Brewing | 0,86 L (e ignora a viabilidade) |

Conclusão inicial: nesse exemplo, os modelos publicados ficam perto do Mr Malty. A regra da Craft Beer & Brewing é de bolso e foi descartada como modelo. A validação passo a passo (seção 3) mostrou que, na placa agitadora, a proximidade era coincidência desse exemplo.

## 3. Validação passo a passo contra o Mr Malty (2026-09-28)

Rodamos 24 cenários na [calculadora de starter em passos](https://mrmalty.com/pitching-stepped-starter-preview.html) do Mr Malty, preenchendo a própria página, e comparamos cada passo: mesmo volume e mesmas células iniciais.

- **Sem agitação (White) × "Simple Starter": bate.** Entre 90% e 108% do crescimento do Mr Malty, na faixa de 20 a 180 milhões/mL.
- **Placa agitadora (Braukaiser) × "Stir Plate": diverge.**

  | Inoculação do passo | Braukaiser ÷ Mr Malty |
  |---|---|
  | abaixo de 60 M/mL | 115% a 230% |
  | 90 a 115 M/mL | 97% a 101% |
  | 150 a 250 M/mL | 36% a 82% |
  | acima de ~350 M/mL | 0% (o Braukaiser para; o Mr Malty continua) |

  Exemplo: lager de 884 bi com 1 pacote e starter de até 2 L. O Mr Malty chega em 4 passos; o Braukaiser para em ~620 bi. O próprio Kai Troester diz que os dados dele não concordam com o Mr Malty.
- **Placa agitadora do Mr Malty reproduzida:** é a curva de White com o volume multiplicado por 2 ÷ 0,75 ≈ 2,67. Esses são os fatores do próprio Mr Malty (placa agitadora 2,0; starter simples 0,75; estão no código da página dele). Fica dentro de ±10% em quase todos os 21 passos coletados. As exceções são passos de fim de cadeia com pouco crescimento: um de 103 bi sai com 83%, e um de 22 bi (658 M/mL) não cresce no modelo.

Decisão (Henrique): **oferecer os dois modelos de placa agitadora**, lado a lado.

## 4. Decisões (Henrique, 2026-09-28)

- Crescimento: **Chris White** (sem agitação) + **Braukaiser** (placa agitadora) + **Mr Malty** (placa agitadora), depois da validação.
- Levedura seca: **15 bi/g** como padrão, editável.
- Passos: **manuais**, sem limite, com um botão que **sugere** a sequência.
- Fontes de levedura: líquida, seca, reaproveitada e contagem própria.

## 5. Cálculo (`calculo.js`)

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
  - `mrmalty`: a mesma curva de `white`, com I = células ÷ (litros × 2,67).
  - `braukaiser`: extrato E = litros × °P × SG × 10 g; x = células ÷ E; x < 1,4 → 1,4·E; 1,4 ≤ x < 3,5 → (2,33 − 0,67·x)·E; x ≥ 3,5 → 0.
- **`propagar(inicial, passos)`**: cada passo começa com o fim do anterior. Devolve começo, fim, inoculação, fator, DME (45 PPG) e avisos:
  - densidade fora de 1.030–1.040;
  - inoculação fora de 25–100 milhões/mL na curva de White (fora dessa faixa a curva extrapola). No modelo do Mr Malty vale a inoculação efetiva, o que dá ~67 a ~267 milhões/mL reais;
  - starter que não cresce.
- **`sugerirPassos(inicial, necessário, frasco, modelo, SG)`**: cada passo usa o menor volume (múltiplo de 0,1 L) que basta; se nem o frasco cheio basta, enche o frasco e segue. Para com `frasco-pequeno` quando um frasco cheio cresce menos de 10%, ou com `passos-demais` depois de 10 passos.

## 6. Interface

1. **01 Sua cerveja:** volume, OG (SG ou °P), taxa (chips + campo livre). Bloco com as células necessárias e a conta.
2. **02 Sua levedura:** Líquida · Seca · Reaproveitada · Contagem. A data de fabricação preenche a viabilidade (que continua editável). Mostra quanto tem, a % do necessário e, se faltar, a alternativa sem starter.
3. **03 Starter:** escondido para levedura seca (não se faz starter com seca). Tem a caixa "Sugerir passos" (maior starter, densidade e os três modelos de agitação), os cartões de passo (volume, densidade, agitação, com começo, fim e DME) e o resultado final (células, taxa obtida, % do alvo).
4. **Fontes:** bloco recolhível.

## 7. Testes

- **`tests/calculo.test.js`:**
  - o exemplo publicado do Brewers Friend: 44 dias → 69%; 69 bi num starter de 2,5 L a 1.036, sem agitação → inoculação 27,6 milhões/mL, crescimento 1,7×, 189 bi, 239,7 g de DME;
  - o modelo da Braukaiser (faixas e continuidade);
  - os passos coletados do Mr Malty: sem agitação com o White, placa agitadora com o modelo `mrmalty` (±12%, porque o Mr Malty arredonda as células) e a divergência documentada do Braukaiser;
  - a sugestão de passos, com invariantes em 300 casos aleatórios de semente fixa.
- **`tests/ui/taxa-de-inoculo.ui.test.js`:** o fluxo na tela: taxas, SG/°P, data → viabilidade, as quatro fontes, passos (adicionar, remover, foco, encadeamento), avisos e sugestão.

## 8. Fora de escopo

- Viabilidade do fermento reaproveitado pela data da coleta (o Mr Malty tem um modelo, mas não é publicado; aqui ela é informada).
- Modelos de viabilidade por fabricante.
- Vitalidade e oxigenação do mosto.
