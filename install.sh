#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$APP_DIR/apps/mobile"
ANDROID_DIR="$MOBILE_DIR/android"
APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
REMOTE_DIR="root@192.168.1.7:/opt/step-challenge/download"

VERSION=$(python3 -c "
import json
with open('$MOBILE_DIR/app.json') as f:
    print(json.load(f)['expo']['version'])
")

VERSION_FILE="$APP_DIR/version.json"

cat > "$VERSION_FILE" <<EOF
{
  "version": "$VERSION",
  "url": "https://step.architech.lu/download/step-challenge.apk"
}
EOF

echo "======================================"
echo " Step Challenge - Build & Deploy"
echo "======================================"

echo
echo "▶ Version : $VERSION"

echo
echo "▶ Build APK release"
cd "$ANDROID_DIR"
NODE_ENV=production ./gradlew assembleRelease

echo
echo "▶ Copie de l'APK"
scp "$APK" "$REMOTE_DIR/step-challenge.apk"

echo
echo "▶ Copie de version.json"
scp "$VERSION_FILE" "$REMOTE_DIR/version.json"

rm "$VERSION_FILE"

echo
echo "======================================"
echo " Déploiement terminé ✓"
echo "======================================"
echo
echo "Version : $VERSION"
echo
echo "APK :"
echo "https://step.architech.lu/download/step-challenge.apk"
echo
echo "Version API :"
echo "https://step.architech.lu/download/version.json"

