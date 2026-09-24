# Spec 04 — Parti-gyle

Status: **v1 implementada**
Diretório: `/ferramentas/parti-gyle/` · Número: `04`
Autor: Henrique Boaventura
Atualizado: 2026-09-24

## 1. Problema

No parti-gyle, uma mostura rende mais de uma cerveja: os primeiros mostos (mais concentrados) fazem uma cerveja forte e os seguintes fazem uma mais leve. O cervejeiro precisa de três respostas:

1. **Antes:** que densidade cada cerveja vai ter, e quanto malte usar.
2. **No dia:** os mostos nunca saem como previsto. Com o mosto forte e o fraco medidos, quanto de cada vai para cada panela.
3. **Correção:** o primeiro mosto saiu mais denso (ou mais fraco) que o planejado. Quanto rende no alvo, e como fica o lúpulo.

## 2. Fontes

| Fonte | O que dá |
|---|---|
| BYO — [Introduction to Parti-Gyle Brewing](https://byo.com/articles/introduction-to-parti-gyle-brewing/) | Esquemas de divisão: 1/3 + 2/3 (o primeiro terço com o dobro da densidade do resto), metade/metade (58% e 42% dos pontos), três terços (1,5×, 1× e 0,5× a média) |
| BYO — [Parti-Gyle Brewing Techniques](https://byo.com/articles/parti-gyle-brewing-techniques/) | Pontos totais = Σ volume × pontos; 1 lb/gal de malte claro = 24 pontos a 65%; ajuste do primeiro mosto (volume = pontos ÷ alvo); correção do lúpulo pelo volume |
| Craft Beer & Brewing — [Practical Parti-Gyle Brewing](https://www.beerandbrewing.com/practical-parti-gyle-brewing) | Misturar o mosto forte e o fraco para cada cerveja (exemplo de 5 gal a 1.080 + 5 gal a 1.020 → IPA, Pale Ale e Saison) |

As três regras de divisão são aproximações práticas e não formam uma curva única coerente entre si. Por isso a ferramenta oferece exatamente os três esquemas publicados, sem interpolar entre eles.

## 3. Cálculo (`calculo.js`)

Toda a conta é feita em **pontos de densidade** (1.064 = 64). Na mistura, os pontos·volume se conservam.

- **`planejar({esquema, volume, og, definirPor})`**: para cada cerveja, volume = volume total × fração do esquema e pontos = pontos médios × multiplicador. Com `definirPor: "primeira"`, os pontos médios = OG da 1ª ÷ multiplicador da 1ª. Devolve também a OG média e os pontos·litro totais.
- **`malteNecessario(pontos·litro, eficiência %, PPG = 37)`**: kg = pontos·L ÷ (PPG × 8,3454 × eficiência). O 8,3454 converte "por libra por galão" em "por kg por litro".
- **`misturar({forte, fraco, cervejas})`**:
  - para cada cerveja de volume V e alvo T (entre o fraco W e o forte F): forte = V·(T−W)/(F−W) e fraco = V − forte;
  - com T < W: fraco = V·T/W, e o resto é água;
  - com T > F: impossível só misturando;
  - devolve o que foi usado e o que sobra (ou falta) de cada mosto.
- **`ajustar(volume, og, alvo)`**: volume no alvo = volume × pontos ÷ pontos do alvo; água para diluir; fator do lúpulo = novo volume ÷ volume. Sinaliza quando o mosto saiu mais fraco que o alvo.

## 4. Interface

1. **01 Planejar a divisão:**
   - escolha do esquema (chips com descrição);
   - volume total e OG, definida pela média do lote ou pela 1ª cerveja (alternar converte o valor mantendo o mesmo lote);
   - um card por cerveja, com OG, volume, °P e % dos pontos;
   - malte necessário, com eficiência e PPG ajustáveis.
2. **02 No dia:**
   - mosto forte e fraco (volume e OG);
   - de 1 a 4 cervejas-alvo;
   - uma "receita" por cerveja, em litros de forte, fraco e água;
   - total usado, sobra ou falta de cada mosto. O que falta ou é impossível aparece em vermelho; as atenções, em âmbar.
3. **03 Primeiro mosto saiu diferente?:** volume coletado, OG medida e OG alvo → volume no alvo, água a acrescentar e fator do lúpulo.
4. **Fontes:** bloco recolhível com os três artigos.

A ferramenta avisa para usar sempre a mesma referência (tudo antes ou tudo depois da fervura). Volumes em litros, malte em kg, densidade em SG com °P ao lado.

## 5. Testes

`ferramentas/parti-gyle/tests/calculo.test.js` usa os **exemplos numéricos das próprias fontes**:
- 15 gal a 1.064 → 1.096 + 1.048;
- 10 gal a 1.060 → 1.070 + 1.050;
- 6 gal a 1.060 → 1.090 / 1.060 / 1.030;
- 320 pontos·galão → ~13 lb;
- IPA/Pale/Saison a partir de 5 + 5 gal (e que as três consomem exatamente os 10 gal);
- 2 gal a 1.100 com alvo 1.080 → 2,5 gal.

Também testa as bordas: água, alvo impossível, falta de mosto, mostos iguais e eficiência zero.

## 6. Fora de escopo (v1)

- Cor (SRM) de cada cerveja. A BYO dá só uma regra aproximada (±50% da média).
- Malte de "capping" nos mostos seguintes.
- Esquema de divisão personalizado.
- IBU por cerveja.
