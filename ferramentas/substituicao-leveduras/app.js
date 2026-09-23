(function () {
  "use strict";

  var NIVEL = { 3: "Equivalente", 2: "Provável", 1: "Alternativa" };
  var FONTE = { ym: "Yeast Master", aeb: "AEB", imperial: "Imperial", curadoria: "Curadoria BF", levteck: "Levteck (fabricante)", inferida: "Inferida (não revisada)" };
  var LIMITE_LISTA = 40;

  var DB, byId = {}, rel = {}, nao = {}, catNome = {};
  var state = { cat: "todas", query: "", active: -1, base: null, forma: "todas", nacionais: false, inferidas: true };

  var $ = function (id) { return document.getElementById(id); };
  var esc = BF.esc;
  var input = $("yx-input"), list = $("yx-list"), status = $("yx-status");
  var picker = $("picker"), baseEl = $("base"), altStep = $("step-alt"), altsEl = $("alts");

  var norm = BFBusca.norm;
  // evita quebra de linha dentro de códigos como "W-34/70"
  function words(s) {
    return String(s).split(" ").map(function (w) { return '<span class="nowrap">' + esc(w) + "</span>"; }).join(" ");
  }
  function fab(y) { return DB.fabricantes[y.fab].nome; }
  function forma(y) { return y.forma === "seca" ? "Seca" : y.forma === "liquida" ? "Líquida" : "—"; }
  function nacional(y) { return !!DB.fabricantes[y.fab].nacional; }
  // mostra o código só quando ele não está no nome (ex.: "SafAle US-05" já contém "US-05")
  function codigo(y) { return y.codigo && norm(y.nome).indexOf(norm(y.codigo)) === -1 ? y.codigo : ""; }
  // "Wyeast 1056", "SafAle US-05", "CellarScience West Coast"
  function rotulo(y) {
    var nome = codigo(y) || y.nome;
    return norm(nome).indexOf(norm(fab(y))) === 0 || norm(nome).indexOf("saf") === 0 || norm(nome).indexOf("lalbrew") === 0
      ? nome : fab(y) + " " + nome;
  }
  function meter(n) {
    var h = '<span class="bf-meter" aria-hidden="true">';
    for (var i = 1; i <= 3; i++) h += '<i class="' + (i <= n ? "on" : "") + '"></i>';
    return h + "</span>";
  }
  function atenMedia(y) { return y.aten ? (y.aten[0] + y.aten[1]) / 2 : y.atenYm || null; }
  function atenTexto(y) { return y.aten ? y.aten[0] + "–" + y.aten[1] + "%" : y.atenYm ? "~" + y.atenYm + "%" : null; }
  function tempTexto(y) { return y.temp ? y.temp[0] + "–" + y.temp[1] + "°C" : null; }

  /* ---------- Carregamento ---------- */
  function carregar() {
    status.textContent = "Carregando leveduras…";
    fetch("data/leveduras.json")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(iniciar)
      .catch(function () {
        status.innerHTML = 'Não foi possível carregar os dados. <button type="button" class="bf-btn" id="btn-retry">Tentar de novo</button>';
        $("btn-retry").addEventListener("click", carregar);
      });
  }

  function iniciar(data) {
    DB = data;
    BFBusca.indexar(DB);
    DB.leveduras.forEach(function (y) { byId[y.id] = y; });
    DB.categorias.forEach(function (c) { catNome[c.id] = c.nome; });
    Object.keys(DB.relacoes).forEach(function (id) {
      rel[id] = DB.relacoes[id].map(function (r) {
        return { y: byId[r[0]], nivel: r[1], fontes: r[2], nota: r[3] || null };
      });
    });
    nao = DB.naoConfundir || {};

    input.disabled = false;
    input.placeholder = "US-05, WLP001, 1056, Chico…";
    status.textContent = "";
    BF.rodape("Ferramenta de Henrique Boaventura e Fábio Koerich · Dados de " +
      DB.versao.split("-").reverse().join("/") + " · " + DB.leveduras.length + " leveduras");
    renderChips();
    renderFontes();
    fromUrl();
  }

  /* ---------- Chips de categoria ---------- */
  function renderChips() {
    var cats = [{ id: "todas", nome: "Todas" }].concat(DB.categorias);
    $("cat-chips").innerHTML = cats.map(function (c) {
      var n = c.id === "todas" ? DB.leveduras.length : DB.leveduras.filter(function (y) { return y.cat === c.id; }).length;
      return '<button type="button" class="bf-chip" data-cat="' + c.id + '" aria-pressed="' + (state.cat === c.id) + '">' +
        esc(c.nome) + '<span class="count">' + n + "</span></button>";
    }).join("");
  }
  $("cat-chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-cat]");
    if (!b) return;
    state.cat = b.dataset.cat;
    renderChips();
    renderList(true);
  });

  /* ---------- Combobox ---------- */
  function matches() {
    return BFBusca.buscar(DB, state.query, state.cat);
  }

  var current = [];
  function renderList(force) {
    var show = force || state.query.length > 0 || state.cat !== "todas";
    if (!show) { closeList(); return; }
    var todos = matches();
    current = todos.slice(0, LIMITE_LISTA);
    state.active = -1;
    input.removeAttribute("aria-activedescendant");
    if (!current.length) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      status.textContent = "Nenhuma levedura encontrada para “" + state.query + "”.";
      return;
    }
    status.textContent = todos.length > LIMITE_LISTA
      ? "Mostrando " + LIMITE_LISTA + " de " + todos.length + ". Digite mais para refinar."
      : "";
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    list.innerHTML = current.map(function (y, i) {
      var meta = [fab(y), forma(y), y.origem || catNome[y.cat]];
      if (y.descontinuada) meta.push("descontinuada");
      return '<li role="option" id="opt-' + i + '" data-id="' + y.id + '" data-fab="' + y.fab + '" aria-selected="false">' +
        '<span class="yx-opt__name"><i class="yx-lab" aria-hidden="true"></i>' + esc(y.nome) + "</span>" +
        '<span class="yx-opt__code">' + esc(codigo(y)) + "</span>" +
        '<span class="yx-opt__meta">' + esc(meta.join(" · ")) + "</span></li>";
    }).join("");
  }
  function closeList() {
    list.hidden = true;
    status.textContent = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  function setActive(i) {
    var items = list.querySelectorAll("li");
    if (!items.length) return;
    state.active = (i + items.length) % items.length;
    items.forEach(function (li, k) { li.setAttribute("aria-selected", String(k === state.active)); });
    items[state.active].scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", "opt-" + state.active);
  }

  input.addEventListener("input", function () { state.query = input.value; renderList(); });
  input.addEventListener("focus", function () { if (state.query || state.cat !== "todas") renderList(); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) renderList(true); setActive(state.active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(state.active - 1); }
    else if (e.key === "Enter") {
      var pick = current[state.active] || (current.length === 1 ? current[0] : null);
      if (pick && !list.hidden) { e.preventDefault(); select(pick.id, true); }
    } else if (e.key === "Escape") { closeList(); }
  });
  list.addEventListener("click", function (e) {
    var li = e.target.closest("li[data-id]");
    if (li) select(li.dataset.id, true);
  });

  /* ---------- Levedura base ---------- */
  function select(id, push) {
    var y = byId[id];
    if (!y) return;
    state.base = y;
    state.forma = "todas";
    closeList();
    picker.hidden = true;
    baseEl.hidden = false;

    var specs = [["Atenuação", atenTexto(y)], ["Temp.", tempTexto(y)], ["Floculação", y.floc]]
      .filter(function (s) { return s[1]; });
    var naoConf = (nao[y.id] || []).map(function (i) { return byId[i]; }).filter(Boolean);
    var tags = (y.descontinuada ? '<span class="bf-tag">Descontinuada</span>' : "") +
      (y.blend ? '<span class="bf-tag">Blend</span>' : "") +
      (y.foraCatalogo ? '<span class="bf-tag">Fora do catálogo</span>' : "");

    baseEl.innerHTML =
      '<article class="yx-base" id="yx-base" data-fab="' + y.fab + '" aria-label="Levedura base">' +
        '<div class="yx-base__top"><span><i class="yx-lab" aria-hidden="true"></i>' + esc(fab(y)) + " · " + forma(y) + tags + "</span>" +
        '<button type="button" class="bf-btn" id="btn-trocar">Trocar</button></div>' +
        '<h3 class="yx-base__name">' + words(y.nome) + "</h3>" +
        (codigo(y) ? '<div class="yx-base__code">' + esc(codigo(y)) + "</div>" : "") +
        (specs.length ? '<dl class="yx-specs">' + specs.map(function (s) {
          return "<div><dt>" + s[0] + "</dt><dd>" + esc(s[1]) + "</dd></div>";
        }).join("") + "</dl>" : "") +
        (y.aviso ? '<p class="yx-base__info"><b>Atenção</b>' + esc(y.aviso) + "</p>" : "") +
        (y.origem ? '<p class="yx-base__info"><b>Origem provável</b>' + esc(y.origem) + "</p>" : "") +
        (y.descr ? '<p class="yx-base__info"><b>Descrição do fabricante</b>' + esc(y.descr) + "</p>" : "") +
        (y.notaYm ? '<p class="yx-base__info"><b>Nota do Yeast Master</b><em lang="en">' + esc(y.notaYm) + "</em></p>" : "") +
        (y.notaBlend ? '<p class="yx-base__info"><b>Composição</b>' + esc(y.notaBlend) + "</p>" : "") +
        (naoConf.length ? '<div class="yx-base__info"><b>Não confunda — não é equivalente a</b><div class="yx-base__not">' +
          naoConf.map(function (n) {
            return '<button type="button" data-id="' + n.id + '" aria-label="' + esc(fab(n) + " " + n.nome) + ', não equivalente. Ver esta levedura">' +
              esc(rotulo(n)) + "</button>";
          }).join("") + "</div></div>" : "") +
        '<div class="yx-base__actions">' +
          '<button type="button" class="bf-btn" id="btn-link">Copiar link</button>' +
          (y.url ? '<a class="bf-btn" href="' + esc(y.url) + '" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none">Site do fabricante ↗</a>' : "") +
        "</div>" +
      "</article>";

    $("btn-trocar").addEventListener("click", reset);
    $("btn-link").addEventListener("click", function () {
      var b = this;
      (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(
        function () { b.textContent = "Link copiado ✓"; },
        function () { b.textContent = "Copie da barra de endereço"; });
    });
    baseEl.querySelectorAll(".yx-base__not button").forEach(function (b) {
      b.addEventListener("click", function () { select(b.dataset.id, true); });
    });

    altStep.hidden = false;
    renderAlts();
    if (push) {
      var url = new URL(location.href);
      url.searchParams.set("levedura", id);
      history.pushState({ id: id }, "", url);
      $("yx-base").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.title = y.nome + " — Substituição de leveduras — Brassagem Forte";
  }

  function reset() {
    state.base = null;
    baseEl.hidden = true;
    altStep.hidden = true;
    picker.hidden = false;
    input.value = ""; state.query = "";
    var url = new URL(location.href);
    url.searchParams.delete("levedura");
    history.pushState({}, "", url);
    document.title = "Substituição de leveduras — Brassagem Forte";
    input.focus();
  }

  /* ---------- Alternativas ---------- */
  function diffMark(a, b) {
    if (a == null || b == null || Math.abs(a - b) < 3) return "";
    return a > b ? " ▲" : " ▼";
  }

  function renderAlts() {
    var base = state.base;
    var all = (rel[base.id] || []).filter(function (a) {
      return (state.inferidas || a.fontes.indexOf("inferida") === -1) && (!state.nacionais || nacional(a.y));
    }).sort(function (a, b) {
      return b.nivel - a.nivel ||
        (a.y.descontinuada ? 1 : 0) - (b.y.descontinuada ? 1 : 0) ||
        (a.y.forma === "seca" ? 0 : 1) - (b.y.forma === "seca" ? 0 : 1) ||
        (nacional(b.y) ? 1 : 0) - (nacional(a.y) ? 1 : 0) ||
        fab(a.y).localeCompare(fab(b.y)) || a.y.nome.localeCompare(b.y.nome);
    });
    var counts = { todas: all.length, seca: 0, liquida: 0 };
    all.forEach(function (a) { if (counts[a.y.forma] != null) counts[a.y.forma]++; });

    $("alt-count").textContent = "(" + all.length + ")";
    $("form-seg").innerHTML = [["todas", "Todas"], ["seca", "Seca"], ["liquida", "Líquida"]].map(function (f) {
      return '<button type="button" class="bf-chip" data-forma="' + f[0] + '" aria-pressed="' + (state.forma === f[0]) + '">' +
        f[1] + '<span class="count">' + counts[f[0]] + "</span></button>";
    }).join("");
    $("btn-nacionais").setAttribute("aria-pressed", String(state.nacionais));
    $("btn-inferidas").setAttribute("aria-pressed", String(state.inferidas));

    var shown = all.filter(function (a) { return state.forma === "todas" || a.y.forma === state.forma; });
    if (!(rel[base.id] || []).length) {
      altsEl.innerHTML = '<div class="yx-empty">Nenhuma fonte lista alternativas para esta levedura ainda.</div>';
      return;
    }
    if (!shown.length) {
      altsEl.innerHTML = '<div class="yx-empty">Nenhuma alternativa com esses filtros.<br>' +
        '<button type="button" class="bf-btn" data-limpar>Limpar filtros</button></div>';
      return;
    }

    var html = "";
    [3, 2, 1].forEach(function (n) {
      var group = shown.filter(function (a) { return a.nivel === n; });
      if (!group.length) return;
      html += '<h3 class="yx-group__head yx-nivel-' + n + '">' + meter(n) + " " + NIVEL[n] + '<span class="n">' + group.length + "</span></h3>";
      group.forEach(function (a) { html += altHtml(a, base); });
    });
    altsEl.innerHTML = html;
  }

  function altHtml(a, base) {
    var y = a.y;
    var dA = diffMark(atenMedia(y), atenMedia(base));
    var specs = [];
    if (atenTexto(y)) specs.push('<span class="' + (dA ? "diff" : "") + '"><em>Aten.</em>' + atenTexto(y) + dA + "</span>");
    if (tempTexto(y)) specs.push("<span><em>Temp.</em>" + tempTexto(y) + "</span>");
    if (y.floc) specs.push("<span><em>Floc.</em>" + esc(y.floc) + "</span>");
    if (y.origem) specs.push("<span><em>Origem</em>" + esc(y.origem) + "</span>");
    var tags = (nacional(y) ? '<span class="bf-tag">Nacional</span>' : "") +
      (y.descontinuada ? '<span class="bf-tag">Descontinuada</span>' : "") +
      (y.blend ? '<span class="bf-tag">Blend</span>' : "") +
      (y.foraCatalogo ? '<span class="bf-tag">Fora do catálogo</span>' : "") +
      '<span class="bf-tag' + (y.forma === "seca" ? " bf-tag--solid" : "") + '">' + forma(y) + "</span>";
    var prefixo = a.fontes.indexOf("inferida") > -1 ? "<b>Inferida pelo nome, ainda não revisada.</b> "
      : a.fontes.indexOf("curadoria") > -1 ? "<b>Curadoria BF:</b> " : "";
    return '<article class="yx-alt yx-nivel-' + a.nivel + (y.descontinuada ? " yx-alt--off" : "") + '" data-fab="' + y.fab + '">' +
      '<div class="yx-alt__top"><span><i class="yx-lab" aria-hidden="true"></i>' + esc(fab(y)) + '</span><span class="yx-alt__tags">' + tags + "</span></div>" +
      '<div class="yx-alt__name"><button type="button" data-id="' + y.id + '" title="Ver alternativas desta levedura">' + words(y.nome) + "</button>" +
        (codigo(y) ? "<code>" + esc(codigo(y)) + "</code>" : "") + "</div>" +
      (specs.length ? '<div class="yx-alt__specs">' + specs.join("") + "</div>" : "") +
      (a.nota ? '<p class="yx-alt__note">' + prefixo + esc(a.nota) + "</p>" : "") +
      '<p class="yx-alt__src">Fonte: ' + a.fontes.map(function (f) { return FONTE[f] || f; }).join(", ") +
        ' <span class="visually-hidden">· Similaridade: ' + NIVEL[a.nivel] + "</span></p>" +
    "</article>";
  }

  altStep.addEventListener("click", function (e) {
    var b = e.target.closest("[data-forma]");
    if (b) { state.forma = b.dataset.forma; renderAlts(); return; }
    if (e.target.closest("[data-limpar]")) { state.forma = "todas"; state.nacionais = false; state.inferidas = true; renderAlts(); return; }
    var nome = e.target.closest(".yx-alt__name button");
    if (nome) select(nome.dataset.id, true);
  });
  $("btn-nacionais").addEventListener("click", function () { state.nacionais = !state.nacionais; renderAlts(); });
  $("btn-inferidas").addEventListener("click", function () { state.inferidas = !state.inferidas; renderAlts(); });

  /* ---------- Fontes ---------- */
  function renderFontes() {
    var f = DB.fontes;
    var bio4 = DB.fabricantes.bio4 && DB.fabricantes.bio4.aviso;
    $("fontes").innerHTML = ["ym", "aeb", "imperial", "levteck", "curadoria", "inferida"].map(function (k) {
      var s = f[k];
      if (!s) return "";
      var nome = s.url ? '<a href="' + esc(s.url) + '" rel="noopener">' + esc(s.nome) + "</a>" : esc(s.nome);
      return "<p><b>" + nome + "</b> — " + esc(s.autor) + "<small>" + esc(s.descricao) +
        (k === "inferida" && bio4 ? " Bio4: " + esc(bio4) : "") + "</small></p>";
    }).join("");
  }

  /* ---------- URL / histórico ---------- */
  function fromUrl() {
    var param = new URLSearchParams(location.search).get("levedura");
    var id = BFBusca.resolverId(DB, param);
    if (id) { select(id, false); return; }
    state.base = null; baseEl.hidden = true; altStep.hidden = true; picker.hidden = false;
    if (param) status.textContent = "Levedura “" + param + "” não encontrada. Busque abaixo.";
  }
  window.addEventListener("popstate", function () { if (DB) fromUrl(); });

  carregar();
})();
