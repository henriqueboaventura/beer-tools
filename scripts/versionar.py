#!/usr/bin/env python3
"""Põe ?v=<versão do site> em todo script, estilo e manifest locais das páginas.

Versão nova = endereços novos: nenhum cache (CDN da Hostinger, navegador)
consegue entregar um arquivo antigo depois de uma publicação. A versão vem de
assets/js/versao.js. Rode depois de subir a versão:

  python3 scripts/versionar.py

Também regenera as páginas de levedura (scripts/gerar_seo.py), que usam a
mesma versão. Os testes falham se algum ?v= ficar desatualizado.
"""
import os
import re
import runpy

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://www.brassagemforte.com.br/ferramentas/"
# páginas escritas à mão (as de levedura são geradas pelo gerar_seo.py)
PAGINAS = ["index.html", "404.html", "ferramentas/substituicao-leveduras/index.html",
           "ferramentas/decoccao/index.html", "ferramentas/decoccao/sobre.html",
           "ferramentas/speise/index.html", "ferramentas/parti-gyle/index.html"]
REF = re.compile(r'((?:href|src)=")([^"?#]+\.(?:js|css|webmanifest))(?:\?v=[^"]*)?(")')


def versao():
    txt = open(os.path.join(RAIZ, "assets", "js", "versao.js"), encoding="utf-8").read()
    return re.search(r'self\.BF_VERSAO = "([0-9.]+)"', txt).group(1)


def versionar_html(html, v):
    def troca(m):
        url = m.group(2)
        if re.match(r"https?:", url) and not url.startswith(SITE):
            return m.group(0)  # recurso externo (fontes do Google etc.)
        return f"{m.group(1)}{url}?v={v}{m.group(3)}"
    return REF.sub(troca, html)


def main():
    v = versao()
    for p in PAGINAS:
        caminho = os.path.join(RAIZ, p)
        html = open(caminho, encoding="utf-8").read()
        novo = versionar_html(html, v)
        if novo != html:
            open(caminho, "w", encoding="utf-8").write(novo)
    runpy.run_path(os.path.join(RAIZ, "scripts", "gerar_seo.py"), run_name="__main__")
    print("?v=%s aplicado" % v)


if __name__ == "__main__":
    main()
