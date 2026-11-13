// JIBI — บอทประจำ P SHOP GAMERPOWER
// ความสามารถอยู่ใน plugins/ · lib/bridge.js = ช่องทางที่ Claude ใช้ควบคุม JIBI ผ่านโฟลเดอร์
require('./lib/env')();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Events, PermissionFlagsBits, Partials } = require('discord.js');
const { startBridge } = require('./lib/bridge');
const { listPlugins } = require('./lib/plugins');

// ย้ายไปรันบน VPS แล้ว: เครื่องที่มีไฟล์ HOSTED_ON_VPS ห้ามเปิดบอท (กัน JIBI ซ้อน 2 ตัว)
if (fs.existsSync(path.join(__dirname, 'HOSTED_ON_VPS')) && process.env.JIBI_HOST !== 'vps') {
  console.log('☁️ JIBI ย้ายไปออนไลน์บนเครื่องเช่า (VPS) แล้ว — เครื่องนี้ไม่ต้องเปิดบอท');
  try { fs.writeFileSync(path.join(__dirname, 'data', 'status.json'), JSON.stringify({ online: false, error: 'moved-to-vps', at: new Date().toISOString() }, null, 2)); } catch {}
  process.exit(2);
}

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const GUILD_ID = (process.env.GUILD_ID || '').trim();
const STATUS = path.join(__dirname, 'data', 'status.json');
// กัน JIBI ซ้อนกัน 2 ตัว: ปิดตัวเก่าที่ค้างอยู่ก่อนเริ่ม
const PIDF = path.join(__dirname, 'data', 'bot.pid');
try {
  const old = parseInt(fs.readFileSync(PIDF, 'utf8'), 10);
  if (old && old !== process.pid) { try { process.kill(old); console.log(`🧹 ปิด JIBI ตัวเก่าที่ค้างอยู่ (pid ${old})`); } catch {} }
} catch {}
try { fs.mkdirSync(path.dirname(PIDF), { recursive: true }); fs.writeFileSync(PIDF, String(process.pid)); } catch {}
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'server.json'), 'utf8'));

let status = { online: false, checks: {} };
function writeStatus(patch = {}) {
  status = { ...status, ...patch, at: new Date().toISOString() };
  try {
    fs.mkdirSync(path.dirname(STATUS), { recursive: true });
    fs.writeFileSync(STATUS, JSON.stringify(status, null, 2));
  } catch { /* ignore */ }
}

process.on('unhandledRejection', (e) => console.error(`⚠️ ${(e && e.message) || e}`));
process.on('uncaughtException', (e) => { console.error(`💥 ${(e && e.stack) || e}`); writeStatus({ online: false, error: 'crash', errorText: String(e && e.message) }); process.exit(1); });

if (!TOKEN || !/^\d{15,22}$/.test(GUILD_ID)) {
  console.error('❌ ยังไม่ได้ใส่รหัสบอท หรือ ID เซิร์ฟ — ไปที่แท็บ "ตั้งค่า" ในแอป');
  writeStatus({ online: false, error: 'not-configured' });
  process.exit(2);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
let guild = null;

async function logTo(text) {
  console.log(text.replace(/\*\*/g, ''));
  const ch = guild && guild.channels.cache.find((c) => c.name === 'bot-logs');
  if (ch) await ch.send({ content: text, allowedMentions: { parse: [] } }).catch(() => {});
}

client.once(Events.ClientReady, async () => {
  console.log(`🔌 ล็อกอินสำเร็จ: ${client.user.tag}`);
  writeStatus({ online: true, error: null, bot: client.user.username, checks: { login: true } });

  // 1) หาเซิร์ฟ
  try {
    guild = await client.guilds.fetch(GUILD_ID);
    await guild.roles.fetch();
    await guild.channels.fetch();
  } catch (e) {
    console.error(`❌ หาเซิร์ฟ ID ${GUILD_ID} ไม่เจอ (${e.message}) — ID ผิด หรือยังไม่ได้เชิญบอทเข้าเซิร์ฟนี้`);
    writeStatus({ checks: { login: true, guild: false }, guilds: client.guilds.cache.map((g) => ({ name: g.name, id: g.id })) });
    return;
  }

  // 2) เช็กสิทธิ์ + สถานะเซิร์ฟ
  const me = await guild.members.fetchMe().catch(() => null);
  const admin = !!(me && me.permissions.has(PermissionFlagsBits.Administrator));
  const built = !!(guild.roles.cache.find((r) => r.name === cfg.roles.customer.name) && guild.channels.cache.find((c) => c.name === cfg.categories[0].name));
  console.log(`✅ เจอเซิร์ฟ: ${guild.name} (สมาชิก ${guild.memberCount})`);
  console.log(admin ? '✅ บอทมีสิทธิ์ Administrator' : '❌ บอทยังไม่มีสิทธิ์ Administrator — ดูวิธีแก้ในหน้าหลักของแอป');
  console.log(built ? '✅ เซิร์ฟถูกสร้างตามแบบแล้ว' : 'ℹ️ เซิร์ฟยังไม่ได้สร้างตามแบบ — กด "สร้างเซิร์ฟ" ในแอป');

  // 3) ปลั๊กอิน + คำสั่ง /
  const ctx = { client, guild, cfg, logTo };
  const plugins = listPlugins().filter((p) => p.enabled && !p.broken);
  const commands = [];
  for (const p of plugins) {
    try {
      if (p.setup) await p.setup(ctx);
      for (const c of p.commands || []) commands.push(c.toJSON ? c.toJSON() : c);
      console.log(`🧩 ปลั๊กอิน: ${p.name}`);
    } catch (e) { console.error(`⚠️ ปลั๊กอิน ${p.id} เริ่มไม่ได้: ${e.message}`); }
  }
  let cmdsOk = true;
  await guild.commands.set(commands).catch((e) => { cmdsOk = false; console.error(`⚠️ ลงทะเบียนคำสั่ง / ไม่ได้: ${e.message}`); });

  writeStatus({
    guild: guild.name, members: guild.memberCount, plugins: plugins.map((p) => p.id),
    checks: { login: true, guild: true, admin, built, commands: cmdsOk },
  });
  setInterval(() => {
    const ping = client.ws.ping;
    writeStatus({ online: true, members: guild.memberCount, ping });
    if (ping > 1500) console.log(`🐢 เน็ตช้า: ping ${ping}ms (ปุ่มอาจกดไม่ติด)`);
  }, 30000);

  let bridge = null;
  try { bridge = startBridge({ client, guild, notify: logTo }); } catch (e) { console.error(`⚠️ เริ่มสะพาน Claude ไม่ได้: ${e.message}`); }
  // JIBI Center Hub — หน้าเว็บควบคุม JIBI (รันบน VPS)
  if (process.env.JIBI_HOST === 'vps' || process.env.HUB_PORT) {
    try { require('./lib/hub').startHub({ client, guild, bridge, logTo }); } catch (e) { console.error(`⚠️ เริ่ม JIBI Hub ไม่ได้: ${e.message}`); }
  }
  console.log('🟢 JIBI พร้อมใช้งาน');
});

client.on('error', (e) => console.error('⚠️', e.message));

client.login(TOKEN).catch((e) => {
  const txt = `${e.code || ''} ${e.message}`;
  let error = 'network';
  if (/TokenInvalid|invalid token|401/i.test(txt)) error = 'token';
  else if (/disallowed intents|4014/i.test(txt)) error = 'intents';
  const msg = {
    token: '❌ รหัสบอทไม่ถูกต้อง — ไปที่ Developer Portal > บอท > รีเซ็ตโทเค็น แล้ววางรหัสใหม่ในแท็บ "ตั้งค่า"',
    intents: '❌ ยังไม่ได้เปิด "Server Members Intent" — Developer Portal > บอท > เปิด "สิทธิ์ในการเข้าถึงข้อมูลสมาชิกของเซิร์ฟเวอร์" > บันทึก',
    network: `❌ ต่อ Discord ไม่ได้ (${e.message}) — เช็กอินเทอร์เน็ต จะลองใหม่อัตโนมัติ`,
  }[error];
  console.error(msg);
  writeStatus({ online: false, error, errorText: e.message });
  process.exit(error === 'network' ? 1 : 2);
});
