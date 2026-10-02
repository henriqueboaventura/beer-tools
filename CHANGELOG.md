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

## [1.15.0] — 2026-10-02

### Adicionado
- **Leveduras: tabela de equivalência da Levteck.** O próprio fabricante
  indica a equivalente de cada TeckBrew (entra como Equivalente) e, em
  alguns casos, uma alternativa (entra como Alternativa).
  - 10 TeckBrews novas da linha profissional (vendida só para
    cervejarias, fora da loja online), com a etiqueta "Profissional":
    TB04, TB15, TB18, TB28, TB29, TB48, TB50, TB53, TB55 e TB89.
    Temperatura, atenuação, floculação e descrição vêm da página de
    produção industrial da Levteck.
  - GigaYeast GY054 (Vermont IPA), a equivalente da TB04.
  - Seljeset Kveik equivalente à LalBrew Voss Kveik (mesma cepa).
  - A tabela confirma 11 vínculos que a curadoria já tinha; eles sobem de
    Provável para Equivalente.

### Corrigido
- O gerador dos dados de leveduras gravava na pasta antiga `ferramentas/`
  desde a 1.12.0; agora grava em `substituicao-leveduras/data/`.

## [1.14.4] — 2026-10-02

### Alterado
- **Leveduras: "Não confunda" fechado por padrão.** A lista de leveduras
  que parecem equivalentes, mas não são, confundia ao aparecer aberta
  junto da levedura escolhida. Virou um bloco recolhível, "Parecem, mas
  não são equivalentes (N)", com uma frase explicando, na ferramenta e
  nas páginas de cada levedura.

## [1.14.3] — 2026-10-02

### Alterado
- **Carbonatação logo depois da speise.** As duas carbonatam a cerveja,
  então ficam lado a lado na página inicial e no menu: Carbonatação passa
  a ser a 04, Parti-gyle a 05 e Taxa de inóculo a 06.

### Corrigido
- **Speise: temperatura mais alta depois da fermentação, não a do envase.**
  O CO₂ que a cerveja guarda vem da temperatura mais quente depois da
  fermentação; resfriar depois (cold crash) não devolve o CO₂ que escapou.
  Com a temperatura do envase, quem fazia cold crash recebia speise de
  menos. A conta é a mesma; mudam o rótulo do campo e a explicação, iguais
  aos da carbonatação.

## [1.14.2] — 2026-10-02

### Alterado
- **Carbonatação: açúcar refinado (sacarose) como padrão**, no lugar do
  açúcar de milho.
- **Carbonatação: rendimento só como informação.** Cada açúcar mostra
  quanto CO₂ rende por grama (e se é estimativa), sem campo para editar.
- **Carbonatação: segurança da embalagem separada da cerveja.**
  - O bloco de pressão virou "Segurança da <embalagem>", com o nome da
    embalagem escolhida no passo 01, e diz que não muda o açúcar.
  - Sem campo de temperatura de armazenamento: a pressão é conferida
    sempre num dia quente de verão (30 °C), o lado seguro. A temperatura
    da cerveja do passo 02 serve só para o CO₂ que ela já tem.
  - O veredito (ok, atenção, perigo) agora compara essa pressão com os
    limites da embalagem convertidos para bar, mostrados na tela. Cerveja
    que já passou do limite sem açúcar (spunding) também alerta.

## [1.14.1] — 2026-10-01

### Adicionado
- **Carbonatação: ícones nos botões do envase.** Garrafa long neck,
  garrafa de champanhe, PET, lata e barril, em traço na cor do texto.

### Alterado
- **Carbonatação: comparada com o Brewers Friend.**
  - CO₂ já na cerveja igual nos 6 cenários; açúcar de milho dentro de 1%;
    açúcar comum 4,5% abaixo (rendimento estequiométrico).
  - Nos açúcares estimados (DME, mel, mascavo), a nota mostra o
    rendimento que o Brewers Friend usa, porque as referências discordam.
  - A Craft Beer & Brewing tem um erro de temperatura que subestima muito
    o açúcar, e ficou fora como referência.
  - Detalhes em `docs/specs/06-carbonatacao.md`.

## [1.14.0] — 2026-10-01

### Adicionado
- **Ferramenta 06 — Carbonatação**: quanto açúcar usar para carbonatar,
  no lote todo ou por garrafa.
  - Garrafa de vidro (comum ou reforçada), PET, lata ou barril. No barril,
    o espaço vazio entra na conta.
  - O CO₂ que a cerveja já tem, pela temperatura mais alta depois da
    fermentação ou pelo manômetro, se ela estava sob pressão.
  - Alvo em volumes de CO₂, com sugestões por estilo.
  - Açúcar de milho, refinado/cristal, dextrose anidra, mascavo, DME ou
    mel, com rendimento editável, ou carbonatação natural (densidade para
    fechar e pressão da válvula de spunding).
  - Dose por garrafa com as mesmas garrafas da speise.
  - Pressão na temperatura de armazenamento, com aviso de garrafa
    estourando por tipo de embalagem.
  - Mesma física da calculadora de priming do Mr Malty, em litros, gramas,
    °C e bar. Os resultados batem exatamente com o código dela.

### Corrigido
- **Página inicial:** nomes longos de ferramenta quebram em vez de vazar
  da tela quando a fonte do site não carrega.

## [1.13.0] — 2026-09-30

### Adicionado
- **Links da Brassagem Forte no menu**, no lugar do "Em breve":
  - **Podcast**, no Spotify;
  - **Site**, brassagemforte.com.br;
  - **Sugira uma ferramenta**, que abre uma issue no GitHub e também serve
    para relatar erros.

  Abrem em aba nova, para não fechar a ferramenta no meio da brassagem.

## [1.12.0] — 2026-09-30

### Alterado
- **Endereços sem o "ferramentas" repetido.** As ferramentas ficavam numa
  pasta `ferramentas/` dentro de um site que já está em `/ferramentas/`, e
  os endereços saíam como
  `brassagemforte.com.br/ferramentas/ferramentas/speise/`. Agora são
  `brassagemforte.com.br/ferramentas/speise/`.
  - As pastas das ferramentas foram para a raiz do repositório.
  - Canonical, sitemap, menu, manifest, service worker e 404 usam os
    endereços novos.
  - No teste, os endereços ficam `hboaventura.com/beer-tools/speise/`.

### Adicionado
- **Redirecionamento dos endereços antigos (produção).** Um `.htaccess` na
  pasta `/ferramentas/` responde 301 de `/ferramentas/ferramentas/*` para
  `/ferramentas/*`, mantendo parâmetros como `?levedura=us-05`. Links
  compartilhados e páginas já indexadas continuam funcionando, e o deploy
  confere o redirecionamento.
- **Página "não encontrada" do próprio site em produção.** Antes, um
  endereço inexistente dentro de `/ferramentas/` caía no WordPress do
  domínio.

## [1.11.1] — 2026-09-29

### Alterado
- **Taxa de inóculo: 200 bilhões de células por pacote como padrão.** O
  atalho de 100 bi continua ao lado, e o campo aceita qualquer valor.

## [1.11.0] — 2026-09-29

### Adicionado
- **Taxa de inóculo: células por pacote de levedura líquida.** Nem todo
  pacote ou vial tem 100 bilhões de células: algumas marcas vendem com
  200. Agora dá para informar o do seu pacote.
  - Atalhos de 100 e 200 bi, ou qualquer valor no campo.
  - Entra na conta de quanto você tem e de quantos pacotes seriam sem
    starter.

## [1.10.0] — 2026-09-28

### Adicionado
- **Taxa de inóculo: "Qual técnica escolher?"** Uma seção no passo 03 que
  explica a diferença entre as técnicas de propagação:
  - como é feita cada uma (placa agitadora, aeração contínua, agitação
    manual, O₂ no início, sem agitação) e o que muda no crescimento;
  - uma tabela com o que cada modelo prevê para um starter de 1 L, com 1
    pacote e com o starter concentrado, calculada pelos próprios modelos;
  - por que as duas placas agitadoras (Braukaiser e Mr Malty) discordam, e
    o que fazer na dúvida.

  Cada passo tem um link "qual escolher?" ao lado de "Agitação", que abre
  a seção.

## [1.9.0] — 2026-09-28

### Adicionado
- **Taxa de inóculo: as cinco técnicas de starter do Mr Malty.** Placa
  agitadora, aeração contínua, agitação manual (intermitente), O₂ no
  início e sem agitação. Ficam nos passos e na sugestão de passos, ao lado
  da placa agitadora (Braukaiser) e do sem agitação (Chris White).

### Alterado
- **Modelo do Mr Malty ajustado na API dele, em vez de aproximado pela
  curva de White.**
  - 166 simulações: as 5 técnicas, de 5% a 500% de crescimento.
  - Mostraram que ele usa uma curva-base própria, com o volume
    multiplicado pelo fator de cada técnica.
  - Reproduz as células no fim com desvio máximo de 0,9%, e 0,4% nos
    passos coletados antes, que ficaram fora do ajuste.
  - Antes, a placa agitadora ficava dentro de ±10%.
- Avisos dos passos: "cresce menos de 25%" substitui o aviso de
  inoculação alta, que dependia do modelo.

## [1.8.2] — 2026-09-28

### Alterado
- **Taxa de inóculo: resultado dos passos no mesmo formato do "Você
  tem".**
  - O número grande, a barra até o necessário e a taxa obtida.
  - A cor diz se chega: verde com ✓ e a folga ("Chega no alvo, com 45 bi
    de folga"), ou âmbar com quanto falta.
  - Antes era um bloco invertido com o "Chega no alvo" solto embaixo.

## [1.8.1] — 2026-09-28

### Alterado
- **Taxa de inóculo: "Você tem" em destaque.** Virou um bloco próprio,
  no mesmo peso do "Você precisa de":
  - o número grande;
  - uma barra até o necessário;
  - âmbar quando falta, verde quando basta;
  - o que fazer (starter, pacotes, gramas ou mL).

## [1.8.0] — 2026-09-28

### Adicionado
- **Taxa de inóculo: segundo modelo de placa agitadora, o do Mr Malty.**
  Validamos a ferramenta passo a passo contra a calculadora de starter em
  passos do Mr Malty (24 cenários). O resultado:
  - Sem agitação, a curva de Chris White bate com o "Simple Starter" dele,
    dentro de ±10%.
  - Na placa agitadora, o modelo da Braukaiser diverge. Com pouca levedura
    por litro, ele prevê mais crescimento; com muita, menos, e a levedura
    para de crescer. Numa lager de 884 bi com 1 pacote e starter de até
    2 L, o Mr Malty chega em 4 passos e o Braukaiser não chega.
  - Agora cada passo, e a sugestão de passos, deixa escolher entre
    "Placa agitadora (Braukaiser)", "Placa agitadora (Mr Malty)" e "Sem
    agitação". O modelo do Mr Malty é a curva de White com os fatores
    publicados por ele, e reproduz os passos dele dentro de ±10% na maioria
    dos casos.

## [1.7.0] — 2026-09-28

### Adicionado
- **Ferramenta 05 — Taxa de inóculo**: quanto fermento a cerveja precisa e
  como chegar lá, sempre em litros.
  - **Sua cerveja:** células necessárias = taxa × litros × °P, com as taxas
    de ale, ale forte, lager e lager forte, ou qualquer valor.
  - **Sua levedura:** líquida (viabilidade pela data de fabricação, 0,7%
    por dia), seca (15 bilhões por grama, editável), fermento reaproveitado
    ou contagem própria. Diz se dá para inocular direto e, se não, quanto
    falta e quantos pacotes, gramas ou mL seriam sem starter.
  - **Starter em passos:** quantos você quiser, com volume, densidade e
    agitação de cada um. Placa agitadora usa o modelo da Braukaiser; sem
    agitação, a curva de Chris White. Mostra células no começo e no fim,
    inoculação e DME de cada passo. O botão "Sugerir passos" monta a
    sequência a partir do maior starter que você consegue fazer.
  - Comparada com Mr Malty, Brewers Friend e Craft Beer & Brewing. Os
    testes reproduzem o exemplo publicado do Brewers Friend e batem com o
    Mr Malty na placa agitadora.

## [1.6.1] — 2026-09-24

### Corrigido
- **Página inicial no celular sem rolagem lateral mesmo sem a fonte do
  site.** Quando a fonte condensada (Archivo) não carrega (primeira
  visita offline, fontes bloqueadas), a fonte reserva é mais larga e o
  título "Ferramentas" empurrava a página para o lado em telas de 360 px.
  Agora a palavra quebra. Achado pelos novos testes de interface no CI
  (Linux), que têm um teste só para esse caso.

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

### Testes
- **Testes de interface automáticos** (`tests/ui/`), rodando no `npm test`
  e no GitHub Actions. Abrem o site num Chrome sem janela, em tela de
  celular, e usam as ferramentas como uma pessoa usaria: busca e filtros de
  leveduras, troca de método e cronômetro da decocção, speise com SG e °P,
  e o fluxo inteiro da parti-gyle. Também conferem, em todas as páginas,
  que não há erro de JavaScript nem rolagem lateral no celular. Sem
  nenhuma dependência: falam direto com o Chrome pelo protocolo de
  depuração dele.

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
