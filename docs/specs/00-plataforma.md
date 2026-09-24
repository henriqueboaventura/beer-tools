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
/ferramentas/decoccao/               → Ferramenta 02
/ferramentas/speise/                 → Ferramenta 03
/ferramentas/parti-gyle/             → Ferramenta 04
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

Direção: **editorial e de alto contraste, com base monocromática**. Títulos em tipografia condensada e pesada, dados em fonte monoespaçada, cantos retos e linhas finas. Sem gradientes nem sombras. A hierarquia vem do peso da fonte, do tamanho e da **inversão** (bloco claro sobre fundo escuro, e o contrário no tema claro).

**Cor só como informação.** Preto, branco e cinza são a base de toda ferramenta. Cor entra quando ajuda a identificar algo: nível de relação e laboratório nas leveduras, faixas de temperatura na decocção. Cada ferramenta define suas cores de informação no próprio CSS, em versões para os dois temas (tons claros no escuro, tons fundos no claro). Nunca use cor como único sinal: há sempre texto, forma ou traço junto.

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
| Largura | Padrão 760px. Ferramentas com duas colunas no desktop usam `<body class="bf-wide">` (1200px) — header e conteúdo continuam alinhados |
| Testes | `npm test` na raiz (só `node:test`, zero dependências): `tests/` (plataforma) + `ferramentas/*/tests/` (cada ferramenta). CI em `.github/workflows/test.yml` roda em todo push |
| Caminhos | Relativos. `shell.js` descobre a raiz pelo próprio `src`, então funciona em `usuario.github.io/beer-tools/` |
| Dados | JSON versionado dentro da pasta da ferramenta. Quando os dados vêm de fontes brutas, um script (só stdlib do Python) gera o JSON, e o resultado é commitado |
| Estado | Query string (`?levedura=<id>`): link compartilhável e o botão voltar funciona |
| PWA / offline | Um service worker para o site inteiro (`sw.js` na raiz) e `manifest.webmanifest`. Instalável. Rede primeiro com revalidação (`no-cache`); o cache local só responde sem conexão |
| Versão | `assets/js/versao.js` (SemVer), no rodapé de todas as páginas. `CHANGELOG.md` na raiz. O cache do service worker tem o nome da versão, e os antigos são apagados ao ativar |
| Nova versão | Aviso "Nova versão disponível · Atualizar" (shell). O site procura atualização ao voltar para a aba e a cada 30 min |
| Fontes | Google Fonts com `display=swap` |
| Analytics | Nenhum na v1 |
| Idioma | pt-BR |
| Publicação | **Teste:** GitHub Pages, a partir de `main` (`.nojekyll` desliga o Jekyll). **Produção:** `https://www.brassagemforte.com.br/ferramentas/`, pasta estática `public_html/ferramentas/` na Hostinger, ao lado do WordPress do domínio e sem relação com ele, publicada por `scripts/deploy-producao.sh` |

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
│   ├── decoccao/                      # ferramenta 02 (motor e testes próprios)
│   ├── speise/                        # ferramenta 03 (calculo.js + testes)
│   ├── parti-gyle/                    # ferramenta 04 (calculo.js + testes)
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

### SEO

- **URL canônica:** `SITE` em `scripts/gerar_seo.py` (`https://www.brassagemforte.com.br/ferramentas/`, a produção). O GitHub Pages (teste) serve as mesmas páginas, com o canonical apontando para a produção. Toda página tem `<link rel="canonical">` com o próprio endereço sob esse prefixo. Se o domínio mudar, troque `SITE` e as URLs absolutas nos `<head>` das páginas fixas; os testes apontam o que ficou para trás.
- **Toda página:** `<title>` único, `meta description` de 50–170 caracteres, Open Graph e Twitter (`summary_large_image`, imagens em `assets/img/og-*.png`, 1200×630), um único `<h1>` e JSON-LD (WebSite na home, WebApplication nas ferramentas, Article em textos, BreadcrumbList).
- **Conteúdo rastreável sem JavaScript:** a lista da home e os links para os índices são HTML estático. Conteúdo que só existe depois do JS (como os resultados da busca de leveduras) ganha páginas estáticas geradas.
- **Gerador:** `scripts/gerar_seo.py` cria as páginas por levedura, o índice e o `sitemap.xml`. Páginas sem conteúdo útil ganham `noindex` e ficam fora do sitemap. Os arquivos são gerados, então não edite à mão; o CI confere que estão em dia.
- **Página nova no site:** inclua o caminho em `PAGINAS_FIXAS` no `gerar_seo.py`, para ela entrar no sitemap.
- `404.html`: `noindex`, com os recursos por URL absoluta (o GitHub Pages a serve em qualquer caminho inexistente).
- **Ícones:** caneco de cerveja com chave inglesa, desenhado em vetor (não é o emoji, que muda de sistema para sistema). `assets/img/icon.svg` é a fonte do PWA; `icon-maskable.svg` mantém o conteúdo na zona segura do Android; `favicon.svg` usa o mesmo desenho, maior, para ler a 16px. Há também `favicon.ico` (16/32/48) na raiz. Os PNGs são gerados com `rsvg-convert`:

  ```sh
  cd assets/img
  rsvg-convert -w 512 -h 512 icon.svg -o icon-512.png   # idem 192 e 180
  rsvg-convert -w 512 -h 512 icon-maskable.svg -o icon-maskable-512.png
  ```

### Como publicar uma versão

1. Suba a versão em `assets/js/versao.js` e escreva a entrada no `CHANGELOG.md`, com o mesmo número. Os testes falham se os dois não baterem.
2. `python3 scripts/versionar.py`: aplica `?v=<versão>` em todo JS/CSS/manifest das páginas e regenera as páginas de levedura. O JSON das leveduras, o logo e o `sw.js` recebem a versão pelo `shell.js`/`app.js`. Motivo: o CDN da Hostinger (hcdn) e o navegador guardam arquivos por horas ou dias. Com endereço novo a cada versão, nada velho é servido. Aprendido na 1.3.0, quando 301s de uma queda ficaram presos no CDN por 1 hora.
3. Arquivo novo que a ferramenta precisa offline vai para o `PRECACHE` do `sw.js`. Os testes também conferem isso.
4. `npm test`, e só então o push em `main`, que publica no **teste** (GitHub Pages).
5. Testado e ok: `scripts/deploy-producao.sh` publica em **produção**. Ele exige `main` igual a `origin/main`, testes passando e versão nova, e marca a tag `producao-vX.Y.Z`. O `--delete` do rsync fica restrito a `public_html/ferramentas/`.

Quem estiver com o site aberto recebe o aviso de nova versão. Quem abrir depois já pega tudo novo, porque a rede tem prioridade.

### Testes da plataforma (`tests/plataforma.test.js`)

- Registro de ferramentas × pastas em `ferramentas/`.
- Toda página: `lang`, viewport, shell (header/rodapé/`bf.css`/`versao.js` antes do `shell.js`), manifest e ícones, e **todo caminho local existindo**.
- `sw.js`: todo item do `PRECACHE` existe, e todo JS/CSS das ferramentas está no `PRECACHE`.
- Manifest válido, com ícones que existem.
- Versão do site = última entrada do `CHANGELOG.md`. Versão da calculadora de decocção = última entrada do changelog dela.

### Como adicionar uma ferramenta

1. Criar `ferramentas/<slug>/index.html` copiando o esqueleto da ferramenta 01 (head com `bf.css` e `shell.js`, placeholders de header e rodapé, cabeçalho padrão).
2. Colocar JS, CSS e dados **dentro da pasta** da ferramenta. Importar só de `assets/`.
3. Adicionar a entrada em `FERRAMENTAS`, no `shell.js`.
4. Adicionar os arquivos dela ao `PRECACHE` do `sw.js`.
5. Colocar os testes em `ferramentas/<slug>/tests/*.test.js`. O `npm test` já pega essa pasta.

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
