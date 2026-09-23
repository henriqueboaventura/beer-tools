#!/usr/bin/env python3
"""Gera as páginas estáticas de SEO e o sitemap a partir de leveduras.json.

- ferramentas/substituicao-leveduras/levedura/<id>/index.html — uma página por
  levedura, com os substitutos já no HTML (indexável sem JavaScript).
  Leveduras sem nenhum substituto ganham página com `noindex` e ficam fora do sitemap.
- ferramentas/substituicao-leveduras/levedura/index.html — índice de todas.
- sitemap.xml — páginas do site + páginas de levedura indexáveis.

Só usa a biblioteca padrão. Roda sozinho ou no fim de gerar_leveduras.py:
  python3 scripts/gerar_seo.py

Arquivos GERADOS — não editar à mão. O CI confere que estão em dia.
"""
import html
import json
import os
import re
import shutil
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://www.brassagemforte.com.br/ferramentas/"  # URL canônica = PRODUÇÃO (com barra no fim).
# O GitHub Pages é só ambiente de teste: as páginas dele apontam o canonical para cá.
FERRAMENTA = "ferramentas/substituicao-leveduras/"
PASTA = os.path.join(RAIZ, FERRAMENTA, "levedura")
DADOS = os.path.join(RAIZ, FERRAMENTA, "data", "leveduras.json")

# Páginas fixas do site (caminho relativo à raiz), na ordem do sitemap.
PAGINAS_FIXAS = [
    "",
    "ferramentas/substituicao-leveduras/",
    "ferramentas/substituicao-leveduras/levedura/",
    "ferramentas/decoccao/",
    "ferramentas/decoccao/sobre.html",
]

NIVEL = {3: "Equivalente", 2: "Provável", 1: "Alternativa"}
FONTE = {"ym": "Yeast Master", "aeb": "AEB", "imperial": "Imperial", "curadoria": "Curadoria BF",
         "levteck": "Levteck (fabricante)", "inferida": "Inferida (não revisada)"}
PREFIXOS_MARCA = ("safale", "saflager", "lalbrew", "wildbrew")
AUTORES = [{"@type": "Person", "name": "Henrique Boaventura"}, {"@type": "Person", "name": "Fábio Koerich"}]


def e(s):
    return html.escape(str(s), quote=True)


def norm(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in s if unicodedata.category(c) != "Mn").lower())


class Base:
    def __init__(self, db):
        self.db = db
        self.por_id = {y["id"]: y for y in db["leveduras"]}

    def fab(self, y):
        return self.db["fabricantes"][y["fab"]]["nome"]

    def codigo(self, y):
        c = y.get("codigo")
        return c if c and norm(c) not in norm(y["nome"]) else ""

    def rotulo(self, y):
        """'Wyeast 1056 American Ale', 'SafAle US-05', 'Levteck TeckBrew 10 American Ale'."""
        base = (self.codigo(y) + " " + y["nome"]).strip()
        if norm(y["nome"]).startswith(PREFIXOS_MARCA) or norm(base).startswith(norm(self.fab(y))):
            return base
        return self.fab(y) + " " + base

    def forma(self, y):
        return {"seca": "seca", "liquida": "líquida"}.get(y.get("forma"), "")

    def aten(self, y):
        if y.get("aten"):
            return "%d–%d%%" % tuple(y["aten"])
        if y.get("atenYm"):
            return "~%d%%" % y["atenYm"]
        return ""

    def rel(self, y):
        return self.db["relacoes"].get(y["id"], [])


def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "</script>"


def breadcrumb(itens):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u}
                                for i, (n, u) in enumerate(itens)]}


def head(titulo, descricao, caminho, raiz, indexar=True, extra_ld=()):
    url = SITE + caminho
    robots = "" if indexar else '\n  <meta name="robots" content="noindex, follow">'
    lds = "\n  ".join(ld(x) for x in extra_ld)
    return f'''<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(titulo)}</title>
  <meta name="description" content="{e(descricao)}">{robots}
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Ferramentas Brassagem Forte">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:title" content="{e(titulo)}">
  <meta property="og:description" content="{e(descricao)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE}assets/img/og-leveduras.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#0b0b0b">
  <link rel="manifest" href="{raiz}manifest.webmanifest">
  <link rel="icon" href="{raiz}favicon.ico" sizes="32x32">
  <link rel="icon" href="{raiz}assets/img/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="{raiz}assets/img/icon-180.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black">
  <meta name="apple-mobile-web-app-title" content="Brassagem Forte">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{raiz}assets/css/bf.css">
  <link rel="stylesheet" href="{raiz}{FERRAMENTA}app.css">
  <script src="{raiz}assets/js/versao.js"></script>
  <script src="{raiz}assets/js/shell.js"></script>
  {lds}
</head>
<body>
  <header data-bf-header></header>
'''


def rodape(versao):
    data = "/".join(reversed(versao.split("-")))
    return f'''
  <footer data-bf-footer="Ferramenta de Henrique Boaventura e Fábio Koerich · Dados de {data}"></footer>
</body>
</html>
'''


def meter(n):
    return '<span class="bf-meter" aria-hidden="true">' + "".join(
        '<i class="on"></i>' if i <= n else "<i></i>" for i in range(1, 4)) + "</span>"


def pagina_levedura(B, y):
    raiz = "../../../../"
    # vínculo direto antes do derivado ("… foi associada à X, que é equivalente à Y")
    rels = sorted(B.rel(y), key=lambda r: (-r[1], "que é equivalente à" in (r[3] if len(r) > 3 else ""),
                                           B.por_id[r[0]].get("descontinuada", False),
                                           B.por_id[r[0]].get("forma") != "seca", B.fab(B.por_id[r[0]]),
                                           B.por_id[r[0]]["nome"]))
    rotulo = B.rotulo(y)
    fab, forma = B.fab(y), B.forma(y)
    caminho = f"{FERRAMENTA}levedura/{y['id']}/"
    indexar = bool(rels)

    eq = [B.rotulo(B.por_id[r[0]]) for r in rels if r[1] == 3][:2]
    outras = [B.rotulo(B.por_id[r[0]]) for r in rels if r[1] < 3][:2]
    # "(Wyeast, líquida)" só quando o fabricante não está no rótulo
    meta = ", ".join(x for x in ([] if norm(fab) in norm(rotulo) else [fab]) + [forma] if x)
    meta = f" ({meta})" if meta else ""
    if rels:
        partes = []
        if eq:
            partes.append("equivalentes como " + " e ".join(eq))
        if outras:
            partes.append(("e " if eq else "") + "alternativas como " + " e ".join(outras))
        descricao = f"Substitutos da levedura {rotulo}{meta}: " + ", ".join(partes) + \
            ". Compare atenuação, forma e origem."
    else:
        descricao = f"Levedura {rotulo}{meta}: nenhuma fonte lista substitutos para ela ainda. Veja outras leveduras de cerveja e seus equivalentes."
    if len(descricao) > 160:
        descricao = descricao[:157].rsplit(" ", 1)[0] + "…"
    titulo = f"{rotulo}: substitutos e equivalentes | Brassagem Forte"
    if len(titulo) > 70:  # nomes longos: sufixo mais curto (o Google corta por volta de 60)
        titulo = f"{rotulo}: substitutos | Brassagem Forte"
    if len(titulo) > 80:
        titulo = f"{rotulo}: substitutos"

    crumbs = [("Ferramentas", ""), ("Substituição de leveduras", FERRAMENTA),
              ("Leveduras", FERRAMENTA + "levedura/"), (rotulo, caminho)]
    pagina = {"@context": "https://schema.org", "@type": "WebPage", "name": titulo, "description": descricao,
              "url": SITE + caminho, "inLanguage": "pt-BR",
              "isPartOf": {"@type": "WebSite", "name": "Ferramentas Brassagem Forte", "url": SITE},
              "author": AUTORES}
    out = [head(titulo, descricao, caminho, raiz, indexar, (breadcrumb(crumbs), pagina))]

    specs = [("Atenuação", B.aten(y)),
             ("Temp.", "%d–%d°C" % tuple(y["temp"]) if y.get("temp") else ""),
             ("Floculação", y.get("floc", ""))]
    specs = [s for s in specs if s[1]]
    tags = "".join(f'<span class="bf-tag">{t}</span>' for t, c in
                   (("Descontinuada", y.get("descontinuada")), ("Blend", y.get("blend")),
                    ("Fora do catálogo", y.get("foraCatalogo"))) if c)
    nao = [B.por_id[i] for i in B.db["naoConfundir"].get(y["id"], []) if i in B.por_id]

    out.append(f'''
  <main>
    <div class="wrap">
      <p class="bf-crumb"><a href="{raiz}">Ferramentas</a> / <a href="../../">01 Leveduras</a> / <a href="../">Todas</a></p>
      <p class="yx-eyebrow">Substitutos para</p>
      <h1 class="bf-title">{e(y['nome'])}</h1>
      <p class="bf-lead">{e(fab)}{(' · ' + e(B.codigo(y))) if B.codigo(y) else ''}{(' · ' + forma) if forma else ''}. {f"{len(rels)} leveduras listadas como equivalentes ou alternativas, com a fonte de cada uma." if rels else "Nenhuma fonte lista substitutos para esta levedura ainda."}</p>

      <article class="yx-base" data-fab="{y['fab']}" aria-label="Levedura">
        <div class="yx-base__top"><span><i class="yx-lab" aria-hidden="true"></i>{e(fab)}{(' · ' + forma.capitalize()) if forma else ''}{tags}</span></div>
        <p class="yx-base__name">{e(y['nome'])}</p>
        {f'<div class="yx-base__code">{e(B.codigo(y))}</div>' if B.codigo(y) else ''}''')
    if specs:
        out.append('\n        <dl class="yx-specs">' + "".join(
            f"<div><dt>{a}</dt><dd>{e(b)}</dd></div>" for a, b in specs) + "</dl>")
    for rot, campo, lang in (("Atenção", "aviso", ""), ("Origem provável", "origem", ""),
                             ("Descrição do fabricante", "descr", ""), ("Nota do Yeast Master", "notaYm", "en"),
                             ("Composição", "notaBlend", "")):
        if y.get(campo):
            txt = f'<em lang="{lang}">{e(y[campo])}</em>' if lang else e(y[campo])
            out.append(f'\n        <p class="yx-base__info"><b>{rot}</b>{txt}</p>')
    if nao:
        out.append('\n        <div class="yx-base__info"><b>Não confunda — não é equivalente a</b><div class="yx-base__not">' +
                   "".join(f'<a href="../{n["id"]}/">{e(B.rotulo(n))}</a>' for n in nao) + "</div></div>")
    acoes = f'<a class="bf-btn yx-base__btn" href="../../?levedura={y["id"]}">Abrir na ferramenta</a>'
    if y.get("url"):
        acoes += f'<a class="bf-btn yx-base__btn" href="{e(y["url"])}" rel="noopener">Site do fabricante ↗</a>'
    out.append(f'\n        <div class="yx-base__actions">{acoes}</div>\n      </article>\n')

    if rels:
        out.append(f'''
      <section class="bf-step" aria-labelledby="l-subs">
        <h2 class="bf-step__label" id="l-subs"><b>02</b> Substitutos ({len(rels)})</h2>''')
        for n in (3, 2, 1):
            grupo = [r for r in rels if r[1] == n]
            if not grupo:
                continue
            out.append(f'\n        <h3 class="yx-group__head yx-nivel-{n}">{meter(n)} {NIVEL[n]}<span class="n">{len(grupo)}</span></h3>')
            for r in grupo:
                a = B.por_id[r[0]]
                nota = r[3] if len(r) > 3 else ""
                spec = []
                if B.aten(a):
                    spec.append(f"<span><em>Aten.</em>{B.aten(a)}</span>")
                if a.get("temp"):
                    spec.append("<span><em>Temp.</em>%d–%d°C</span>" % tuple(a["temp"]))
                if a.get("floc"):
                    spec.append(f"<span><em>Floc.</em>{e(a['floc'])}</span>")
                if a.get("origem"):
                    spec.append(f"<span><em>Origem</em>{e(a['origem'])}</span>")
                atags = ('<span class="bf-tag">Nacional</span>' if B.db["fabricantes"][a["fab"]].get("nacional") else "") + \
                    ('<span class="bf-tag">Descontinuada</span>' if a.get("descontinuada") else "") + \
                    (f'<span class="bf-tag{" bf-tag--solid" if a.get("forma") == "seca" else ""}">{B.forma(a).capitalize()}</span>' if B.forma(a) else "")
                out.append(f'''
        <article class="yx-alt yx-nivel-{n}{' yx-alt--off' if a.get('descontinuada') else ''}" data-fab="{a['fab']}">
          <div class="yx-alt__top"><span><i class="yx-lab" aria-hidden="true"></i>{e(B.fab(a))}</span><span class="yx-alt__tags">{atags}</span></div>
          <div class="yx-alt__name"><a href="../{a['id']}/">{e(a['nome'])}</a>{f'<code>{e(B.codigo(a))}</code>' if B.codigo(a) else ''}</div>
          {f'<div class="yx-alt__specs">{"".join(spec)}</div>' if spec else ''}
          {f'<p class="yx-alt__note">{e(nota)}</p>' if nota else ''}
          <p class="yx-alt__src">Fonte: {", ".join(FONTE.get(f, f) for f in r[2])}</p>
        </article>''')
        out.append("\n      </section>\n")

    out.append(f'''
      <p class="bf-note">Equivalências são aproximadas. A mesma cepa pode se comportar diferente entre fabricantes e lotes. Para filtrar por seca/líquida ou só nacionais, <a href="../../?levedura={y['id']}">abra esta levedura na ferramenta</a>.</p>
    </div>
  </main>''')
    out.append(rodape(B.db["versao"]))
    return "".join(out), indexar


def pagina_indice(B):
    raiz = "../../../"
    caminho = FERRAMENTA + "levedura/"
    titulo = "Todas as leveduras de cerveja: equivalências por fabricante | Brassagem Forte"
    total = len(B.db["leveduras"])
    descricao = (f"Lista de {total} leveduras de cerveja de {len(B.db['fabricantes'])} fabricantes — Fermentis, "
                 "Lallemand, White Labs, Wyeast, Imperial, Levteck e mais — com os substitutos de cada uma.")
    crumbs = [("Ferramentas", ""), ("Substituição de leveduras", FERRAMENTA), ("Leveduras", caminho)]
    out = [head(titulo, descricao, caminho, raiz, True, (breadcrumb(crumbs),))]
    out.append(f'''
  <main>
    <div class="wrap">
      <p class="bf-crumb"><a href="{raiz}">Ferramentas</a> / <a href="../">01 Leveduras</a> / Todas</p>
      <h1 class="bf-title">Todas as leveduras</h1>
      <p class="bf-lead">{total} leveduras de {len(B.db['fabricantes'])} fabricantes. Escolha uma para ver os substitutos, ou <a href="../">use a busca</a>.</p>''')
    por_fab = {}
    for y in B.db["leveduras"]:
        por_fab.setdefault(y["fab"], []).append(y)
    ordem = sorted(por_fab, key=lambda f: B.db["fabricantes"][f]["nome"].lower())
    for i, f in enumerate(ordem):
        nome = B.db["fabricantes"][f]["nome"]
        lista = sorted(por_fab[f], key=lambda y: (norm(B.codigo(y)) or norm(y["nome"])))
        out.append(f'''
      <section class="bf-step yx-indice" data-fab="{f}" aria-labelledby="f-{f}">
        <h2 class="bf-step__label" id="f-{f}"><i class="yx-lab" aria-hidden="true"></i><b>{e(nome)}</b> {len(lista)}</h2>
        <ul>''')
        for y in lista:
            n = len(B.rel(y))
            out.append(f'\n          <li><a href="{y["id"]}/">{e(y["nome"])}</a>'
                       f'{(" <code>" + e(B.codigo(y)) + "</code>") if B.codigo(y) else ""}'
                       f' <small>{n if n else "sem"} substituto{"s" if n != 1 else ""}</small></li>')
        out.append("\n        </ul>\n      </section>")
    out.append('''
    </div>
  </main>''')
    out.append(rodape(B.db["versao"]))
    return "".join(out)


def sitemap(indexaveis, versao):
    urls = [SITE + p for p in PAGINAS_FIXAS] + [SITE + p for p in indexaveis]
    linhas = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        linhas.append(f"  <url><loc>{u}</loc><lastmod>{versao}</lastmod></url>")
    linhas.append("</urlset>")
    return "\n".join(linhas) + "\n"


def versionar(html):
    """?v=<versão do site> nos scripts/estilos/manifest (ver scripts/versionar.py)."""
    txt = open(os.path.join(RAIZ, "assets", "js", "versao.js"), encoding="utf-8").read()
    v = re.search(r'self\.BF_VERSAO = "([0-9.]+)"', txt).group(1)
    return re.sub(r'((?:href|src)=")((?!https?:)[^"?#]+\.(?:js|css|webmanifest))(")', r"\g<1>\g<2>?v=" + v + r"\g<3>", html)


def main():
    db = json.load(open(DADOS, encoding="utf-8"))
    B = Base(db)
    if os.path.isdir(PASTA):
        shutil.rmtree(PASTA)
    os.makedirs(PASTA)
    indexaveis = []
    for y in db["leveduras"]:
        conteudo, indexar = pagina_levedura(B, y)
        destino = os.path.join(PASTA, y["id"])
        os.makedirs(destino)
        with open(os.path.join(destino, "index.html"), "w", encoding="utf-8") as f:
            f.write(versionar(conteudo))
        if indexar:
            indexaveis.append(f"{FERRAMENTA}levedura/{y['id']}/")
    with open(os.path.join(PASTA, "index.html"), "w", encoding="utf-8") as f:
        f.write(versionar(pagina_indice(B)))
    with open(os.path.join(RAIZ, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap(indexaveis, db["versao"]))
    print("%d páginas de levedura (%d indexáveis) + índice + sitemap.xml" % (len(db["leveduras"]), len(indexaveis)))


if __name__ == "__main__":
    main()
