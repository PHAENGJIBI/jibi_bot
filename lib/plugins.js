// ระบบปลั๊กอินของ JIBI — ทุกไฟล์ใน plugins/ คือความสามารถหนึ่งอย่าง
// เปิด/ปิดได้จากแอป (เก็บใน data/plugins.json)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'plugins');
const STATE = path.join(ROOT, 'data', 'plugins.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; }
}

function listPlugins() {
  if (!fs.existsSync(DIR)) return [];
  const state = readState();
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).map((f) => {
    const file = path.join(DIR, f);
    delete require.cache[require.resolve(file)];
    try {
      const p = require(file);
      const id = p.id || f.replace(/\.js$/, '');
      return { ...p, id, enabled: state[id] !== false, file };
    } catch (e) {
      return { id: f.replace(/\.js$/, ''), name: f, description: `โหลดไม่ได้: ${e.message}`, enabled: false, broken: true, file };
    }
  });
}

function setEnabled(id, enabled) {
  const state = readState();
  state[id] = !!enabled;
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
}

module.exports = { listPlugins, setEnabled, PLUGIN_DIR: DIR, PLUGIN_STATE: STATE };
