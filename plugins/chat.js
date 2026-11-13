// ปลั๊กอิน: JIBI คุยตอบเอง — มีคนแท็ก @JIBI หรือตอบกลับข้อความของ JIBI → JIBI ตอบ
// โหมด (ตั้งใน JIBI Center Hub): off = ไม่ตอบ · rules = ตอบจากคำที่ตั้งไว้ (ฟรี) · ai = คุยด้วย Claude (ต้องใส่ API key)
// ตั้งค่า: data/chat-settings.json · API key: data/ai-key.json (ไม่ขึ้น GitHub)
const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const store = require('../lib/store');

const KEY_FILE = path.join(__dirname, '..', 'data', 'ai-key.json');
const DEFAULTS = { mode: 'rules', lastMode: 'rules', perUserDaily: 20, dailyCap: 300, model: 'claude-haiku-5-5' };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ---------- คำตอบแบบตั้งไว้ (ลาว + ไทย) ----------
// {ch:ชื่อห้อง} = ลิงก์ห้อง · {event} = ชื่องานแข่ง · {start} = เวลาเริ่ม (นับถอยหลังเอง)
const RULES = [
  { k: ['ລາຄາ', 'ເທົ່າໃດ', 'ເທົ່າໃດ', 'ສັ່ງຊື້', 'ຊື້', 'ເຕີມ', 'ราคา', 'เท่าไหร่', 'ซื้อ', 'เติม', 'สั่ง', 'price', 'vp', 'gift card', 'wallet'],
    r: ['ເລື່ອງລາຄາ ແລະ ສັ່ງຊື້ ທັກແອດມິນທາງ Facebook Page ຫຼື WhatsApp ຂອງ P SHOP GAMERPOWER ໄດ້ເລີຍເດີ້ 💛 JIBI ບໍ່ຮັບອໍເດີໃນ Discord ນະ',
      'ຢາກເຕີມເກມ ທັກ Facebook Page ຫຼື WhatsApp ຂອງຮ້ານໄດ້ເລີຍ ແອດມິນຕອບໄວ 💛 (ລະວັງຄົນປອມເປັນແອດມິນ — ແອດມິນບໍ່ທັກຫາກ່ອນ)'] },
  { k: ['ແຂ່ງ', 'ລົງທະບຽນ', 'ທົວ', 'ລາງວັນ', 'แข่ง', 'ลงทะเบียน', 'ทัวร์', 'tournament', 'deathmatch', 'cup'],
    r: ['ງານແຂ່ງ **{event}** ລົງທະບຽນໄດ້ທີ່ {ch:ລົງທະບຽນ} ເລີຍເດີ້ 🏆{start}', 'ຢາກແຂ່ງບໍ່? ໄປກົດ 📝 ລົງທະບຽນ ທີ່ {ch:ລົງທະບຽນ} ໄດ້ເລີຍ 💛{start}'] },
  { k: ['ປາຕີ້', 'ຫາໝູ່', 'ຫາຄົນຫຼິ້ນ', 'ຫາທີມ', 'ปาร์ตี้', 'หาตี้', 'หาเพื่อน', 'party', 'duo', 'squad'],
    r: ['ຫາໝູ່ຫຼິ້ນ ໄປຫ້ອງ 🤝・ຫາປາຕີ້ ຂອງເກມນັ້ນເລີຍ ກົດ 🎮 ສ້າງປາຕີ້ ແລ້ວລໍຖ້າໝູ່ມາຈອຍ 💛'] },
  { k: ['ຄູ່ມື', 'ວິທີ', 'ສອນ', 'ເຮັດແນວໃດ', 'คู่มือ', 'วิธี', 'ยังไง', 'สอน', 'how to', 'howto'],
    r: ['ພິມ `/howto` ຕາມດ້ວຍຄຳທີ່ຢາກຮູ້ ເຊັ່ນ `/howto VP` JIBI ຈະຫາຄູ່ມືໃຫ້ 📖💛', 'ເບິ່ງຫ້ອງ 📖・ຄູ່ມື ຂອງແຕ່ລະເກມເດີ້ ຫຼື ພິມ `/howto` ກໍໄດ້ 💛'] },
  { k: ['ກິນເຂົ້າ', 'ກິນຫຍັງ', 'ຫິວ', 'กินข้าว', 'หิว', 'กินอะไร', 'ส้มตำ', 'ຕຳ'],
    r: ['JIBI ເປັນບອດ ກິນໄດ້ແຕ່ໄຟຟ້າ ⚡ ແຕ່ຂອບໃຈທີ່ຊວນເດີ້ 🥺💛', 'ກິນໃຫ້ອີ່ມເດີ້ ອີ່ມແລ້ວຄ່ອຍມາຫຼິ້ນເກມນຳກັນ 💛', 'ສັ່ງຕຳໝາກຫຸ່ງ ໝາກເຜັດ 2 ເມັດ ໃຫ້ JIBI ນຳເດີ້ 🥺💛'] },
  { k: ['ຂອບໃຈ', 'ຂອບໃຈຫຼາຍ', 'ขอบคุณ', 'ขอบใจ', 'thank', 'thx', 'ty'],
    r: ['ຍິນດີເດີ້ 💛', 'ບໍ່ເປັນຫຍັງເລີຍ JIBI ຍິນດີຊ່ວຍສະເໝີ 💛', 'ດ້ວຍຄວາມຍິນດີ 🥰💛'] },
  { k: ['ແມ່ນໃຜ', 'ເປັນໃຜ', 'ຊື່ຫຍັງ', 'ใคร', 'ชื่ออะไร', 'who are you'],
    r: ['JIBI ເອງ! ບອດປະຈຳ P SHOP GAMERPOWER ຄອຍດູແລເຊີບເວີ, ລົງທະບຽນງານແຂ່ງ ແລະ ຫາປາຕີ້ໃຫ້ທຸກຄົນ 💛'] },
  { k: ['ຝັນດີ', 'ນອນ', 'ງ່ວງ', 'ฝันดี', 'นอน', 'ง่วง', 'good night', 'gn'],
    r: ['ຝັນດີເດີ້ 😴💛', 'ນອນຫຼັບໃຫ້ສະບາຍ ມື້ອື່ນມາຫຼິ້ນນຳກັນໃໝ່ 💛'] },
  { k: ['ຮັກ', 'ໜ້າຮັກ', 'ຄິດຮອດ', 'รัก', 'น่ารัก', 'คิดถึง', 'love', 'cute'],
    r: ['ອາຍເດີ້ 🙈💛', 'JIBI ກໍຮັກທຸກຄົນໃນ P SHOP ເດີ້ 💛', 'ຄິດຮອດຄືກັນ 🥺💛'] },
  { k: ['ເບື່ອ', 'ເຫງົາ', 'เบื่อ', 'เหงา', 'bored'],
    r: ['ເບື່ອບໍ່? ໄປຫາປາຕີ້ຫຼິ້ນເກມນຳໝູ່ເລີຍ 🎮💛', 'ມາລົມກັບ JIBI ກໍໄດ້ ຫຼື ໄປຫ້ອງສຽງ ➕ ສ້າງຫ້ອງ ແລ້ວຊວນໝູ່ 💛'] },
  { k: ['valorant', 'ວາໂລ', 'วาโล', 'rank', 'ແຣງ', 'แรงค์'],
    r: ['ຂ່າວ Valorant ອັບເດດຢູ່ໃນໝວດ VALORANT ເດີ້ 🎯 ຢາກໄດ້ VP ທັກ Facebook ຂອງຮ້ານໄດ້ເລີຍ 💛', 'ຂຶ້ນແຣງໃຫ້ໄວໆເດີ້ JIBI ເອົາໃຈຊ່ວຍ 🎯💛'] },
  { k: ['ສະບາຍດີ', 'ດີຈ້າ', 'ຫວັດດີ', 'ຮາຍ', 'สวัสดี', 'หวัดดี', 'ดีจ้า', 'hello', 'hi', 'hey'],
    r: ['ສະບາຍດີເດີ້ 💛 ມີຫຍັງໃຫ້ JIBI ຊ່ວຍບໍ່?', 'ດີຈ້າ 👋💛', 'ສະບາຍດີ ມື້ນີ້ຫຼິ້ນເກມຫຍັງດີ? 🎮💛'] },
];
const FALLBACK = ['JIBI ຍັງບໍ່ເຂົ້າໃຈ 🥺 ລອງຖາມເລື່ອງ ງານແຂ່ງ, ຫາປາຕີ້, ຄູ່ມື ຫຼື ສັ່ງຊື້ ເບິ່ງເດີ້ 💛', 'ອືມມ... JIBI ຈະໄປຖາມແອດມິນໃຫ້ເດີ້ 💛', 'JIBI ຢູ່ນີ້ເດີ້ 💛 ມີຫຍັງໃຫ້ຊ່ວຍບໍ່?'];

const AI_SYSTEM = `You are JIBI (ຈີບີ), the cute, friendly bot of the Discord server "P SHOP GAMERPOWER" — a game top-up shop in Laos (Steam, PSN, Valorant VP and more).
Rules:
- Reply in Lao (ພາສາລາວ) by default; if the user writes Thai, reply in Thai. Keep it short: 1–3 sentences, casual and warm.
- Only use the yellow heart emoji 💛 when using hearts. Other cute emoji are fine, sparingly.
- Never quote prices, never take orders, never ask for payment or account details. For prices or orders say to message the shop's Facebook Page or WhatsApp. Admins never DM first — warn about impersonators if relevant.
- Server help you can give: tournament registration is in the 📝 ລົງທະບຽນ-ນັກແຂ່ງ channel; find teammates in 🤝・ຫາປາຕີ້ rooms (button 🎮 ສ້າງປາຕີ້); guides via /howto or 📖・ຄູ່ມື; create a private voice room with ➕ ສ້າງຫ້ອງ.
- Don't invent facts about the shop or events. If unsure, say an admin will help.
- Never use @everyone or @here.`;

module.exports = {
  id: 'chat',
  name: 'JIBI คุยตอบเอง (แท็ก @JIBI)',
  description: 'มีคนแท็ก JIBI หรือตอบข้อความของ JIBI → ตอบเอง · โหมด rules (ฟรี) หรือ ai (Claude) ตั้งใน JIBI Hub',
  setup({ client, guild, logTo }) {
    let S = { ...DEFAULTS, ...store.load('chat-settings', {}) };
    // สิ่งที่แอดมินสอน JIBI (แก้จาก Hub): rules = คำ→คำตอบ (เช็กก่อนคำตอบในตัว) · notes = ความรู้ให้โหมด AI
    let TEACH = { rules: [], notes: '', ...store.load('chat-teach', {}) };
    const usage = { day: '', users: {}, total: 0 };
    const cooldown = new Map();
    const history = new Map(); // channelId -> [{role, content}]

    const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' });
    const readKey = () => { try { return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')).key || ''; } catch { return ''; } };

    async function fill(text) {
      let out = text;
      for (const m of [...out.matchAll(/\{ch:([^}]+)\}/g)]) {
        const c = guild.channels.cache.find((x) => x.name.includes(m[1]));
        out = out.replace(m[0], c ? `<#${c.id}>` : m[1]);
      }
      const ev = client.jibiTourney ? client.jibiTourney.getEvent() : null;
      out = out.replace('{event}', ev ? ev.name : 'Valorant');
      const t = ev && ev.startAt ? Math.floor(new Date(ev.startAt).getTime() / 1000) : 0;
      out = out.replace('{start}', t && t * 1000 > Date.now() ? `\n⏰ ເລີ່ມ <t:${t}:F> (<t:${t}:R>)` : '');
      return out;
    }
    function ruleReply(text) {
      const s = String(text || '').toLowerCase();
      const hit = (k) => (/^[a-z ]{1,4}$/.test(k) ? new RegExp(`(^|[^a-z])${k}([^a-z]|$)`).test(s) : s.includes(k.toLowerCase()));
      for (const rule of [...(TEACH.rules || []), ...RULES]) if (rule.k.some(hit)) return pick(rule.r);
      return pick(FALLBACK);
    }
    async function aiReply(msg, text) {
      const key = readKey();
      if (!key) return null;
      if (usage.day !== today()) { usage.day = today(); usage.users = {}; usage.total = 0; }
      const u = usage.users[msg.author.id] || 0;
      if (u >= S.perUserDaily) return 'ມື້ນີ້ JIBI ລົມນຳເຈົ້າຫຼາຍແລ້ວ ພັກກ່ອນເດີ້ ມື້ອື່ນມາລົມກັນໃໝ່ 💛';
      if (usage.total >= S.dailyCap) return null;
      const h = (history.get(msg.channelId) || []).slice(-6);
      const name = msg.member ? msg.member.displayName : msg.author.username;
      const messages = [...h, { role: 'user', content: `${name}: ${text}` }];
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: S.model, max_tokens: 300, system: AI_SYSTEM + (TEACH.notes ? `\n\nShop knowledge from the admins (trust this, use it when relevant):\n${TEACH.notes}` : '') + ((TEACH.rules || []).length ? `\n\nAdmin-taught replies (when a message is about these keywords, answer in this spirit):\n${TEACH.rules.map((r) => `- ${r.k.join(', ')} → ${r.r.join(' / ')}`).join('\n')}` : ''), messages }),
        signal: AbortSignal.timeout(20000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { console.error(`[chat] AI ${r.status}: ${(j.error && j.error.message) || ''}`); return null; }
      const out = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
      if (!out) return null;
      usage.users[msg.author.id] = u + 1; usage.total += 1;
      history.set(msg.channelId, [...messages, { role: 'assistant', content: out }].slice(-8));
      return out;
    }

    client.on(Events.MessageCreate, async (msg) => {
      try {
        if (S.mode === 'off' || msg.author.bot || !msg.guild || msg.guild.id !== guild.id) return;
        const mentioned = msg.mentions.users.has(client.user.id);
        let repliedToMe = false;
        if (!mentioned && msg.reference && msg.reference.messageId) {
          const ref = await msg.fetchReference().catch(() => null);
          repliedToMe = !!(ref && ref.author.id === client.user.id);
        }
        if (!mentioned && !repliedToMe) return;
        if (msg.mentions.everyone) return;
        const last = cooldown.get(msg.author.id) || 0;
        if (Date.now() - last < 4000) return;
        cooldown.set(msg.author.id, Date.now());
        const text = msg.content.replace(/<@!?\d+>/g, '').trim();
        await msg.channel.sendTyping().catch(() => {});
        let reply = null;
        if (S.mode === 'ai') reply = await aiReply(msg, text).catch((e) => { console.error('[chat] AI', e.message); return null; });
        if (!reply) reply = ruleReply(text);
        reply = await fill(reply);
        await msg.reply({ content: reply.slice(0, 1900), allowedMentions: { repliedUser: true, parse: [] } });
      } catch (e) { console.error('[chat]', e.message); }
    });

    // ---------- API ให้ JIBI Center Hub ----------
    client.jibiChat = {
      get: () => ({ ...S, hasKey: !!readKey(), usedToday: usage.day === today() ? usage.total : 0 }),
      set(patch) {
        if (patch.mode && ['off', 'rules', 'ai'].includes(patch.mode)) S.mode = patch.mode;
        if (patch.enabled !== undefined) S.mode = patch.enabled ? (S.lastMode || 'rules') : 'off';
        if (S.mode === 'ai' && !readKey()) { S.mode = 'rules'; if (patch.mode === 'ai') throw new Error('ໃສ່ API key ກ່ອນ ຈຶ່ງເປີດໂໝດ AI ໄດ້'); }
        if (S.mode !== 'off') S.lastMode = S.mode;
        if (patch.perUserDaily) S.perUserDaily = Math.max(1, Math.min(500, parseInt(patch.perUserDaily, 10) || 20));
        if (patch.dailyCap) S.dailyCap = Math.max(1, Math.min(5000, parseInt(patch.dailyCap, 10) || 300));
        store.save('chat-settings', S);
        logTo(`💬 ຕັ້ງຄ່າ JIBI ລົມຕອບ: ${S.mode}`);
        return this.get();
      },
      setKey(key) {
        const k = String(key || '').trim();
        if (k && !/^sk-ant-[\w-]{20,}$/.test(k)) throw new Error('API key ບໍ່ຖືກຮູບແບບ (ຕ້ອງຂຶ້ນຕົ້ນ sk-ant-)');
        if (!k) { try { fs.unlinkSync(KEY_FILE); } catch {} return this.get(); }
        fs.writeFileSync(KEY_FILE, JSON.stringify({ key: k, at: new Date().toISOString() }), { mode: 0o600 });
        logTo('🔑 ໃສ່ AI API key ແລ້ວ');
        return this.get();
      },
      test: async (text) => fill(ruleReply(text)),
      getTeach: () => TEACH,
      setTeach(patch) {
        const clean = (arr, max) => [...new Set((arr || []).map((x) => String(x).trim()).filter(Boolean))].slice(0, max);
        if (patch.rules !== undefined) {
          TEACH.rules = (patch.rules || []).map((r) => ({ k: clean(r.k, 20).map((x) => x.slice(0, 40)), r: clean(r.r, 10).map((x) => x.slice(0, 500)) })).filter((r) => r.k.length && r.r.length).slice(0, 200);
        }
        if (patch.notes !== undefined) TEACH.notes = String(patch.notes || '').slice(0, 4000);
        store.save('chat-teach', TEACH);
        logTo(`🎓 ສອນ JIBI: ${TEACH.rules.length} ຄຳຕອບ${TEACH.notes ? ' · ມີຄວາມຮູ້ຮ້ານ' : ''}`);
        return TEACH;
      },
    };
  },
};
