/*
 * Shell compartilhado: registro de ferramentas, header, menu, rodapé, tema,
 * service worker (PWA) e aviso de nova versão.
 * Carregado no <head> de todas as páginas (sem defer), logo depois de
 * assets/js/versao.js, para aplicar o tema antes da pintura.
 * As páginas só declaram <header data-bf-header> e <footer data-bf-footer>; o conteúdo vem daqui.
 */
(function () {
  "use strict";

  var FERRAMENTAS = [
    {
      numero: "01",
      slug: "substituicao-leveduras",
      titulo: "Substituição de leveduras",
      descricao: "Não achou a levedura da receita? Veja equivalentes secas e líquidas de outros fabricantes.",
      status: "disponivel"
    },
    {
      numero: "02",
      slug: "decoccao",
      titulo: "Decocção",
      descricao: "Monte o programa de mostura por decocção: puxadas, cronograma, gráfico e cronômetro de brassagem.",
      status: "disponivel"
    }
  ];

  // links institucionais do menu. Placeholder até decidir quais entram:
  // troque por itens como { titulo: "Podcast", url: "https://…" }. Item sem url aparece desabilitado.
  var LINKS = [
    { titulo: "Em breve", url: null }
  ];

  var VERSAO = self.BF_VERSAO || "?";
  var CHANGELOG = "https://github.com/henriqueboaventura/beer-tools/blob/main/CHANGELOG.md";

  // raiz do site, a partir do caminho deste script (funciona em /beer-tools/ no GitHub Pages)
  var script = document.currentScript;
  var BASE = script ? script.src.replace(/assets\/js\/shell\.js(\?.*)?$/, "") : "/";

  /* ---------- Tema ---------- */
  var root = document.documentElement;
  function temaSalvo() {
    try { return localStorage.getItem("bf-tema"); } catch (e) { return null; }
  }
  function temaAtual() {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  var salvo = temaSalvo();
  if (salvo === "light" || salvo === "dark") root.setAttribute("data-theme", salvo);

  function alternarTema() {
    var novo = temaAtual() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", novo);
    try { localStorage.setItem("bf-tema", novo); } catch (e) { /* sem storage: vale só nesta visita */ }
    atualizarBotaoTema();
  }
  function atualizarBotaoTema() {
    var b = document.querySelector(".bf-theme-btn");
    if (!b) return;
    var escuro = temaAtual() === "dark";
    b.setAttribute("aria-label", escuro ? "Usar tema claro" : "Usar tema escuro");
    b.title = b.getAttribute("aria-label");
  }

  /* ---------- Markup ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function urlFerramenta(f) { return BASE + "ferramentas/" + f.slug + "/"; }
  function atual() {
    var m = location.pathname.match(/\/ferramentas\/([^/]+)\//);
    return m ? m[1] : null;
  }

  function header() {
    return '<div class="wrap">' +
      '<a class="bf-brand" href="' + BASE + '" aria-label="Brassagem Forte — Ferramentas, início">' +
        '<img class="bf-logo" src="' + BASE + 'assets/img/brassagem-forte-wordmark.jpg" alt="" width="74" height="44">' +
        '<span class="bf-brand__sub">Ferramentas</span>' +
      "</a>" +
      '<button class="bf-icon-btn bf-theme-btn" type="button"><span class="bf-theme-icon" aria-hidden="true"></span></button>' +
      '<button class="bf-menu-btn" type="button" aria-expanded="false" aria-controls="bf-menu">' +
        '<span class="bf-menu-btn__text">Menu</span><span class="bf-menu-btn__icon" aria-hidden="true"></span>' +
      "</button>" +
    "</div>";
  }

  function menu() {
    var slug = atual();
    var itens = FERRAMENTAS.map(function (f) {
      var rotulo = "<small>" + f.numero + "</small>" + esc(f.titulo);
      if (f.status !== "disponivel") return "<li><span>" + rotulo + "</span></li>";
      return '<li><a href="' + urlFerramenta(f) + '"' + (f.slug === slug ? ' aria-current="page"' : "") + ">" + rotulo + "</a></li>";
    }).join("");
    var links = LINKS.map(function (l) {
      if (!l.url) return "<li><span><small>↗</small>" + esc(l.titulo) + "</span></li>";
      return '<li><a href="' + l.url + '" rel="noopener"><small>↗</small>' + esc(l.titulo) + "</a></li>";
    }).join("");
    return '<div class="wrap">' +
      '<p class="bf-menu__label">Ferramentas</p><ul class="bf-menu__list">' + itens + "</ul>" +
      (links ? '<p class="bf-menu__label">Brassagem Forte</p><ul class="bf-menu__list">' + links + "</ul>" : "") +
    "</div>";
  }

  function footer(extra) {
    return '<div class="wrap">' +
      '<img class="bf-logo bf-footer__logo" src="' + BASE + 'assets/img/brassagem-forte-wordmark.jpg" alt="Brassagem Forte" width="94" height="56">' +
      "<span>Ferramentas gratuitas para cervejeiros caseiros.</span>" +
      (extra ? "<span>" + extra + "</span>" : "") +
      '<span>Versão ' + esc(VERSAO) + ' · <a href="' + CHANGELOG + '" rel="noopener">Novidades</a></span>' +
    "</div>";
  }

  /* ---------- PWA: service worker e aviso de nova versão ---------- */
  function avisoNovaVersao(worker) {
    if (document.querySelector(".bf-update")) return;
    var aviso = document.createElement("div");
    aviso.className = "bf-update";
    aviso.setAttribute("role", "status");
    aviso.innerHTML = '<span>Nova versão disponível.</span>' +
      '<button type="button" class="bf-update__btn">Atualizar</button>' +
      '<button type="button" class="bf-update__close" aria-label="Agora não">✕</button>';
    aviso.querySelector(".bf-update__btn").addEventListener("click", function () {
      atualizando = true;
      worker.postMessage("SKIP_WAITING");
    });
    aviso.querySelector(".bf-update__close").addEventListener("click", function () { aviso.remove(); });
    document.body.appendChild(aviso);
  }

  var atualizando = false;
  function registrarServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register(BASE + "sw.js", { scope: BASE, updateViaCache: "none" }).then(function (reg) {
      // versão nova já baixada numa visita anterior, esperando
      if (reg.waiting && navigator.serviceWorker.controller) avisoNovaVersao(reg.waiting);
      reg.addEventListener("updatefound", function () {
        var novo = reg.installing;
        if (!novo) return;
        novo.addEventListener("statechange", function () {
          if (novo.state === "installed" && navigator.serviceWorker.controller) avisoNovaVersao(novo);
        });
      });
      // o site fica aberto por horas no dia da brassagem: procura versão nova
      // quando a aba volta ao primeiro plano e a cada 30 minutos
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") reg.update().catch(function () {});
      });
      setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
    }).catch(function () { /* sem service worker: o site funciona normalmente, só não fica offline */ });

    // recarrega só quando a troca de versão foi pedida pelo botão
    // (na primeira instalação o controle também muda, e aí não deve recarregar)
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (atualizando) location.reload();
    });
  }

  function montar() {
    var h = document.querySelector("[data-bf-header]");
    if (h) {
      h.classList.add("bf-header");
      h.innerHTML = header();
      var nav = document.createElement("nav");
      nav.id = "bf-menu";
      nav.className = "bf-menu";
      nav.hidden = true;
      nav.setAttribute("aria-label", "Menu");
      nav.innerHTML = menu();
      h.insertAdjacentElement("afterend", nav);

      var btn = h.querySelector(".bf-menu-btn");
      var setOpen = function (open) {
        btn.setAttribute("aria-expanded", String(open));
        btn.querySelector(".bf-menu-btn__text").textContent = open ? "Fechar" : "Menu";
        nav.hidden = !open;
        document.body.style.overflow = open ? "hidden" : "";
      };
      btn.addEventListener("click", function () { setOpen(btn.getAttribute("aria-expanded") !== "true"); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !nav.hidden) { setOpen(false); btn.focus(); }
      });
      h.querySelector(".bf-theme-btn").addEventListener("click", alternarTema);
      atualizarBotaoTema();
    }
    var f = document.querySelector("[data-bf-footer]");
    if (f) {
      f.classList.add("bf-footer");
      f.innerHTML = footer(f.getAttribute("data-bf-footer"));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();
  window.addEventListener("load", registrarServiceWorker);

  window.BF = {
    base: BASE,
    versao: VERSAO,
    ferramentas: FERRAMENTAS,
    esc: esc,
    urlFerramenta: urlFerramenta,
    // permite à ferramenta acrescentar texto no rodapé (ex.: versão dos dados)
    rodape: function (texto) {
      var f = document.querySelector("[data-bf-footer]");
      if (!f) return;
      f.setAttribute("data-bf-footer", texto);
      f.innerHTML = footer(texto);
    }
  };
})();
