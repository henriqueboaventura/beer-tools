#!/usr/bin/env bash
# Publica o site em PRODUÇÃO: https://www.brassagemforte.com.br/ferramentas/
#
# Fluxo do projeto:
#   1. push em `main`       -> GitHub Pages (ambiente de TESTE)
#   2. testou e está ok     -> este script (PRODUÇÃO)
#
# O que ele faz:
#   - confere que está em `main`, sem mudanças pendentes e igual a origin/main
#     (produção só recebe o que já passou pelo teste no GitHub Pages);
#   - roda os testes e confere que as páginas geradas estão em dia;
#   - exige versão nova (tag producao-vX.Y.Z ainda não existe): é a troca de
#     versão que invalida o cache offline e mostra "Nova versão disponível";
#   - monta o pacote a partir do commit (git archive), só com os arquivos do site;
#   - envia por rsync (comparando conteúdo, não data) para public_html/ferramentas/
#     na Hostinger. O --delete
#     vale SÓ dentro dessa pasta, que é exclusiva deste projeto — nada fora
#     dela é tocado (WordPress, .htaccess, outros apps);
#   - confere a produção no ar e cria a tag producao-vX.Y.Z.
#
# Uso:
#   scripts/deploy-producao.sh            # publica
#   scripts/deploy-producao.sh --simular  # mostra o que seria enviado, sem enviar
#
# Credenciais: .env.deploy na raiz (gitignored). Modelo em .env.deploy.example.
set -euo pipefail
cd "$(dirname "$0")/.."

SIMULAR=0
[ "${1:-}" = "--simular" ] && SIMULAR=1

URL_PRODUCAO="https://www.brassagemforte.com.br/ferramentas/"
passo() { printf '\n==> %s\n' "$1"; }
erro() { printf 'ERRO: %s\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- checagens
passo "Conferindo o repositório"
[ "$(git branch --show-current)" = "main" ] || erro "produção só sai de 'main' (você está em '$(git branch --show-current)')."
git diff --quiet && git diff --cached --quiet || erro "há mudanças não commitadas."
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || \
  erro "main local difere de origin/main. Faça push e teste no GitHub Pages antes de publicar."

VERSAO=$(sed -nE 's/^self\.BF_VERSAO = "([0-9.]+)";/\1/p' assets/js/versao.js)
[ -n "$VERSAO" ] || erro "versão não encontrada em assets/js/versao.js."
TAG="producao-v$VERSAO"
git fetch -q --tags origin
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  erro "a versão $VERSAO já foi publicada em produção ($TAG). Suba a versão em assets/js/versao.js + CHANGELOG.md."
fi
echo "versão $VERSAO, commit $(git rev-parse --short HEAD)"

passo "Testes"
npm test --silent >/dev/null 2>&1 || { npm test; erro "testes falharam."; }
echo "ok"
python3 scripts/gerar_seo.py >/dev/null
git diff --quiet -- sitemap.xml ferramentas/substituicao-leveduras/levedura || \
  erro "páginas geradas desatualizadas: rode python3 scripts/gerar_seo.py e faça commit."

# ---------------------------------------------------------------- credenciais
[ -f .env.deploy ] || erro "falta .env.deploy (veja .env.deploy.example)."
# shellcheck disable=SC1091
set -a; source .env.deploy; set +a
for v in BF_SSH_HOST BF_SSH_USER BF_SSH_PORT BF_DESTINO; do
  [ -n "${!v:-}" ] || erro "variável $v não definida em .env.deploy."
done
case "$BF_DESTINO" in
  */public_html/ferramentas|*/public_html/ferramentas/) ;;
  *) erro "BF_DESTINO precisa terminar em public_html/ferramentas (é a única pasta que o deploy pode tocar)." ;;
esac
SSH_CMD="ssh -p $BF_SSH_PORT -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -o PasswordAuthentication=yes"
if [ -n "${BF_SSH_PASS:-}" ]; then
  command -v sshpass >/dev/null || erro "instale o sshpass (ou configure chave SSH e deixe BF_SSH_PASS vazio)."
  export SSHPASS="$BF_SSH_PASS"
  SSH_CMD="sshpass -e $SSH_CMD"
fi

# ---------------------------------------------------------------- pacote
passo "Montando o pacote a partir do commit"
PACOTE=$(mktemp -d)
trap 'rm -rf "$PACOTE"' EXIT
git archive HEAD | tar -x -C "$PACOTE"
( cd "$PACOTE" && rm -rf .github docs dados scripts tests examples package.json .gitignore .nojekyll .env.deploy.example 404.html \
    ferramentas/*/tests ferramentas/decoccao/scripts && find . -name '*.md' -delete )
echo "$(find "$PACOTE" -type f | wc -l | tr -d ' ') arquivos, $(du -sh "$PACOTE" | cut -f1)"

# ---------------------------------------------------------------- envio
if [ "$SIMULAR" = 1 ]; then
  passo "SIMULAÇÃO: o que mudaria em produção (nada é enviado)"
  rsync -az --checksum --delete --dry-run --itemize-changes -e "$SSH_CMD" "$PACOTE/" "$BF_SSH_USER@$BF_SSH_HOST:${BF_DESTINO%/}/" \
    | grep -v '^\.' | head -60 || true
  echo "(simulação — rode sem --simular para publicar)"
  exit 0
fi

passo "Enviando para ${BF_DESTINO%/}/"
rsync -az --checksum --delete --stats -e "$SSH_CMD" "$PACOTE/" "$BF_SSH_USER@$BF_SSH_HOST:${BF_DESTINO%/}/" \
  | grep -E 'Number of files transferred|Number of deleted files|Total transferred file size' || true

# ---------------------------------------------------------------- verificação
passo "Conferindo a produção"
publicada=$(curl -s "${URL_PRODUCAO}assets/js/versao.js?v=$RANDOM" | sed -nE 's/.*BF_VERSAO = "([0-9.]+)".*/\1/p')
[ "$publicada" = "$VERSAO" ] || erro "produção responde versão '$publicada', esperado '$VERSAO'."
for caminho in "" ferramentas/substituicao-leveduras/ ferramentas/decoccao/ sitemap.xml sw.js; do
  codigo=$(curl -s -o /dev/null -w '%{http_code}' "${URL_PRODUCAO}${caminho}")
  [ "$codigo" = 200 ] || erro "${URL_PRODUCAO}${caminho} respondeu $codigo."
done
echo "ok: versão $VERSAO no ar"

git tag -a "$TAG" -m "Produção $VERSAO ($URL_PRODUCAO)"
git push -q origin "$TAG"
passo "Publicado: $URL_PRODUCAO (tag $TAG)"
