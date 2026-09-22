/*
 * Busca da ferramenta 01 — funções puras, sem DOM.
 * Exportadas em window.BFBusca (navegador) e module.exports (Node, testes).
 */
(function (raiz) {
  "use strict";

  // minúsculas, sem acento e só letras/números: "SafAle US-05" -> "safaleus05"
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // Prepara as leveduras para a busca (uma vez só, ao carregar os dados).
  function indexar(db) {
    db.leveduras.forEach(function (y) {
      var fab = db.fabricantes[y.fab] ? db.fabricantes[y.fab].nome : y.fab;
      y._busca = norm([y.nome, y.codigo, fab, y.origem].join(" "));
      y._codigo = norm(y.codigo);
      y._nome = norm(y.nome);
      y._fab = fab;
    });
    return db;
  }

  /*
   * Busca por texto e categoria.
   * - Ignora acento, caixa, hífen e espaço ("us05" = "US-05").
   * - Com várias palavras, cada uma precisa aparecer em algum campo, em
   *   qualquer ordem ("imperial l17", "l17 imperial", "white labs wlp001").
   * - Ordem: código exato, código/nome que começa com um termo, o resto;
   *   descontinuadas por último; depois fabricante e nome.
   */
  function buscar(db, texto, categoria) {
    var q = norm(texto);
    var termos = String(texto || "").split(/\s+/).map(norm).filter(Boolean);
    function peso(y) {
      if (!q) return 2;
      if (y._codigo === q || termos.indexOf(y._codigo) > -1) return 0;
      return termos.some(function (t) { return y._codigo.indexOf(t) === 0 || y._nome.indexOf(t) === 0; }) ? 1 : 2;
    }
    return db.leveduras.filter(function (y) {
      if (categoria && categoria !== "todas" && y.cat !== categoria) return false;
      if (!q || y._busca.indexOf(q) > -1) return true;
      return termos.every(function (t) { return y._busca.indexOf(t) > -1; });
    }).sort(function (a, b) {
      return peso(a) - peso(b) ||
        (a.descontinuada ? 1 : 0) - (b.descontinuada ? 1 : 0) ||
        a._fab.localeCompare(b._fab) || a.nome.localeCompare(b.nome);
    });
  }

  // ?levedura=<id>, aceitando também só o código ("us-05" -> "fermentis-us-05")
  function resolverId(db, param) {
    if (!param) return null;
    for (var i = 0; i < db.leveduras.length; i++) if (db.leveduras[i].id === param) return param;
    var q = norm(param);
    for (var j = 0; j < db.leveduras.length; j++) if (db.leveduras[j]._codigo === q) return db.leveduras[j].id;
    return null;
  }

  var api = { norm: norm, indexar: indexar, buscar: buscar, resolverId: resolverId };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.BFBusca = api;
})(typeof self !== "undefined" ? self : this);
