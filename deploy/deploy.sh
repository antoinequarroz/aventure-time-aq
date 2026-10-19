#!/usr/bin/env bash
# Construit le site et l'envoie sur le VPS par rsync (SSH).
#
# Utilisation :
#   DEPLOY_HOST=1.2.3.4 DEPLOY_USER=antoine ./deploy/deploy.sh
#
# Variables :
#   DEPLOY_HOST  adresse IP ou nom du VPS (obligatoire)
#   DEPLOY_USER  utilisateur SSH (défaut : utilisateur courant)
#   DEPLOY_PATH  dossier du site sur le VPS (défaut : /var/www/aventuretime)
#   DEPLOY_PORT  port SSH (défaut : 22)
#   SKIP_BUILD=1 pour envoyer le dossier dist/ existant sans reconstruire
set -euo pipefail

if [ -z "${DEPLOY_HOST:-}" ]; then echo "Indique l’adresse du VPS : DEPLOY_HOST=1.2.3.4 ./deploy/deploy.sh" >&2; exit 1; fi
DEPLOY_USER="${DEPLOY_USER:-$(whoami)}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/aventuretime}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"

cd "$(dirname "$0")/.."

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  npm ci
  npm run build
fi
test -f dist/index.html || { echo "dist/index.html introuvable : le build a échoué ?" >&2; exit 1; }

echo "Envoi de dist/ vers $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH"
# Les fichiers (modèles, images) d'abord, index.html en dernier : les visiteurs
# ne reçoivent jamais une page qui pointe vers des fichiers pas encore arrivés.
rsync -rlz --delay-updates --exclude index.html -e "ssh -p $DEPLOY_PORT" dist/ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
rsync -rlz -e "ssh -p $DEPLOY_PORT" dist/index.html "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/index.html"
# Nettoyage des anciennes versions des fichiers générés.
rsync -rlz --delete -e "ssh -p $DEPLOY_PORT" dist/ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
echo "C'est en ligne : https://aventuretime.antoinequarroz.ch"
