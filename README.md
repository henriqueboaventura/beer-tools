# Ferramentas Brassagem Forte

Diretório de ferramentas para cervejeiros caseiros. HTML, CSS e JS puros, publicado no GitHub Pages.

## Rodar localmente

```sh
python3 -m http.server 8000
# abra http://localhost:8000
```

(Precisa de um servidor: a ferramenta carrega JSON via `fetch`, que não funciona com `file://`.)

## Testes

```sh
npm test
```

(Só o runner nativo do Node, sem dependências.) Cobre a plataforma (`tests/`: páginas, links, PWA e versão) e cada ferramenta (`ferramentas/*/tests/`). O CI roda em todo push.

## Publicar uma versão

1. Suba a versão em `assets/js/versao.js` e escreva a entrada no `CHANGELOG.md`, com o mesmo número.
2. `npm test`.
3. Merge em `main`. Quem estiver com o site aberto vê "Nova versão disponível · Atualizar".

## Atualizar os dados de leveduras

1. Edite as fontes: a planilha em `examples/`, ou os JSONs em `dados/leveduras/` (`aeb.json`, `imperial.json`, `nacionais.json`).
   A pasta `examples/` (planilha e PDFs originais) **não vai para o repositório** (`.gitignore`). Para gerar os dados, coloque lá a planilha `YEAST MASTER….xlsx`.
2. Gere o JSON da ferramenta:

   ```sh
   python3 scripts/gerar_leveduras.py
   ```

3. Faça commit de `ferramentas/substituicao-leveduras/data/leveduras.json` junto com as fontes alteradas.

## Estrutura

Veja `docs/specs/00-plataforma.md` (plataforma, layout, como adicionar ferramentas), `docs/specs/01-substituicao-leveduras.md` (ferramenta de leveduras e regras dos dados) e `docs/specs/02-decoccao.md` (integração da calculadora de decocção; detalhes em `ferramentas/decoccao/README.md`).

## Créditos das fontes

- Yeast Master — David M. Taylor (http://tinyurl.com/yeastmaster)
- AEB Brewing Yeast Substitution Guide v.5 — AEB
- Imperial Yeast Strain Cross Reference Guide — Imperial Yeast
- Curadoria das leveduras nacionais — Brassagem Forte
