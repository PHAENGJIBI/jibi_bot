// สะพานระหว่าง Claude กับ JIBI ผ่านโฟลเดอร์
//  - Claude แก้ config/server.json  → JIBI ซิงก์เซิร์ฟอัตโนมัติ
//  - Claude แก้ bot.js หรือ lib/*.js → JIBI รีสตาร์ทตัวเองเพื่อใช้โค้ดใหม่
//  - Claude วางไฟล์งานใน inbox/     → JIBI ทำงาน แล้วเขียนผลใน outbox/
const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ChannelType } = require('discord.js');
const { syncServer } = require('./sync');

const ROOT = path.join(__dirname, '..');
const INBOX = path.join(ROOT, 'inbox');
const DONE = path.join(INBOX, 'done');
const OUTBOX = path.join(ROOT, 'outbox');
const CONFIG = path.join(ROOT, 'config', 'server.json');
for (const d of [INBOX, DONE, OUTBOX]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

function startBridge({ client, guild, notify }) {
  let busy = Promise.resolve();
  const queue = (fn) => { busy = busy.then(fn).catch((e) => console.error(e)); return busy; };
  const timers = {};
  const debounce = (key, ms, fn) => { clearTimeout(timers[key]); timers[key] = setTimeout(fn, ms); };

  // ----- 1. config เปลี่ยน → ซิงก์ -----
  fs.watch(path.dirname(CONFIG), (ev, file) => {
    if (file !== 'server.json') return;
    debounce('sync', 2000, () => queue(async () => { await waitStable(CONFIG); await runSync('config เปลี่ยน'); }));
  });

  // ----- 2. โค้ดเปลี่ยน → รีสตาร์ท -----
  const codeFiles = [path.join(ROOT, 'bot.js'), path.join(__dirname), path.join(ROOT, 'plugins'), path.join(ROOT, 'data')];
  for (const target of codeFiles) {
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    fs.watch(target, (ev, file) => {
      if (file && !(String(file).endsWith('.js') || String(file) === 'plugins.json')) return;
      debounce('restart', 3000, () => restartWhenStable());
    });
  }

  // รอจนไฟล์โค้ดเขียนเสร็จจริง (ขนาด/เวลาไม่เปลี่ยน 3 วินาที) ค่อยรีสตาร์ท — กันโหลดไฟล์ครึ่งๆ กลางๆ
  let restarting = false;
  function codeSnapshot() {
    const files = [path.join(ROOT, 'bot.js')];
    for (const d of [__dirname, path.join(ROOT, 'plugins')]) {
      if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (f.endsWith('.js')) files.push(path.join(d, f));
    }
    files.push(path.join(ROOT, 'data', 'plugins.json'));
    return files.map((f) => { try { const st = fs.statSync(f); return `${f}:${st.size}:${st.mtimeMs}:${fs.readFileSync(f).length}`; } catch { return `${f}:-`; } }).join('|');
  }
  async function restartWhenStable() {
    if (restarting) return;
    restarting = true;
    let last = codeSnapshot();
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const now = codeSnapshot();
      if (now === last) break;
      last = now;
    }
    await notify('🔁 Claude ອັບເດດໂຄດ JIBI — ກຳລັງ restart...');
    console.log('🔁 โค้ดถูกอัปเดต กำลังรีสตาร์ท...');
    setTimeout(() => process.exit(0), 1000);
  }

  // ----- 3. งานใน inbox -----
  fs.watch(INBOX, (ev, file) => {
    if (!file || !file.endsWith('.json')) return;
    debounce(`task:${file}`, 1200, () => queue(() => runTask(file)));
  });
  for (const f of fs.readdirSync(INBOX).filter((x) => x.endsWith('.json'))) queue(() => runTask(f));

  // รอจนไฟล์ไม่เปลี่ยนแล้ว 2 รอบติด และอ่านเป็น JSON ได้ — กันอ่านไฟล์ที่ยังเขียนไม่เสร็จ
  async function waitStable(file) {
    let last = '';
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      let now = '';
      try { now = fs.readFileSync(file, 'utf8'); JSON.parse(now); } catch { last = ''; continue; }
      if (now === last) return;
      last = now;
    }
  }

  async function runSync(reason) {
    const lines = [];
    const log = (m) => { lines.push(m); console.log(m); };
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
      log(`🔄 ซิงก์เซิร์ฟ (${reason})`);
      await syncServer({ client, guild, cfg, archiveOld: false, log });
      await notify(`🔄 Claude ອັບເດດໂຄງສ້າງເຊີບເວີແລ້ວ\n${lines.filter((l) => /➕|⚠️/.test(l)).slice(0, 15).join('\n') || 'ບໍ່ມີຫ້ອງໃໝ່'}`);
      writeOut('last-sync', { ok: true, at: new Date().toISOString(), log: lines });
    } catch (e) {
      log(`❌ ${e.message}`);
      writeOut('last-sync', { ok: false, at: new Date().toISOString(), error: e.message, log: lines });
    }
  }

  async function runTask(file) {
    const src = path.join(INBOX, file);
    if (!fs.existsSync(src)) return;
    const id = file.replace(/\.json$/, '');
    let task;
    try { task = JSON.parse(fs.readFileSync(src, 'utf8')); }
    catch (e) { writeOut(id, { ok: false, error: `อ่านไฟล์งานไม่ได้: ${e.message}` }); return move(src, file); }
    console.log(`📥 งานจาก Claude: ${task.action} (${id})`);
    try {
      const result = await doTask(task);
      writeOut(id, { ok: true, action: task.action, at: new Date().toISOString(), result });
    } catch (e) {
      writeOut(id, { ok: false, action: task.action, at: new Date().toISOString(), error: e.message });
    }
    move(src, file);
  }

  async function doTask(t) {
    await guild.channels.fetch();
    const findCh = (name) => {
      const n = (v) => String(v).toLowerCase().replace(/\s+/g, '-');
      const c = guild.channels.cache.find((x) => x.name === name || n(x.name) === n(name));
      if (!c) throw new Error(`ไม่พบห้อง "${name}"`);
      return c;
    };
    switch (t.action) {
      case 'sync':
        await runSync('สั่งจาก Claude');
        return 'ok';
      case 'find-members': {
        // หา ID สมาชิกจากชื่อ — { names: [...] }
        await guild.members.fetch();
        const out = {};
        for (const nm of t.names || []) {
          const k = String(nm).toLowerCase();
          const m = guild.members.cache.find((x) => [x.displayName, x.user.username, x.user.globalName].filter(Boolean).some((v) => v.toLowerCase() === k));
          out[nm] = m ? m.id : null;
        }
        return out;
      }
      case 'report':
        return report();
      case 'post': {
        const ch = findCh(t.channel);
        // mentionNames: ["ชื่อ", ...] → หาสมาชิกจากชื่อ แล้วแท็ก {mentions} ใน content ให้เด้งแจ้งเตือน
        let users = [];
        if (t.mentionNames && t.mentionNames.length) {
          await guild.members.fetch();
          const missing = [];
          for (const nm of t.mentionNames) {
            const k = String(nm).toLowerCase();
            const m = guild.members.cache.find((x) => [x.displayName, x.user.username, x.user.globalName].filter(Boolean).some((v) => v.toLowerCase() === k));
            if (m) users.push(m.id); else missing.push(nm);
          }
          if (missing.length) throw new Error(`หาสมาชิกไม่เจอ: ${missing.join(', ')}`);
        }
        if (Array.isArray(t.mentionIds)) users.push(...t.mentionIds.filter((x) => /^\d{15,22}$/.test(x)));
        let content = t.content ? t.content.replace('{mentions}', users.map((id) => `<@${id}>`).join(' ')) : undefined;
        // {#ชื่อห้อง} → ลิงก์ห้องกดได้
        if (content) content = content.replace(/\{#([^}]+)\}/g, (_, nm) => `<#${findCh(nm).id}>`);
        const msg = { content, allowedMentions: { users } };
        if (t.embed) {
          const e = new EmbedBuilder().setColor(0xFFC400);
          if (t.embed.title) e.setTitle(t.embed.title);
          if (t.embed.description) e.setDescription(t.embed.description);
          if (t.embed.image) e.setImage(t.embed.image);
          if (t.embed.thumbnail) e.setThumbnail(t.embed.thumbnail === 'logo' ? guild.iconURL({ size: 256 }) : t.embed.thumbnail);
          e.setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
          msg.embeds = [e];
        }
        const sent = await ch.send(msg);
        return { messageUrl: sent.url };
      }
      case 'reply-mention': {
        // ตอบกลับข้อความล่าสุดของคนนี้ที่แท็ก JIBI — { user: "ชื่อ", content: "... {user} ..." }
        await guild.members.fetch();
        const k = String(t.user).toLowerCase();
        const mem = guild.members.cache.find((x) => [x.displayName, x.user.username, x.user.globalName].filter(Boolean).some((v) => v.toLowerCase() === k));
        if (!mem) throw new Error(`หาสมาชิกไม่เจอ: ${t.user}`);
        let best = null;
        for (const c of guild.channels.cache.filter((x) => x.isTextBased && x.isTextBased() && x.viewable).values()) {
          const msgs = await c.messages.fetch({ limit: 30 }).catch(() => null);
          if (!msgs) continue;
          for (const m of msgs.values()) {
            if (m.author.id === mem.id && m.mentions.users.has(client.user.id) && (!best || m.createdTimestamp > best.createdTimestamp)) best = m;
          }
        }
        if (!best) throw new Error('ไม่เจอข้อความที่แท็ก JIBI');
        const content = t.content.replace('{user}', `<@${mem.id}>`);
        const sent = await best.reply({ content, allowedMentions: { users: [mem.id], repliedUser: true } });
        return { replyTo: best.content, channel: best.channel.name, messageUrl: sent.url };
      }
      case 'bot-color': {
        // เปลี่ยนสีชื่อ JIBI — สร้าง/แก้ยศสีของบอท แล้ววางไว้สูงสุดเท่าที่บอทวางได้
        const me = await guild.members.fetchMe({ force: true });
        const color = parseInt(String(t.color || '#FFC400').replace('#', ''), 16);
        const name = t.roleName || '🤖 JIBI';
        let r = guild.roles.cache.find((x) => x.name === name);
        if (!r) r = await guild.roles.create({ name, colors: { primaryColor: color }, reason: 'สีชื่อ JIBI' });
        else await r.edit({ colors: { primaryColor: color } });
        const top = me.roles.highest;
        if (r.id !== top.id) await r.setPosition(Math.max(1, top.position - 1)).catch((e) => console.error('[bot-color]', e.message));
        if (!me.roles.cache.has(r.id)) await me.roles.add(r);
        const after = await guild.members.fetchMe({ force: true });
        return { display: after.displayHexColor, roles: after.roles.cache.sort((a, b) => b.position - a.position).map((x) => `${x.name} ${x.hexColor} @${x.position}`) };
      }
      case 'ping': {
        // วัดความเร็ว: ping ของ gateway + เวลาเรียก API จริง 3 ครั้ง
        const rest = [];
        for (let k = 0; k < 3; k++) { const t0 = Date.now(); await guild.fetch(); rest.push(Date.now() - t0); }
        return { wsPing: client.ws.ping, restMs: rest, host: process.env.JIBI_HOST || 'pc', uptimeSec: Math.round(process.uptime()) };
      }
      case 'post-file': {
        // โพสต์รูปจากใน repo (เช่น assets/results/game1.png) + ข้อความ/การ์ด + แท็กคน — { channel, file, content, mentionIds, embed:{title,description} }
        const ch = findCh(t.channel);
        const abs = path.resolve(ROOT, String(t.file || ''));
        if (!abs.startsWith(path.join(ROOT, 'assets') + path.sep) || !fs.existsSync(abs)) throw new Error(`ไม่พบไฟล์ ${t.file}`);
        const name = path.basename(abs);
        const users = (t.mentionIds || []).filter((x) => /^\d{15,22}$/.test(x));
        let content = t.content ? t.content.replace('{mentions}', users.map((id) => `<@${id}>`).join(' ')) : undefined;
        if (content) content = content.replace(/\{#([^}]+)\}/g, (_, nm) => `<#${findCh(nm).id}>`);
        const msg = { content, files: [{ attachment: abs, name }], allowedMentions: { users } };
        if (t.embed) {
          const e = new EmbedBuilder().setColor(0xFFC400).setImage(`attachment://${name}`).setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
          if (t.embed.title) e.setTitle(t.embed.title);
          if (t.embed.description) e.setDescription(t.embed.description);
          msg.embeds = [e];
        }
        const sent = await ch.send(msg);
        return { messageUrl: sent.url };
      }
      case 'dm': {
        // ส่งข้อความส่วนตัว — { userIds:[...], content, embed:{title,description} } · {#ห้อง} = ลิงก์ห้อง
        const out = {};
        let content = t.content ? t.content.replace(/\{#([^}]+)\}/g, (_, nm) => `<#${findCh(nm).id}>`) : undefined;
        let embeds;
        if (t.embed) {
          const e = new EmbedBuilder().setColor(0xFFC400).setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
          if (t.embed.title) e.setTitle(t.embed.title);
          if (t.embed.description) e.setDescription(t.embed.description.replace(/\{#([^}]+)\}/g, (_, nm) => `<#${findCh(nm).id}>`));
          embeds = [e];
        }
        for (const id of t.userIds || []) {
          try { const u = await client.users.fetch(id); await u.send({ content, embeds }); out[id] = 'ok'; }
          catch (e) { out[id] = `fail: ${e.message}`; }
        }
        return out;
      }
      case 'howto': {
        const forum = findCh(t.forum);
        if (forum.type !== ChannelType.GuildForum) throw new Error(`"${t.forum}" ไม่ใช่ห้อง Forum`);
        const tags = (t.tags || []).map((name) => forum.availableTags.find((x) => x.name === name || `${x.emoji?.name} ${x.name}` === name)).filter(Boolean).map((x) => x.id);
        const th = await forum.threads.create({ name: t.title, message: { content: t.content }, appliedTags: tags });
        return { threadUrl: th.url };
      }
      case 'delete-messages': {
        // ลบข้อความตาม ID — { channel, ids: [...] }
        const ch = findCh(t.channel);
        const done = [];
        for (const id of t.ids || []) {
          const m = await ch.messages.fetch(id).catch(() => null);
          if (m) { await m.delete(); done.push(id); }
        }
        return { deleted: done.length };
      }
      case 'edit-message': {
        const ch = findCh(t.channel);
        const m = await ch.messages.fetch(t.messageId);
        const upd = { content: t.content ? t.content.replace(/\{#([^}]+)\}/g, (_, nm) => `<#${findCh(nm).id}>`) : t.content, allowedMentions: { parse: [] } };
        if (t.embed) {
          // แก้เป็นการ์ด (embed) — ไม่แท็กซ้ำ
          const e = new EmbedBuilder().setColor(0xFFC400);
          if (t.embed.title) e.setTitle(t.embed.title);
          if (t.embed.description) e.setDescription(t.embed.description);
          if (t.embed.thumbnail) e.setThumbnail(t.embed.thumbnail === 'logo' ? guild.iconURL({ size: 256 }) : t.embed.thumbnail);
          e.setFooter({ text: t.embed.footer || 'JIBI · P SHOP GAMERPOWER' });
          upd.embeds = [e];
        }
        await m.edit(upd);
        return 'ok';
      }
      case 'migrate-roles': {
        // ให้ยศใหม่ตามยศเก่า (เพิ่มอย่างเดียว ไม่ลบยศเก่า) + ให้ยศลูกค้ากับทุกคน
        await guild.members.fetch();
        await guild.roles.fetch();
        const byName = (n) => guild.roles.cache.find((r) => r.name === n);
        const customer = t.customer ? byName(t.customer) : null;
        let changed = 0;
        client.jibiBulk = true;
        try {
          for (const m of guild.members.cache.values()) {
            if (m.user.bot) continue;
            const add = [];
            if (customer && !m.roles.cache.has(customer.id)) add.push(customer.id);
            for (const [oldName, newName] of Object.entries(t.map || {})) {
              const o = byName(oldName); const n = byName(newName);
              if (o && n && m.roles.cache.has(o.id) && !m.roles.cache.has(n.id)) add.push(n.id);
            }
            if (add.length) { await m.roles.add(add, 'ย้ายยศเก่า → ยศใหม่ (Claude)'); changed += 1; }
          }
        } finally { client.jibiBulk = false; }
        await notify(`🔁 ອັບເດດຍົດໃຫ້ສະມາຊິກເກົ່າ ${changed} ຄົນ`);
        return { changed };
      }
      case 'delete-voice': {
        const v = guild.channels.cache.find((c) => c.type === ChannelType.GuildVoice && c.name === t.name);
        if (!v) throw new Error(`ไม่พบห้องเสียง "${t.name}"`);
        if (v.members.size) throw new Error(`มีคนอยู่ในห้อง "${t.name}" ${v.members.size} คน — ไม่ลบ`);
        await v.delete('ลบห้องเสียงตามคำสั่ง Claude');
        await notify(`🧹 ລຶບຫ້ອງສຽງ: ${t.name}`);
        return 'deleted';
      }
      case 'delete-empty-category': {
        const cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === t.name);
        if (!cat) throw new Error(`ไม่พบหมวด "${t.name}"`);
        if (cat.children.cache.size) throw new Error(`หมวด "${t.name}" ยังมีห้องอยู่ ${cat.children.cache.size} ห้อง — ไม่ลบ`);
        await cat.delete('ลบหมวดว่างตามคำสั่ง Claude');
        await notify(`🧹 ລຶບໝວດວ່າງ: ${t.name}`);
        return 'deleted';
      }
      case 'archive-channel': {
        // ย้ายห้องไปเก็บในหมวด ARCHIVE ที่ซ่อนไว้ (ไม่ลบ ข้อความยังอยู่ ย้ายกลับได้)
        const c = findCh(t.name);
        const archive = guild.channels.cache.filter((x) => x.type === ChannelType.GuildCategory && x.name.startsWith('📦 ARCHIVE')).find((x) => x.children.cache.size < 50);
        if (!archive) throw new Error('ไม่พบหมวด 📦 ARCHIVE ที่ยังว่าง');
        await c.setParent(archive.id, { lockPermissions: true });
        await notify(`📦 ຍ້າຍຫ້ອງໄປເກັບ: ${c.name}`);
        return 'archived';
      }
      case 'delete-event': {
        const events = await guild.scheduledEvents.fetch();
        const hits = events.filter((e) => e.name.toLowerCase().includes(String(t.name).toLowerCase()));
        if (!hits.size) throw new Error(`ไม่พบอีเวนต์ที่ชื่อมี "${t.name}" (มี: ${events.map((e) => e.name).join(', ') || 'ไม่มีอีเวนต์'})`);
        for (const e of hits.values()) await e.delete();
        await notify(`🗑️ ລຶບອີເວັນ: ${hits.map((e) => e.name).join(', ')}`);
        return hits.map((e) => e.name);
      }
      case 'move-channel': {
        // ย้ายห้องไปหมวดอื่น: { name, category, before? } — before = ชื่อห้องที่จะวางไว้ข้างบน
        const c = findCh(t.name);
        const cat = guild.channels.cache.find((x) => x.type === ChannelType.GuildCategory && x.name === t.category);
        if (!cat) throw new Error(`ไม่พบหมวด "${t.category}"`);
        await c.setParent(cat.id, { lockPermissions: false });
        if (t.before) { const b = findCh(t.before); await c.setPosition(b.position); }
        await notify(`📦 ຍ້າຍຫ້ອງ ${c.name} → ${cat.name}`);
        return 'moved';
      }
      case 'survey-post': {
        if (!client.jibiSurvey) throw new Error('ปลั๊กอิน survey ยังไม่เปิด');
        const m = await client.jibiSurvey.post({ mentionIds: t.mentionIds || [], text: t.text || '' });
        return { messageUrl: m.url };
      }
      case 'add-role': {
        // { userIds: [...], role: 'ชื่อยศ (บางส่วนก็ได้)' }
        await guild.roles.fetch();
        const r = guild.roles.cache.find((x) => x.name.includes(t.role));
        if (!r) throw new Error(`ไม่พบยศ "${t.role}"`);
        const out = {};
        for (const id of t.userIds || []) { const m = await guild.members.fetch(id).catch(() => null); if (m) { await m.roles.add(r).catch((e) => { out[id] = e.message; }); out[id] = out[id] || 'ok'; } else out[id] = 'not found'; }
        return out;
      }
      case 'list-events': {
        const events = await guild.scheduledEvents.fetch();
        return events.map((e) => ({ id: e.id, name: e.name, status: e.status, start: e.scheduledStartAt, users: e.userCount }));
      }
      case 'end-event': {
        // ปิดอีเวนต์: { name, newName?, description?, summary? } → แก้ข้อความ แล้วตั้งเป็น Completed + ปิดงานแข่งในปลั๊กอิน
        const { GuildScheduledEventStatus: ST } = require('discord.js');
        const out = {};
        if (t.summary !== undefined && client.jibiTourney) { await client.jibiTourney.setEvent({ ended: true, summary: t.summary }); out.tourney = 'ended'; }
        if (t.name) {
          const events = await guild.scheduledEvents.fetch();
          const ev = events.find((e) => e.name.toLowerCase().includes(String(t.name).toLowerCase()));
          if (!ev) throw new Error(`ไม่พบอีเวนต์ "${t.name}" (มี: ${events.map((e) => e.name).join(', ') || 'ไม่มี'})`);
          const patch = {};
          if (t.newName) patch.name = String(t.newName).slice(0, 100);
          if (t.description) patch.description = String(t.description).slice(0, 1000);
          let e = ev;
          if (Object.keys(patch).length) e = await e.edit(patch);
          if (e.status === ST.Scheduled) e = await e.setStatus(ST.Active);
          if (e.status === ST.Active) e = await e.setStatus(ST.Completed);
          out.event = { name: e.name, status: e.status };
          await notify(`🏁 ປິດອີເວັນ: ${e.name}`);
        }
        return out;
      }
      case 'channel-perms': {
        // ดูว่าแต่ละยศ ดู/พิมพ์ ในห้องนี้ได้ไหม (คิดสิทธิ์จริงแบบ Discord) — { name }
        const c = findCh(t.name);
        await guild.roles.fetch();
        const { PermissionFlagsBits: PF } = require('discord.js');
        const out = {};
        for (const r of guild.roles.cache.values()) {
          if (r.managed) continue;
          const p = c.permissionsFor(r);
          out[r.name] = { view: p.has(PF.ViewChannel), send: p.has(PF.SendMessages), admin: p.has(PF.Administrator) };
        }
        return out;
      }
      case 'room-code': {
        // ส่งรหัสห้องแข่งทันที (ใช้ปลั๊กอิน tournament) — { code, game?, note? }
        if (!client.jibiRoomCode) throw new Error('ปลั๊กอิน tournament ยังไม่เปิด');
        const msg = await client.jibiRoomCode(client.user, { code: String(t.code).trim(), game: t.game || null, map: t.map || null, note: t.note || null, preview: !!t.preview, channel: t.channel || null });
        return { messageUrl: msg.url };
      }
      case 'create-event': {
        // สร้าง/อัปเดตอีเวนต์ในเซิร์ฟ (ชื่อซ้ำ = แก้อันเดิม ไม่สร้างซ้ำ)
        const { GuildScheduledEventEntityType: ET, GuildScheduledEventPrivacyLevel: PL } = require('discord.js');
        const data = {
          name: t.name,
          description: t.description || undefined,
          scheduledStartTime: new Date(t.start),
          privacyLevel: PL.GuildOnly,
        };
        if (t.end) data.scheduledEndTime = new Date(t.end);
        if (t.voiceChannel) {
          const v = guild.channels.cache.find((c) => (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && c.name === t.voiceChannel);
          if (!v) throw new Error(`ไม่พบห้องเสียง "${t.voiceChannel}"`);
          data.entityType = v.type === ChannelType.GuildStageVoice ? ET.StageInstance : ET.Voice;
          data.channel = v.id;
        } else {
          if (!t.end) throw new Error('อีเวนต์นอก Discord ต้องมี end');
          data.entityType = ET.External;
          data.entityMetadata = { location: t.location || 'Online' };
        }
        if (t.image) data.image = path.isAbsolute(t.image) ? t.image : path.join(ROOT, t.image);
        const events = await guild.scheduledEvents.fetch();
        const old = events.find((e) => e.name === t.name);
        const ev = old ? await old.edit(data) : await guild.scheduledEvents.create(data);
        await notify(`📅 ${old ? 'ອັບເດດ' : 'ສ້າງ'}ອີເວັນ: ${t.name}`);
        const link = `https://discord.com/events/${guild.id}/${ev.id}`;
        if (t.announceChannel) {
          const ch = findCh(t.announceChannel);
          const sent = await ch.send({ content: `${t.announceText || ''}\n${link}`.trim(), allowedMentions: { parse: [] } });
          return { eventUrl: link, id: ev.id, updated: !!old, messageUrl: sent.url };
        }
        return { eventUrl: link, id: ev.id, updated: !!old };
      }
      default:
        throw new Error(`ไม่รู้จักคำสั่ง "${t.action}" (มี: sync, report, post, howto, edit-message, create-event, archive-channel, delete-event)`);
    }
  }

  async function report() {
    await guild.members.fetch().catch(() => {});
    await guild.channels.fetch();
    const cats = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
    return {
      server: guild.name,
      members: guild.memberCount,
      tier: guild.premiumTier, boosts: guild.premiumSubscriptionCount, features: guild.features,
      vanity: guild.vanityURLCode || null, maxBitrate: guild.maximumBitrate,
      roles: guild.roles.cache.sort((a, b) => b.position - a.position).map((r) => ({ name: r.name, members: r.members.size })),
      categories: cats.map((c) => ({
        name: c.name,
        channels: c.children.cache.sort((a, b) => a.position - b.position).map((x) => ({ name: x.name, type: ChannelType[x.type] })),
      })),
    };
  }

  function writeOut(id, data) {
    fs.writeFileSync(path.join(OUTBOX, `${id}.result.json`), JSON.stringify(data, null, 2));
  }
  function move(src, file) {
    try { fs.renameSync(src, path.join(DONE, `${Date.now()}-${file}`)); } catch { /* ignore */ }
  }

  console.log('🔗 สะพาน Claude ↔ JIBI พร้อมแล้ว (เฝ้าโฟลเดอร์ config/, inbox/ และโค้ด)');
  writeOut('bridge-status', { online: true, since: new Date().toISOString() });
  return { run: doTask, sync: runSync };
}

module.exports = { startBridge };
