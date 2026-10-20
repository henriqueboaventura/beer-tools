(function () {
  "use strict";

  var S = window.BFSpunding;
  var $ = function (id) { return document.getElementById(id); };

  var state = { modo: "bar" };
  // valor padrão ao trocar de unidade
  var PADRAO = { bar: 1, vol: 2.5 };

  function num(n, casas) { return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }); }
  function sg(x) { return x.toFixed(3); }
  function campo(id) { var v = $(id).value; return v === "" ? "" : parseFloat(v); }

  function aplicarModo() {
    var bar = state.modo === "bar";
    document.querySelectorAll("[data-modo]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.modo === state.modo)); });
    $("valorRotulo").innerHTML = bar ? "Pressão <span>bar</span>" : "Carbonatação <span>vol</span>";
    $("valor").step = bar ? "0.05" : "0.1";
  }

  function calcular() {
    var r = S.calcular({ modo: state.modo, valor: campo("valor"), tempC: campo("tempC"), litros: campo("litros"),
      capacidade: campo("capacidade"), fg: campo("fg") });
    if (!r.valido) {
      $("detalhe").innerHTML = "";
      var msg = "Preencha a pressão, a temperatura, o volume e a densidade final.";
      if (r.erro === "capacidade") msg = "A cerveja não cabe no fermentador. Confira o volume e a capacidade.";
      if (r.erro === "aberta") msg = "Com a válvula aberta, a " + num(r.tempC, 0) + " °C a cerveja já tem " + num(r.volumesAberta, 2) + " volumes. Não precisa fechar.";
      $("resultado").innerHTML = '<p class="spd-nota">' + msg + "</p>";
      return;
    }
    $("resultado").innerHTML = '<div class="spd-destaque"><p class="spd-destaque__rotulo">Feche a válvula em</p>' +
      '<p class="spd-destaque__valor">' + sg(r.densidadeFechar) + " <small>SG</small></p>" +
      '<p class="spd-destaque__sub">' + r.pontosFechar + " pontos antes da final, com a válvula regulada em " + num(r.bar, 2) + " bar</p></div>";
    $("detalhe").innerHTML = "A " + num(r.tempC, 0) + " °C e " + num(r.bar, 2) + " bar, a cerveja fica com <b>" + num(r.volumes, 2) + " volumes</b> de CO₂. " +
      "A fermentação precisa de cerca de " + num(r.pontos, 1) + " pontos para isso" +
      (r.espacoVazio > 0 ? ", contando encher os " + num(r.espacoVazio, 1) + " L de espaço vazio" : "") + "; a conta soma 1 de folga.";
  }

  document.querySelectorAll("[data-modo]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (state.modo === b.dataset.modo) return;
      state.modo = b.dataset.modo;
      $("valor").value = PADRAO[state.modo];
      aplicarModo();
      calcular();
    });
  });
  ["valor", "tempC", "litros", "capacidade", "fg"].forEach(function (id) { $(id).addEventListener("input", calcular); });

  BF.rodape("Ferramenta de Henrique Boaventura");
  aplicarModo();
  calcular();
})();
