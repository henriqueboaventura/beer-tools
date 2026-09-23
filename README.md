# Ferramentas Brassagem Forte

Ferramentas gratuitas para cervejeiros caseiros, pensadas para usar no celular: na loja de insumos, no planejamento da receita ou no meio da brassagem.

**Site:** https://www.brassagemforte.com.br/ferramentas/

Versão de teste (novidades antes de irem para produção): https://www.hboaventura.com/beer-tools/

O site é feito de HTML, CSS e JavaScript puros, sem framework e sem etapa de build, e é publicado pelo GitHub Pages. Pode ser instalado como app (PWA) e funciona offline.

## Ferramentas

### 01 — Substituição de leveduras

`ferramentas/substituicao-leveduras/`

De Henrique Boaventura e Fábio Koerich. A receita pede uma levedura que você não encontrou? Escolha a original e veja as equivalentes de outros fabricantes, secas ou líquidas.

- Cerca de 490 leveduras de 20 fabricantes, incluindo as nacionais: Levteck, Smartyeast e Bio4.
- Busca por nome, código, fabricante ou origem, em qualquer ordem ("imperial l17", "us05", "chico").
- Alternativas agrupadas por proximidade: **Equivalente**, **Provável** e **Alternativa**. Cada uma mostra a fonte e o motivo.
- **Não confunda:** leveduras que parecem equivalentes, mas não são.
- Filtros por forma (seca ou líquida), só nacionais, e para esconder os vínculos ainda não revisados.
- Link compartilhável: `?levedura=us-05`.

Quando as fontes discordam, a prioridade é esta: [Yeast Master](http://tinyurl.com/yeastmaster) (David M. Taylor), guia de substituição da AEB, guia da Imperial Yeast, tabela de substituição da Levteck e curadoria da Brassagem Forte. As regras completas estão em [`docs/specs/01-substituicao-leveduras.md`](docs/specs/01-substituicao-leveduras.md).

### 02 — Decocção

`ferramentas/decoccao/`

Calculadora de programas de mostura por decocção, de Henrique Boaventura e Fábio Koerich.

- 8 métodos: Simples, Dupla Tradicional, Dupla Moderna, Hochkurz, Boaventura, Dupla Aprimorada, Tripla Tradicional e Pseudo-decocção.
- Quanto puxar em cada decocção (balanço de energia), cronograma completo e gráfico de temperatura com as faixas de enzima.
- Cronômetro para o dia da brassagem. Ele se ajusta ao seu ritmo real ("Cheguei"), tem alarme e mantém a tela acesa.
- Predefinições salvas no aparelho, com exportação e importação em JSON.

Os detalhes técnicos (métodos, fontes, testes e histórico) estão em [`ferramentas/decoccao/README.md`](ferramentas/decoccao/README.md). O "Por que decocção?" está na própria ferramenta.

## Rodar localmente

Só precisa de Python 3 (para servir os arquivos) e Node 18 ou mais novo (para os testes). Não há dependências para instalar.

```sh
git clone https://github.com/henriqueboaventura/beer-tools.git
cd beer-tools
python3 -m http.server 8000
```

Depois é só abrir http://localhost:8000.

- É preciso usar um servidor, e não abrir o `index.html` direto. As ferramentas carregam dados via `fetch` e registram um service worker, e nenhum dos dois funciona com `file://`.
- **Para testar no celular:** com o celular na mesma rede Wi-Fi, abra `http://<IP do computador>:8000`. No macOS, o IP aparece com `ipconfig getifaddr en0`.
- **O service worker guarda o site para uso offline.** Se algo parecer desatualizado durante o desenvolvimento, abra as ferramentas de desenvolvedor do navegador, vá em Application → Service Workers e marque "Update on reload". Outra opção é usar uma janela anônima.

## Testes

```sh
npm test
```

Os testes usam só o runner nativo do Node (`node:test`). Eles cobrem:

- **Plataforma** (`tests/`):
  - toda página usa o layout comum;
  - todo link local aponta para um arquivo que existe;
  - todo arquivo necessário offline está no service worker;
  - o manifest é válido;
  - a versão bate com o CHANGELOG;
  - SEO: título único, descrição, `canonical`, Open Graph e JSON-LD em todas as páginas, sitemap igual às páginas indexáveis, e páginas geradas em dia com os dados.
- **Substituição de leveduras** (`ferramentas/substituicao-leveduras/tests/`): consistência dos dados, casos conferidos à mão contra as fontes, e a busca.
- **Decocção** (`ferramentas/decoccao/tests/`): o motor de cálculo, com valores conferidos contra a literatura.

O GitHub Actions roda a suíte em todo push.

## Como contribuir

Correções de dados, ideias de ferramentas e melhorias são bem-vindas.

- **Encontrou um erro ou tem uma sugestão?** Abra uma [issue](https://github.com/henriqueboaventura/beer-tools/issues). Para dados de levedura, diga qual levedura está errada e a fonte (ficha técnica do fabricante, tabela publicada…).
- **Quer mandar código?** Faça um fork, crie uma branch, rode `npm test` e abra um pull request explicando o que mudou e por quê.

### Estrutura

```
index.html                  diretório (página inicial)
assets/css/bf.css           visual compartilhado (cores, tipografia, componentes)
assets/js/shell.js          header, menu, rodapé, tema, PWA e aviso de nova versão
assets/js/versao.js         versão do site
sw.js, manifest.webmanifest PWA
sitemap.xml, 404.html       SEO (sitemap gerado por scripts/gerar_seo.py)
ferramentas/<nome>/         uma pasta por ferramenta, com HTML, JS, CSS, dados e testes
dados/leveduras/            fontes transcritas e curadas das leveduras (editáveis)
scripts/gerar_leveduras.py  gera o JSON da ferramenta de leveduras
scripts/gerar_seo.py        gera as páginas estáticas por levedura e o sitemap
tests/                      testes da plataforma
docs/specs/                 especificações (plataforma e cada ferramenta)
```

### Regras do visual

- A base é **preta, branca e cinza**, com tipografia condensada nos títulos e monoespaçada nos dados.
- **Cor só como informação**, como o nível de relação e o laboratório nas leveduras, ou a temperatura na decocção. Nunca use a cor como único sinal: sempre há texto, forma ou traço junto.
- **Mobile first.** Tudo precisa funcionar em 320px de largura, sem rolagem horizontal e com alvos de toque de pelo menos 44px.
- Tema claro e escuro. Use os tokens `--bf-*` de `assets/css/bf.css`, nunca cores soltas.

Detalhes em [`docs/specs/00-plataforma.md`](docs/specs/00-plataforma.md).

### Adicionar uma ferramenta

1. Crie `ferramentas/<nome>/index.html` copiando o esqueleto de uma ferramenta existente. O esqueleto tem o `<head>` com `bf.css`, `versao.js` e `shell.js`, os marcadores `<header data-bf-header>` e `<footer data-bf-footer>`, e o cabeçalho padrão (trilha, título, explicação e "Como funciona").
2. Coloque JS, CSS e dados **dentro da pasta**. Importe de fora só o que está em `assets/`.
3. Registre a ferramenta em `FERRAMENTAS`, no `assets/js/shell.js`. Ela passa a aparecer na página inicial e no menu.
4. Adicione os arquivos dela ao `PRECACHE` do `sw.js`, para funcionar offline.
5. Escreva testes em `ferramentas/<nome>/tests/*.test.js`. O `npm test` já pega essa pasta.
6. Escreva a spec em `docs/specs/NN-<nome>.md`.
7. SEO: dê à página `<title>`, `meta description`, `canonical`, Open Graph e JSON-LD (copie de uma ferramenta existente), coloque o link dela em HTML na página inicial e adicione o caminho em `PAGINAS_FIXAS` no `scripts/gerar_seo.py` (sitemap).

Os testes da plataforma avisam se faltar algum desses passos.

### Atualizar os dados de leveduras

O JSON da ferramenta (`ferramentas/substituicao-leveduras/data/leveduras.json`) é **gerado**. Não edite esse arquivo à mão.

1. Edite as fontes em `dados/leveduras/`:
   - `aeb.json` e `imperial.json` são transcrições dos guias dos fabricantes;
   - `nacionais.json` tem Levteck, Smartyeast e Bio4. O campo `curadoria` guarda os vínculos revisados, `inferida` os ainda não revisados e `fabricante` a tabela de substituição do próprio fabricante.
2. Gere o JSON:

   ```sh
   python3 scripts/gerar_leveduras.py
   ```

   Esse comando também gera, via `scripts/gerar_seo.py`, as páginas estáticas de cada levedura (`levedura/<id>/`) e o `sitemap.xml`. Se você mudou só o layout dessas páginas, rode direto `python3 scripts/gerar_seo.py`.

   O script lê também a planilha Yeast Master, que fica em `examples/`. Essa pasta **não vai para o repositório**, porque guarda os arquivos originais de terceiros. Coloque a planilha lá para gerar os dados.
3. Rode `npm test` e faça commit das fontes junto com o JSON gerado.

### Publicar: teste e produção

| Ambiente | Endereço | Como publica |
|---|---|---|
| **Teste** | https://www.hboaventura.com/beer-tools/ | push em `main` (GitHub Pages, cerca de 1 minuto) |
| **Produção** | https://www.brassagemforte.com.br/ferramentas/ | `scripts/deploy-producao.sh` |

Todo recurso novo passa primeiro pelo teste:

1. Suba a versão em `assets/js/versao.js` e escreva a entrada no `CHANGELOG.md`, com o mesmo número. Os testes falham se os dois não baterem.
2. `npm test`, commit e push em `main`. Confira em https://www.hboaventura.com/beer-tools/ (no celular também).
3. Se estiver ok, publique em produção:

   ```sh
   scripts/deploy-producao.sh --simular   # mostra o que mudaria, sem enviar
   scripts/deploy-producao.sh             # publica
   ```

   O script só publica a partir de `main` já enviada ao GitHub, roda os testes, exige uma versão que ainda não foi para produção, envia só os arquivos do site para `public_html/ferramentas/` (não toca em mais nada do servidor), confere a produção no ar e cria a tag `producao-vX.Y.Z`.

   As credenciais ficam em `.env.deploy` (ignorado pelo git). Copie o `.env.deploy.example` e preencha.

É a troca de versão que invalida o cache offline antigo. Quem estiver com o site aberto vê "Nova versão disponível · Atualizar".

O endereço oficial das páginas (`canonical`, sitemap) é sempre o de produção, inclusive na versão de teste, para as duas não concorrerem no Google.

Na decocção, mudanças na calculadora também sobem a versão dela (`ferramentas/decoccao/version.js` e `ferramentas/decoccao/CHANGELOG.md`).

## Créditos

- **Substituição de leveduras:** Henrique Boaventura e Fábio Koerich. Fontes dos dados: Yeast Master (David M. Taylor), AEB Brewing Yeast Substitution Guide, Imperial Yeast Strain Cross Reference Guide, tabela de substituição Levteck e curadoria da Brassagem Forte.
- **Decocção:** Henrique Boaventura e Fábio Koerich. As fontes da literatura estão no README da ferramenta.
- Um projeto da [Brassagem Forte](https://www.brassagemforte.com.br).
