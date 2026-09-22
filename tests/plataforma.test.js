// Testes da plataforma: shell, páginas, PWA e versionamento.
// Rodam com o runner nativo do Node (node:test), sem dependências.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8");
const existe = (p) => fs.existsSync(path.join(RAIZ, p));

// Todas as páginas HTML publicadas (fora de pastas de ferramentas de dev).
function paginas(dir = "") {
  const ignorar = new Set([".git", "node_modules", "examples", "docs", "tests", "dados", "scripts", ".github"]);
  let out = [];
  for (const nome of fs.readdirSync(path.join(RAIZ, dir))) {
    if (ignorar.has(nome)) continue;
    const rel = path.join(dir, nome);
    const st = fs.statSync(path.join(RAIZ, rel));
    if (st.isDirectory()) out = out.concat(paginas(rel));
    else if (nome.endsWith(".html")) out.push(rel);
  }
  return out;
}

// Versão mais recente de um CHANGELOG ("## [1.2.3] — data").
function versaoChangelog(arquivo) {
  const m = ler(arquivo).match(/^## \[(\d+\.\d+\.\d+)\]/m);
  return m && m[1];
}

describe("registro de ferramentas (shell.js)", () => {
  const shell = ler("assets/js/shell.js");
  const bloco = shell.slice(shell.indexOf("var FERRAMENTAS"), shell.indexOf("];", shell.indexOf("var FERRAMENTAS")));
  const slugs = [...bloco.matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]);
  const numeros = [...bloco.matchAll(/numero: "([^"]+)"/g)].map((m) => m[1]);

  test("tem pelo menos uma ferramenta", () => assert.ok(slugs.length > 0));

  test("números são únicos e sequenciais (01, 02, …)", () => {
    assert.deepEqual(numeros, numeros.map((_, i) => String(i + 1).padStart(2, "0")));
  });

  for (const slug of slugs) {
    test(`ferramenta "${slug}" tem ferramentas/${slug}/index.html`, () => {
      assert.ok(existe(`ferramentas/${slug}/index.html`));
    });
  }

  test("toda pasta em ferramentas/ está no registro", () => {
    const pastas = fs.readdirSync(path.join(RAIZ, "ferramentas")).filter((n) =>
      fs.statSync(path.join(RAIZ, "ferramentas", n)).isDirectory());
    assert.deepEqual(pastas.sort(), [...slugs].sort());
  });
});

describe("páginas", () => {
  const lista = paginas();

  test("encontrou as páginas do site", () => assert.ok(lista.length >= 4, lista.join(", ")));

  for (const pagina of lista) {
    const html = ler(pagina);
    const dir = path.dirname(pagina);

    describe(pagina, () => {
      test('<html lang="pt-BR"> e viewport', () => {
        assert.match(html, /<html lang="pt-BR">/);
        assert.match(html, /<meta name="viewport"[^>]*width=device-width/);
      });

      test("usa o shell: header, rodapé, bf.css, versao.js antes do shell.js", () => {
        assert.match(html, /<header data-bf-header><\/header>/);
        assert.match(html, /<footer data-bf-footer><\/footer>/);
        assert.match(html, /assets\/css\/bf\.css/);
        const iVersao = html.indexOf("assets/js/versao.js");
        const iShell = html.indexOf("assets/js/shell.js");
        assert.ok(iVersao > -1 && iShell > -1 && iVersao < iShell, "versao.js precisa vir antes do shell.js");
      });

      test("PWA: manifest, ícone e theme-color", () => {
        assert.match(html, /<link rel="manifest" href="[^"]*manifest\.webmanifest">/);
        assert.match(html, /<link rel="apple-touch-icon"/);
        assert.match(html, /<meta name="theme-color"/);
      });

      test("todo caminho local (href/src) aponta para um arquivo que existe", () => {
        const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1])
          .filter((u) => !/^(https?:|mailto:|#|data:|javascript:)/.test(u))
          .filter((u) => !/['+]/.test(u)); // href montado em JavaScript dentro de <script>
        for (const ref of refs) {
          let alvo = path.normalize(path.join(dir, ref.split(/[?#]/)[0]));
          if (ref.endsWith("/") || alvo === "." || alvo === "") alvo = path.join(alvo, "index.html");
          assert.ok(existe(alvo), `${pagina}: ${ref} -> ${alvo} não existe`);
        }
      });
    });
  }
});

describe("PWA (sw.js e manifest)", () => {
  const sw = ler("sw.js");

  test("sw.js importa a versão e nomeia o cache com ela", () => {
    assert.match(sw, /importScripts\("assets\/js\/versao\.js"\)/);
    assert.match(sw, /const CACHE = "bf-" \+ self\.BF_VERSAO/);
  });

  test("todo arquivo do PRECACHE existe (um 404 derruba a instalação offline)", () => {
    const bloco = sw.slice(sw.indexOf("const PRECACHE"), sw.indexOf("];", sw.indexOf("const PRECACHE")));
    const itens = [...bloco.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(itens.length > 5);
    for (const item of itens) {
      const alvo = item === "./" ? "index.html" : item.endsWith("/") ? item + "index.html" : item;
      assert.ok(existe(alvo), `PRECACHE: ${item} não existe`);
    }
  });

  test("todo script e estilo das ferramentas está no PRECACHE (senão não abre offline)", () => {
    for (const pagina of paginas("ferramentas")) {
      const dir = path.dirname(pagina);
      const refs = [...ler(pagina).matchAll(/<(?:script|link rel="stylesheet")[^>]*(?:src|href)="([^"]+\.(?:js|css))"/g)]
        .map((m) => m[1]).filter((u) => !/^https?:/.test(u));
      for (const ref of refs) {
        const rel = path.normalize(path.join(dir, ref)).split(path.sep).join("/");
        assert.ok(sw.includes(`"${rel}"`), `${rel} (usado em ${pagina}) não está no PRECACHE do sw.js`);
      }
    }
  });

  test("manifest válido, com ícones que existem", () => {
    const m = JSON.parse(ler("manifest.webmanifest"));
    assert.equal(m.lang, "pt-BR");
    assert.equal(m.display, "standalone");
    assert.ok(m.icons.some((i) => i.sizes === "192x192"));
    assert.ok(m.icons.some((i) => i.sizes === "512x512"));
    assert.ok(m.icons.some((i) => i.purpose === "maskable"));
    for (const i of m.icons) assert.ok(existe(i.src), `ícone ${i.src} não existe`);
    for (const s of m.shortcuts || []) assert.ok(existe(path.join(s.url, "index.html")), `atalho ${s.url}`);
  });
});

describe("versionamento", () => {
  test("versão do site (versao.js) é SemVer e igual à última entrada do CHANGELOG.md", () => {
    const m = ler("assets/js/versao.js").match(/self\.BF_VERSAO = "(\d+\.\d+\.\d+)"/);
    assert.ok(m, "BF_VERSAO não encontrada");
    assert.equal(m[1], versaoChangelog("CHANGELOG.md"), "suba a versão em assets/js/versao.js junto com o CHANGELOG.md");
  });

  test("versão da calculadora de decocção é igual à última entrada do changelog dela", () => {
    const m = ler("ferramentas/decoccao/version.js").match(/self\.APP_VERSION = "(\d+\.\d+\.\d+)"/);
    assert.ok(m);
    assert.equal(m[1], versaoChangelog("ferramentas/decoccao/CHANGELOG.md"));
  });
});
