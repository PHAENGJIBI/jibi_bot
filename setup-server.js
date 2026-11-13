// JIBI — สร้างเซิร์ฟตามแบบ (เรียกจากปุ่ม "สร้างเซิร์ฟ" ในแอป) · รันซ้ำได้ ไม่สร้างซ้ำ
require('./lib/env')();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { syncServer } = require('./lib/sync');

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const GUILD_ID = (process.env.GUILD_ID || '').trim();
const ARCHIVE_OLD = String(process.env.ARCHIVE_OLD_CHANNELS || 'true').toLowerCase() === 'true';
const RESULT = path.join(__dirname, 'data', 'setup-result.json');

const lines = [];
const log = (m) => { lines.push(String(m)); console.log(m); };
function finish(ok, summary) {
  const warnings = lines.filter((l) => l.includes('⚠️')).length;
  try { fs.mkdirSync(path.dirname(RESULT), { recursive: true }); fs.writeFileSync(RESULT, JSON.stringify({ ok, summary, warnings, at: new Date().toISOString(), log: lines }, null, 2)); } catch { /* ignore */ }
  log(ok ? `🎉 ${summary}` : `❌ ${summary}`);
  setTimeout(() => process.exit(ok ? 0 : 1), 300);
}
process.on('unhandledRejection', (e) => log(`⚠️ ${(e && e.message) || e}`));
process.on('uncaughtException', (e) => finish(false, `เกิดข้อผิดพลาด: ${e.message}`));

if (!TOKEN || !/^\d{15,22}$/.test(GUILD_ID)) finish(false, 'ยังไม่ได้ใส่รหัสบอท หรือ ID เซิร์ฟ');
else {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once('clientReady', async () => {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'server.json'), 'utf8'));
      const guild = await client.guilds.fetch(GUILD_ID);
      log(`✅ เชื่อมต่อเซิร์ฟ: ${guild.name}`);
      const me = await guild.members.fetchMe();
      if (!me.permissions.has(PermissionFlagsBits.Administrator)) {
        client.destroy();
        return finish(false, 'บอทยังไม่มีสิทธิ์ Administrator — ทำตามขั้นที่ 3 ในหน้าหลักของแอปก่อน');
      }
      await syncServer({ client, guild, cfg, archiveOld: ARCHIVE_OLD, log });
      client.destroy();
      finish(true, 'สร้างเซิร์ฟเสร็จแล้ว — เปิด Discord ดูได้เลย');
    } catch (e) {
      client.destroy();
      finish(false, `สร้างเซิร์ฟไม่สำเร็จ: ${e.message}`);
    }
  });
  client.login(TOKEN).catch((e) => finish(false, `ล็อกอินบอทไม่ได้: ${e.message}`));
}
