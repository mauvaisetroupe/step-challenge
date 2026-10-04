#!/bin/bash

set -euo pipefail

APP_DIR="/opt/step-challenge"
SERVICE_NAME="step-challenge-api"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "==> Updating package lists"
apt update

echo "==> Installing required packages"
apt install -y \
  curl \
  ca-certificates \
  build-essential

echo "==> Checking Node.js"

if command -v node >/dev/null 2>&1; then
    NODE_VERSION="$(node --version)"
    echo "Node.js already installed: ${NODE_VERSION}"
else
    echo "Installing Node.js 24..."

    if [ ! -f /etc/apt/sources.list.d/nodesource.list ]; then
        curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    fi

    apt install -y nodejs
fi

echo "Node.js: $(node --version)"
echo "npm:     $(npm --version)"

echo "==> Creating application directory"

mkdir -p "$APP_DIR"
chown root:root "$APP_DIR"

echo "==> Configuring systemd service"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Step Challenge API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR/backend
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo
echo "=========================================="
echo " Step Challenge server setup complete"
echo "=========================================="
echo
echo "Node.js : $(node --version)"
echo "npm     : $(npm --version)"
echo "App     : $APP_DIR"
echo "Service : $SERVICE_NAME"
echo
echo "The service has NOT been started."
echo