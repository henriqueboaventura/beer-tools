// SEO: metadados de todas as páginas, sitemap, páginas geradas de levedura e ícones.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8");
const existe = (p) => fs.existsSync(path.join(RAIZ, p));
const SITE = ler("scripts/gerar_seo.py").match(/^SITE = "([^"]+)"/m)[1];
const LEV = "ferramentas/substituicao-leveduras/levedura";
const DB = JSON.parse(ler("ferramentas/substituicao-leveduras/data/leveduras.json"));

function todasPaginas(dir = "") {
  const ignorar = new Set([".git", "node_modules", "examples", "docs", "tests", "dados", "scripts", ".github"]);
  let out = [];
  for (const nome of fs.readdirSync(path.join(RAIZ, dir))) {
    if (ignorar.has(nome)) continue;
    const rel = path.join(dir, nome);
    if (fs.statSync(path.join(RAIZ, rel)).isDirectory()) out = out.concat(todasPaginas(rel));
    else if (nome.endsWith(".html")) out.push(rel.split(path.sep).join("/"));
  }
  return out;
}

// caminho do arquivo -> URL canônica esperada
function urlDe(pagina) {
  return SITE + pagina.replace(/(^|\/)index\.html$/, "$1");
}
const decodificar = (s) => s && s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const meta = (html, re) => { const m = html.match(re); return m && decodificar(m[1]); };
const noindex = (html) => /<meta name="robots" content="noindex/.test(html);

const PAGINAS = todasPaginas().filter((p) => p !== "404.html");
const INFO = PAGINAS.map((p) => {
  const html = ler(p);
  return {
    pagina: p,
    html,
    titulo: meta(html, /<title>([^<]+)<\/title>/),
    descricao: meta(html, /<meta name="description" content="([^"]+)">/),
    canonical: meta(html, /<link rel="canonical" href="([^"]+)">/),
    indexavel: !noindex(html),
  };
});

describe("metadados de todas as páginas", () => {
  test(`encontrou as páginas (${PAGINAS.length})`, () => assert.ok(PAGINAS.length > 400));

  test("título, descrição e canonical presentes; canonical = endereço real da página", () => {
    for (const i of INFO) {
      assert.ok(i.titulo && i.titulo.length >= 15 && i.titulo.length <= 90, `${i.pagina}: título "${i.titulo}"`);
      assert.ok(i.descricao && i.descricao.length >= 50 && i.descricao.length <= 170, `${i.pagina}: descrição com ${i.descricao && i.descricao.length} caracteres`);
      assert.equal(i.canonical, urlDe(i.pagina), `${i.pagina}: canonical`);
    }
  });

  test("títulos únicos entre as páginas indexáveis", () => {
    const vistos = new Map();
    for (const i of INFO.filter((x) => x.indexavel)) {
      assert.ok(!vistos.has(i.titulo), `título repetido em ${i.pagina} e ${vistos.get(i.titulo)}: "${i.titulo}"`);
      vistos.set(i.titulo, i.pagina);
    }
  });

  test("Open Graph e Twitter: título, descrição, url = canonical, imagem que existe", () => {
    for (const i of INFO) {
      const h = i.html;
      assert.equal(meta(h, /<meta property="og:url" content="([^"]+)">/), i.canonical, `${i.pagina}: og:url`);
      assert.ok(meta(h, /<meta property="og:title" content="([^"]+)">/), `${i.pagina}: og:title`);
      assert.ok(meta(h, /<meta property="og:description" content="([^"]+)">/), `${i.pagina}: og:description`);
      assert.match(h, /<meta property="og:locale" content="pt_BR">/, i.pagina);
      assert.match(h, /<meta name="twitter:card" content="summary_large_image">/, i.pagina);
      const img = meta(h, /<meta property="og:image" content="([^"]+)">/);
      assert.ok(img && img.startsWith(SITE) && existe(img.slice(SITE.length)), `${i.pagina}: og:image ${img}`);
    }
  });

  test("exatamente um <h1> por página", () => {
    for (const i of INFO) assert.equal((i.html.match(/<h1[\s>]/g) || []).length, 1, i.pagina);
  });

  test("JSON-LD válido (quando presente) e com @context schema.org", () => {
    for (const i of INFO) {
      for (const m of i.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        const obj = JSON.parse(m[1]);
        assert.equal(obj["@context"], "https://schema.org", i.pagina);
      }
    }
  });

  test("favicon (svg e ico) e apple-touch-icon em todas as páginas", () => {
    for (const i of INFO) {
      assert.match(i.html, /<link rel="icon" href="[^"]*favicon\.ico" sizes="32x32">/, i.pagina);
      assert.match(i.html, /<link rel="icon" href="[^"]*favicon\.svg" type="image\/svg\+xml">/, i.pagina);
      assert.match(i.html, /<link rel="apple-touch-icon" href="[^"]*icon-180\.png">/, i.pagina);
    }
  });

  test("404.html não é indexada", () => {
    assert.ok(noindex(ler("404.html")));
  });
});

describe("sitemap.xml", () => {
  const locs = [...ler("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  test("XML com namespace de sitemap e sem URL repetida", () => {
    assert.match(ler("sitemap.xml"), /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.equal(new Set(locs).size, locs.length);
  });

  test("contém exatamente as páginas indexáveis (pelo canonical)", () => {
    const esperado = INFO.filter((i) => i.indexavel).map((i) => i.canonical).sort();
    assert.deepEqual([...locs].sort(), esperado);
  });
});

describe("páginas geradas de levedura", () => {
  const dirs = fs.readdirSync(path.join(RAIZ, LEV)).filter((n) => fs.statSync(path.join(RAIZ, LEV, n)).isDirectory());

  test("uma página por levedura, nem mais nem menos (rode scripts/gerar_seo.py)", () => {
    assert.deepEqual(dirs.sort(), DB.leveduras.map((y) => y.id).sort());
  });

  test("cada página lista todos os substitutos do JSON; sem substituto = noindex", () => {
    for (const y of DB.leveduras) {
      const html = ler(`${LEV}/${y.id}/index.html`);
      const n = (DB.relacoes[y.id] || []).length;
      assert.equal((html.match(/<article class="yx-alt /g) || []).length, n, y.id);
      assert.equal(noindex(html), n === 0, `${y.id}: noindex deveria ser ${n === 0}`);
    }
  });

  test("links internos das páginas geradas apontam para arquivos que existem", () => {
    const paginas = ["index.html", ...dirs.map((d) => `${d}/index.html`)];
    for (const p of paginas) {
      const dir = path.dirname(path.join(LEV, p));
      const html = ler(path.join(LEV, p));
      for (const [, ref] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (/^(https?:|mailto:|#)/.test(ref)) continue;
        let alvo = path.normalize(path.join(dir, ref.split(/[?#]/)[0]));
        if (ref.split(/[?#]/)[0].endsWith("/") || ref.startsWith("?")) alvo = path.join(alvo, "index.html");
        assert.ok(existe(alvo), `${LEV}/${p}: ${ref}`);
      }
    }
  });

  test("índice de leveduras lista todas", () => {
    const html = ler(`${LEV}/index.html`);
    for (const y of DB.leveduras) assert.ok(html.includes(`href="${y.id}/"`), y.id);
  });
});

describe("rastreabilidade", () => {
  test("a página inicial lista todas as ferramentas do registro em HTML estático (sem depender de JS)", () => {
    const shell = ler("assets/js/shell.js");
    const bloco = shell.slice(shell.indexOf("var FERRAMENTAS"), shell.indexOf("];", shell.indexOf("var FERRAMENTAS")));
    const slugs = [...bloco.matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]);
    const home = ler("index.html");
    for (const s of slugs) assert.ok(home.includes(`href="ferramentas/${s}/"`), `home sem link estático para ${s}`);
  });

  test("a ferramenta de leveduras tem link estático para o índice de todas as leveduras", () => {
    assert.match(ler("ferramentas/substituicao-leveduras/index.html"), /<a href="levedura\/">/);
  });
});
