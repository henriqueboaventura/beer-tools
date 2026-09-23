# Spec 01 — Substituição de Leveduras

Status: **v1 implementada**
Diretório: `/ferramentas/substituicao-leveduras/` · Número: `01`
Atualizado: 2026-09-22

## 1. Problema

A receita pede uma levedura específica e ela não está disponível, está cara, ou o cervejeiro prefere seca a líquida (ou uma marca nacional). Ele precisa saber **rápido** quais leveduras são equivalentes ou próximas, e **o que muda** com a troca.

## 2. Histórias de usuário

- **H1** — Buscar a levedura pelo nome, código, fabricante ou origem (ex.: "Chico"), sem precisar da grafia exata.
- **H2** — Ver as alternativas ordenadas da mais parecida para a menos parecida.
- **H3** — Filtrar por forma (seca / líquida) e por marcas nacionais.
- **H4** — Comparar a atenuação (e temperatura/floculação, quando houver) com a original.
- **H5** — Saber quais leveduras **não** são equivalentes, apesar de parecerem ("não confunda").
- **H6** — Saber de onde vem cada informação.
- **H7** — Compartilhar o resultado por link.

## 3. Fontes de dados e prioridade

| # | Fonte | Arquivo | O que fornece |
|---|---|---|---|
| 1 | **Yeast Master** (David M. Taylor), atualizada em 19/09/2026 | `examples/YEAST MASTER….xlsx` (local, fora do git) | Grupos de equivalência, "(NOT X)", incertezas (`?` ou célula amarela), descontinuadas (tachado), atenuação aprox. e notas |
| 2 | **AEB Brewing Yeast Substitution Guide v.5** | `dados/leveduras/aeb.json` (transcrito) | Equivalentes (vermelho no PDF) e alternativas (preto), origem |
| 3 | **Imperial Yeast Strain Cross Reference** | `dados/leveduras/imperial.json` (transcrito) | Equivalentes Wyeast/WLP/Omega e origem provável |
| 4 | **Tabela de substituição Levteck** (do fabricante) | `dados/leveduras/nacionais.json` → `fabricante` | Substitutas por estilo para cada TeckBrew (entram como Alternativa; somam fonte quando coincidem com a curadoria). Inclui a TB07, fora do catálogo online |
| 5 | **Curadoria Brassagem Forte** | `dados/leveduras/nacionais.json` → `curadoria` | Levteck e Smartyeast associadas por comparação de fichas técnicas (revisado pela BF) |
| 6 | **Inferências não revisadas** | `dados/leveduras/nacionais.json` → `inferida` | Bio4 associada só pelo nome do produto |

Fora da v1: colunas TUM, VLB, Doemens e BSI (bancos profissionais); cepas selvagens/ácidas e de vinho do guia Imperial; tradução das notas do Yeast Master (exibidas em inglês).

## 4. Níveis de similaridade

| Nível | Rótulo | Regra |
|---|---|---|
| 3 ■■■ | Equivalente | Mesma linha do Yeast Master, ou equivalência declarada pela AEB ou pela Imperial, **desde que** o Yeast Master não diga o contrário |
| 2 ■■□ | Provável | O Yeast Master marca como incerta, **ou** vínculo da curadoria/inferência (inclusive por transitividade: nacional → alvo → equivalentes nível 3 do alvo) |
| 1 ■□□ | Alternativa | Preto no guia AEB, **ou** AEB/Imperial dizem que é equivalente mas o Yeast Master diz que não (com nota explicando) |
| — | Não confunda | "(NOT X)" do Yeast Master, propagado pelos grupos de equivalência do próprio Yeast Master, quando nenhuma outra fonte liga o par |

Vínculos da curadoria marcados como "Incerta" não se propagam para as equivalentes do alvo.

## 5. Fluxo

```
[Entrada] → explicação + "Como funciona" (recolhido)
[01 Levedura base] chips de categoria + busca (combobox)
    ↓ seleciona
[Cartão da base] fabricante · forma · tags · specs · origem · descrição · nota YM · "não confunda" · copiar link · site do fabricante
[02 Alternativas (N)] Todas | Seca | Líquida · "Só nacionais" · "Incluir não revisadas"
    grupos por nível → nome (clique = vira base), código, specs com ▲▼, origem, nota, fonte
[Fontes] créditos e links
```

### Cores de informação

- **Nível da relação:** o medidor e o traço do título do grupo usam verde (Equivalente), âmbar (Provável) e cinza-azulado (Alternativa). O rótulo em texto aparece sempre junto.
- **Laboratório:** cada fabricante tem uma cor, usada num ponto ao lado do nome e na barra lateral do card (e numa faixa no topo do cartão da base). Fabricantes sem cor definida ficam em cinza.
- **Não confunda:** botões em vermelho.
- Paletas em `app.css`, com uma versão para cada tema.

## 6. Requisitos funcionais

| ID | Requisito |
|---|---|
| RF1 | A busca ignora acento, caixa, hífen e espaço, e cobre nome, código, fabricante e origem. Com várias palavras, cada uma precisa aparecer em algum campo, em qualquer ordem ("imperial l17", "white labs wlp001", "wyeast 1056"). |
| RF2 | A ordem dos resultados é: código exato, código/nome que começa com o termo, o resto. Descontinuadas por último. Máximo de 40 resultados, com aviso para refinar. |
| RF3 | Chips de categoria: Todas, Ale, Lager, Trigo, Belga/Saison, Kveik, Outras. |
| RF4 | A URL `?levedura=<id>` abre direto no resultado e também aceita só o código (`?levedura=us-05`). |
| RF5 | Alternativas ordenadas por nível, depois ativas antes das descontinuadas, seca antes de líquida, nacional antes de importada, e por fim fabricante e nome. |
| RF6 | Atenuação com diferença ≥ 3 p.p. em relação à base ganha ▲/▼. |
| RF7 | Clicar no nome de uma alternativa ou num item de "não confunda" transforma essa levedura na nova base. |
| RF8 | Toda alternativa mostra a(s) fonte(s). Curadoria e inferências trazem o motivo por escrito. |
| RF9 | Estados: carregando, erro com "Tentar de novo", nenhum resultado, sem alternativas, filtros sem resultado com "Limpar filtros". |

## 7. Código e testes

- `busca.js`: funções puras da busca (`norm`, `indexar`, `buscar`, `resolverId`), em `window.BFBusca` e `module.exports`.
- `tests/dados.test.js`: invariantes do JSON (ids únicos; relações simétricas, com nível e fontes válidos; "não confunda" sem conflito) e casos conferidos à mão contra as fontes.
- `tests/busca.test.js`: buscas reais ("imperial l17", "us05", "wyeast 1056"…) e `?levedura=`.

## 8. Páginas estáticas (SEO)

`scripts/gerar_seo.py` (chamado no fim de `gerar_leveduras.py`) gera:
- `levedura/<id>/index.html`: uma página por levedura, com cartão, substitutos agrupados por nível (links entre as páginas), "não confunda" e um botão para abrir na ferramenta. Sem substitutos, a página leva `noindex`.
- `levedura/index.html`: todas as leveduras, por fabricante.

Os títulos seguem o padrão "SafAle US-05: substitutos e equivalentes | Brassagem Forte", encurtados quando o nome é longo.

## 9. Geração dos dados

```
python3 scripts/gerar_leveduras.py
```

O script lê a planilha (xlsx lido direto, com cores e tachado), os três JSONs de `dados/leveduras/` e gera `ferramentas/substituicao-leveduras/data/leveduras.json` (~490 leveduras, ~1100 relações, ~240 KB).

Formato de referência nos JSONs: `"fabricante:CÓDIGO"` ou `"fabricante:CÓDIGO|Nome"`.

## 10. Critérios de aceite

- [x] 360px de largura sem rolagem horizontal.
- [x] "us05", "1056", "wlp001" e "chico" encontram as leveduras certas.
- [x] `?levedura=us-05` abre direto; o botão voltar restaura o estado anterior.
- [x] Conflito entre fontes aparece como "Alternativa" com nota (ex.: US-05 × WLP001).
- [x] Temas claro e escuro.
- [ ] Revisão das inferências da Bio4 pela Brassagem Forte.
- [ ] Lighthouse mobile ≥ 95 (a medir depois da publicação).

## 11. Fora de escopo (v1)

Comparar duas leveduras lado a lado; ajuste automático de receita; contribuição pela interface; preço e disponibilidade em lojas.
