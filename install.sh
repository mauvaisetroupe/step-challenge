#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$APP_DIR/apps/mobile/android"
APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
REMOTE="root@192.168.1.7:/opt/step-challenge/download/step-challenge.apk"

echo "======================================"
echo " Step Challenge - Build & Install"
echo "======================================"

cd "$APP_DIR"

echo
echo "▶ Build APK release"
cd "$ANDROID_DIR"
NODE_ENV=production ./gradlew assembleRelease

echo
echo "▶ Copie de l'APK"
scp "$APK" "$REMOTE"

echo
echo "======================================"
echo " Installation terminée ✓"
echo "======================================"
echo
echo "APK disponible sur :"
echo "https://step.architech.lu/download/step-challenge.apk"
```
