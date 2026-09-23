# Spec 03 — Speise

Status: **v1 implementada** (migrada de `henriqueboaventura/speise`)
Diretório: `/ferramentas/speise/` · Número: `03`
Autor: Henrique Boaventura
Atualizado: 2026-09-23

## 1. Problema

Carbonatar a cerveja sem açúcar de priming: reservar parte do próprio mosto (a speise) antes de inocular o fermento e devolvê-la no envase. O cervejeiro precisa saber **quanto reservar** e, como a speise sai do lote, **quanto mosto coletar e fermentar**.

## 2. Entradas

| Campo | Unidade | Padrão |
|---|---|---|
| Volume final da cerveja | L | 20 |
| Densidade original (OG) | SG ou °Plato (alternável) | 1.050 |
| Atenuação aparente esperada | % (40–90) | 75 |
| CO₂ alvo | vol | 2,4 |
| Temperatura no envase | °C | 20 |

## 3. Cálculo (`calculo.js`)

Idêntico à calculadora original. Comparei os dois códigos em 432 combinações de entradas, e a diferença máxima foi de 9×10⁻¹⁶.

1. **CO₂ residual** (Henry, com a temperatura em °F): `3,0378 − 0,050062·F + 0,00026555·F²` vol, com mínimo 0.
2. **CO₂ que falta** = max(alvo − residual, 0).
3. **°Plato** da OG em SG: `−616,868 + 1111,14·SG − 630,272·SG² + 135,997·SG³` (a conversão °P → SG é a inversa, resolvida por Newton).
4. **Açúcar necessário** ≈ 4 g/L por volume de CO₂ que falta: `4 · volume · falta`.
5. **Açúcar fermentável por litro de mosto** = `10 · °P · atenuação`.
6. **Speise** = açúcar necessário ÷ açúcar fermentável por litro, com teto no volume do lote. **Mosto principal** = volume − speise.
7. **Por garrafa** (650, 600, 550, 500, 375, 350 e 300 ml): `(speise ÷ volume) · tamanho`.

Avisos: `og-invalida` quando °P ≤ 0 ou a atenuação é 0; `sem-speise` quando o CO₂ residual já atinge o alvo.

Exemplo conferido à mão: 20 L, OG 1.050 (12,39 °P), 75%, 2,4 vol a 20 °C. O CO₂ residual é 0,8615 vol e faltam 1,5385; o açúcar necessário é 123,1 g e há 92,9 g/L de fermentável. Resultado: **1,325 L de speise** e 18,675 L de mosto principal.

## 4. Interface

`01 Lote` → `02 Carbonatação` → `03 Resultado`. O resultado fica num bloco invertido (speise em destaque, e a divisão entre mosto principal e speise). O aviso aparece em âmbar, e a tabela de garrafas fica recolhida ("Avançado"). Números no formato brasileiro.

## 5. Testes

`ferramentas/speise/tests/calculo.test.js`:
- conversões SG ↔ °P;
- CO₂ residual;
- o caso de exemplo;
- equivalência SG = °P;
- proporcionalidade com o volume;
- avisos;
- teto no volume do lote;
- dosagem por garrafa.

## 6. Pendências

- A versão antiga continua em `hboaventura.com/speise/`. Decidir se ela redireciona para a nova.
