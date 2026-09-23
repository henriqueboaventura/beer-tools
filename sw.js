/*
 * Service worker do site inteiro (escopo = raiz do site).
 * Registrado pelo shell como `sw.js?v=<versão>`: a versão vem do próprio
 * endereço (sem importar versao.js), então versão nova = endereço novo, e
 * nenhum cache de CDN/navegador entrega um service worker ou arquivo velho.
 *
 * Estratégia:
 * - Arquivos do próprio site: REDE PRIMEIRO, revalidando com o servidor
 *   (`cache: "no-cache"`, que faz uma requisição condicional com ETag e
 *   ignora o cache HTTP de ~10 min do GitHub Pages). O cache local só
 *   responde quando não há conexão. Assim ninguém fica preso numa versão
 *   velha e o site continua funcionando offline no dia da brassagem.
 * - Fontes do Google: cache primeiro (não mudam).
 * - O cache tem o nome da versão. Subir a versão cria um cache novo e o
 *   "activate" apaga os antigos. O pré-cache também baixa cada arquivo com
 *   ?v=<versão>, pelo mesmo motivo.
 * - Versão nova fica esperando ("waiting") até a página pedir
 *   SKIP_WAITING — é o botão "Atualizar" do aviso no shell.
 */
const VERSAO = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = "bf-" + VERSAO;
const FONTES = "bf-fontes";

// Tudo o que precisa abrir offline logo na primeira visita.
const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/css/bf.css",
  "assets/js/shell.js",
  "assets/js/versao.js",
  "favicon.ico",
  "assets/img/favicon.svg",
  "assets/img/brassagem-forte-wordmark.jpg",
  "assets/img/icon-180.png",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png",
  "ferramentas/substituicao-leveduras/",
  "ferramentas/substituicao-leveduras/index.html",
  "ferramentas/substituicao-leveduras/app.css",
  "ferramentas/substituicao-leveduras/app.js",
  "ferramentas/substituicao-leveduras/busca.js",
  "ferramentas/substituicao-leveduras/data/leveduras.json",
  "ferramentas/decoccao/",
  "ferramentas/decoccao/index.html",
  "ferramentas/decoccao/sobre.html",
  "ferramentas/decoccao/app.css",
  "ferramentas/decoccao/app.js",
  "ferramentas/decoccao/app-core.js",
  "ferramentas/decoccao/methods.js",
  "ferramentas/decoccao/version.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(PRECACHE.map((url) => new Request(url + "?v=" + encodeURIComponent(VERSAO), { cache: "reload" })))
    )
  );
  // Primeira instalação: não há versão anterior para "esperar", então
  // assume o controle direto. Atualizações ficam em "waiting" até o aviso.
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(FONTES).then((cache) =>
        cache.match(req).then((hit) =>
          hit || fetch(req).then((res) => { cache.put(req, res.clone()); return res; })
        )
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copia));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) =>
          hit || (req.mode === "navigate" ? caches.match("./") : Response.error())
        )
      )
  );
});
