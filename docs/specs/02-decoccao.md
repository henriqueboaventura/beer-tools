# Spec 02 — Decocção

Status: **integrada (branch `ferramenta-decoccao`)**
Diretório: `/ferramentas/decoccao/` · Número: `02`
Atualizado: 2026-09-22

## 1. Origem

A calculadora existia como app independente (`henriqueboaventura/decoccao`, v1.14.2). Tem motor de cálculo próprio, auditado em várias rodadas externas, e 183 testes. Ela foi trazida para o diretório sem reescrever a lógica.

A documentação funcional completa (métodos, cronômetro, testes, histórico) fica em `ferramentas/decoccao/README.md` e `ferramentas/decoccao/CHANGELOG.md`.

## 2. Regras da integração

| Parte | Tratamento |
|---|---|
| `methods.js`, `app-core.js`, `tests/` | Copiados **sem alteração** |
| `app.js` | Só saíram o tema e o rodapé próprios (o shell cuida disso). A linha de fervura do gráfico ficou tracejada |
| `index.html`, `sobre.html` | Reescritos no layout do shell (`data-bf-header` / `data-bf-footer`, cabeçalho padrão de ferramenta, passos numerados) |
| CSS | `styles.css` e `sobre.css` substituídos por `app.css`. As variáveis antigas apontam para os tokens do shell |
| PWA | O PWA próprio saiu. Vale o PWA do site inteiro (`sw.js` na raiz), que também mostra o aviso de nova versão |
| `localStorage` | Mesmas chaves (`decoccao:v1:*`), então os dados da versão antiga continuam valendo |
| Versão | 1.15.0 (ver CHANGELOG) |

## 3. Layout

- `<body class="bf-wide">`: o container vai a 1200px, porque a calculadora tem duas colunas (parâmetros | programa) acima de 860px. No celular fica uma coluna só.
- Passos: `01 Método` (abas no desktop, `<select>` no celular), `02 Parâmetros`, `03 Programa`.
- O cronômetro é um bloco invertido. No celular, quando a rolagem chega nele, ele fica preso logo abaixo do header até o fim do programa. Por isso `html`/`body` usam `overflow-x: clip`: com `hidden`, o sticky não funciona.
- Cor só onde carrega informação de temperatura: mostura (azul-aço), fervura (cobre, também tracejada), "agora" (âmbar), faixas de enzima, pontos da escada e pílulas de temperatura mantêm as cores do app original. O resto da interface é monocromático.

## 4. Pendências

- Gráfico no celular: o SVG tem proporção fixa (640×218, como no app original) e fica com ~115px de altura a 360px de largura. Os rótulos dos eixos ficam pequenos. Melhorar exige desenhar o gráfico com outra geometria no celular (`renderChart` no `app.js`).
- O endereço antigo (`/decoccao/`) continua no ar. Decidir se ele redireciona para `/beer-tools/ferramentas/decoccao/`.
