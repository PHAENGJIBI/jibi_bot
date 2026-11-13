// ตรวจสอบการเชื่อมต่อ JIBI → เขียนผลที่ data/diag.log (ไม่มีรหัสบอทในไฟล์)
require('./lib/env')();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

const OUT = path.join(__dirname, 'data', 'diag.log');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, '');
const log = (m) => { console.log(m); fs.appendFileSync(OUT, `${m}\n`); };
const done = (code) => { log(`== จบการตรวจสอบ (${code}) ==`); setTimeout(() => process.exit(code), 300); };

process.on('unhandledRejection', (e) => { log(`💥 ${(e && e.stack) || e}`); done(1); });
process.on('uncaughtException', (e) => { log(`💥 ${(e && e.stack) || e}`); done(1); });

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const GUILD_ID = (process.env.GUILD_ID || '').trim();
log(`Node ${process.version} · discord.js ${require('discord.js').version} · ${new Date().toISOString()}`);
log(`รหัสบอท: ${TOKEN ? `มี (ยาว ${TOKEN.length})` : 'ไม่มี'} · ID เซิร์ฟ: ${GUILD_ID || 'ไม่มี'}`);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.once('clientReady', async () => {
  log(`✅ ล็อกอินได้: ${client.user.tag} · อยู่ใน ${client.guilds.cache.size} เซิร์ฟ: ${client.guilds.cache.map((g) => `${g.name} (${g.id})`).join(', ')}`);
  let guild;
  try { guild = await client.guilds.fetch(GUILD_ID); log(`✅ เจอเซิร์ฟ: ${guild.name} · สมาชิก ${guild.memberCount} · features: ${guild.features.join(',') || '-'}`); }
  catch (e) { log(`❌ หาเซิร์ฟ ID ${GUILD_ID} ไม่เจอ: ${e.message}`); return done(1); }
  try {
    const me = await guild.members.fetchMe();
    log(`สิทธิ์ของบอท: Administrator=${me.permissions.has(PermissionFlagsBits.Administrator)} · ยศสูงสุด: ${me.roles.highest.name} (ตำแหน่ง ${me.roles.highest.position}/${guild.roles.cache.size})`);
  } catch (e) { log(`❌ อ่านสิทธิ์บอทไม่ได้: ${e.message}`); }
  try { const r = await guild.roles.fetch(); log(`✅ อ่านยศได้ ${r.size} ยศ`); } catch (e) { log(`❌ อ่านยศไม่ได้: ${e.message}`); }
  try { const c = await guild.channels.fetch(); log(`✅ อ่านห้องได้ ${c.size} ห้อง`); } catch (e) { log(`❌ อ่านห้องไม่ได้: ${e.message}`); }
  try { const cmds = await guild.commands.fetch(); log(`✅ อ่านคำสั่ง / ได้ (${cmds.size})`); } catch (e) { log(`❌ อ่านคำสั่ง / ไม่ได้: ${e.message} (เชิญบอทด้วย scope applications.commands หรือยัง)`); }
  try { const m = await guild.members.fetch({ limit: 5 }); log(`✅ อ่านรายชื่อสมาชิกได้ (Server Members Intent เปิดแล้ว) ${m.size}`); } catch (e) { log(`❌ อ่านรายชื่อสมาชิกไม่ได้: ${e.message}`); }
  done(0);
});
client.login(TOKEN).catch((e) => { log(`❌ ล็อกอินไม่ได้: ${e.code || ''} ${e.message}`); done(1); });
setTimeout(() => { log('❌ หมดเวลา 40 วินาที — เชื่อมต่อ Discord ไม่สำเร็จ'); done(1); }, 40000);
