// โหลดค่าตั้งค่า: data/settings.json (จากแอป) > .env > env-template.txt
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ROOT = path.join(__dirname, '..');
const SETTINGS = path.join(ROOT, 'data', 'settings.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch { return {}; }
}

module.exports = function loadEnv() {
  const file = ['.env', 'env-template.txt'].map((f) => path.join(ROOT, f)).find((f) => fs.existsSync(f));
  if (file) dotenv.config({ path: file, override: true, quiet: true });
  const s = readSettings();
  const map = { token: 'DISCORD_TOKEN', guildId: 'GUILD_ID', facebookUrl: 'FACEBOOK_URL', whatsappUrl: 'WHATSAPP_URL' };
  for (const [k, env] of Object.entries(map)) if (s[k]) process.env[env] = String(s[k]).trim();
};
module.exports.readSettings = readSettings;
module.exports.SETTINGS = SETTINGS;
