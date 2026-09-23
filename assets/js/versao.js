// Versão do site (SemVer) — fonte única, lida pelo shell (rodapé) e pelo
// service worker (nome do cache). Toda publicação em `main` que muda
// qualquer arquivo do site deve subir este número e ganhar uma entrada no
// CHANGELOG.md: é a troca de versão que invalida o cache offline antigo e
// faz aparecer o aviso "Nova versão disponível" para quem já tem o site aberto.
//
// `self` (e não `window`/`const`) porque o arquivo roda tanto na página
// quanto dentro do service worker (importScripts).
self.BF_VERSAO = "1.2.1";
