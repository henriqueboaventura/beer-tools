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

## [1.6.0] — 2026-09-24

### Alterado
- **Parti-gyle refeita em fluxo único e guiado.** A primeira versão
  confundia: tinha dois métodos misturados (dividir por esquema e misturar
  mosto forte e fraco), e um plano e um "no dia" que não se conversavam.
  Agora:
  1. **Suas cervejas:** 2 ou 3, com volume e OG final de cada uma.
  2. **O plano:**
     - quanto malte usar e a ordem da coleta ("colete os primeiros 21,1 L
       para a Wee Heavy"), com a OG prevista de cada cerveja;
     - para cada uma, o que fazer para chegar exatamente no alvo:
       acrescentar água ou ferver mais;
     - com 2 cervejas, a divisão de volumes que acerta as duas sem ajuste
       (botão "Usar essa divisão") ou, se forem parecidas demais, como
       trocar mosto entre as panelas.
  3. **No dia:** já preenchido com a previsão. Troque pelo volume e pela OG
     medidos em cada panela para ver a OG depois da fervura, o ajuste e
     quanto mudar o lúpulo.
- **Modelo da coleta:** a densidade dos mostos cai em linha reta do
  primeiro ao último litro, calibrada para reproduzir exatamente as regras
  da BYO de 1/3 + 2/3 e de três terços. A regra de metade/metade (58%) do
  mesmo artigo é incompatível com as outras duas e ficou de fora. Com esse
  modelo, só coletando, a 1ª de duas cervejas sai entre 1,75× e 4× mais
  densa que a 2ª (em pontos).
- A perda na fervura agora entra na conta: os volumes de coleta são antes
  da fervura, e as OGs pedidas, depois.
- Testes da ferramenta reescritos para o modelo novo: os exemplos das
  fontes, os cenários de uso e mais de 2.000 casos aleatórios.

## [1.5.0] — 2026-09-24

### Adicionado
- **Ferramenta 04 — Parti-gyle**: várias cervejas de uma mostura.
  - **Planejar:** os três esquemas de divisão publicados na BYO
    (1/3 + 2/3, metade/metade e três terços), definidos pela OG média ou
    pela OG da 1ª cerveja, com a densidade e o volume de cada cerveja e
    quanto malte usar (eficiência e potencial do malte ajustáveis).
  - **No dia:** com o mosto forte e o fraco medidos, quantos litros de cada
    vão para até 4 cervejas, completando com água quando o alvo fica abaixo
    do mosto fraco, e avisando quando falta mosto ou o alvo passa do forte.
  - **Primeiro mosto diferente do previsto:** volume no alvo, água para
    diluir e fator de correção do lúpulo.
  - Os testes usam os exemplos numéricos das fontes (BYO e Craft Beer &
    Brewing), citadas na própria ferramenta.

## [1.4.0] — 2026-09-23

### Adicionado
- **Ferramenta 03 — Speise**: calculadora de carbonatação natural com o
  próprio mosto (antes um app separado, `henriqueboaventura/speise`).
  Calcula quanto mosto reservar como speise, quanto fermentar e a dosagem
  por garrafa. Aceita OG em SG ou °Plato. O cálculo é idêntico ao original
  (comparado em 432 combinações de entradas), agora em `calculo.js`, com
  testes conferidos à mão. Tem layout, PWA/offline, SEO e imagem de
  compartilhamento no padrão do site. Números no formato brasileiro (1,32 L).

## [1.3.1] — 2026-09-23

### Corrigido
- **Arquivos velhos presos em cache (CDN da Hostinger e navegador).** Na
  publicação da 1.3.0, uma falha de permissão deixou a produção fora do ar
  por alguns minutos, e o CDN guardou por até 1 hora os redirecionamentos
  desse intervalo: páginas abriam sem estilo, sem cabeçalho ou sem a
  ferramenta de leveduras. Agora todo script, estilo, manifest, JSON e logo
  é carregado com `?v=<versão>`. Cada versão usa endereços novos, que nenhum
  cache consegue responder com um arquivo antigo.
- O service worker é registrado como `sw.js?v=<versão>` e tira a versão do
  próprio endereço, sem depender de outro arquivo que poderia estar em cache.

### Adicionado
- `scripts/versionar.py`: aplica a versão atual em todos os `?v=` e
  regenera as páginas de levedura. Os testes falham se algum ficar
  desatualizado.

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

### Corrigido
- Deploy: a pasta `public_html/ferramentas/` recebia a permissão 700 da pasta
  temporária do pacote, e a produção ficou alguns minutos fora do ar (403, e
  o resto redirecionando para o pint.network). O script agora força 755 nas
  pastas e 644 nos arquivos. A verificação no fim do deploy pegou o problema.

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
