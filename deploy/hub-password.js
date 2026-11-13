// ตั้ง/เปลี่ยนรหัสผ่าน JIBI Center Hub — รัน: sudo -u jibi node /opt/jibi/deploy/hub-password.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const FILE = path.join(__dirname, '..', 'data', 'hub-auth.json');
function ask(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); else rl.output.write('*'); };
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}
(async () => {
  const a = await ask('ตั้งรหัสผ่าน Hub (อย่างน้อย 8 ตัว): ');
  if (a.length < 8) { console.log('❌ สั้นไป — ต้องอย่างน้อย 8 ตัว'); process.exit(1); }
  const b = await ask('พิมพ์ซ้ำอีกครั้ง: ');
  if (a !== b) { console.log('❌ สองครั้งไม่ตรงกัน ลองใหม่'); process.exit(1); }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(a, salt, 64);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ salt: salt.toString('hex'), hash: hash.toString('hex'), at: new Date().toISOString() }), { mode: 0o600 });
  console.log('✅ ตั้งรหัสผ่าน Hub แล้ว');
})();
