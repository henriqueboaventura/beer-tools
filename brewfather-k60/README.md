# Brewfather → K60 (ferramenta interna)

Lê uma receita do Brewfather e cria a receita na controladora **EZBrew / K60**
(`POST /receita`). O schema de receita foi verificado contra os firmwares
**v9.0 e v9.1** — idêntico nos dois. Fora do menu: não é registrada em
`assets/js/shell.js`, então não aparece na lista de ferramentas, mas tem URL
própria em **`/brewfather-k60/`**.

Só **cria** a receita. Não inicia, não para, não mexe em execução.

## Modelo da controladora (firmware v9.0 + telas do app)

As chaves do `POST /receita` foram **confirmadas na `.rodata` do firmware**: o
parser usa chaves **curtas**, distintas das chaves longas que o `/status`
devolve (`tipoEtapaReceita`, `nomeEtapaReceita`, `nomeAdicao`, `nomeReceita`).

`Receita = { nome, etapas: [Etapa], adicoes: [Adicao] }`. Cada `Etapa` tem
`tipo`, `nome`, `iTemperatura`, `iRampa`, `iTempo`, `iDosagem`,
`bPump` (recirculação), `bBeep` (alerta), `bActive` (ativar).

`adicoes` é um **array no topo da receita** (irmão de `etapas`), **não**
dentro de cada etapa — confirmado por round-trip na controladora real.
`Adicao = { nome, id_etapa, tempo, bActive, executed }`: `id_etapa` é o
**índice 0-based** da etapa-alvo; `tempo` são os **minutos restantes** do
patamar (ex.: fervura de 70 min, lúpulo de amargor com `tempo: 60` entra 10 min
após o início); `id_receita` a controladora **atribui sozinha** no POST (não
enviamos). O `nome` vem de uma
**lista fixa** (dropdown do app, ≤18 chars): `Add. Acido`, `Add. Adjuntos`,
`Add. Clarificante`, `Add. Enzimas`, `Add. Especiarias`, `Add. Malte Torrado`,
`Add. Nutriente`, `Add. Sais`, `Derrubar Malte`, `Hidratar Levedura`,
`Lplo Amargor`, `Lplo Amargor/Sabor`, `Lupulo Aroma`, `Lupulo Sabor`,
`Medir Densidade`, `Medir pH`, `Mexer Cama Malte`, `Outros`, `Pesar Ingrediente`,
`Preparar Chiller`, `Preparar Fermtdor`, `Teste Iodo`.

Tipos de etapa (`tipo`): `Dosagem d'agua`, `Mostura`, `Fervura`,
`Whirlpool lento`, `Whirlpool rapido`, `Descanso`, `Resfriamento`,
`Kettle Souring`, `First Wort Hop`, `Hop Stand`. Quando `tipo` é `Mostura`, o
`nome` é o sub-tipo (`Infusao`, `Beta-Glucanase`, `Protease`, `Beta-Amilase`,
`Beta&Alfa Amilase`, `Alfa-Amilase`, `Mash Out`); nos outros tipos,
`nome == tipo`.

## Mapeamento Brewfather → K60

- **Mostura** → etapa `Mostura`, sub-tipo escolhido pela temperatura do patamar.
- **Decocção** (passo `Decoction` no Brewfather) → vira **mostura base** no
  patamar + **aviso** para puxar o volume para a outra panela. A K60 não faz
  decocção; ela mantém só a mostura base.
- **Fervura** → uma etapa `Fervura` (tempo = `boilTime`) com os lúpulos de
  fervura e os aditivos (`miscs use: Boil`) como adições apontando essa etapa,
  cada uma com `tempo` = minutos restantes (= `hop.time` do Brewfather). Lúpulo vira
  `Lplo Amargor` / `Lplo Amargor/Sabor` / `Lupulo Sabor` pelo tempo; aditivo
  vira `Add. Clarificante` / `Add. Nutriente` / `Add. Sais` / … pelo nome.
- **First Wort Hop** → etapa `First Wort Hop`.
- **Aroma / whirlpool / hop stand** → etapa `Hop Stand` (temperatura e tempo),
  com os lúpulos de aroma como `Lupulo Aroma`.
- **Aditivos de mostura/sparge** (`miscs use: Mash/Sparge`, fora sal/ácido) →
  adição na última etapa de mostura.
- **Sais e ácidos** (química da água) → sempre na **primeira etapa**
  (mash-in), independente do uso no Brewfather. Vários sais viram **uma única**
  `Add. Sais`; ácidos, uma única `Add. Acido`.
- **Resfriamento** → etapa `Resfriamento` na temperatura de inóculo da receita
  (1º passo da fermentação), ou na temperatura informada nas opções.
- **Dry hop** e **aditivos** sem etapa na K60 entram só como **aviso**.

### Compatibilidade de firmware

O `POST /receita` e o vocabulário de etapas são iguais em **v9.0** e **v9.1**;
nada precisou mudar. Diferenças entre essas versões que **não** afetam esta
ferramenta: a v9.1 passou a checar firmware novo no servidor do fabricante
(`brennerbeer.ddns.net/exist/`), e a variante *Univ* não serve a página web
(`/serverIndex`, `/auth`, `/update` ausentes — só a API de dados).

> Chaves do payload **confirmadas no firmware + round-trip na panela real**:
> `nome`/`etapas`/`tipo`/`iTemperatura`/`iRampa`/`iTempo`/`bPump`/`bBeep`/
> `bActive`/`iDosagem`, e `adicoes` **top-level** com
> `adicao = {nome, id_etapa, tempo, bActive, executed}` (a panela devolve
> também `id_receita`, que ela atribui). **Nome da receita: máx. 18 chars**
> (confirmado no device: 19 dá `retVal:5 "Nome da receita estrapolou o
> tamanho."`). A UI sugere uma abreviação editável do nome do Brewfather.
> Ponto ainda a confirmar: a unidade de `iTempo` no Kettle Souring (o app
> mostra horas). **Confira a prévia (JSON) antes de enviar.**
>
> **Decocção:** não há nome de adição "Decocção" na lista fixa. Mantemos a
> decocção como aviso + mostura base. Se quiser um alerta cronometrado dentro
> da mostura, dá para usar `Outros` ou `Mexer Cama Malte` como adição no tempo
> da puxada — mas a panela mostra só esse nome, não "decocção".

## Testar local

Sem a panela, suba o mock, que **loga o corpo** de cada `POST /receita`:

```bash
node brewfather-k60/scripts/mock-k60.js 8099       # mock da K60
python3 -m http.server 8000                         # serve o site estático
```

Abra `http://localhost:8000/brewfather-k60/`, ponha `http://localhost:8099` no
campo "Endereço da K60", carregue uma receita (ou cole um JSON de
`brewfather-k60/exemplos/`) e envie. O terminal do mock mostra a chamada.

Com a panela real: use `http://ezbrew.local` ou o IP dela, com o computador na
mesma rede.

## Testes

```bash
node --test brewfather-k60/tests/mapa.test.js
```

Cobrem o mapeamento puro (`mapa.js`): sub-tipo por temperatura, divisão da
fervura, aviso de decocção, First Wort Hop / Hop Stand, nome longo e os
invariantes de validação do firmware.

## Arquivos

- `mapa.js` — mapeamento puro Brewfather → payload da K60 (testável em Node).
- `brewfather.js` — cliente de leitura do Brewfather (API v2).
- `k60.js` — cliente da controladora (`/status`, `/receita/count`, `POST /receita`).
- `app.js` / `index.html` / `app.css` — a página.
- `scripts/mock-k60.js` — mock local que loga o POST.
- `exemplos/` — receitas de exemplo para colar.
