(function () {
  "use strict";

  var C = window.BFCarbonatacao;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    envase: "vidro",
    inicio: "fermentada",
    modo: "total",
    acucar: "sacarose"
  };

  function num(n, casas) { return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }); }
  function val(id) { return parseFloat($(id).value); }
  function campo(id) { var v = $(id).value; return v === "" ? "" : parseFloat(v); }
  function marcar(attr, valor) {
    document.querySelectorAll("[" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute(attr) === valor)); });
  }
  function status(tipo, html) { return '<p class="cb-status cb-status--' + tipo + '">' + html + "</p>"; }
  // gramas com casas conforme o tamanho (0,85 g · 6,8 g · 136 g)
  function g(x) { return x >= 100 ? num(x, 0) : x >= 10 ? num(x, 1) : num(x, 2); }

  /* ---------- listas ---------- */
  $("estilo").innerHTML = '<option value="">Escolha um estilo (opcional)</option>' + C.ESTILOS.map(function (grupo) {
    return '<optgroup label="' + grupo.grupo + '">' + grupo.itens.map(function (it) {
      return '<option value="' + it[1] + '">' + it[0] + " · " + num(it[1], 1) + "</option>";
    }).join("") + "</optgroup>";
  }).join("");
  $("acucar").innerHTML = C.ACUCARES.map(function (a) { return '<option value="' + a.id + '">' + a.nome + "</option>"; }).join("");

  function aplicarAcucar() {
    var a = C.acucarPorId(state.acucar);
    var natural = a.id === "natural";
    $("rendimentoCampo").hidden = natural;
    $("naturalCampo").hidden = !natural;
    if (!natural) {
      $("rendimentoEco").innerHTML = "Rende <b>" + num(a.rendimento, 3) + " g</b> de CO₂ por grama" + (a.confirmado ? "." : " (estimativa).");
      $("acucarNota").textContent = a.nota;
    } else {
      $("naturalNota").textContent = a.nota + " Use a densidade final de um teste de fermentação forçada ou a esperada da receita.";
    }
  }

  // "da garrafa de vidro", "da lata", "do barril"
  var NOME_ENVASE = {
    "vidro": "da garrafa de vidro", "vidro-reforcado": "da garrafa reforçada", "pet": "da garrafa PET", "lata": "da lata", "barril": "do barril"
  };

  function aplicarEnvase() {
    var e = C.ENVASES[state.envase];
    marcar("data-envase", state.envase);
    $("pressaoTitulo").textContent = "Segurança " + NOME_ENVASE[state.envase];
    $("espacoVazioCampo").hidden = !e.espacoVazio;
    $("modo").hidden = !e.porGarrafa;
    if (!e.porGarrafa) state.modo = "total";
    marcar("data-modo", state.modo);
    $("envaseNota").textContent = {
      "vidro": "Garrafa comum de tampa metálica: segura até cerca de 3,5 volumes.",
      "vidro-reforcado": "Garrafa grossa, tipo champanhe: para estilos muito carbonatados, como saison e weiss.",
      "pet": "Deforma antes de estourar: aguenta bem, mas fica dura quando passa do ponto.",
      "lata": "A costura da lata aguenta menos que o vidro.",
      "barril": "O espaço vazio entra na conta. Tem válvula de alívio, por isso fica longe do limite."
    }[state.envase];
  }

  /* ---------- resultado ---------- */
  function textoResultado(r) {
    var a = r.acucar;
    if (a.id === "natural") {
      if (r.semPriming) return '<div class="cb-destaque"><p class="cb-destaque__rotulo">Não precisa</p><p class="cb-destaque__valor">0 <small>pontos</small></p><p class="cb-destaque__sub">A cerveja já está no alvo ou acima dele.</p></div>';
      return '<div class="cb-destaque"><p class="cb-destaque__rotulo">Feche o barril com</p>' +
        '<p class="cb-destaque__valor">' + (isFinite(r.densidadeFechar) ? r.densidadeFechar.toFixed(3) : "—") + " <small>SG</small></p>" +
        '<p class="cb-destaque__sub">' + num(r.pontos, 1) + " pontos acima da densidade final</p></div>" +
        '<p class="cb-nota">Por segurança, regule a válvula de spunding em <b>' + num(r.valvulaBar, 1) + " bar</b>: é a pressão que segura " + num(r.alvo, 1) +
        " volumes a " + num(val("tempC"), 0) + " °C. Se a densidade final for outra, a válvula alivia o excesso. Precisa de um recipiente que aguente a pressão.</p>";
    }
    var nome = a.nome.split(" (")[0].toLowerCase();
    if (r.semPriming) {
      return '<div class="cb-destaque"><p class="cb-destaque__rotulo">Não precisa de açúcar</p><p class="cb-destaque__valor">0 <small>g</small></p>' +
        '<p class="cb-destaque__sub">A cerveja já tem ' + num(r.residual, 2) + " volumes, no alvo ou acima dele. Açúcar a mais deixaria carbonatada demais.</p></div>";
    }
    if (state.modo === "garrafa") {
      return '<p class="cb-tabela__titulo">' + a.nome + " em cada garrafa</p>" +
        '<table class="cb-tabela cb-tabela--garrafas"><thead><tr><th scope="col">Garrafa</th><th scope="col">Açúcar</th><th scope="col">No lote</th></tr></thead><tbody>' +
        r.garrafas.map(function (x) {
          return '<tr data-ml="' + x.ml + '"><td>' + x.ml + " mL</td><td>" + num(x.gramas, 2) + " g</td><td>" + x.quantas + "</td></tr>";
        }).join("") + "</tbody></table>" +
        '<p class="cb-nota">Pese em balança de 0,01 g e coloque direto na garrafa vazia antes de encher. "No lote" é quantas garrafas desse tamanho cabem em ' + num(r.litros, 1) + " L.</p>";
    }
    return '<div class="cb-destaque"><p class="cb-destaque__rotulo">' + a.nome + "</p>" +
      '<p class="cb-destaque__valor">' + g(r.gramas) + " <small>g</small></p>" +
      '<p class="cb-destaque__sub">' + num(r.gramasPorLitro, 2) + " g por litro, para " + num(r.litros, 1) + " L</p></div>" +
      '<p class="cb-nota">Dissolva o ' + nome + " em um pouco de água, ferva, deixe esfriar e misture com cuidado na cerveja antes de envasar.</p>";
  }

  function textoResumo(r) {
    return '<dl class="cb-resumo">' +
      "<div><dt>Já tem</dt><dd>" + num(r.residual, 2) + " <small>vol</small></dd></div>" +
      "<div><dt>Acrescenta</dt><dd>" + num(r.co2, 0) + " <small>g de CO₂</small></dd></div>" +
      "<div><dt>Alvo</dt><dd>" + num(r.alvo, 2) + " <small>vol</small></dd></div>" +
      "</dl>";
  }

  function textoPressao(r) {
    var tipo = r.risco === "perigo" ? "perigo" : r.risco === "atencao" ? "atencao" : "ok";
    var de = NOME_ENVASE[state.envase];
    var veredito = { ok: "Dentro do limite " + de + ".", atencao: "Perto do limite " + de + ": guarde em lugar fresco.", perigo: "Acima do limite seguro " + de + "." }[tipo];
    return '<p class="cb-pressao__valor">' + num(Math.max(r.pressao.total, 0), 1) + " <small>bar</small></p>" +
      status(tipo, "Pressão dentro " + de + " a " + num(r.tempArmazenamento, 0) + " °C (CO₂ e o ar que fica preso). " + veredito) +
      '<p class="cb-nota" id="limites">Limite ' + de + ": atenção a partir de " + num(r.limiteAtencaoBar, 1) + " bar, perigo a partir de " + num(r.limitePerigoBar, 1) + " bar.</p>";
  }

  function textoAvisos(r) {
    var e = r.envase, w = [];
    if (r.risco === "perigo") {
      w.push(status("perigo", {
        "vidro": "<b>Risco de garrafa estourar.</b> Num dia quente, a pressão passa do que a garrafa comum aguenta. Use garrafa reforçada (champanhe) ou baixe o alvo.",
        "vidro-reforcado": "<b>Alto demais até para garrafa reforçada.</b> Baixe o alvo.",
        "pet": "<b>Muito alto para PET.</b> Ela deve inchar bastante; confira se não está dura como pedra no armazenamento.",
        "lata": "<b>Acima do que a costura da lata aguenta.</b> Baixe o alvo ou use garrafas próprias para isso.",
        "barril": "<b>Alto para barril.</b> Aguenta mecanicamente, mas vai sair muita espuma no serviço."
      }[state.envase]));
    } else if (r.risco === "atencao") {
      w.push(status("atencao", state.envase === "vidro"
        ? "<b>Perto do limite da garrafa comum.</b> Garrafas boas guardadas em lugar fresco aguentam; se alguma for ficar no calor, use garrafa reforçada ou baixe o alvo."
        : "<b>Perto do limite desta embalagem.</b> Guarde em lugar fresco e não suba mais o alvo."));
    }
    if (e.espacoVazio && r.espacoVazio > 0 && r.residual - r.semPrimingEquilibrio > 0.08) {
      w.push(status("info", "<b>O espaço vazio puxa a carbonatação para baixo.</b> Sem açúcar, esta cerveja cairia de " + num(r.residual, 2) +
        " para cerca de " + num(r.semPrimingEquilibrio, 2) + " volumes, porque parte do CO₂ vai para o espaço vazio. O açúcar acima já cobre isso."));
    }
    w.push(status("info", "<b>Precisa de levedura viva.</b> A carbonatação só acontece se ainda houver levedura em suspensão. Cerveja maturada por muito tempo, filtrada, clarificada ou muito tempo gelada pode precisar de um pouco de fermento novo no envase."));
    return w.join("");
  }

  /* ---------- ciclo ---------- */
  function calcular() {
    var r = C.calcular({
      envase: state.envase, litros: campo("litros"), tempC: campo("tempC"), alvo: campo("alvo"),
      inicio: state.inicio, pressaoBar: campo("pressaoBar"), acucar: state.acucar,
      espacoVazio: campo("espacoVazio"), tempArmazenamento: C.TEMP_SEGURANCA_C, densidadeFinal: campo("densidadeFinal")
    });
    var alvo = val("alvo");
    $("alvoEco").textContent = alvo > 0 ? "≈ " + num(alvo * C.G_POR_VOL_L, 1) + " g de CO₂ por litro." : "";
    if (!r.valido) {
      $("resultado").innerHTML = '<p class="cb-nota">Preencha volume, temperatura e alvo.</p>';
      ["resumo", "pressao", "avisos", "outros", "residualEco"].forEach(function (id) { $(id).innerHTML = ""; });
      return;
    }
    $("residualEco").innerHTML = state.inicio === "pressao"
      ? "Com essa pressão e temperatura, a cerveja tem <b>" + num(r.residual, 2) + " volumes</b> de CO₂."
      : "Nessa temperatura, a cerveja ficou com <b>" + num(r.residual, 2) + " volumes</b> de CO₂.";
    $("resultado").innerHTML = textoResultado(r);
    $("resumo").innerHTML = textoResumo(r);
    $("pressao").innerHTML = textoPressao(r);
    $("avisos").innerHTML = textoAvisos(r);
    $("outrosBloco").hidden = r.acucar.id === "natural" || r.semPriming;
    $("outros").innerHTML = (r.outros || []).map(function (o) {
      return '<tr data-acucar="' + o.id + '"' + (o.id === r.acucar.id ? ' class="cb-atual"' : "") + "><th scope=\"row\">" + o.nome + "</th><td>" + g(o.gramas) + " g</td><td>" +
        num(o.gramas * 0.5 / r.litros, 2) + " g</td></tr>";
    }).join("");
  }

  /* ---------- eventos ---------- */
  document.querySelectorAll("[data-envase]").forEach(function (b) {
    b.addEventListener("click", function () { state.envase = b.dataset.envase; aplicarEnvase(); calcular(); });
  });
  document.querySelectorAll("[data-inicio]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.inicio = b.dataset.inicio;
      marcar("data-inicio", state.inicio);
      $("pressaoCampo").hidden = state.inicio !== "pressao";
      calcular();
    });
  });
  document.querySelectorAll("[data-modo]").forEach(function (b) {
    b.addEventListener("click", function () { state.modo = b.dataset.modo; marcar("data-modo", state.modo); calcular(); });
  });
  $("estilo").addEventListener("change", function () {
    if ($("estilo").value) { $("alvo").value = $("estilo").value; calcular(); }
  });
  $("acucar").addEventListener("change", function () { state.acucar = $("acucar").value; aplicarAcucar(); calcular(); });
  $("alvo").addEventListener("input", function () { $("estilo").value = ""; calcular(); });
  ["litros", "tempC", "pressaoBar", "espacoVazio", "densidadeFinal"].forEach(function (id) {
    $(id).addEventListener("input", calcular);
  });

  $("tempSeguranca").textContent = C.TEMP_SEGURANCA_C;
  BF.rodape("Ferramenta de Henrique Boaventura");
  aplicarEnvase();
  aplicarAcucar();
  calcular();
})();
