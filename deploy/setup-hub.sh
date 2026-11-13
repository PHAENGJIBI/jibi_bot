#!/usr/bin/env bash
# ติดตั้งหน้าเว็บ JIBI Center Hub (HTTPS) — รันด้วย root ครั้งเดียว:  bash /opt/jibi/deploy/setup-hub.sh
set -euo pipefail
IP=$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')
HOST="$(echo "$IP" | tr . -).sslip.io"
echo "▶ ติดตั้ง Caddy (ทำ HTTPS ให้อัตโนมัติ)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y caddy >/dev/null
cat > /etc/caddy/Caddyfile <<CADDY
$HOST {
  encode gzip
  reverse_proxy 127.0.0.1:3940
}
CADDY
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 80/tcp; ufw allow 443/tcp; fi
echo "▶ ตั้งรหัสผ่านเข้า Hub..."
sudo -u jibi node /opt/jibi/deploy/hub-password.js
echo
echo "✅ เสร็จแล้ว — เปิด JIBI Center Hub ได้ที่:"
echo "   https://$HOST"
