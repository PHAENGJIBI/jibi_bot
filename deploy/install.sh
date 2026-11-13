#!/usr/bin/env bash
# JIBI — ติดตั้งบน VPS (Ubuntu 22.04/24.04) · รันด้วย root:
#   bash install.sh git@github.com:<OWNER>/<REPO>.git
set -euo pipefail
REPO="${1:?ใส่ที่อยู่ repo เช่น git@github.com:pshop/jibi.git}"
APP=/opt/jibi
GUILD_DEFAULT=1245771682833109032

echo "▶ 1/6 ติดตั้งโปรแกรมพื้นฐาน..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y git curl ca-certificates >/dev/null
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
timedatectl set-timezone Asia/Vientiane || true
# swap 1GB กัน RAM ไม่พอตอน npm install
if ! swapon --show | grep -q swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "▶ 2/6 สร้างผู้ใช้ jibi + กุญแจ GitHub..."
id jibi >/dev/null 2>&1 || useradd -r -m -d /home/jibi -s /bin/bash jibi
sudo -u jibi mkdir -p /home/jibi/.ssh
[ -f /home/jibi/.ssh/id_ed25519 ] || sudo -u jibi ssh-keygen -q -t ed25519 -N "" -f /home/jibi/.ssh/id_ed25519 -C jibi-vps
sudo -u jibi bash -c 'ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null'
echo
echo "================ ก๊อปบรรทัดข้างล่างนี้ทั้งบรรทัด ================"
cat /home/jibi/.ssh/id_ed25519.pub
echo "=============================================================="
echo "เอาไปวางที่ GitHub → repo → Settings → Deploy keys → Add deploy key"
echo "ติ๊ก ✅ Allow write access แล้วกด Add key"
read -rp "วางเสร็จแล้วกด Enter... " _

echo "▶ 3/6 ดึงโค้ด JIBI..."
if [ ! -d "$APP/.git" ]; then
  mkdir -p "$APP" && chown jibi:jibi "$APP"
  sudo -u jibi git clone -q "$REPO" "$APP"
fi
sudo -u jibi git -C "$APP" config user.name "JIBI VPS"
sudo -u jibi git -C "$APP" config user.email "jibi-vps@localhost"
sudo -u jibi git -C "$APP" config pull.rebase true
sudo -u jibi git -C "$APP" config rebase.autoStash true
(cd "$APP" && sudo -u jibi npm ci --omit=dev --no-fund --no-audit >/dev/null 2>&1 || sudo -u jibi npm install --omit=dev --no-fund --no-audit >/dev/null)

echo "▶ 4/6 ใส่ token บอท (ไม่แสดงบนจอ / ไม่ขึ้น GitHub)..."
sudo -u jibi mkdir -p "$APP/data"
if [ ! -f "$APP/data/settings.json" ] || ! grep -q '"token"' "$APP/data/settings.json"; then
  read -rsp "วาง DISCORD TOKEN แล้วกด Enter (ตัวอักษรจะไม่ขึ้น): " TOKEN; echo
  [ -n "$TOKEN" ] || { echo "❌ ไม่ได้ใส่ token"; exit 1; }
  TOKEN="$TOKEN" GID="$GUILD_DEFAULT" node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({token:process.env.TOKEN,guildId:process.env.GID,autoStart:true},null,2))' "$APP/data/settings.json"
  chown jibi:jibi "$APP/data/settings.json"; chmod 600 "$APP/data/settings.json"
  unset TOKEN
fi

echo "▶ 5/6 ตั้งให้ JIBI เปิดเองตลอด 24 ชม. + อัปเดตเองทุก 1 นาที..."
install -m 644 "$APP/deploy/jibi.service" /etc/systemd/system/jibi.service
install -m 644 "$APP/deploy/jibi-sync.service" /etc/systemd/system/jibi-sync.service
install -m 644 "$APP/deploy/jibi-sync.timer" /etc/systemd/system/jibi-sync.timer
chmod +x "$APP/deploy/sync.sh"
systemctl daemon-reload
systemctl enable --now jibi.service jibi-sync.timer

echo "▶ 6/6 เช็กสถานะ..."
sleep 15
systemctl --no-pager --lines=0 status jibi.service | head -5
tail -n 5 "$APP/data/app.log" 2>/dev/null || journalctl -u jibi -n 10 --no-pager
echo
echo "✅ เสร็จแล้ว — ปิดหน้าต่างนี้ได้ JIBI จะทำงานเองตลอด"
