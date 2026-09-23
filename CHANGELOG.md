# Changelog — Ferramentas Brassagem Forte

Mudanças do site (shell, PWA e ferramentas). Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versionamento
[SemVer](https://semver.org/lang/pt-BR/). A versão fica em
`assets/js/versao.js` e aparece no rodapé de todas as páginas.

A calculadora de decocção mantém também o próprio histórico, com mais
detalhe técnico, em `ferramentas/decoccao/CHANGELOG.md`.

**Toda publicação em `main` sobe a versão.** É a troca de versão que
invalida o cache offline antigo e faz aparecer o aviso "Nova versão
disponível" para quem já está com o site aberto.

## [1.3.0] — 2026-09-23

### Alterado
- **Produção em https://www.brassagemforte.com.br/ferramentas/.** O GitHub
  Pages passa a ser o ambiente de teste. O endereço oficial (`canonical`,
  sitemap, dados estruturados, imagens de compartilhamento) é o de
  produção, então as páginas de teste não concorrem com ela no Google.

### Adicionado
- `scripts/deploy-producao.sh`: publica em produção num comando. Só sai de
  `main` já enviada ao GitHub, roda os testes, exige versão nova, envia só
  os arquivos do site para `public_html/ferramentas/` (e nada fora dela),
  confere a produção no ar e marca a tag `producao-vX.Y.Z`. Tem o modo
  `--simular`.
- Credenciais do deploy em `.env.deploy` (ignorado pelo git); modelo em
  `.env.deploy.example`.

## [1.2.2] — 2026-09-23

### Alterado
- Crédito da Substituição de leveduras: ferramenta de Henrique Boaventura e
  Fábio Koerich (rodapé da ferramenta e das páginas de levedura, dados
  estruturados e README).

## [1.2.1] — 2026-09-23

### Alterado
- Ícone novo para favicon e PWA: caneco de cerveja com chave inglesa, no
  lugar do monograma "BF". Tem uma versão maior para o favicon, legível a
  16px, e uma versão "maskable" para o Android.

## [1.2.0] — 2026-09-23

### Adicionado
- **Uma página por levedura** (`/ferramentas/substituicao-leveduras/levedura/<id>/`),
  com os substitutos no próprio HTML, para buscas como "substituto da
  US-05" ou "equivalente da WLP001" chegarem ao site. Leveduras sem
  substituto ganham página com `noindex`. Também há um índice com todas as
  leveduras, agrupado por fabricante.
- **SEO em todas as páginas**:
  - título e descrição próprios;
  - `canonical` (o site responde com e sem `www`);
  - Open Graph e Twitter com imagem de compartilhamento para cada ferramenta;
  - dados estruturados (WebSite, WebApplication, Article, BreadcrumbList).
- `sitemap.xml` e página 404.
- Ícone novo para favicon e PWA (substituído na 1.2.1).
- Testes de SEO: metadados de todas as páginas, sitemap, páginas geradas em
  dia com os dados, e ícones. O CI confere que as páginas geradas estão
  atualizadas.

### Alterado
- A lista de ferramentas da página inicial é HTML estático (antes era
  montada por JavaScript), para ser rastreável.

### Corrigido
- Nomes com aspa sem par vindos da planilha (ex.: M84 Bohemian "Lager).

## [1.1.0] — 2026-09-22

### Adicionado
- **Ferramenta 02 — Decocção**: a calculadora de programas de mostura por
  decocção (antes um app separado) agora faz parte do diretório, no layout
  compartilhado. Motor de cálculo e os 183 testes vieram sem alteração.
  Predefinições e cronômetro salvos na versão antiga continuam valendo.
- **PWA do site inteiro**: dá para instalar no celular ("Adicionar à tela
  de início") e usar offline. Um único service worker (`sw.js`) cobre
  todas as ferramentas.
- **Aviso de nova versão**: quando sai uma versão nova, aparece
  "Nova versão disponível · Atualizar". O site procura atualização ao voltar
  para a aba e a cada 30 minutos.
- **Versão e novidades no rodapé** de todas as páginas.
- Variante de layout largo (`<body class="bf-wide">`) para ferramentas com
  duas colunas no desktop.
- Testes (`npm test`) e CI no GitHub Actions.

### Alterado
- **Cache**: páginas, scripts, estilos e dados são sempre buscados na rede
  primeiro, revalidando com o servidor. O cache local só é usado sem
  conexão, então ninguém fica preso numa versão antiga. Cada versão tem o
  próprio cache, e os antigos são apagados.
- **Cores como informação**: a base continua preta, branca e cinza, mas a
  cor passou a ser usada onde ajuda a identificar algo:
  - Leveduras: cor por nível de relação (equivalente, provável,
    alternativa), cor por laboratório e "não confunda" em vermelho.
  - Decocção: cores originais das faixas de temperatura, das linhas de
    mostura e fervura e da escada de etapas.
- Leveduras: as fontes dos dados ficam num bloco recolhível no fim da página.

### Corrigido
- Leveduras: a busca não encontrava "fabricante + código" (ex.: "imperial l17").
- Decocção no celular: o cronômetro não grudava no topo ao rolar; tempo e
  temperaturas se sobrepunham na escada; o texto "% do volume" vazava da
  tela em 320–360px.
- Cartão da levedura base: rótulos pequenos e apagados demais; botões
  "não confunda" tachados, difíceis de ler.

## [1.0.0] — 2026-09-22

### Adicionado
- Diretório de ferramentas com layout compartilhado (header, menu, rodapé,
  tema claro/escuro), mobile first.
- **Ferramenta 01 — Substituição de leveduras**: 490 leveduras de 20
  fabricantes, com equivalências cruzadas do Yeast Master, dos guias AEB e
  Imperial, da tabela de substituição da Levteck e da curadoria da
  Brassagem Forte (Levteck, Smartyeast, Bio4).
