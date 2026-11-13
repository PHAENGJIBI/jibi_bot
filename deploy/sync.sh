#!/usr/bin/env bash
# ทุก 1 นาที: ดึงโค้ด/งานจาก Claude ลงมา · ทุก 10 นาที (หรือมีผลงาน) ส่งข้อมูล+ผลงานขึ้น GitHub
set -uo pipefail
cd /opt/jibi
before=$(git rev-parse HEAD)
git add -A data outbox inbox state 2>/dev/null
if ! git diff --cached --quiet; then
  min=$(date +%M)
  if [ -n "$(git diff --cached --name-only -- outbox inbox)" ] || [ $((10#$min % 10)) -eq 0 ]; then
    git commit -qm "vps: data $(date '+%F %H:%M')" || true
  fi
fi
git pull -q --rebase --autostash || { git rebase --abort 2>/dev/null; exit 0; }
git push -q 2>/dev/null || true
after=$(git rev-parse HEAD)
if [ "$before" != "$after" ] && git diff --name-only "$before" "$after" | grep -q '^package\(-lock\)\?\.json$'; then
  npm ci --omit=dev --no-fund --no-audit >/dev/null 2>&1 || npm install --omit=dev --no-fund --no-audit >/dev/null 2>&1
  sudo -n systemctl restart jibi 2>/dev/null || pkill -f "node bot.js" || true
fi
