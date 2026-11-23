#!/usr/bin/env bash
# OpenJarvis auf einem eigenen Linux-Server (Ubuntu 24.04) – Bedienung per Telegram vom iPhone.
# Aufruf (als root):  TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... MODEL=qwen3:4b bash setup.sh
set -euo pipefail
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN fehlt (von @BotFather)}"
: "${TELEGRAM_CHAT_ID:?TELEGRAM_CHAT_ID fehlt (z. B. von @userinfobot)}"
MODEL="${MODEL:-qwen3:4b}"
OJ_VERSION="${OJ_VERSION:-1.0.4}"
export DEBIAN_FRONTEND=noninteractive

echo "[1/6] Systempakete und Firewall"
apt-get update -y
apt-get install -y curl ca-certificates python3 python3-venv ufw unattended-upgrades zstd
ufw allow OpenSSH >/dev/null; ufw --force enable >/dev/null   # nur SSH offen – Telegram braucht keine offenen Ports

echo "[2/6] Benutzer jarvis"
id jarvis >/dev/null 2>&1 || useradd -m -s /bin/bash jarvis

echo "[3/6] Ollama (lokale Modelle) und Modell $MODEL"
command -v ollama >/dev/null || curl -fsSL https://ollama.com/install.sh | sh
systemctl enable --now ollama
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:11434/api/version >/dev/null && break; sleep 2; done
ollama pull "$MODEL"

echo "[4/6] OpenJarvis $OJ_VERSION"
sudo -u jarvis python3 -m venv /home/jarvis/venv
sudo -u jarvis /home/jarvis/venv/bin/pip install -q --upgrade pip
sudo -u jarvis /home/jarvis/venv/bin/pip install -q "openjarvis[server,channel-telegram]==${OJ_VERSION}"

echo "[5/6] Konfiguration"
install -d -o jarvis -g jarvis /home/jarvis/.openjarvis
cat > /home/jarvis/.openjarvis/config.toml <<CFG
[engine]
default = "ollama"

[channel]
enabled = true
default_channel = "telegram"
default_agent = "simple"

[channel.telegram]
allowed_chat_ids = "${TELEGRAM_CHAT_ID}"
CFG
chown jarvis:jarvis /home/jarvis/.openjarvis/config.toml
umask 077; printf 'TELEGRAM_BOT_TOKEN=%s\n' "$TELEGRAM_BOT_TOKEN" > /etc/openjarvis.env; chmod 600 /etc/openjarvis.env

echo "[6/6] Dienst starten"
cat > /etc/systemd/system/openjarvis.service <<UNIT
[Unit]
Description=OpenJarvis (Telegram-Bot)
After=network-online.target ollama.service
Wants=network-online.target

[Service]
User=jarvis
EnvironmentFile=/etc/openjarvis.env
ExecStart=/home/jarvis/venv/bin/jarvis serve --host 127.0.0.1 --port 8000 -m ${MODEL}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now openjarvis
sleep 20
systemctl --no-pager --lines=15 status openjarvis || true
echo "Fertig. Schreib deinem Bot in Telegram „Hallo“. Logs: journalctl -u openjarvis -f"
