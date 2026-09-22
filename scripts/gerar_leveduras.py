#!/usr/bin/env python3
"""Gera ferramentas/substituicao-leveduras/data/leveduras.json a partir das fontes.

Fontes, em ordem de prioridade:
  1. Yeast Master (David M. Taylor) — examples/*.xlsx
  2. AEB Brewing Yeast Substitution Guide — dados/leveduras/aeb.json (transcrito)
  3. Imperial Yeast Strain Cross Reference — dados/leveduras/imperial.json (transcrito)
  4. Curadoria Brassagem Forte (Levteck, Smartyeast; revisada) e inferências por nome (Bio4; não revisadas)
     — dados/leveduras/nacionais.json

Só usa a biblioteca padrão do Python. Uso:
  python3 scripts/gerar_leveduras.py
"""
import datetime
import glob
import json
import os
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, "dados", "leveduras")
SAIDA = os.path.join(RAIZ, "ferramentas", "substituicao-leveduras", "data", "leveduras.json")

FABRICANTES = {
    "fermentis": ("Fermentis", "seca"),
    "lallemand": ("Lallemand", "seca"),
    "mangrove-jacks": ("Mangrove Jack's", "seca"),
    "cellarscience": ("CellarScience", "seca"),
    "aeb": ("AEB", "seca"),
    "white-labs": ("White Labs", "liquida"),
    "wyeast": ("Wyeast", "liquida"),
    "imperial": ("Imperial", "liquida"),
    "omega": ("Omega", "liquida"),
    "escarpment": ("Escarpment Labs", "liquida"),
    "levteck": ("Levteck", "liquida"),
    "bio4": ("Bio4", "liquida"),
    "smartyeast": ("Smartyeast", "liquida"),
    "mauribrew": ("Mauribrew", "seca"),
    "brewferm": ("Brewferm", "seca"),
    "coopers": ("Coopers", "seca"),
    "muntons": ("Muntons", "seca"),
    "edme": ("EDME", "seca"),
    "whc": ("WHC Lab", "liquida"),
    "outros": ("Outros", None),
}
NACIONAIS = {"levteck", "bio4", "smartyeast"}
# fabricantes cujo "código" é só o nome — não mostramos código separado
SEM_CODIGO = {"aeb", "lallemand", "cellarscience", "escarpment", "mauribrew", "brewferm", "coopers", "muntons", "edme", "whc", "outros"}

# nomes da Lallemand como aparecem na planilha -> código canônico
LALLEMAND = {
    "BRY-97 AMERICAN WEST COAST ALE": "BRY-97", "BRY-97": "BRY-97",
    "NOTTINGHAM ALE": "NOTTINGHAM", "NOTTINGHAM": "NOTTINGHAM",
    "VERDANT IPA": "VERDANT IPA", "VERDANT": "VERDANT IPA",
    "NEW ENGLAND": "NEW ENGLAND",
    "ABBAYE ALE": "ABBAYE", "ABBAYE": "ABBAYE",
    "BELLE SAISON ALE": "BELLE SAISON",
    "WINDSOR ALE": "WINDSOR", "WINDSOR": "WINDSOR",
    "LONDON ESB ALE": "LONDON",
    "DIAMOND LAGER": "DIAMOND",
    "NOVALAGER": "NOVALAGER",
    "VOSS KVEIK ALE": "VOSS",
    "KOLN KOLSCH-STYLE ALE": "KOLN",
    "WIT-STYLE ALE (WAS: MUNICH)": "WIT",
    "MUNICH CLASSIC": "MUNICH CLASSIC",
    "REGULAR": "MUNICH",
    "HOUSE ALE": "HOUSE ALE",
    "FARMHOUSE": "FARMHOUSE",
}
NOMES_LALLEMAND = {
    "BRY-97": "LalBrew BRY-97", "NOTTINGHAM": "LalBrew Nottingham", "VERDANT IPA": "LalBrew Verdant IPA",
    "NEW ENGLAND": "LalBrew New England", "ABBAYE": "LalBrew Abbaye", "BELLE SAISON": "LalBrew Belle Saison",
    "WINDSOR": "LalBrew Windsor", "LONDON": "LalBrew London (ESB)", "DIAMOND": "LalBrew Diamond Lager",
    "NOVALAGER": "LalBrew NovaLager", "VOSS": "LalBrew Voss Kveik", "KOLN": "LalBrew Köln (Kölsch)",
    "WIT": "LalBrew Wit", "MUNICH CLASSIC": "LalBrew Munich Classic", "MUNICH": "LalBrew Munich (antiga)",
    "HOUSE ALE": "House Ale", "FARMHOUSE": "LalBrew Farmhouse", "CBC-1": "LalBrew CBC-1",
    "PHILLY SOUR": "WildBrew Philly Sour",
}
OUTRAS_MARCAS = [
    ("CellarScience ", "cellarscience"), ("Mauribrew ", "mauribrew"), ("Brewferm ", "brewferm"),
    ("Coopers ", "coopers"), ("Munton's ", "muntons"), ("EDME ", "edme"), ("WHC ", "whc"),
]

CATEGORIAS = [
    ("ale", "Ale"), ("lager", "Lager"), ("trigo", "Trigo"), ("belga", "Belga / Saison"),
    ("kveik", "Kveik"), ("outras", "Outras"),
]


def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def chave(fab, codigo):
    return fab + ":" + re.sub(r"[^A-Z0-9]", "", sem_acento(codigo).upper())


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", sem_acento(s).lower()).strip("-")


def avisar(msg):
    print("aviso:", msg, file=sys.stderr)


# ---------------------------------------------------------------- leveduras

class Base:
    def __init__(self):
        self.lev = {}      # chave -> dict
        self.pares = {}    # (a, b) ordenado -> lista de evidências

    def add(self, fab, codigo, nome=None, **extra):
        k = chave(fab, codigo)
        y = self.lev.get(k)
        if y is None:
            y = {"k": k, "fab": fab, "codigo": codigo, "nome": None, "fontes": set()}
            self.lev[k] = y
        if nome and not y["nome"]:
            y["nome"] = nome
        for campo, valor in extra.items():
            if valor in (None, "", [], False):
                continue
            if campo == "fonte":
                y["fontes"].add(valor)
            elif campo not in y:
                y[campo] = valor
        return k

    def ref(self, texto, fonte):
        """'fab:CÓDIGO' ou 'fab:CÓDIGO|Nome' -> chave."""
        fab, resto = texto.split(":", 1)
        codigo, _, nome = resto.partition("|")
        if fab not in FABRICANTES:
            raise SystemExit("fabricante desconhecido: " + texto)
        return self.add(fab, codigo, nome or None, fonte=fonte)

    def evid(self, a, b, tipo, fonte, nota=None):
        if a == b:
            return
        par = tuple(sorted((a, b)))
        self.pares.setdefault(par, []).append({"tipo": tipo, "fonte": fonte, "nota": nota})


# ---------------------------------------------------------------- planilha

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def ler_xlsx(caminho):
    z = zipfile.ZipFile(caminho)
    st = ET.fromstring(z.read("xl/styles.xml"))
    fonts = list(st.find(NS + "fonts"))
    fills = list(st.find(NS + "fills"))
    xfs = list(st.find(NS + "cellXfs"))
    strings = []
    for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(NS + "si"):
        strings.append("".join(t.text or "" for t in si.iter(NS + "t")))

    def col(ref):
        n = 0
        for ch in re.match(r"[A-Z]+", ref).group():
            n = n * 26 + ord(ch) - 64
        return n - 1

    linhas = []
    for row in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).iter(NS + "row"):
        celulas = {}
        for c in row.findall(NS + "c"):
            v = c.find(NS + "v")
            if v is None:
                continue
            xf = xfs[int(c.get("s", "0"))]
            fg = fills[int(xf.get("fillId", "0"))].find(NS + "patternFill/" + NS + "fgColor")
            texto = strings[int(v.text)] if c.get("t") == "s" else v.text
            texto = (texto or "").strip()
            if not texto:
                continue
            celulas[col(c.get("r"))] = {
                "t": texto,
                "amarelo": fg is not None and fg.get("rgb") == "FFFFFF00",
                "tachado": fonts[int(xf.get("fontId", "0"))].find(NS + "strike") is not None,
            }
        linhas.append(celulas)
    return linhas


COLUNAS_YM = {0: "lallemand", 1: "fermentis", 2: "mangrove-jacks", 3: "white-labs", 4: "wyeast",
              7: "imperial", 8: "omega", 9: "escarpment", 10: "outros"}


def interpretar(fab, p):
    """Texto de uma levedura numa coluna da planilha -> (fab, código, nome) ou None."""
    p = p.strip().strip('"').strip()
    if fab == "white-labs":
        m = re.search(r"WLP\s?(\d+)(.*)", p)
        return m and ("white-labs", "WLP%03d" % int(m.group(1)), m.group(2).strip(" -\"") or None)
    if fab == "wyeast":
        m = re.match(r"(\d{4})\b(.*)", p)
        return m and ("wyeast", m.group(1), m.group(2).strip() or None)
    if fab == "imperial":
        m = re.match(r"([A-Z]\d{2})\b(.*)", p)
        return m and ("imperial", m.group(1), m.group(2).strip() or None)
    if fab == "omega":
        m = re.search(r"OYL-(\d{3})(.*)", p)
        return m and ("omega", "OYL-" + m.group(1), m.group(2).strip() or None)
    if fab == "mangrove-jacks":
        m = re.match(r"(M\d{2})\b(.*)", p)
        return m and ("mangrove-jacks", m.group(1), m.group(2).strip() or None)
    if fab == "fermentis":
        m = re.match(r"(?:(Saf(?:Ale|Lager))\s+)?([A-Z]{1,2}-\d+(?:/\d+)?)$", p)
        return m and ("fermentis", m.group(2), "%s %s" % (m.group(1), m.group(2)) if m.group(1) else None)
    if fab == "lallemand":
        codigo = LALLEMAND.get(sem_acento(p).upper())
        if not codigo:
            avisar("Lallemand sem mapeamento: %r" % p)
            return None
        return ("lallemand", codigo, NOMES_LALLEMAND.get(codigo))
    if fab == "escarpment":
        if re.fullmatch(r"\d+", p):  # ex.: "3470" — não é um produto Escarpment
            avisar("Escarpment ignorado: %r" % p)
            return None
        nome = re.sub(r"\s*\(EL-D1\)", "", p).split("/")[0].strip()
        return ("escarpment", nome, nome)
    if fab == "outros":
        for prefixo, marca in OUTRAS_MARCAS:
            if p.startswith(prefixo):
                nome = p[len(prefixo):].strip().strip('"')
                return (marca, nome, nome)
        return ("outros", p, p)
    return None


def partes_celula(fab, cel):
    """Uma célula -> lista de dicts {fab, codigo, nome, incerta, nao, tachada, nota, blend}."""
    t = cel["t"]
    if "NO equivalent" in t:
        return []
    nao = t.startswith("(NOT")
    if nao:
        t = t[4:].rstrip(")").strip()
        pedacos = re.split(r"\s+(?:or|OR)\s+", t)
    elif fab == "white-labs":
        pedacos = t.split(" / ")
    elif fab in ("escarpment", "outros"):
        pedacos = t.split(", ")
    else:
        pedacos = [t]
    out = []
    for p in pedacos:
        incerta = cel["amarelo"] or p.rstrip().endswith("?") or "?" in p.split("=")[0]
        p = p.strip().rstrip("?").strip()
        nota, blend = None, False
        if "=" in p:
            esq, dir_ = p.split("=", 1)
            blend = "+" in dir_ or "+" in esq
            nota = p
            if fab == "lallemand" and blend:  # fórmula de blend de outro fabricante
                continue
            p = dir_ if "+" in esq else esq
            p = p.split("?")[0]
        r = interpretar(fab, p)
        if not r:
            continue
        out.append({"fab": r[0], "codigo": r[1], "nome": r[2], "incerta": incerta, "nao": nao,
                    "tachada": cel["tachado"], "nota": nota, "blend": blend})
    return out


def atributos_ym(texto):
    attrs = {}
    m = re.search(r"(\d{2})%\s*atten", texto)
    if m:
        attrs["atenYm"] = int(m.group(1))
    if re.search(r"\bhi floc\b", texto):
        attrs["floc"] = "alta"
    return attrs


def categoria(codigos, texto):
    t = texto.lower()
    for fab, cod in codigos:
        if fab == "white-labs":
            n = int(cod[3:])
            if n in (520, 521):
                return "kveik"
            if n < 100:
                return "ale"
            if n < 400:
                return "trigo"
            if n < 600:
                return "belga"
            if n < 800:
                return "outras"
            return "lager"
    for fab, cod in codigos:
        if fab == "wyeast":
            n = int(cod)
            if n in (1010, 3068, 3333, 3638, 3056):
                return "trigo"
            if n in (2565, 2575):
                return "ale"
            return "ale" if n < 2000 else "lager" if n < 3000 else "belga"
    for fab, cod in codigos:
        if fab == "imperial":
            if cod in ("A43", "A44", "A46"):
                return "kveik"
            if cod == "G01":
                return "trigo"
            return {"A": "ale", "B": "belga", "G": "ale", "L": "lager"}.get(cod[0], "outras")
    if "kveik" in t or "voss" in t or "hornindal" in t:
        return "kveik"
    if "lager" in t or "pils" in t:
        return "lager"
    if re.search(r"wheat|weizen|weiss|hefe", t):
        return "trigo"
    if re.search(r"saison|belg|abbey|abbaye|trapp|wit|monk|tripel|farmhouse", t):
        return "belga"
    if re.search(r"sour|acid|brett", t):
        return "outras"
    return "ale"


def carregar_ym(base, caminho):
    linhas = ler_xlsx(caminho)
    inicio = next(i for i, l in enumerate(linhas) if l.get(0, {}).get("t") == "Lallemand") + 1
    fim = next(i for i, l in enumerate(linhas) if l.get(1, {}).get("t") == "Legend:")
    grupos = []
    for celulas in linhas[inicio:fim]:
        nota = celulas.get(6, {}).get("t", "")
        membros, naos = [], []
        for c, fab in COLUNAS_YM.items():
            if c not in celulas:
                continue
            for p in partes_celula(fab, celulas[c]):
                k = base.add(p["fab"], p["codigo"], p["nome"], fonte="ym")
                if p["nao"]:
                    if not p["incerta"]:
                        naos.append(k)
                    continue
                y = base.lev[k]
                if p["tachada"]:
                    y["descontinuada"] = True
                if p["blend"]:
                    y["blend"] = True
                    y.setdefault("notaBlend", p["nota"])
                if p["incerta"] or p["blend"]:
                    membros.append((k, True, p["blend"]))
                else:
                    membros.append((k, False, False))
        codigos = [(base.lev[k]["fab"], base.lev[k]["codigo"]) for k, _, _ in membros]
        cat = categoria(codigos, nota + " " + " ".join(base.lev[k]["nome"] or "" for k, _, _ in membros))
        attrs = atributos_ym(nota)
        for k, incerta, blend in membros:
            y = base.lev[k]
            if not incerta:
                y.setdefault("notaYm", nota or None)
                for a, v in attrs.items():
                    y.setdefault(a, v)
            y.setdefault("cat", cat)
        for i, (a, ia, ba) in enumerate(membros):
            for b, ib, bb in membros[i + 1:]:
                if ba or bb:
                    continue
                base.evid(a, b, "eq?" if (ia or ib) else "eq", "ym")
            for n in naos:
                base.evid(a, n, "nao", "ym")
        grupos.append([k for k, incerta, _ in membros if not incerta])
    return grupos


def carregar_aeb(base):
    dados = json.load(open(os.path.join(DADOS, "aeb.json"), encoding="utf-8"))
    for linha in dados["linhas"]:
        p = base.ref(linha["produto"], "aeb")
        base.lev[p].setdefault("origem", linha["origem"])
        eq = [p] + [base.ref(r, "aeb") for r in linha["eq"]]
        alt = [base.ref(r, "aeb") for r in linha["alt"]]
        for i, a in enumerate(eq):
            for b in eq[i + 1:]:
                base.evid(a, b, "eq", "aeb")
            for b in alt:
                base.evid(a, b, "alt", "aeb")


def carregar_imperial(base):
    dados = json.load(open(os.path.join(DADOS, "imperial.json"), encoding="utf-8"))
    for linha in dados["linhas"]:
        p = base.ref("imperial:" + linha["imperial"], "imperial")
        y = base.lev[p]
        y["origem"] = linha["origem"]  # a Imperial é a fonte da origem das próprias cepas
        if linha.get("blend"):
            y["blend"] = True
        membros = [p] + [base.ref(r, "imperial") for r in linha["eq"]]
        for i, a in enumerate(membros):
            for b in membros[i + 1:]:
                base.evid(a, b, "eq", "imperial")


def carregar_nacionais(base):
    dados = json.load(open(os.path.join(DADOS, "nacionais.json"), encoding="utf-8"))
    inferidas = []
    for item in dados["leveduras"]:
        k = base.ref(item["ref"], "curadoria")
        y = base.lev[k]
        for campo in ("codigo", "temp", "aten", "floc", "descr", "url", "origem", "cat", "blend", "foraCatalogo", "aviso"):
            if campo in item:
                y["codigoExibido" if campo == "codigo" else campo] = item[campo]
        # substitutas indicadas pelo próprio fabricante: estilo parecido, não necessariamente mesma cepa
        for r in item.get("fabricante", []):
            base.evid(k, base.ref(r, item["ref"].split(":")[0]), "alt", item["ref"].split(":")[0])
        for fonte in ("curadoria", "inferida"):
            for inf in item.get(fonte, []):
                alvo = base.ref(inf["ref"], fonte)
                inferidas.append((k, alvo, inf["motivo"], fonte))
    return dados["fabricantes"], inferidas


# ---------------------------------------------------------------- relações

def rotulo(y):
    """'Wyeast 1318', 'Levteck TeckBrew 06', 'Lallemand LalBrew Verdant IPA'."""
    fab = FABRICANTES[y["fab"]][0]
    if y.get("codigoExibido"):
        return "%s %s" % (fab, y["codigoExibido"])
    if y["fab"] in SEM_CODIGO or y["fab"] in NACIONAIS:
        return "%s %s" % (fab, y["nome"] or y["codigo"])
    return "%s %s" % (fab, y["codigo"])


def resolver(base, grupos_ym, inferidas):
    # equivalências fortes do Yeast Master, para propagar os "NOT"
    eq_ym = {}
    for (a, b), evs in base.pares.items():
        if any(e["tipo"] == "eq" and e["fonte"] == "ym" for e in evs):
            eq_ym.setdefault(a, set()).add(b)
            eq_ym.setdefault(b, set()).add(a)
    nao = set()
    for (a, b), evs in base.pares.items():
        if any(e["tipo"] == "nao" for e in evs):
            for x in {a} | eq_ym.get(a, set()):
                for y in {b} | eq_ym.get(b, set()):
                    if x != y:
                        nao.add(tuple(sorted((x, y))))

    NOMES = {"ym": "Yeast Master", "aeb": "AEB", "imperial": "Imperial", "levteck": "Levteck"}
    rel = {}

    def ligar(a, b, nivel, fontes, nota=None, inferida=False):
        for x, y in ((a, b), (b, a)):
            atual = rel.setdefault(x, {}).get(y)
            if atual is None or nivel > atual["nivel"]:
                anteriores = atual["fontes"] if atual else []
                rel[x][y] = {"nivel": nivel, "fontes": sorted(set(fontes) | set(anteriores)), "nota": nota, "inferida": inferida}
            else:  # mesmo par com nível menor ou igual: só soma a fonte
                atual["fontes"] = sorted(set(atual["fontes"]) | set(fontes))

    for par, evs in base.pares.items():
        a, b = par
        eq = sorted({e["fonte"] for e in evs if e["tipo"] == "eq"})
        prov = sorted({e["fonte"] for e in evs if e["tipo"] == "eq?"})
        alt = sorted({e["fonte"] for e in evs if e["tipo"] == "alt"})
        if par in nao:
            outros = [f for f in eq + prov if f != "ym"]
            if outros:
                ligar(a, b, 1, outros + ["ym"],
                      "%s %s como equivalente, mas o Yeast Master indica que são cepas diferentes."
                      % (" e ".join(NOMES[f] for f in outros), "listam" if len(outros) > 1 else "lista"))
            continue
        if eq:
            ligar(a, b, 3, eq)
        elif prov:
            ligar(a, b, 2, prov, "O Yeast Master marca esta equivalência como incerta.")
        elif alt:
            ligar(a, b, 1, alt, "A Levteck indica como substituta na tabela do fabricante (estilo parecido; não necessariamente a mesma cepa)."
                  if alt == ["levteck"] else None)

    # curadoria/inferências: ligam ao alvo e às equivalentes fortes do alvo
    for n, alvo, motivo, fonte in inferidas:
        alvos = [(alvo, motivo)]
        # vínculo incerto não se propaga para as equivalentes do alvo
        for outro, r in ([] if motivo.startswith("Incerta") else list(rel.get(alvo, {}).items())):
            if r["nivel"] == 3 and outro != n:
                alvos.append((outro, "%s foi associada à %s, que é equivalente à %s."
                              % (rotulo(base.lev[n]), rotulo(base.lev[alvo]), rotulo(base.lev[outro]))))
        for t, m in alvos:
            if tuple(sorted((n, t))) in nao:
                continue
            if t in rel.get(n, {}) and rel[n][t]["nivel"] >= 2:
                continue
            ligar(n, t, 2, [fonte], m, inferida=True)

    nao_por = {}
    for a, b in nao:
        if b not in rel.get(a, {}):
            nao_por.setdefault(a, set()).add(b)
            nao_por.setdefault(b, set()).add(a)
    return rel, nao_por


# ---------------------------------------------------------------- saída

def main():
    base = Base()
    xlsx = glob.glob(os.path.join(RAIZ, "examples", "YEAST MASTER*.xlsx"))
    if not xlsx:
        raise SystemExit("planilha Yeast Master não encontrada em examples/")
    grupos = carregar_ym(base, xlsx[0])
    carregar_aeb(base)
    carregar_imperial(base)
    fab_nacionais, inferidas = carregar_nacionais(base)
    rel, nao = resolver(base, grupos, inferidas)

    ids = {}
    for k, y in base.lev.items():
        ids[k] = slug(y["fab"] + "-" + y["codigo"])
    if len(set(ids.values())) != len(ids):
        raise SystemExit("ids duplicados")

    leveduras = []
    for k, y in sorted(base.lev.items(), key=lambda kv: (kv[1]["fab"], kv[1]["codigo"])):
        nome_fab, forma = FABRICANTES[y["fab"]]
        nome = y["nome"] or y["codigo"]
        if y["fab"] == "fermentis" and not y["nome"]:
            nome = y["codigo"]
        item = {
            "id": ids[k],
            "fab": y["fab"],
            "nome": nome,
            "forma": forma,
            "cat": y.get("cat") or categoria([(y["fab"], y["codigo"])] if y["fab"] in ("white-labs", "wyeast", "imperial") else [], nome),
        }
        if y.get("codigoExibido"):
            item["codigo"] = y["codigoExibido"]
        elif y["fab"] not in SEM_CODIGO and y["fab"] not in NACIONAIS:
            item["codigo"] = y["codigo"]
        for campo in ("origem", "temp", "aten", "atenYm", "floc", "descr", "notaYm", "url", "descontinuada", "blend", "notaBlend",
                      "foraCatalogo", "aviso"):
            if y.get(campo):
                item[campo] = y[campo]
        item["fontes"] = sorted(y["fontes"])
        leveduras.append(item)

    saida = {
        "versao": datetime.date.today().isoformat(),
        "fontes": {
            "ym": {"nome": "Yeast Master", "autor": "David M. Taylor", "url": "http://tinyurl.com/yeastmaster",
                   "descricao": "Tabela de equivalências mantida pela comunidade (atualizada em 19/09/2026)."},
            "aeb": {"nome": "AEB Brewing Yeast Substitution Guide v.5", "autor": "AEB", "url": "https://www.aeb-group.com/beer",
                    "descricao": "Guia de substituição do fabricante AEB."},
            "imperial": {"nome": "Imperial Yeast Strain Cross Reference Guide", "autor": "Imperial Yeast",
                         "url": "https://www.imperialyeast.com/", "descricao": "Tabela de referência cruzada da Imperial."},
            "curadoria": {"nome": "Curadoria Brassagem Forte", "autor": "Brassagem Forte",
                          "descricao": "Leveduras nacionais (Levteck, Smartyeast) associadas pela Brassagem Forte comparando fichas técnicas. Não é declaração do fabricante."},
            "levteck": {"nome": "Tabela de substituição Levteck", "autor": "Levteck (fabricante)",
                        "descricao": "Substitutas indicadas pelo próprio fabricante para cada TeckBrew. Indicam estilo parecido, não necessariamente a mesma cepa."},
            "inferida": {"nome": "Inferências não revisadas", "autor": "Brassagem Forte",
                         "descricao": "Vínculos deduzidos só pelo nome do produto (Bio4). Ainda não revisados — use com cautela."},
        },
        "fabricantes": {f: {"nome": n, **({"forma": fo} if fo else {}), **({"nacional": True} if f in NACIONAIS else {}),
                            **fab_nacionais.get(f, {})}
                        for f, (n, fo) in FABRICANTES.items() if any(l["fab"] == f for l in leveduras)},
        "categorias": [{"id": c, "nome": n} for c, n in CATEGORIAS],
        "leveduras": leveduras,
        "relacoes": {ids[a]: [[ids[b], r["nivel"], r["fontes"]] + ([r["nota"]] if r["nota"] else [])
                              for b, r in sorted(outros.items(), key=lambda kv: -kv[1]["nivel"])]
                     for a, outros in rel.items()},
        "naoConfundir": {ids[a]: sorted(ids[b] for b in bs) for a, bs in nao.items()},
    }
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
    n_rel = sum(len(v) for v in saida["relacoes"].values()) // 2
    print("%d leveduras, %d relações, %d fabricantes -> %s" % (len(leveduras), n_rel, len(saida["fabricantes"]),
                                                             os.path.relpath(SAIDA, RAIZ)))


if __name__ == "__main__":
    main()
