// JIBI Center Hub — หน้าเว็บควบคุม JIBI (เปิดบน VPS ที่ 127.0.0.1:3940, Caddy ทำ HTTPS ให้)
// ล็อกอินด้วยรหัสใน data/hub-auth.json (ตั้งด้วย deploy/hub-password.js) · ไม่มีรหัส = เข้าไม่ได้
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ChannelType, EmbedBuilder } = require('discord.js');

const ROOT = path.join(__dirname, '..');
const AUTH = path.join(ROOT, 'data', 'hub-auth.json');
const LOG = path.join(ROOT, 'data', 'app.log');
const PAGE = path.join(ROOT, 'hub', 'index.html');
const PORT = parseInt(process.env.HUB_PORT || '3940', 10);
const YELLOW = 0xFFC400;
const FOOTER = 'JIBI · P SHOP GAMERPOWER';

const sessions = new Map(); // token -> expires
const fails = new Map(); // ip -> [times]

function checkPassword(pw) {
  let a;
  try { a = JSON.parse(fs.readFileSync(AUTH, 'utf8')); } catch { return false; }
  const h = crypto.scryptSync(String(pw), Buffer.from(a.salt, 'hex'), 64);
  const want = Buffer.from(a.hash, 'hex');
  return want.length === h.length && crypto.timingSafeEqual(h, want);
}
const hasPassword = () => fs.existsSync(AUTH);

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, v.join('=')]));
}
function authed(req) {
  const t = cookies(req).jibi_hub;
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function ipOf(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }

function send(res, code, body, headers = {}) {
  const isStr = typeof body === 'string' || Buffer.isBuffer(body);
  res.writeHead(code, { 'Content-Type': isStr ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers });
  res.end(isStr ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 200000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { reject(new Error('JSON ไม่ถูก')); } });
  });
}
function tail(file, n) {
  try {
    const st = fs.statSync(file);
    const size = Math.min(st.size, 256 * 1024);
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(size);
    fs.readSync(fd, buf, 0, size, st.size - size);
    fs.closeSync(fd);
    return buf.toString('utf8').split('\n').filter(Boolean).slice(-n);
  } catch { return []; }
}

function startHub({ client, guild, bridge, logTo }) {
  const T = () => client.jibiTourney;

  const textChannels = () => guild.channels.cache
    .filter((c) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type))
    .sort((a, b) => (a.parent ? a.parent.position : -1) - (b.parent ? b.parent.position : -1) || a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name, category: c.parent ? c.parent.name : '' }));

  async function findChannel(ref) {
    await guild.channels.fetch();
    const s = String(ref || '').replace(/^#/, '').trim().toLowerCase();
    const list = guild.channels.cache.filter((c) => c.isTextBased && c.isTextBased());
    return list.get(ref) || list.find((c) => c.name.toLowerCase() === s) || list.find((c) => c.name.toLowerCase().includes(s));
  }
  async function findMember(ref) {
    const s = String(ref || '').replace(/^@/, '').trim().toLowerCase();
    if (/^\d{15,22}$/.test(s)) return guild.members.fetch(s).catch(() => null);
    await guild.members.fetch().catch(() => {});
    return guild.members.cache.find((m) => [m.displayName, m.user.username, m.user.globalName].filter(Boolean).some((v) => v.toLowerCase() === s))
      || guild.members.cache.find((m) => [m.displayName, m.user.username, m.user.globalName].filter(Boolean).some((v) => v.toLowerCase().includes(s)));
  }

  // ข้อความ: {#ห้อง} → ลิงก์ห้อง, {@ชื่อ} → แท็กคน
  async function expand(text) {
    let out = String(text || '');
    const users = [];
    for (const m of [...out.matchAll(/\{#([^}]+)\}/g)]) { const c = await findChannel(m[1]); if (c) out = out.replace(m[0], `<#${c.id}>`); }
    for (const m of [...out.matchAll(/\{@([^}]+)\}/g)]) { const mem = await findMember(m[1]); if (mem) { users.push(mem.id); out = out.replace(m[0], `<@${mem.id}>`); } }
    return { text: out, users };
  }

  async function sendMessage(b) {
    const ch = await findChannel(b.channel);
    if (!ch) throw new Error(`ບໍ່ພົບຫ້ອງ ${b.channel}`);
    const body = await expand(b.content);
    const mentionIds = [...new Set([...(b.mentions || []), ...body.users])];
    const head = (b.mentions || []).map((id) => `<@${id}>`).join(' ');
    const content = [head, b.embed ? '' : body.text].filter(Boolean).join('\n') || undefined;
    const msg = { content, allowedMentions: { users: mentionIds, roles: [] } };
    if (b.embed) {
      const e = new EmbedBuilder().setColor(YELLOW).setFooter({ text: FOOTER });
      if (b.title) e.setTitle(String(b.title).slice(0, 256));
      if (body.text) e.setDescription(body.text.slice(0, 4000));
      msg.embeds = [e];
    }
    if (!msg.content && !msg.embeds) throw new Error('ຂໍ້ຄວາມວ່າງ');
    let sent;
    if (b.replyTo) {
      const target = await ch.messages.fetch(b.replyTo).catch(() => null);
      if (!target) throw new Error('ບໍ່ພົບຂໍ້ຄວາມທີ່ຈະຕອບ');
      sent = await target.reply({ ...msg, allowedMentions: { ...msg.allowedMentions, repliedUser: true } });
    } else sent = await ch.send(msg);
    return { url: sent.url, channel: ch.name };
  }

  // ข้อความล่าสุดที่มีคนแท็ก JIBI
  async function mentions(limit = 15) {
    await guild.channels.fetch();
    const out = [];
    for (const c of guild.channels.cache.filter((x) => x.isTextBased && x.isTextBased() && x.viewable && x.type !== ChannelType.GuildCategory).values()) {
      const msgs = await c.messages.fetch({ limit: 25 }).catch(() => null);
      if (!msgs) continue;
      for (const m of msgs.values()) {
        if (m.author.bot) continue;
        if (m.mentions.users.has(client.user.id) || (m.reference && m.mentions.repliedUser && m.mentions.repliedUser.id === client.user.id)) {
          out.push({ id: m.id, channelId: c.id, channel: c.name, author: m.member ? m.member.displayName : m.author.username, authorId: m.author.id, content: m.cleanContent.slice(0, 300), at: m.createdTimestamp, url: m.url });
        }
      }
    }
    return out.sort((a, b) => b.at - a.at).slice(0, limit);
  }

  const routes = {
    'GET /api/status': async () => ({
      bot: client.user.tag, guild: guild.name, members: guild.memberCount, ping: client.ws.ping,
      uptimeSec: Math.round(process.uptime()), host: process.env.JIBI_HOST || 'pc', at: new Date().toISOString(),
    }),
    'GET /api/channels': async () => { await guild.channels.fetch(); return textChannels(); },
    'GET /api/members': async (b, q) => {
      await guild.members.fetch().catch(() => {});
      const s = String(q.get('q') || '').toLowerCase();
      return guild.members.cache.filter((m) => !m.user.bot && (!s || [m.displayName, m.user.username].some((v) => v.toLowerCase().includes(s))))
        .first(20).map((m) => ({ id: m.id, name: m.displayName, username: m.user.username }));
    },
    'GET /api/logs': async (b, q) => ({ lines: tail(LOG, Math.min(500, parseInt(q.get('n') || '200', 10))) }),
    'GET /api/mentions': async () => mentions(),
    'POST /api/send': async (b) => { const r = await sendMessage(b); logTo(`🛰️ Hub ສົ່ງຂໍ້ຄວາມໃນ #${r.channel}`); return r; },
    'POST /api/task': async (b) => { if (!bridge) throw new Error('bridge ບໍ່ພ້ອມ'); return bridge.run(b); },
    'GET /api/tourney': async () => { if (!T()) throw new Error('ປລັກອິນງານແຂ່ງບໍ່ໄດ້ເປີດ'); return { event: T().getEvent(), players: T().players() }; },
    'POST /api/tourney/event': async (b) => T().setEvent(b),
    'POST /api/tourney/remove': async (b) => T().removePlayer(b.uid, 'Hub'),
    'POST /api/tourney/remind': async () => { const m = await T().remindNow(); return { url: m.url }; },
    'POST /api/tourney/code': async (b) => {
      if (!b.code) throw new Error('ໃສ່ລະຫັດກ່ອນ');
      const m = await T().sendCode({ code: String(b.code).trim().slice(0, 40), game: b.game ? parseInt(b.game, 10) : null, map: b.map || null, note: b.note || null, preview: !!b.preview }, 'Hub');
      return { url: m.url };
    },
    'POST /api/tourney/refresh': async () => { await T().refreshPanels(); return true; },
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const key = `${req.method} ${url.pathname}`;
    try {
      if (key === 'GET /' || key === 'GET /index.html') return send(res, 200, fs.readFileSync(PAGE));
      const STATIC = { '/manifest.webmanifest': 'application/manifest+json', '/sw.js': 'text/javascript; charset=utf-8', '/icon-192.png': 'image/png', '/icon-512.png': 'image/png', '/apple-touch-icon.png': 'image/png' };
      if (req.method === 'GET' && STATIC[url.pathname]) return send(res, 200, fs.readFileSync(path.join(ROOT, 'hub', url.pathname.slice(1))), { 'Content-Type': STATIC[url.pathname], 'Cache-Control': 'public, max-age=3600' });
      if (key === 'GET /api/me') return send(res, 200, { authed: authed(req), hasPassword: hasPassword() });
      if (key === 'POST /api/login') {
        const ip = ipOf(req);
        const recent = (fails.get(ip) || []).filter((t) => t > Date.now() - 10 * 60000);
        if (recent.length >= 5) return send(res, 429, { error: 'ລອງຜິດຫຼາຍເກີນ — ລໍຖ້າ 10 ນາທີ' });
        const b = await readBody(req);
        if (!hasPassword()) return send(res, 403, { error: 'ຍັງບໍ່ໄດ້ຕັ້ງລະຫັດ Hub ໃນເຄື່ອງເຊົ່າ' });
        if (!checkPassword(b.password || '')) { recent.push(Date.now()); fails.set(ip, recent); return send(res, 401, { error: 'ລະຫັດບໍ່ຖືກ' }); }
        const t = crypto.randomBytes(32).toString('hex');
        sessions.set(t, Date.now() + 30 * 86400000);
        logTo(`🔐 ມີຄົນເຂົ້າ JIBI Hub (IP ${ip})`);
        return send(res, 200, { ok: true }, { 'Set-Cookie': `jibi_hub=${t}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 86400}` });
      }
      if (key === 'POST /api/logout') { sessions.delete(cookies(req).jibi_hub); return send(res, 200, { ok: true }, { 'Set-Cookie': 'jibi_hub=; Max-Age=0; Path=/' }); }
      const fn = routes[key];
      if (!fn) return send(res, 404, { error: 'not found' });
      if (!authed(req)) return send(res, 401, { error: 'login' });
      if (req.method === 'POST' && req.headers['x-jibi'] !== '1') return send(res, 403, { error: 'csrf' });
      const body = req.method === 'POST' ? await readBody(req) : {};
      const data = await fn(body, url.searchParams);
      return send(res, 200, { ok: true, data });
    } catch (e) {
      return send(res, 400, { ok: false, error: e.message });
    }
  });
  server.on('error', (e) => console.error(`⚠️ JIBI Hub: ${e.message}`));
  server.listen(PORT, '127.0.0.1', () => console.log(`🛰️ JIBI Center Hub ພ້ອມ (127.0.0.1:${PORT})`));
  return server;
}

module.exports = { startHub };
