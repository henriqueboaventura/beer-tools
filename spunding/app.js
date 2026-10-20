(function () {
  "use strict";

  var S = window.BFSpunding;
  var C = window.BFCarbonatacao;
  var $ = function (id) { return document.getElementById(id); };

  var state = { fermentador: "pet" };

  function num(n, casas) { return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }); }
  function bar(x) { return num(Math.max(x, 0), 2) + " bar"; }
  function sg(x) { return x.toFixed(3); }
  function graus(t) { return num(t, 0) + " °C"; }
  function campo(id) { var v = $(id).value; return v === "" ? "" : parseFloat(v); }
  function marcar(attr, valor) {
    document.querySelectorAll("[" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute(attr) === valor)); });
  }
  function status(tipo, html) { return '<p class="spd-status spd-status--' + tipo + '">' + html + "</p>"; }
  // faixa de pressão: "aberto", "0,70 bar", "0,70–1,00 bar"
  function faixa(f) {
    if (f[0] === 0 && f[1] === 0) return "aberto (0 bar)";
    return f[0] === f[1] ? bar(f[0]) : (f[0] === 0 ? "0" : num(f[0], 2)) + "–" + bar(f[1]);
  }

  var DO_FERMENTADOR = { "pet": "do Fermzilla / PET", "corny": "do barril corny", "inox": "do inox", "outro": "do fermentador" };

  /* ---------- listas ---------- */
  $("grupo").innerHTML = S.GRUPOS.map(function (g) { return '<option value="' + g.id + '">' + g.nome + "</option>"; }).join("");

  function grupo() { return S.grupoPorId($("grupo").value); }

  function aplicarGrupo() {
    var g = grupo();
    $("grupoExemplos").textContent = g.exemplos + ".";
    $("grupoPorque").textContent = g.porque;
    $("tempC").value = g.tempC;
    $("alvo").value = g.alvo;
    $("pressaoFinal").value = S.pressaoFinalSugerida(g, campo("maxBar"));
    textoDica();
  }

  function textoDica() {
    var g = grupo();
    $("pressaoDica").innerHTML = "Sugerido para o estilo: válvula em <b>" + faixa(g.fases[2]) + "</b> no fim. Carbonatação típica: <b>" +
      num(g.faixa[0], 1) + "–" + num(g.faixa[1], 1) + " vol</b> (" + (g.fonteFaixa || "BYO") + ").";
  }

  function aplicarFermentador() {
    var f = S.FERMENTADORES[state.fermentador];
    marcar("data-fermentador", state.fermentador);
    $("fermentadorNota").textContent = f.nota;
    if (f.capacidade) $("capacidade").value = f.capacidade;
    if (f.maxBar) $("maxBar").value = f.maxBar;
    $("segurancaTitulo").textContent = "Segurança " + DO_FERMENTADOR[state.fermentador];
  }

  /* ---------- plano ---------- */
  function textoResultado(r) {
    var g = r.grupo, sub;
    if (!r.sobe) {
      return '<div class="spd-destaque"><p class="spd-destaque__rotulo">Válvula em</p><p class="spd-destaque__valor">' + num(r.pressaoFinal, 2) + " <small>bar</small></p>" +
        '<p class="spd-destaque__sub">desde a fermentação ativa, sem mudar no fim</p></div>';
    }
    if (r.subirNaInoculacao) sub = "desde o começo: a fermentação não tem pontos sobrando para subir depois";
    else sub = "em " + sg(r.densidadeSubir) + " SG (" + r.pontosSubir + " pontos acima da final)";
    return '<div class="spd-destaque"><p class="spd-destaque__rotulo">' + (g.uso === "fim" ? "Fermente aberto e feche em" : "Suba a válvula para") + "</p>" +
      '<p class="spd-destaque__valor">' + num(r.pressaoFinal, 2) + " <small>bar</small></p>" +
      '<p class="spd-destaque__sub">' + sub + "</p></div>";
  }

  function textoResumo(r) {
    return '<dl class="spd-resumo">' +
      "<div><dt>No quente</dt><dd>" + num(r.volumesQuente, 1) + " <small>vol</small></dd></div>" +
      (r.pronta
        ? "<div><dt>Depois do crash</dt><dd>pronta</dd></div>"
        : "<div><dt>Depois do crash</dt><dd>" + num(r.pressaoFria, 2) + " <small>bar</small></dd></div>") +
      "<div><dt>Alvo</dt><dd>" + num(r.alvo, 1) + " <small>vol</small></dd></div>" +
      "</dl>";
  }

  function fases(r) {
    var g = r.grupo, t = graus(r.tempC), lista = [];
    var ativa = [Math.min(g.fases[1][0], r.pressaoFinal), Math.min(g.fases[1][1], r.pressaoFinal)];
    lista.push(["Inoculação, primeiros 1–2 dias", t, faixa(g.fases[0]),
      "Até o krausen subir e o manômetro começar a subir sozinho. Oxigene e inocule normalmente antes de fechar."]);
    lista.push(["Fermentação ativa", t, faixa(ativa),
      (r.sobe && !r.subirNaInoculacao ? "Até a densidade chegar em " + sg(r.densidadeSubir) + "." : "Até a densidade chegar na final, " + sg(r.fg) + ".") +
      (g.lupulo ? " Faça o dry hop enquanto ainda faltam alguns pontos, para a levedura consumir o oxigênio." : "")]);
    if (r.sobe) {
      lista.push([g.uso === "fim" ? "Feche perto do fim" : "Suba para carbonatar", t, bar(r.pressaoFinal),
        "Até a densidade ficar 2 dias parada na final, " + sg(r.fg) + "." + (g.lupulo ? " Suba a válvula depois do último dry hop." : "")]);
    }
    lista.push(["Descanso de diacetil", r.tempC >= 16 ? t : "17–18 °C", "mantenha " + bar(r.pressaoFinal),
      "2 a 3 dias depois da densidade final, até uma amostra aquecida não ter gosto de manteiga."]);
    lista.push(["Cold crash", graus(r.tempFria), "CO₂ ligado em " + bar(r.pressaoCrash),
      "1 a 2 dias. Ligue o CO₂ antes de começar a resfriar: a pressão cai e, sem gás, o fermentador puxa ar."]);
    if (r.pronta) {
      lista.push(["Servir ou transferir", graus(r.tempFria), "mantenha " + bar(r.pressaoFria), "Já está com " + num(r.volumesQuente, 1) + " volumes."]);
    } else {
      lista.push(["Carbonatar", graus(r.tempFria), bar(r.pressaoFria),
        "Cerca de uma semana nessa pressão, ou um ou dois dias com pedra de carbonatação. Depois sirva direto ou transfira para barris."]);
    }
    return lista.map(function (f) {
      return "<li><strong>" + f[0] + '</strong><span class="spd-fase__meta">' + f[1] + " · " + f[2] + "</span><p>" + f[3] + "</p></li>";
    }).join("");
  }

  function textoSeguranca(r) {
    var de = DO_FERMENTADOR[state.fermentador];
    var h = '<p class="spd-seguranca__valor">' + num(r.pressaoMaxPlano, 2) + " <small>bar</small></p>";
    var msg = "A maior pressão do plano";
    if (r.risco === "desconhecido") return h + status("info", msg + ". <b>Informe a pressão máxima " + de + "</b> no passo 02 para conferir.");
    var limite = " (máximo " + bar(r.maxBar) + ")";
    return h + status(r.risco, msg + {
      ok: ": dentro do limite " + de + limite + ".",
      atencao: ": perto do limite " + de + limite + ". Confira a válvula de alívio e não suba mais.",
      perigo: ": <b>acima do limite " + de + "</b>" + limite + ". Baixe a válvula e complete a carbonatação no frio, ou use um fermentador que aguente."
    }[r.risco]);
  }

  function textoAvisos(r) {
    var g = r.grupo;
    var textos = {
      "esteres": status("atencao", "<b>Pressão alta para este estilo antes do fim.</b> Mais de " + bar(g.fases[2][1]) +
        " antes de a fermentação acabar achata os ésteres e fenóis do estilo. Deixe a válvula aberta e carbonate no frio."),
      "lager-quente": status("atencao", "<b>Lager acima de 20 °C ganha ésteres mesmo sob pressão.</b> O normal é 17–20 °C."),
      "lager-fria": status("info", "A " + graus(r.tempC) + ", a lager fica limpa sem pressão. Use a válvula perto do fim, para carbonatar e proteger do oxigênio."),
      "forte": status("info", "<b>Cerveja forte (" + sg(r.og) + ").</b> Inocule bastante levedura saudável, com starter grande ou vários pacotes, e oxigene bem antes de colocar pressão."),
      "capacidade": status("perigo", "<b>A cerveja não cabe no fermentador.</b> Confira o volume e a capacidade."),
      "krausen": status("atencao", "<b>Quase sem espaço vazio.</b> Deixe lugar para o krausen: a maioria enche o fermentador até 75–85%."),
      "garrafa": status("info", "<b>Alvo acima de 3,5 volumes.</b> Garrafa comum não aguenta: veja a garrafa reforçada na <a href=\"../carbonatacao/\">calculadora de carbonatação</a>.")
    };
    return r.avisos.map(function (a) { return textos[a]; }).join("");
  }

  function numeros(r) {
    var l = [];
    if (r.sobe) {
      l.push("Ir de " + bar(r.pressaoAtiva) + " para " + bar(r.pressaoFinal) + " pede cerca de <b>" + num(r.pontos, 1) + " pontos</b> de densidade" +
        (r.espacoVazio > 0 ? ", contando encher os " + num(r.espacoVazio, 1) + " L de espaço vazio" : "") +
        ". Por segurança, suba em <b>" + (r.subirNaInoculacao ? "qualquer momento" : sg(r.densidadeSubir)) + "</b>: depois de chegar em " + bar(r.pressaoFinal) + ", a válvula solta o resto.");
    }
    l.push("A " + graus(r.tempC) + " e " + bar(r.pressaoFinal) + ", a cerveja segura <b>" + num(r.volumesQuente, 2) + " volumes</b> de CO₂.");
    l.push("Para ter " + num(r.alvo, 1) + " volumes no quente seriam <b>" + bar(r.pressaoAlvoQuente) + "</b>" +
      (r.alvoQuentePassaMax ? ", acima da pressão máxima do fermentador. Por isso a carbonatação termina no frio." : "."));
    if (!r.pronta) l.push("Depois do cold crash, a " + graus(r.tempFria) + ", " + num(r.alvo, 1) + " volumes pedem <b>" + bar(r.pressaoFria) + "</b>.");
    l.push("Cada ponto de densidade fermentado gera cerca de " + num(C.CO2_POR_PONTO_GL / C.G_POR_VOL_L, 2) + " volume de CO₂ (" + num(C.CO2_POR_PONTO_GL, 2) + " g por litro).");
    return l.map(function (x) { return "<li>" + x + "</li>"; }).join("");
  }

  function tabela(r) {
    return r.tabela.map(function (x) {
      var atual = Math.abs(x.tempC - r.tempFria) < 1 || Math.abs(x.tempC - r.tempC) < 1;
      var acima = r.maxBar > 0 && x.bar > r.maxBar;
      return "<tr" + (atual ? ' class="spd-atual"' : "") + '><th scope="row">' + graus(x.tempC) + (acima ? " <small>acima do máximo</small>" : "") +
        "</th><td>" + bar(x.bar) + "</td></tr>";
    }).join("");
  }

  /* ---------- ciclo ---------- */
  var SAIDAS = ["resultado", "resumo", "fases", "seguranca", "avisos", "numeros", "tabela", "agora"];

  function calcular() {
    var r = S.calcular({
      grupo: $("grupo").value, fermentador: state.fermentador, maxBar: campo("maxBar"), capacidade: campo("capacidade"),
      litros: campo("litros"), og: campo("og"), fg: campo("fg"), tempC: campo("tempC"),
      pressaoFinal: campo("pressaoFinal"), alvo: campo("alvo"), tempFria: campo("tempFria"),
      agoraTemp: campo("agoraTemp"), agoraBar: campo("agoraBar")
    });
    var cap = campo("capacidade"), litros = campo("litros");
    $("espacoEco").innerHTML = cap > 0 && litros > 0
      ? "Espaço vazio no fermentador: <b>" + num(Math.max(cap - litros, 0), 1) + " L</b>. Ele também precisa encher de CO₂."
      : "Sem a capacidade, a conta ignora o espaço vazio.";
    if (!r.valido) {
      SAIDAS.forEach(function (id) { $(id).innerHTML = ""; });
      $("resultado").innerHTML = '<p class="spd-nota">' + (r.erro === "densidade"
        ? "A densidade inicial precisa ser maior que a final."
        : "Preencha volume, temperaturas, pressão da válvula e alvo.") + "</p>";
      return;
    }
    $("resultado").innerHTML = textoResultado(r);
    $("resumo").innerHTML = textoResumo(r);
    $("fases").innerHTML = fases(r);
    $("seguranca").innerHTML = textoSeguranca(r);
    $("avisos").innerHTML = textoAvisos(r);
    $("numeros").innerHTML = numeros(r);
    $("tabelaTitulo").textContent = "Tabela de carbonatação para " + num(r.alvo, 1) + " volumes";
    $("tabela").innerHTML = tabela(r);
    $("agora").innerHTML = r.agora
      ? '<p class="spd-eco">A cerveja tem <b>' + num(r.agora.volumes, 2) + " volumes</b> de CO₂" +
        (r.agora.falta > 0.05 ? "; faltam " + num(r.agora.falta, 2) + " para o alvo." : ", no alvo ou acima dele.") + "</p>"
      : '<p class="spd-nota">Preencha a temperatura da cerveja e o manômetro.</p>';
  }

  /* ---------- eventos ---------- */
  document.querySelectorAll("[data-fermentador]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.fermentador = b.dataset.fermentador;
      aplicarFermentador();
      // a pressão final sugerida não passa do novo máximo
      var max = campo("maxBar");
      if (max > 0 && campo("pressaoFinal") > max) $("pressaoFinal").value = max;
      calcular();
    });
  });
  $("grupo").addEventListener("change", function () { aplicarGrupo(); calcular(); });
  ["capacidade", "maxBar", "litros", "tempC", "og", "fg", "pressaoFinal", "alvo", "tempFria", "agoraTemp", "agoraBar"].forEach(function (id) {
    $(id).addEventListener("input", calcular);
  });

  BF.rodape("Ferramenta de Henrique Boaventura");
  aplicarFermentador();
  aplicarGrupo();
  calcular();
})();
