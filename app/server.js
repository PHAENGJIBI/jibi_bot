// JIBI Control Center — แอปควบคุม JIBI (เปิดผ่าน JIBI.bat)
// เปิดเว็บเซิร์ฟเวอร์ในเครื่องเท่านั้น (127.0.0.1) แล้วเปิดหน้าต่างแอป
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const { listPlugins, setEnabled } = require('../lib/plugins');
const { readSettings, SETTINGS } = require('../lib/env');

const ROOT = path.join(__dirname, '..');
const PORT = 3939;
const URL = `http://127.0.0.1:${PORT}`;
const STATUS = path.join(ROOT, 'data', 'status.json');
const OUTBOX = path.join(ROOT, 'outbox');

// ---------- log ----------
const logs = [];
const streams = new Set();
function addLog(line, src = 'app') {
  const entry = { t: new Date().toISOString(), src, line: String(line).replace(/\x1b\[[0-9;]*m/g, '') };
  logs.push(entry);
  try { fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true }); fs.appendFileSync(path.join(ROOT, 'data', 'app.log'), `${entry.t} [${src}] ${entry.line}\n`); } catch { /* ignore */ }
  if (logs.length > 800) logs.shift();
  for (const res of streams) res.write(`data: ${JSON.stringify(entry)}\n\n`);
}

// ---------- process management ----------
let bot = null;
let wantRun = false;
let lastExit = null;

function settingsOk() {
  const s = readSettings();
  return !!(s.token && /^\d{15,22}$/.test(String(s.guildId || '')));
}

function pipe(child, src) {
  for (const stream of [child.stdout, child.stderr]) {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString('utf8');
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const l of lines) if (l.trim()) addLog(l, src);
    });
  }
}

function startBot() {
  if (bot) return;
  if (!settingsOk()) { addLog('❌ ยังตั้งค่าไม่ครบ — ใส่รหัสบอทและ ID เซิร์ฟในแท็บ "ตั้งค่า" ก่อน'); wantRun = false; return; }
  wantRun = true;
  addLog('▶️ กำลังเปิด JIBI...');
  bot = spawn(process.execPath, ['bot.js'], { cwd: ROOT, env: { ...process.env, FORCE_COLOR: '0' } });
  pipe(bot, 'bot');
  bot.on('exit', (code) => {
    bot = null;
    lastExit = { code, at: new Date().toISOString() };
    addLog(`ℹ️ JIBI process จบด้วยรหัส ${code}`);
    markOffline();
    if (code === 2) { addLog('⏹ JIBI หยุด (ตั้งค่าไม่ถูก) — แก้ในแท็บ "ตั้งค่า" แล้วกดเปิดใหม่'); wantRun = false; return; }
    if (wantRun) { addLog('🔁 JIBI จะเปิดใหม่ใน 3 วินาที...'); setTimeout(() => wantRun && startBot(), 3000); }
    else addLog('⏹ JIBI ปิดแล้ว');
  });
}

function stopBot() {
  wantRun = false;
  if (bot) bot.kill();
}

function restartBot() {
  if (bot) { wantRun = true; bot.kill(); } else startBot();
}

function markOffline() {
  try {
    const s = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
    s.online = false;
    fs.writeFileSync(STATUS, JSON.stringify(s, null, 2));
  } catch { /* ignore */ }
}

let setupRunning = false;
function runSetup(archive) {
  if (setupRunning) return false;
  if (!settingsOk()) { addLog('❌ ใส่รหัสบอทและ ID เซิร์ฟก่อน'); return false; }
  setupRunning = true;
  const wasRunning = !!bot;
  if (wasRunning) stopBot();
  addLog(`🏗️ เริ่มสร้าง/ซิงก์เซิร์ฟ (ย้ายห้องเก่า: ${archive ? 'ใช่' : 'ไม่'})`);
  const child = spawn(process.execPath, ['setup-server.js'], { cwd: ROOT, env: { ...process.env, FORCE_COLOR: '0', ARCHIVE_OLD_CHANNELS: archive ? 'true' : 'false' } });
  pipe(child, 'setup');
  child.on('exit', () => {
    setupRunning = false;
    addLog('🏁 สร้างเซิร์ฟจบแล้ว');
    if (wasRunning) startBot();
  });
  return true;
}

// ---------- API ----------
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function body(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}
function send(res, code, data, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // อนุญาตเฉพาะจากเครื่องนี้
  const host = req.headers.host || '';
  if (!host.startsWith('127.0.0.1') && !host.startsWith('localhost')) return send(res, 403, { error: 'forbidden' });
  const origin = req.headers.origin;
  if (req.method !== 'GET' && origin && !origin.startsWith(URL) && !origin.startsWith(`http://localhost:${PORT}`)) return send(res, 403, { error: 'forbidden' });

  const u = new globalThis.URL(req.url, URL);
  try {
    if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'ui.html'), 'utf8'), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && u.pathname === '/api/status') {
      const s = readSettings();
      const st = readJson(STATUS) || {};
      const bridge = readJson(path.join(OUTBOX, 'bridge-status.json'));
      const lastSync = readJson(path.join(OUTBOX, 'last-sync.json'));
      const setupResult = readJson(path.join(ROOT, 'data', 'setup-result.json'));
      return send(res, 200, {
        running: !!bot, wantRun, setupRunning, lastExit,
        configured: settingsOk(),
        online: !!bot && st.online && Date.now() - new Date(st.at).getTime() < 90000,
        bot: st.bot || null, guild: st.guild || null, members: st.members || null,
        checks: st.checks || {}, error: st.error || null, errorText: st.errorText || null, guilds: st.guilds || null,
        setupResult: setupResult ? { ok: setupResult.ok, summary: setupResult.summary, warnings: setupResult.warnings, at: setupResult.at } : null,
        bridge: bridge ? { since: bridge.since } : null,
        lastSync: lastSync ? { ok: lastSync.ok, at: lastSync.at } : null,
        settings: { hasToken: !!s.token, guildId: s.guildId || '', facebookUrl: s.facebookUrl || '', whatsappUrl: s.whatsappUrl || '', autoStart: s.autoStart !== false },
      });
    }
    if (req.method === 'GET' && u.pathname === '/api/settings') {
      const s = readSettings();
      return send(res, 200, { token: s.token || '', guildId: s.guildId || '', facebookUrl: s.facebookUrl || '', whatsappUrl: s.whatsappUrl || '', autoStart: s.autoStart !== false });
    }
    if (req.method === 'GET' && u.pathname === '/api/logs') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      for (const e of logs) res.write(`data: ${JSON.stringify(e)}\n\n`);
      streams.add(res);
      req.on('close', () => streams.delete(res));
      return;
    }
    if (req.method === 'POST' && u.pathname === '/api/settings') {
      const b = await body(req);
      const s = readSettings();
      if (typeof b.token === 'string' && b.token.trim()) s.token = b.token.trim();
      for (const k of ['guildId', 'facebookUrl', 'whatsappUrl']) if (typeof b[k] === 'string') s[k] = b[k].trim();
      if (typeof b.autoStart === 'boolean') s.autoStart = b.autoStart;
      if (s.guildId && !/^\d{15,22}$/.test(s.guildId)) return send(res, 400, { error: 'ID เซิร์ฟต้องเป็นตัวเลขล้วน 17–20 หลัก' });
      fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
      fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2));
      addLog('💾 บันทึกการตั้งค่าแล้ว');
      if (bot) restartBot();
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && u.pathname === '/api/bot') {
      const b = await body(req);
      if (b.action === 'start') startBot();
      else if (b.action === 'stop') stopBot();
      else if (b.action === 'restart') restartBot();
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && u.pathname === '/api/setup') {
      const b = await body(req);
      return send(res, 200, { ok: runSetup(!!b.archive) });
    }
    if (req.method === 'GET' && u.pathname === '/api/plugins') {
      return send(res, 200, listPlugins().map((p) => ({ id: p.id, name: p.name, description: p.description, enabled: p.enabled, broken: !!p.broken, commands: (p.commands || []).map((c) => `/${c.name}`) })));
    }
    if (req.method === 'POST' && u.pathname === '/api/plugins') {
      const b = await body(req);
      setEnabled(String(b.id), !!b.enabled);
      addLog(`🧩 ${b.enabled ? 'เปิด' : 'ปิด'}ปลั๊กอิน ${b.id}`);
      if (bot) restartBot();
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && u.pathname === '/api/open-folder') {
      exec(`explorer "${ROOT}"`);
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

function openWindow() {
  if (process.platform !== 'win32') return console.log(`เปิด ${URL} ในเบราว์เซอร์`);
  exec(`start "" msedge --app=${URL} --window-size=1180,820`, (err) => {
    if (err) exec(`start "" "${URL}"`);
  });
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('แอป JIBI เปิดอยู่แล้ว — เปิดหน้าต่างให้ใหม่');
    openWindow();
    setTimeout(() => process.exit(0), 1500);
  } else { console.error(e); }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`JIBI Control Center: ${URL}  (ปิดหน้าต่างนี้ = ปิดแอปและบอท)`);
  addLog('🟣 เปิดแอป JIBI Control Center');
  markOffline();
  openWindow();
  const s = readSettings();
  if (settingsOk() && s.autoStart !== false) startBot();
  else if (!settingsOk()) addLog('👉 ไปที่แท็บ "ตั้งค่า" ใส่รหัสบอทและ ID เซิร์ฟ');
});

process.on('uncaughtException', (e) => addLog(`💥 แอปเจอข้อผิดพลาด: ${e.stack || e.message}`));
process.on('unhandledRejection', (e) => addLog(`💥 แอปเจอข้อผิดพลาด: ${(e && e.stack) || e}`));
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stopBot(); process.exit(0); });
process.on('exit', () => { if (bot) bot.kill(); });
