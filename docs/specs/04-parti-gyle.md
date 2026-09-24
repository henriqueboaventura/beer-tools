# Spec 04 — Parti-gyle

Status: **v2 implementada** (fluxo guiado, versão 1.6.0)
Diretório: `/ferramentas/parti-gyle/` · Número: `04`
Autor: Henrique Boaventura
Atualizado: 2026-09-24

## 1. Problema

No parti-gyle, uma mostura rende mais de uma cerveja. O jeito clássico é **só coletar**: os primeiros mostos (mais concentrados) vão para a cerveja mais forte, os seguintes para a próxima. O cervejeiro sabe o que quer de cada cerveja (volume e OG). Ele precisa saber:

1. quanto malte usar e **quantos litros coletar para cada panela**;
2. a OG que cada cerveja vai atingir e **o que mexer para chegar no alvo**;
3. no dia, com o que mediu, **qual ajuste fazer** e quanto mudar o lúpulo.

A v1 (1.5.0) confundia. Ela misturava dois métodos (dividir por esquema e misturar mosto "forte" com "fraco"), e o plano e o "no dia" não se conversavam. Com 3 cervejas, o conceito de forte/fraco ficava estranho.

## 2. Fontes

| Fonte | O que dá |
|---|---|
| BYO — [Introduction to Parti-Gyle Brewing](https://byo.com/articles/introduction-to-parti-gyle-brewing/) | Regras de divisão: 1/3 + 2/3 (o primeiro terço com o dobro da densidade do resto), três terços (1,5× / 1× / 0,5× a média), metade/metade (58%/42%) |
| BYO — [Parti-Gyle Brewing Techniques](https://byo.com/articles/parti-gyle-brewing-techniques/) | Pontos totais = Σ volume × pontos; 1 lb/gal de malte claro = 24 pontos a 65%; ajuste por diluição (volume = pontos ÷ alvo) e lúpulo proporcional ao volume |
| Craft Beer & Brewing — [Practical Parti-Gyle Brewing](https://www.beerandbrewing.com/practical-parti-gyle-brewing) | Misturar os mostos para cada cerveja (5 gal a 1.080 + 5 gal a 1.020 → IPA, Pale Ale e Saison) |

## 3. Modelo da coleta

A densidade dos mostos cai em linha reta do primeiro ao último litro:

`g(s) = G · (1 − B · s/R)`, com `s` = litros já coletados, `R` = total coletado e **B = 6/7**.

- Esse B é o único que reproduz **exatamente** duas regras da BYO: a de 1/3 + 2/3 (razão 2:1) e a de três terços (1,5 / 1 / 0,5).
- A terceira regra do mesmo artigo (metade/metade = 58%/42%) é **incompatível** com as outras duas. Nenhuma curva que só desce satisfaz as três. Ela fica de fora, e isso está documentado na própria página.
- **Consequência:** só coletando, a 1ª de duas cervejas sai entre **1,75× e 4×** mais densa que a 2ª (em pontos). Mais parecidas que isso, só trocando mosto entre as panelas; mais diferentes, só com água ou fervura.
- É uma previsão. O passo 03 corrige com o que foi medido.

## 4. Cálculo (`calculo.js`)

- **`planejar({cervejas:[{nome, volume, og}], evaporacao %, eficiencia %, ppg})`**
  - Ordem de coleta: a maior OG primeiro. O volume de coleta é o volume final ÷ (1 − perda na fervura).
  - Pontos·litro totais = Σ volume × pontos pedidos. Isso define G e o malte: kg = pontos·L ÷ (PPG × 8,3454 × eficiência).
  - Por cerveja: trecho da coleta, OG na panela, OG prevista depois da fervura e a **ação** (`ok`, `agua` ou `ferver`, com o volume final).
  - Com 2 cervejas, a **sugestão**:
    - `dividir`: volumes que acertam as duas sem ajuste, mantendo o total;
    - `misturar`: a razão é menor que 1,75, e o plano diz quanto de cada panela vai para cada cerveja;
    - `impossivel`: a razão é maior que 4.
- **`acao(volume, pontos, alvo)`**: volume final = volume × pontos ÷ alvo. Com diferença menor que 0,5%, a ação é "ok".
- **`misturar(...)`**: litros de cada mosto por cerveja, com água abaixo do fraco. Usada na sugestão `misturar`.
- **`noDia({cervejas, medidas, evaporacao})`**: com o volume e a OG medidos antes da fervura, calcula a OG depois da fervura, a ação e o fator do lúpulo (volume final ÷ volume planejado).

## 5. Interface

1. **01 Suas cervejas:**
   - 2 ou 3 cervejas (padrão: o exemplo da BYO, Wee Heavy 19 L a 1.096 + Scottish Export 38 L a 1.048);
   - nome opcional, volume e OG finais;
   - eficiência e perda na fervura, com o potencial do malte recolhido.
2. **02 O plano:**
   - malte;
   - uma barra com a ordem da coleta;
   - um card por cerveja: "Colete os primeiros/próximos X L", a OG na panela, o volume e a OG depois da fervura, e a ação (verde se chega no alvo, âmbar se precisa de ajuste);
   - a sugestão para 2 cervejas, com o botão "Usar essa divisão".
3. **03 No dia:** volume e OG medidos por panela, preenchidos com a previsão até você editar. Mostra a OG depois da fervura, a ação e o fator do lúpulo (quando muda 2% ou mais). Tem o botão "Voltar para a previsão".
4. **Fontes:** bloco recolhível com os três artigos.

## 6. Testes

- **`tests/calculo.test.js`:**
  - o modelo reproduz as regras da BYO (1/3 + 2/3 e três terços), com os limites de 1,75× e 4×;
  - malte: 320 pontos·galão → ~13 lb;
  - ação: 2 gal a 1.100 → 2,5 gal a 1.080;
  - mistura: IPA, Pale e Saison da Craft Beer & Brewing.
- **`tests/cenarios.test.js`:**
  - os cenários da interface: padrão, ordem pela OG, pedido fora da curva com a divisão sugerida, cervejas parecidas, razão maior que 4, 3 cervejas, entradas incompletas e o no dia;
  - invariantes com casos aleatórios de semente fixa: os pontos se conservam, a coleta desce, toda ação leva ao alvo, a divisão sugerida acerta sem ajuste, a troca de mosto fecha sem sobra, e o lúpulo acompanha o volume.

## 7. Fora de escopo

- Cor (SRM) de cada cerveja.
- Malte de "capping" nos mostos seguintes.
- IBU por cerveja.
- 4 cervejas ou mais (as fontes vão até 3).
