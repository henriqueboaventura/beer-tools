# Ferramenta 02 — Decocção

Calculadora de programas de mostura por decocção, parte das Ferramentas Brassagem Forte (`/ferramentas/decoccao/`).

App estático (PWA) que calcula programas de mostura por decocção — e por
pseudo-decocção — direto no navegador: divisão de puxadas por balanço de
energia, cronograma completo, gráfico de temperatura x tempo e cronômetro
de brassagem por evento.

## O que faz

- 8 métodos de mostura: **Simples**, **Dupla Tradicional**, **Dupla Moderna**,
  **Hochkurz**, **Boaventura**, **Dupla Aprimorada**, **Tripla Tradicional**
  — os três do meio cruzados com o [Braukaiser Wiki de decocção](https://www.hboaventura.com/braukaiser-wiki/pages/Decoction_Mashing.html)
  para preencher métodos que faltavam — e **Pseudo-decocção**, que não é
  decocção: é o *cereal mash*/*double-mash system* (Briggs et al., Kunze,
  Narziß, Brücklmeier), uma panela só sem puxada nem retorno.
- Todos os parâmetros de cada método (temperaturas, tempos de rampa, taxa de
  aquecimento, tempos de transferência etc.) ficam editáveis em formulário.
- A tabela de passo a passo, o tempo total e o gráfico de temperatura x tempo
  são recalculados na hora, a partir do balanço de energia de cada método
  (ver `methods.js`). O gráfico marca cada mudança de temperatura com um
  ponto e o respectivo horário no eixo X.
- Resumo de cada método com Etapas, Volume da mostura, Maior puxada e
  **Carga térmica** — índice comparativo próprio do app (fração puxada ×
  minutos de fervura plena, somado por puxada) que mostra o eixo em que
  os sete métodos de decocção real de fato diferem.
- Página separada **"Por que decocção?"** (`sobre.html`, link no rodapé)
  com origem, motivo e trade-offs do método, pra quem não conhece.
- Cronômetro de brassagem por evento: iniciar/pausar/resetar e confirmar
  "Cheguei" ao fim real de cada etapa (não um horário previsto) — o resto
  do cronograma se desloca pelo atraso ou adiantamento acumulado. Etapa
  atual destacada na lista, marcador no gráfico, alarme (som + vibração)
  quando o tempo previsto é atingido, tela não apaga sozinha enquanto roda
  (Wake Lock). Estado salvo por método, sobrevive a um recarregamento de
  página (baseado em relógio de parede, não em contador).
- Funciona offline e pode ser instalado no celular ou desktop (PWA do site inteiro).
- Salva a configuração atual automaticamente no `localStorage` do navegador.
  Também é possível salvar predefinições nomeadas, exportar tudo para um
  arquivo `.json` (backup) e importar de volta.

## Testes

`methods.js` (o motor de cálculo) e `app-core.js` (a lógica do
cronômetro/interface sem DOM) têm uma suíte de testes unitários em
`tests/`, usando só o test runner nativo do Node (`node:test` — nenhuma
dependência de dev):

```bash
# na raiz do repositório
npm test
# ou, sem npm:
node --test ferramentas/decoccao/tests/*.test.js
```

(`tests/*.test.js` explícito, não o diretório sozinho — a descoberta de
arquivo do `node --test` varia entre versões do Node; o glob `*` é
expandido pelo shell antes de chegar no Node, então funciona igual em
qualquer versão. Achado S7 da sétima leitura: `npm test` não rodava
nenhum teste, saindo com erro, num Node mais novo do que o testado
aqui.)

O que a suíte cobre:

- **`regression.test.js`** — os números golden dos 8 métodos com
  parâmetros de fábrica (tempo total, nº de etapas, volume e fração de
  cada puxada), validados rodada após rodada de auditoria externa (ver
  `CHANGELOG.md`). É a rede de segurança contra regressão silenciosa:
  se um valor aqui mudar sem uma linha no changelog explicando por quê,
  é bug.
- **`physics.test.js`** — o balanço de energia da decocção
  (`d = (T2-T1)/(Tb-T1)`) reconstruído e conferido contra o que o motor
  calcula, pra qualquer método e não só os defaults; a conservação de
  energia em puxadas devolvidas em mais de uma parte (T1 sempre fixo na
  puxada original, travado contra a fórmula aditiva do bug original —
  achado C1 do Raio-X — e conferido pela conta publicada do achado N9);
  a Dupla Moderna e a Dupla Aprimorada concordando no mesmo volume pra
  mesma viagem térmica; o Boaventura com os patamares reais batendo com
  a correção do achado T6; o Hochkurz com fervura curta nas duas
  decocções (Narziß); invariantes estruturais nos 8 métodos (schema
  autoconsistente, cronograma monotônico, sem NaN).
- **`sanitize.test.js`** — `sanitizeParams` (movida de `app.js` pra
  `methods.js` justamente pra ficar testável): todo campo grampeado no
  seu próprio `[min,max]`, valores não numéricos caindo no default, e
  os casos de contorno exatos que o Raio-X e a Segunda Leitura rodaram
  na ferramenta à mão (água negativa, taxa de aquecimento zero, campo
  ausente de uma versão antiga do app).
- **`mash-cooling.test.js`** — o parâmetro de perda térmica em espera
  (T3): padrão 0 é sempre um no-op; ligado, o volume de puxada cresce
  monotonicamente; o tooltip de "patamar real" sobrevive (achado Q2).
- **`pseudo-decoccao.test.js`** — os 11 casos de teste e as duas
  tabelas de passo a passo completas da especificação da
  Pseudo-decocção, os dois diagramas publicados reproduzidos pela
  fórmula direta, a constante térmica travada contra regressão, o teto
  da taxa escalada (achado Q10), a evaporação da 1ª parcela (achado
  Q5) e o guarda de alvo inalcançável (V2).
- **`app-core.test.js`** — a lógica do cronômetro/interface
  (`app-core.js`, ver "Estrutura" abaixo): repetição e teto do alarme
  (achados N1/Q13), o deslocamento do cronograma por atraso/
  adiantamento (`computeEffectiveRows`, achado P1), as faixas de
  severidade de aviso, a decisão de mostrar a panela de fervura no
  gráfico (`annotateDisplayBoil`, achado N4) e a formatação de tempo.
- **`boundaries.test.js`** — varredura de bordas: cada parâmetro no
  mínimo e no máximo, cada par de campos de temperatura nos quatro
  cantos, e as taxas de perda térmica/evaporação no máximo cruzadas com
  temperatura, nos sete métodos reais. Confere que o motor nunca
  produz um resultado fisicamente absurdo (negativo, NaN, volume maior
  que o total, panela esfriando sozinha) — é a categoria de teste que
  teria pego os achados graves da décima primeira leitura antes de uma
  auditoria externa (ver `CHANGELOG.md`).

Os fixtures numéricos de `regression.test.js`/`physics.test.js` vêm das
sucessivas rodadas de auditoria externa deste projeto (os PDFs "Raio-X"
em diante, mantidos fora do repositório — ver `CHANGELOG.md` pra cada
achado) — cada valor golden é um número que uma leitura independente
conferiu à mão contra a literatura ou contra um modelo físico
reconstruído do zero, não um número que o próprio motor gerou pra si
mesmo.

**Antes de publicar uma nova versão** (bump em `version.js` +
`CHANGELOG.md`), rode `npm test` — o CI (`.github/workflows/test.yml`)
já roda em todo push, mas não trava o deploy do GitHub Pages sozinho
(ver "Publicação" abaixo), então a checagem manual antes do bump continua
sendo o que garante isso.

Escrevendo um teste novo: prefira valores conferidos à mão ou contra
uma fonte externa (a própria especificação em PDF, um livro-texto, uma
tabela publicada) a copiar o que o motor já devolve — testar "o código
bate com o código" não pega regressão nenhuma.

## Estrutura

- `index.html`, `app.css`, `app.js` — interface. Header, menu, rodapé e tema vêm do
  shell compartilhado (`assets/js/shell.js`, `assets/css/bf.css`); a página usa
  `<body class="bf-wide">` para ter duas colunas no desktop.
- `app.css` redireciona as variáveis de cor antigas (`--steel`, `--copper`,
  `--amber`, `--zone-*`…) para os tokens monocromáticos do shell — o gráfico e a
  escada gerados pelo `app.js` usam essas variáveis.
- `sobre.html` — página "Por que decocção?".
- `app-core.js` — lógica do cronômetro/interface sem DOM, exportada em
  `window.DecoccaoCore` e testável no Node.
- `methods.js` — motor de cálculo (schema de parâmetros + fórmulas de cada
  método), exportado em `window.Decoccao` e via `module.exports`.
- `tests/` — suíte `node:test`, zero dependências.
- `scripts/verify_pseudo_decoccao.js` — conferência da Pseudo-decocção.
- PWA: vem do site inteiro (`sw.js` e `manifest.webmanifest` na raiz), não mais desta pasta.
- `version.js` — versão da calculadora (rodapé). Ver `CHANGELOG.md`. A versão do site fica em `assets/js/versao.js`.

## Versionamento

Segue [SemVer](https://semver.org/lang/pt-BR/). A versão atual está em
`version.js` e aparece no rodapé do app. Toda mudança relevante vai pro
`CHANGELOG.md`. O cache offline é do site inteiro e é invalidado pela
versão do site (`assets/js/versao.js`, `CHANGELOG.md` na raiz): mudou a
calculadora, suba as duas.

## Métodos cruzados com o Braukaiser Wiki

- **Hochkurz**: mostura já "alta" (dough-in a ~62°C, sem rampa de
  proteína), 1ª decocção leva ao patamar de dextrinização (70-72°C,
  descanso de até 60min), 2ª decocção vai direto ao mash-out. Reaproveita
  o mesmo motor das Duplas, só com defaults diferentes.
- **Dupla Aprimorada** (Enhanced Double Decoction): rampa ácida inicial,
  1ª decocção maior (50-60% do lote) devolvida em **duas adições
  parciais** — a primeira leva a mostura à rampa de proteína, a segunda à
  sacarificação — e uma 2ª decocção menor leva direto ao mash-out.

## Publicação

Faz parte do site Ferramentas Brassagem Forte, publicado pelo GitHub Pages a partir
da branch `main` do repositório `beer-tools`. A Action `.github/workflows/test.yml`
roda a suíte em todo push, mas não bloqueia o Pages — rode `npm test` antes de
enviar para `main`, especialmente antes de um bump de versão.

As chaves de `localStorage` (`decoccao:v1:*`) são as mesmas da versão standalone e o
domínio é o mesmo, então predefinições e cronômetro salvos continuam valendo.

## Problemas e sugestões

O link "Reportar problema" no rodapé abre uma issue nova em
https://github.com/henriqueboaventura/decoccao/issues/new.
