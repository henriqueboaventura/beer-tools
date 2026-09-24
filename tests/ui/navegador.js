/*
 * Infraestrutura dos testes de interface — sem dependências.
 *
 * - Sobe um servidor HTTP local servindo o repositório.
 * - Abre o Chrome headless e conversa com ele pelo protocolo de depuração
 *   (Chrome DevTools Protocol) via --remote-debugging-pipe: mensagens JSON
 *   separadas por \0 nos descritores 3 (envio) e 4 (recebimento). Nada de
 *   WebSocket, então funciona no Node 20 sem flags.
 * - Cada página abre em tela de celular (390 px) e registra erros de
 *   JavaScript, console.error e arquivos que falharam ao carregar.
 *
 * Chrome: variável CHROME_BIN, ou o caminho padrão no macOS, ou
 * google-chrome / chromium no PATH (o runner do GitHub Actions já tem).
 * Sem Chrome, `navegadorDisponivel()` devolve null e os testes são pulados.
 */
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");

const RAIZ = path.join(__dirname, "..", "..");
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".xml": "application/xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

function encontrarChrome() {
  const candidatos = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean);
  for (const c of candidatos) if (fs.existsSync(c)) return c;
  for (const nome of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try { return execFileSync("which", [nome], { encoding: "utf8" }).trim(); } catch (e) { /* tenta o próximo */ }
  }
  return null;
}

function navegadorDisponivel() { return encontrarChrome(); }

function servidor() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let caminho = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (caminho.endsWith("/")) caminho += "index.html";
      const arquivo = path.join(RAIZ, path.normalize(caminho));
      if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
        res.writeHead(404, { "content-type": "text/plain" });
        return res.end("404");
      }
      res.writeHead(200, { "content-type": TIPOS[path.extname(arquivo)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(arquivo).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

class Navegador {
  static async abrir() {
    const chrome = encontrarChrome();
    if (!chrome) throw new Error("Chrome não encontrado (defina CHROME_BIN)");
    const nav = new Navegador();
    const { srv, base } = await servidor();
    nav.srv = srv;
    nav.base = base;
    nav.perfil = fs.mkdtempSync(path.join(os.tmpdir(), "bf-ui-"));
    nav.proc = spawn(chrome, [
      "--headless=new", "--remote-debugging-pipe", "--no-first-run", "--no-default-browser-check",
      "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars",
      "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
      `--user-data-dir=${nav.perfil}`, "about:blank",
    ], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
    nav.id = 0;
    nav.pendentes = new Map();
    nav.ouvintes = [];
    let buffer = "";
    nav.proc.stdio[4].on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let i;
      while ((i = buffer.indexOf("\0")) >= 0) {
        const msg = JSON.parse(buffer.slice(0, i));
        buffer = buffer.slice(i + 1);
        if (msg.id && nav.pendentes.has(msg.id)) {
          const { ok, falha } = nav.pendentes.get(msg.id);
          nav.pendentes.delete(msg.id);
          msg.error ? falha(new Error(msg.error.message)) : ok(msg.result);
        } else if (msg.method) {
          nav.ouvintes.forEach((f) => f(msg));
        }
      }
    });
    return nav;
  }

  enviar(method, params = {}, sessionId) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((ok, falha) => {
      this.pendentes.set(id, { ok, falha });
      this.proc.stdio[3].write(JSON.stringify(msg) + "\0");
    });
  }

  async pagina({ largura = 390, altura = 900 } = {}) {
    const { targetId } = await this.enviar("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await this.enviar("Target.attachToTarget", { targetId, flatten: true });
    const pag = new Pagina(this, sessionId, targetId);
    this.ouvintes.push((msg) => { if (msg.sessionId === sessionId) pag.evento(msg); });
    await pag.enviar("Runtime.enable");
    await pag.enviar("Page.enable");
    await pag.enviar("Log.enable");
    // fontes do Google: fora dos testes (rápido e sem depender da internet)
    await pag.enviar("Network.enable");
    await pag.enviar("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
    await pag.enviar("Emulation.setDeviceMetricsOverride", { width: largura, height: altura, deviceScaleFactor: 1, mobile: true });
    return pag;
  }

  async fechar() {
    try { await this.enviar("Browser.close"); } catch (e) { /* já fechou */ }
    this.proc.kill();
    this.proc.stdio[3].destroy();
    this.proc.stdio[4].destroy();
    this.srv.closeAllConnections(); // keep-alive seguraria o processo
    this.srv.close();
    try { fs.rmSync(this.perfil, { recursive: true, force: true }); } catch (e) { /* ignora */ }
  }
}

class Pagina {
  constructor(nav, sessionId, targetId) {
    this.nav = nav;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.erros = [];
    this.esperandoLoad = null;
  }

  enviar(method, params) { return this.nav.enviar(method, params, this.sessionId); }

  evento(msg) {
    const p = msg.params || {};
    if (msg.method === "Page.loadEventFired" && this.esperandoLoad) { this.esperandoLoad(); this.esperandoLoad = null; }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = p.exceptionDetails || {};
      this.erros.push("exceção: " + ((d.exception && d.exception.description) || d.text));
    }
    if (msg.method === "Runtime.consoleAPICalled" && p.type === "error") {
      this.erros.push("console.error: " + (p.args || []).map((a) => a.value || a.description).join(" "));
    }
    if (msg.method === "Log.entryAdded" && p.entry.level === "error") {
      // fontes do Google são bloqueadas de propósito (ver pagina())
      if (!/fonts\.(googleapis|gstatic)\.com/.test(p.entry.url || "")) this.erros.push("log: " + p.entry.text + " " + (p.entry.url || ""));
    }
  }

  async ir(caminho) {
    const carregou = new Promise((ok) => { this.esperandoLoad = ok; });
    await this.enviar("Page.navigate", { url: this.nav.base + caminho.replace(/^\//, "") });
    let relogio;
    await Promise.race([carregou, new Promise((ok) => { relogio = setTimeout(ok, 15000); })]);
    clearTimeout(relogio);
    await this.esperar("document.readyState === 'complete'", 15000);
  }

  // avalia uma expressão (ou função assíncrona) na página e devolve o valor
  async avaliar(codigo) {
    const r = await this.enviar("Runtime.evaluate", { expression: codigo, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error("erro na página: " + ((d.exception && d.exception.description) || d.text));
    }
    return r.result.value;
  }

  // espera até a expressão ser verdadeira (depois de uma navegação, `ui` volta a existir)
  async esperar(expressao, timeout = 8000) {
    const fim = Date.now() + timeout;
    while (Date.now() < fim) {
      // durante uma navegação a avaliação falha: tenta de novo
      try { if (await this.avaliar(`if (!window.ui) { ${UTIL} }; !!(${expressao})`)) return; } catch (e) { /* página trocando */ }
      await new Promise((ok) => setTimeout(ok, 50));
    }
    throw new Error("tempo esgotado esperando: " + expressao);
  }

  async fechar() {
    await this.nav.enviar("Target.closeTarget", { targetId: this.targetId });
  }
}

// Utilitários injetados em cada teste (disponíveis como `ui` na página)
const UTIL = `
window.ui = {
  $: (s) => document.querySelector(s),
  $$: (s) => [...document.querySelectorAll(s)],
  texto: (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\\s+/g, " ").trim() : null; },
  digitar: (s, v) => { const e = document.querySelector(s); e.focus(); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); },
  clicar: (s) => { const e = document.querySelector(s); if (!e) throw new Error("não achei " + s); e.click(); },
  semRolagemLateral: () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
};
true`;

/*
 * Uma suíte por arquivo: um Chrome e uma aba compartilhados pelos testes.
 * Sem Chrome, os testes são pulados — a não ser com BF_UI_OBRIGATORIO=1
 * (o CI usa), quando falham.
 */
function suiteUI(nome, corpo) {
  const { describe, before, after } = require("node:test");
  const semChrome = !navegadorDisponivel();
  if (semChrome && process.env.BF_UI_OBRIGATORIO) throw new Error("Chrome não encontrado e BF_UI_OBRIGATORIO=1");
  describe(nome, { skip: semChrome && "Chrome não encontrado (defina CHROME_BIN)" }, () => {
    const ctx = {};
    before(async () => {
      ctx.nav = await Navegador.abrir();
      ctx.pag = await ctx.nav.pagina();
    });
    after(async () => { if (ctx.nav) await ctx.nav.fechar(); });
    corpo(ctx);
  });
}

module.exports = { Navegador, navegadorDisponivel, suiteUI, UTIL };
