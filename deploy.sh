#!/bin/bash

set -e

APP_DIR="/opt/step-challenge"

echo "======================================"
echo " Step Challenge - Déploiement"
echo "======================================"

cd "$APP_DIR"

echo
echo "▶ Git pull"
git pull

echo
echo "▶ Backend : installation des dépendances"
cd "$APP_DIR/backend"
npm install --no-audit

echo
echo "▶ Backend : build"
npm run build

echo
echo "▶ Redémarrage du backend"
systemctl restart step-challenge-api

echo
echo "▶ Attente du démarrage du backend"

for i in {1..20}; do
    if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
        echo "Backend disponible ✓"
        break
    fi

    if [ "$i" -eq 20 ]; then
        echo "ERREUR : le backend ne répond pas après 20 secondes"
        systemctl status step-challenge-api --no-pager -l
        exit 1
    fi

    sleep 1
done

echo
echo "▶ Vérification du backend"
curl -fsS http://127.0.0.1:3000/api/health

echo
echo
echo "▶ Vérification via Cloudflare"
curl -fsS https://step.architech.lu/api/health

echo
echo
echo "======================================"
echo " Déploiement terminé avec succès ✓"
echo "======================================"