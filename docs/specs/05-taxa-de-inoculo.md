# Spec 05 — Taxa de inóculo

Status: **implementada** (versão 1.9.0: as cinco técnicas do Mr Malty, ajustadas na API dele)
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
- **Primeira aproximação (v1.8.0):** a placa agitadora do Mr Malty como a curva de White com o volume × 2 ÷ 0,75. Ficava dentro de ±10% na maioria dos passos.

Decisão (Henrique): **oferecer os dois modelos de placa agitadora**, lado a lado.

## 4. Modelo do Mr Malty ajustado na API (2026-09-28)

Depois pedimos as cinco técnicas do Mr Malty. Para estabelecer o modelo, fizemos 166 simulações na API da calculadora de passos dele (`/v1/stepped-starter`):

- as 5 técnicas: simples, O₂ no início, agitação manual (intermitente), aeração contínua e placa agitadora;
- 100 e 400 bi iniciais;
- metas de 1,05× a 6×;
- frasco de 50 L, para que tudo caiba num passo só e a API devolva o menor volume que chega na meta.

Os dados estão em `ferramentas/taxa-de-inoculo/tests/mrmalty-simulacoes.json`.

O que as simulações mostram:

1. **A proporção entre as técnicas é exatamente a dos fatores do Mr Malty** (simples 0,75 · O₂ 1,0 · agitação 1,3 · aeração 1,5 · placa 2,0; estão no código da página dele). Em qualquer nível de crescimento, o volume de uma técnica ÷ o de outra é a razão entre os fatores.
2. **A curva-base não é a de White.** No starter simples, o "volume equivalente" na curva de White desliza de 1,05× para 0,84× conforme o crescimento aumenta. A curva de White só coincide com a do Mr Malty no meio da faixa (daí os ±10% da v1.8.0).
3. **Curva-base ajustada**, no referencial "O₂ no início" (fator 1,0), que o próprio Mr Malty diz ser a calibração da API:

   r = 12,6809 · I^−0,437 − 0,98, com I = células ÷ (litros × fator)

   - Nas 166 simulações: células no fim com desvio máximo de 0,89% (volume: médio 0,34%, máximo 2%, praticamente o arredondamento da API).
   - Nos 46 passos das cadeias coletadas na página (fora do ajuste): desvio máximo de 0,4%, inclusive o passo de 862 bi em 1,31 L que ainda cresce 22 bi.

A curva de White continua na ferramenta como "Sem agitação (Chris White)": é a publicada, a mesma do Brewers Friend.

## 5. Decisões (Henrique, 2026-09-28)

- Crescimento: **Chris White** (sem agitação) + **Braukaiser** (placa agitadora) + as **cinco técnicas do Mr Malty**, com o modelo ajustado na API.
- Levedura seca: **15 bi/g** como padrão, editável.
- Passos: **manuais**, sem limite, com um botão que **sugere** a sequência.
- Fontes de levedura: líquida, seca, reaproveitada e contagem própria.

## 6. Cálculo (`calculo.js`)

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
  - `mm-placa`, `mm-aeracao`, `mm-agitacao`, `mm-o2`, `mm-simples`: r = 12,6809 · I^−0,437 − 0,98 (mínimo 0), com I = células ÷ (litros × fator: 2,0 · 1,5 · 1,3 · 1,0 · 0,75).
  - `braukaiser`: extrato E = litros × °P × SG × 10 g; x = células ÷ E; x < 1,4 → 1,4·E; 1,4 ≤ x < 3,5 → (2,33 − 0,67·x)·E; x ≥ 3,5 → 0.
- **`propagar(inicial, passos)`**: cada passo começa com o fim do anterior. Devolve começo, fim, inoculação, fator, DME (45 PPG) e avisos:
  - densidade fora de 1.030–1.040;
  - inoculação abaixo de 25 milhões/mL na curva de White (ela extrapola);
  - crescimento menor que 25% (muita levedura para o volume), ou nenhum.
- **`sugerirPassos(inicial, necessário, frasco, modelo, SG)`**: cada passo usa o menor volume (múltiplo de 0,1 L) que basta; se nem o frasco cheio basta, enche o frasco e segue. Para com `frasco-pequeno` quando um frasco cheio cresce menos de 10%, ou com `passos-demais` depois de 10 passos.

## 7. Interface

1. **01 Sua cerveja:** volume, OG (SG ou °P), taxa (chips + campo livre). Bloco com as células necessárias e a conta.
2. **02 Sua levedura:** Líquida · Seca · Reaproveitada · Contagem. A data de fabricação preenche a viabilidade (que continua editável). Mostra quanto tem, a % do necessário e, se faltar, a alternativa sem starter.
3. **03 Starter:** escondido para levedura seca (não se faz starter com seca). Tem a caixa "Sugerir passos" (maior starter, densidade e o modelo de agitação: Braukaiser, as cinco técnicas do Mr Malty ou Chris White), os cartões de passo (volume, densidade, agitação, com começo, fim e DME) e o resultado final (células, taxa obtida, % do alvo).
4. **Fontes:** bloco recolhível.

## 8. Testes

- **`tests/calculo.test.js`:**
  - o exemplo publicado do Brewers Friend: 44 dias → 69%; 69 bi num starter de 2,5 L a 1.036, sem agitação → inoculação 27,6 milhões/mL, crescimento 1,7×, 189 bi, 239,7 g de DME;
  - o modelo da Braukaiser (faixas e continuidade);
  - as 166 simulações da API do Mr Malty e os 46 passos das cadeias coletadas na página, com as células no fim dentro de ±1%;
  - a divergência documentada entre o Braukaiser e o Mr Malty na placa agitadora;
  - a sugestão de passos, com invariantes em 300 casos aleatórios de semente fixa.
- **`tests/ui/taxa-de-inoculo.ui.test.js`:** o fluxo na tela: taxas, SG/°P, data → viabilidade, as quatro fontes, passos (adicionar, remover, foco, encadeamento), avisos e sugestão.

## 9. Fora de escopo

- Viabilidade do fermento reaproveitado pela data da coleta (o Mr Malty tem um modelo, mas não é publicado; aqui ela é informada).
- Modelos de viabilidade por fabricante.
- Vitalidade e oxigenação do mosto.
