// เก็บข้อมูลของปลั๊กอินเป็นไฟล์ JSON ใน data/
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data');

function load(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8')); } catch { return fallback; }
}
function save(name, data) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const file = path.join(DIR, `${name}.json`);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
    fs.renameSync(`${file}.tmp`, file);
  } catch (e) { console.error(`⚠️ บันทึก ${name} ไม่ได้: ${e.message}`); }
}
module.exports = { load, save };
