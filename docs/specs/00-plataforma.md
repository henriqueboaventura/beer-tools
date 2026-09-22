# Spec 00 — Plataforma "Ferramentas Brassagem Forte"

Status: **v1 implementada**
Atualizado: 2026-09-22

## 1. Objetivo

Site estático, mobile first, publicado no GitHub Pages, que funciona como um **diretório de ferramentas para cervejeiros caseiros** da Brassagem Forte. Cada ferramenta fica no seu próprio diretório, e todas compartilham o mesmo layout, a mesma identidade visual e os mesmos componentes base.

## 2. Público e contexto de uso

- Cervejeiro caseiro, geralmente no celular, muitas vezes **na loja de insumos** ou **no dia da brassagem**.
- Alvos de toque ≥ 44px, contraste alto, pouco texto por tela, funcionar com conexão ruim.

## 3. Arquitetura de informação

```
/                                    → Diretório (lista de ferramentas)
/ferramentas/substituicao-leveduras/ → Ferramenta 01
/ferramentas/<slug>/                 → Ferramentas futuras
```

O registro de ferramentas (número, título, descrição, status `disponivel` | `em-breve`) fica em `assets/js/shell.js` (`FERRAMENTAS`). O diretório e o menu são gerados a partir dele.

## 4. Layout compartilhado (shell)

| Região | Conteúdo |
|---|---|
| Header (sticky) | Logo Brassagem Forte + "FERRAMENTAS" · botão de tema · botão `MENU` |
| Menu (tela cheia) | Lista numerada de ferramentas (+ links institucionais, se configurados) |
| Cabeçalho da ferramenta | Trilha (`FERRAMENTAS / 01`), título grande, frase de explicação, "Como funciona" recolhível |
| Corpo | Passos numerados (`01 — …`, `02 — …`) |
| Rodapé | Logo, frase, texto extra da ferramenta (ex.: versão dos dados) |

Regras:
- Cada página declara só `<header data-bf-header>` e `<footer data-bf-footer>`. O conteúdo deles é montado por `assets/js/shell.js`, então existe **uma única fonte** para header, menu e rodapé.
- Nenhuma ferramenta altera header, menu, rodapé ou tokens. A ferramenta só é dona do próprio corpo.
- `shell.js` expõe `window.BF` (`base`, `ferramentas`, `esc`, `urlFerramenta`, `rodape(texto)`).

## 5. Sistema visual

Direção: **editorial, monocromática e de alto contraste**. Títulos em tipografia condensada e pesada, dados em fonte monoespaçada, cantos retos e linhas finas. Sem gradientes, sombras ou cor de destaque: a hierarquia vem do peso da fonte, do tamanho e da **inversão** (bloco claro sobre fundo escuro, e o contrário no tema claro).

### Tokens (semânticos)

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bf-bg` | `#0B0B0B` | `#F4F3EF` | Fundo |
| `--bf-raised` | `#151515` | `#EAE8E3` | Inputs, superfícies |
| `--bf-line` | `#2A2A2A` | `#D5D3CD` | Divisórias |
| `--bf-line-strong` | `#4A4A4A` | `#A3A19B` | Bordas |
| `--bf-mute` | `#8C8C8C` | `#62615D` | Rótulos, texto secundário |
| `--bf-soft` | `#C8C8C8` | `#2B2B2A` | Texto corrido |
| `--bf-fg` | `#F4F3EF` | `#0B0B0B` | Títulos, blocos invertidos |

Tema: segue o sistema por padrão, e o botão do header alterna e guarda a escolha (`localStorage`, com fallback silencioso). O logo (branco sobre preto) é invertido no tema claro com `filter` + `mix-blend-mode`.

### Tipografia

- **Display:** Archivo (eixo `wdth` condensado, peso 800–900), caixa alta.
- **Texto:** Archivo 400–600.
- **Dados:** IBM Plex Mono.

## 6. Decisões técnicas

| Tema | Decisão |
|---|---|
| Stack | **HTML, CSS e JS puros**, sem framework nem build do site |
| Layout compartilhado | `assets/js/shell.js` monta header, menu e rodapé em placeholders que já reservam altura (sem deslocamento de layout) |
| Caminhos | Relativos. `shell.js` descobre a raiz pelo próprio `src`, então funciona em `usuario.github.io/beer-tools/` |
| Dados | JSON versionado dentro da pasta da ferramenta. Quando os dados vêm de fontes brutas, um script (só stdlib do Python) gera o JSON, e o resultado é commitado |
| Estado | Query string (`?levedura=<id>`): link compartilhável e o botão voltar funciona |
| Offline | Service worker — fase 2 |
| Fontes | Google Fonts com `display=swap` |
| Analytics | Nenhum na v1 |
| Idioma | pt-BR |
| Publicação | GitHub Pages direto da branch, na raiz. Arquivo `.nojekyll` desliga o Jekyll |

### Estrutura

```
/
├── index.html                         # diretório
├── .nojekyll
├── assets/
│   ├── css/bf.css                     # tokens + componentes compartilhados
│   ├── js/shell.js                    # registro, header, menu, rodapé, tema
│   └── img/                           # logo
├── ferramentas/
│   └── substituicao-leveduras/
│       ├── index.html
│       ├── app.js
│       ├── app.css
│       └── data/leveduras.json        # GERADO — não editar à mão
├── dados/leveduras/                   # fontes transcritas/curadas (editáveis)
├── scripts/gerar_leveduras.py         # gera o JSON da ferramenta 01
├── examples/                          # fontes originais (planilha, PDFs) — fora do git
└── docs/specs/
```

### Como adicionar uma ferramenta

1. Criar `ferramentas/<slug>/index.html` copiando o esqueleto da ferramenta 01 (head com `bf.css` e `shell.js`, placeholders de header e rodapé, cabeçalho padrão).
2. Colocar JS, CSS e dados **dentro da pasta** da ferramenta. Importar só de `assets/`.
3. Adicionar a entrada em `FERRAMENTAS`, no `shell.js`.

## 7. Acessibilidade

- Contraste ≥ 4.5:1 nos dois temas.
- Tudo operável por teclado; o combobox segue o padrão WAI-ARIA.
- `prefers-reduced-motion` é respeitado.
- Nada é comunicado só por forma: o medidor de similaridade sempre vem com texto.

## 8. Questões em aberto

1. Links institucionais do menu: por enquanto é um placeholder ("Em breve") em `LINKS`, no `shell.js`.

## 9. Decisões registradas

- Ferramentas futuras só entram no registro quando existirem (nada de "Em breve" no diretório).
- `examples/` (planilha e PDFs originais) **não é publicada**: está no `.gitignore` e fica só na máquina de quem gera os dados.
