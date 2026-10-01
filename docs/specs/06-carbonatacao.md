# Spec 06 — Carbonatação

Status: **implementada** (versão 1.14.0)
Diretório: `/carbonatacao/` · Número: `06`
Autor: Henrique Boaventura
Atualizado: 2026-10-01

## 1. Problema

Na hora de envasar com açúcar (priming), o cervejeiro precisa saber:

1. quanto açúcar usar no lote todo, ou em cada garrafa, se for dosar direto nela;
2. se a embalagem aguenta a pressão.

O pedido (Henrique, 2026-10-01): algo como a [Priming Sugar Calculator do Mr Malty](https://mrmalty.com/priming-sugar-calculator.html), mas:

- só unidades métricas, com densidade em SG;
- sem correção de altitude;
- sem maple, gyle/speise, candi sugar e turbinado como fonte de açúcar;
- com o total e a dose por embalagem;
- com as mesmas garrafas da calculadora de speise.

## 2. Fonte e validação

A calculadora do Mr Malty roda no navegador, e as fórmulas estão no código da página. Portamos a matemática e rodamos as funções dele e as nossas lado a lado em 8 cenários: garrafa, barril com espaço vazio, cerveja sob pressão de spunding, temperaturas de 4 a 25 °C e armazenamento mais quente. A diferença foi **zero** no CO₂ residual, no açúcar e na pressão. Os números viraram testes em `carbonatacao/tests/calculo.test.js`.

## 3. Cálculo (`calculo.js`)

- **CO₂ residual** pela temperatura **mais alta** depois da fermentação: vol = 3,0378 − 0,050062·T + 0,00026555·T² (T em °F). É a mesma fórmula da speise, e um teste garante isso.
- **Sob pressão (spunding):** vol = k(T)·(manômetro + 1 atm) − 0,003342, com k(T) = 0,01821 + 0,090115·e^(−(T−32)/43,11), pressão em psi absoluto. A ferramenta recebe a pressão em bar.
- **CO₂ a acrescentar:** (alvo − residual) × 1,964 g/L × litros.
  - No barril, o espaço vazio também guarda CO₂ (lei dos gases) e entra no equilíbrio, então pede mais açúcar.
  - Em garrafa e lata, o espaço vazio é desprezível.
- **Açúcar** = CO₂ ÷ rendimento (g de CO₂ por g):

  | Fonte | Rendimento |
  |---|---|
  | Açúcar de milho (dextrose monoidratada) | 0,444 |
  | Sacarose (refinado ou cristal) | 0,514 |
  | Dextrose anidra | 0,489 |
  | Mascavo | 0,500 |
  | DME claro (estimativa) | 0,40 |
  | Mel (estimativa) | 0,41 |

  O rendimento é editável.
- **Carbonatação natural:** cada ponto de densidade aparente fermentado gera 0,989 g/L de CO₂. A ferramenta calcula a densidade em que fechar (densidade final + pontos) e a pressão da válvula de spunding que segura o alvo.
- **Pressão na temperatura de armazenamento:** o CO₂ total se redistribui entre a cerveja e o espaço vazio, mais o ar preso, aquecido.
- **Limites por embalagem** (volumes de CO₂, atenção / perigo):

  | Embalagem | Atenção | Perigo |
  |---|---|---|
  | Vidro comum | 2,9 | 3,5 |
  | Vidro reforçado | 4,5 | 5,5 |
  | PET | 4,0 | 5,0 |
  | Lata | 2,7 | 3,2 |
  | Barril | 3,6 | 4,2 |
- **Por garrafa:** total × (mL da garrafa ÷ mL do lote), para as garrafas da speise (650, 600, 550, 500, 375, 350 e 300 mL).

## 4. Interface

1. **01 Envase:**
   - garrafa de vidro, garrafa reforçada, PET, lata ou barril;
   - o barril pede o espaço vazio, em L.
2. **02 A cerveja:**
   - volume e temperatura mais alta depois da fermentação;
   - "Fermentada" ou "Sob pressão", que pede o manômetro em bar;
   - mostra o CO₂ que a cerveja já tem.
3. **03 Carbonatação:** estilo (opcional, preenche o alvo) e alvo em volumes, com o equivalente em g/L.
4. **04 Açúcar:**
   - fonte e rendimento, com a etiqueta confirmado ou estimativa;
   - na carbonatação natural, a densidade final.
5. **05 Resultado:**
   - "No lote todo" ou "Por garrafa"; o barril só tem o lote todo;
   - resumo: já tem, acrescenta e alvo;
   - pressão na temperatura de armazenamento, com o veredito pela embalagem;
   - avisos: risco de estourar, espaço vazio do barril, levedura viva;
   - "Com outro açúcar": a mesma carbonatação em cada açúcar.

## 5. Testes

- **`carbonatacao/tests/calculo.test.js`:**
  - os 8 cenários do Mr Malty;
  - residual e garrafas iguais aos da speise;
  - rendimentos e açúcares fora da lista;
  - total e por garrafa;
  - barril × garrafa;
  - sem priming, spunding, carbonatação natural, risco e pressão de armazenamento.
- **`tests/ui/carbonatacao.ui.test.js`:** o fluxo na tela (exemplo, por garrafa, barril, estilo, risco, armazenamento, spunding, natural, sem açúcar e outros açúcares).

## 6. Fora de escopo

- Altitude.
- Cask (barril inglês ventilado).
- Gyle/speise como fonte (tem ferramenta própria), maple, candi e turbinado/demerara.
- Unidades imperiais.
