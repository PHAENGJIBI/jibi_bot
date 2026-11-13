// ซิงก์โครงสร้างเซิร์ฟให้ตรงกับ config/server.json
// ใช้ทั้งตอนสร้างเซิร์ฟครั้งแรก (setup-server.js) และตอน Claude แก้ไฟล์ (bot.js)
const fs = require('fs');
const path = require('path');
const {
  ChannelType, PermissionFlagsBits: P, Routes, SnowflakeUtil,
  GuildVerificationLevel, GuildExplicitContentFilter, OverwriteType,
} = require('discord.js');

const R = OverwriteType.Role;
const M = OverwriteType.Member;
const TYPES = {
  text: ChannelType.GuildText,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
  voice: ChannelType.GuildVoice,
};
const STATE_DIR = path.join(__dirname, '..', 'state');

async function syncServer({ client, guild, cfg, archiveOld = false, log = console.log }) {
  const warn = (m) => log(`⚠️ ${m}`);
  await guild.channels.fetch();
  await guild.roles.fetch();

  const before = new Set(guild.channels.cache.map((c) => c.id));
  const ours = new Set();

  // ---------- ยศ ----------
  const roles = {};
  for (const [key, r] of Object.entries(cfg.roles)) {
    let role = guild.roles.cache.find((x) => x.name === r.name);
    const data = {
      name: r.name, hoist: !!r.hoist, mentionable: !!r.mentionable,
      permissions: r.admin ? [P.Administrator] : [],
    };
    if (r.color) data.colors = { primaryColor: r.color };
    if (r.icon && guild.features.includes('ROLE_ICONS')) data.unicodeEmoji = r.icon;
    if (!role) { role = await guild.roles.create(data); log(`➕ ยศ ${r.name}`); }
    else { await role.edit(data).catch((e) => warn(`แก้ยศ ${r.name} ไม่ได้: ${e.message}`)); }
    roles[key] = role;
  }
  const staffIds = [roles.admin.id, roles.staff.id];
  const boosterRole = guild.roles.premiumSubscriberRole;
  if (boosterRole) roles.booster = boosterRole;

  // ---------- สิทธิ์ ----------
  const noTalk = () => [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads];
  function overwrites(visible, readOnly) {
    const everyone = guild.roles.everyone.id;
    const list = [];
    if (visible === 'everyone') {
      list.push({ id: everyone, type: R, allow: [P.ViewChannel], deny: readOnly ? noTalk() : [] });
    } else {
      list.push({ id: everyone, type: R, deny: [P.ViewChannel] });
      if (visible !== 'staff') {
        if (!roles[visible]) throw new Error(`visible "${visible}" ไม่มีใน roles`);
        list.push({ id: roles[visible].id, type: R, allow: [P.ViewChannel, P.ReadMessageHistory, P.AddReactions, P.Connect, P.Speak], deny: readOnly ? noTalk() : [] });
      }
    }
    for (const id of staffIds) {
      list.push({ id, type: R, allow: [P.ViewChannel, P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.ManageMessages, P.ManageThreads, P.Connect, P.Speak] });
    }
    list.push({ id: client.user.id, type: M, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ManageMessages, P.ManageThreads, P.CreatePublicThreads, P.SendMessagesInThreads] });
    return list;
  }

  async function ensureCategory(name, perm, was = []) {
    const findCat = (n) => guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === n);
    let cat = findCat(name);
    if (!cat) for (const old of was) { cat = findCat(old); if (cat) { await cat.setName(name); log(`✏️ เปลี่ยนชื่อหมวด ${old} → ${name}`); break; } }
    if (!cat) { cat = await guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: perm }); log(`➕ หมวด ${name}`); }
    else { await cat.permissionOverwrites.set(perm); }
    ours.add(cat.id);
    return cat;
  }

  // Discord เปลี่ยนชื่อห้องแชทเป็นตัวเล็ก และเว้นวรรคเป็น - เอง จึงเทียบแบบเดียวกัน
  const textLike = (t) => [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(t);
  const norm = (name, t) => (textLike(t) ? String(name).toLowerCase().replace(/\s+/g, '-') : String(name));
  const sameType = (x, ch) => x.type === TYPES[ch.type] || (ch.type === 'announcement' && x.type === ChannelType.GuildText);
  const findCh = (ch, name) => guild.channels.cache.find((x) => sameType(x, ch) && norm(x.name, x.type) === norm(name, TYPES[ch.type]));

  async function ensureChannel(ch, parent, perm) {
    const type = TYPES[ch.type];
    let c = findCh(ch, ch.name);
    if (!c) for (const old of ch.was || []) { c = findCh(ch, old); if (c) { await c.setName(ch.name); log(`   ✏️ เปลี่ยนชื่อ ${old} → ${ch.name}`); break; } }
    const base = { name: ch.name, type, parent: parent.id, permissionOverwrites: perm };
    if (ch.type === 'voice' && ch.userLimit) base.userLimit = ch.userLimit;
    if (ch.type === 'voice') base.bitrate = guild.maximumBitrate;
    if (ch.topic && ch.type !== 'voice') base.topic = ch.topic;
    if (ch.type === 'forum') base.availableTags = cfg.forumTags.map((t) => {
      const [emoji, ...rest] = t.split(' ');
      return { name: rest.join(' '), emoji: { id: null, name: emoji } };
    });
    if (!c) { c = await guild.channels.create(base); log(`   ➕ ${ch.name}`); }
    else {
      // keepLayout: ห้องที่มีอยู่แล้ว ไม่ย้ายหมวด (คนย้ายเองใน Discord ให้คงไว้)
      if (!cfg.keepLayout && c.parentId !== parent.id) await c.setParent(parent.id, { lockPermissions: false });
      await c.permissionOverwrites.set(perm);
      if (ch.topic && 'setTopic' in c && c.topic !== ch.topic) await c.setTopic(ch.topic).catch(() => {});
      if (ch.type === 'voice' && (ch.userLimit || 0) !== (c.userLimit || 0)) await c.setUserLimit(ch.userLimit || 0).catch(() => {});
      if (ch.type === 'voice' && c.bitrate !== guild.maximumBitrate) await c.setBitrate(guild.maximumBitrate).catch(() => {});
      if (ch.type === 'announcement' && c.type === ChannelType.GuildText) await c.setType(ChannelType.GuildAnnouncement).catch(() => {});
    }
    ours.add(c.id);
    return c;
  }

  // ---------- ห้องที่ต้องมีก่อนเปิด Community ----------
  const keyed = {};
  const first = cfg.categories.filter((cat) => cat.channels.some((ch) => ['rules', 'staffchat'].includes(ch.key)));
  for (const cat of first) {
    const c = await ensureCategory(cat.name, overwrites(cat.visible, false), cat.was);
    for (const ch of cat.channels) {
      if (ch.type !== 'text' && !guild.features.includes('COMMUNITY')) continue;
      const made = await ensureChannel(ch, c, overwrites(ch.visible || cat.visible, ch.readOnly));
      if (ch.key) keyed[ch.key] = made;
    }
  }

  if (!guild.features.includes('COMMUNITY')) {
    try {
      await guild.edit({
        features: [...guild.features, 'COMMUNITY'],
        verificationLevel: Math.max(guild.verificationLevel, GuildVerificationLevel.Low),
        explicitContentFilter: GuildExplicitContentFilter.AllMembers,
        rulesChannel: keyed.rules.id,
        publicUpdatesChannel: keyed.staffchat.id,
      });
      log('✅ เปิดโหมด Community แล้ว');
      await guild.channels.fetch();
    } catch (e) {
      warn(`เปิด Community ไม่ได้ (${e.message}) — เปิดเองใน Server Settings > Enable Community แล้วรันอีกครั้ง`);
    }
  }

  // ---------- หมวดทั้งหมด ----------
  const forums = [];
  for (const cat of cfg.categories) {
    if (cat.visible === 'booster' && !roles.booster) { log(`ℹ️ ข้ามหมวด ${cat.name} — ยังไม่มียศ Server Booster (จะสร้างเองเมื่อมีคนบูสต์)`); continue; }
    const c = await ensureCategory(cat.name, overwrites(cat.visible, false), cat.was);
    for (const ch of cat.channels) {
      try {
        const made = await ensureChannel(ch, c, overwrites(ch.visible || cat.visible, ch.readOnly));
        if (ch.key) keyed[ch.key] = made;
        if (ch.type === 'forum') forums.push(made);
      } catch (e) { warn(`สร้าง/แก้ ${ch.name} ไม่ได้: ${e.message}`); }
    }
  }

  // ---------- เรียงหมวด + เรียงห้องในหมวด ----------
  const positions = [];
  cfg.categories.forEach((cat, i) => {
    const c = guild.channels.cache.find((x) => x.type === ChannelType.GuildCategory && x.name === cat.name);
    if (c) positions.push({ channel: c.id, position: i });
    cat.channels.forEach((ch, j) => {
      const x = guild.channels.cache.find((y) => norm(y.name, y.type) === norm(ch.name, TYPES[ch.type]) && y.parentId === (c && c.id));
      if (x) positions.push({ channel: x.id, position: j });
    });
  });
  // keepLayout: ไม่เรียงตำแหน่งใหม่ — ตำแหน่งที่ย้ายเองใน Discord คงไว้เสมอ (ห้องใหม่ไปต่อท้ายหมวด)
  if (!cfg.keepLayout) await guild.channels.setPositions(positions).catch((e) => warn(`เรียงห้องไม่ได้: ${e.message}`));
  else log('📌 keepLayout: ไม่เรียงตำแหน่งห้องใหม่');

  // ---------- ย้ายห้องเก่า (เฉพาะตอนสร้างเซิร์ฟครั้งแรก) ----------
  if (archiveOld) {
    const old = guild.channels.cache.filter((c) => before.has(c.id) && !ours.has(c.id) && c.type !== ChannelType.GuildCategory && !c.isThread() && !(c.parent && c.parent.name.startsWith('📦 ARCHIVE')));
    if (old.size) {
      let archive = null; let n = 0; let idx = 0;
      const hidden = [{ id: guild.roles.everyone.id, type: R, deny: [P.ViewChannel] }, ...staffIds.map((id) => ({ id, type: R, allow: [P.ViewChannel] }))];
      for (const c of old.values()) {
        if (!archive || n >= 50) { idx += 1; archive = await ensureCategory(`📦 ARCHIVE ${idx}`, hidden); n = 0; }
        await c.setParent(archive.id, { lockPermissions: true }).catch((e) => warn(`ย้าย ${c.name} ไม่ได้: ${e.message}`));
        n += 1;
      }
      log(`📦 ย้ายห้องเก่า ${old.size} ห้องไปหมวด ARCHIVE (ซ่อนจากลูกค้า ไม่ได้ลบ)`);
      for (const c of guild.channels.cache.filter((x) => x.type === ChannelType.GuildCategory && before.has(x.id) && !ours.has(x.id)).values()) {
        await c.permissionOverwrites.set([{ id: guild.roles.everyone.id, type: R, deny: [P.ViewChannel] }]).catch(() => {});
      }
    }
  }

  // ---------- ข้อความเริ่มต้น ----------
  await postOnce(client, keyed.rules, rulesText(), log);
  await postOnce(client, keyed.welcome, welcomeText(), log);
  for (const f of forums) {
    try {
      const active = await f.threads.fetchActive();
      if (!active.threads.some((t) => t.name.includes('ມືໃໝ່'))) {
        const t = await f.threads.create({ name: '📖 ຄູ່ມືໃຊ້ Discord ສຳລັບມືໃໝ່', message: { content: newbieGuide() } });
        await t.pin().catch(() => {});
        log(`   📌 ปักหมุดคู่มือมือใหม่ใน ${f.name}`);
      }
    } catch (e) { warn(`สร้างโพสต์คู่มือใน ${f.name} ไม่ได้: ${e.message}`); }
  }

  // ---------- Onboarding (ส่งเฉพาะเมื่อคำถามเปลี่ยน) ----------
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  const stateFile = path.join(STATE_DIR, 'onboarding-last.json');
  const wanted = JSON.stringify(cfg.onboarding);
  const last = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8') : '';
  if (wanted !== last && keyed.rules && keyed.welcome) {
    const prompts = cfg.onboarding.map((q) => ({
      id: SnowflakeUtil.generate().toString(), type: 0, title: q.title,
      single_select: false, required: !!q.required, in_onboarding: true,
      options: q.options.map((o) => ({
        id: SnowflakeUtil.generate().toString(), title: o.title, description: o.description || null, emoji_name: o.emoji,
        role_ids: q.giveCustomer ? [roles[o.role].id, roles.customer.id] : [roles[o.role].id], channel_ids: [],
      })),
    }));
    const defaults = [keyed.rules.id, keyed.welcome.id];
    try {
      await client.rest.put(Routes.guildOnboarding(guild.id), { body: { prompts, default_channel_ids: defaults, enabled: true, mode: 0 } });
      log('✅ ตั้งคำถามตอนเข้าเซิร์ฟ และเปิดใช้งานแล้ว');
      fs.writeFileSync(stateFile, wanted);
    } catch (e) {
      warn(`เปิด Onboarding อัตโนมัติไม่ได้: ${e.message}`);
      try {
        await client.rest.put(Routes.guildOnboarding(guild.id), { body: { prompts, default_channel_ids: defaults, enabled: false, mode: 0 } });
        log('   → บันทึกคำถามไว้แล้วแต่ยังไม่เปิด ให้ไปที่ Server Settings > Onboarding แล้วกดเปิดเอง');
        fs.writeFileSync(stateFile, wanted);
      } catch (e2) { warn(`บันทึกคำถามไม่ได้: ${e2.message}`); }
    }
  }
  log('✅ ซิงก์โครงสร้างเสร็จ');
}

async function postOnce(client, channel, content, log) {
  if (!channel) return;
  const msgs = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  if (msgs && msgs.some((m) => m.author.id === client.user.id)) return;
  await channel.send({ content, allowedMentions: { parse: [] } });
  log(`   ✉️  โพสต์ข้อความใน ${channel.name}`);
}

function rulesText() {
  return [
    '# 📜 ກົດລະບຽບ P SHOP GAMERPOWER', '',
    '**1.** ໃຫ້ກຽດກັນ — ບໍ່ດ່າ, ບໍ່ເວົ້າຫຍາບຄາຍ, ບໍ່ແບ່ງແຍກ',
    '**2.** ບໍ່ສະແປມ, ບໍ່ໂຄສະນາ, ບໍ່ສົ່ງລິ້ງແປກໆ',
    '**3.** ບໍ່ຊື້-ຂາຍ ຫຼື ແລກປ່ຽນໄອດີເກມໃນເຊີບເວີ',
    '**4.** ສັ່ງຊື້ສິນຄ້າຜ່ານ Facebook Page ຫຼື WhatsApp ຂອງ P SHOP ເທົ່ານັ້ນ',
    '**5.** ⚠️ ແອດມິນຈະບໍ່ທັກຫາເຈົ້າກ່ອນເພື່ອຂໍເງິນ — ລະວັງຄົນປອມເປັນແອດມິນ',
    '**6.** ເຮັດຕາມຄຳແນະນຳຂອງແອດມິນ', '',
    'ຝ່າຝືນກົດ = ຕັກເຕືອນ → ປິດປາກ → ເຕະອອກ',
  ].join('\n');
}

function welcomeText() {
  return [
    '# 👋 ຍິນດີຕ້ອນຮັບສູ່ P SHOP GAMERPOWER!', '',
    'ທີ່ນີ້ມີ **ຂ່າວ Valorant**, **Steam ລົດລາຄາ** ແລະ **ຄູ່ມືການໃຊ້ງານທຸກເກມ** 🎮', '',
    '**ເລີ່ມຕົ້ນ:**',
    '1️⃣ ອ່ານ 📜・ກົດລະບຽບ',
    '2️⃣ ເລືອກເກມທີ່ເຈົ້າຫຼິ້ນ (ເມນູ Channels & Roles ດ້ານເທິງ)',
    '3️⃣ ເປີດຫ້ອງ 📖・ຄູ່ມື ຂອງເກມທີ່ເລືອກ', '',
    '🛒 ສັ່ງຊື້: Facebook Page / WhatsApp ຂອງ P SHOP GAMERPOWER',
  ].join('\n');
}

function newbieGuide() {
  return [
    '**ຄູ່ມືໃຊ້ Discord ສຳລັບມືໃໝ່** 🙌', '',
    '**1. ເລືອກເກມ / ປ່ຽນເກມ** — ກົດ "Channels & Roles" ດ້ານເທິງລາຍການຫ້ອງ',
    '**2. ອ່ານຄູ່ມື** — ຫ້ອງ 📖 ທຸກຫ້ອງມີໂພສ [How-to] ໃຫ້ກົດອ່ານໄດ້ເລີຍ',
    '**3. ຄົ້ນຫາຄູ່ມື** — ພິມ `/howto` ຕາມດ້ວຍຄຳທີ່ຢາກຮູ້ ເຊັ່ນ `/howto VP`',
    '**4. ລົມກັບໝູ່** — ໄປຫ້ອງ 💬 ຂອງເກມທີ່ເລືອກ',
    '**5. ປິດແຈ້ງເຕືອນ** — ກົດຄ້າງທີ່ຊື່ເຊີບເວີ → Notification Settings', '',
    '[ຮູບ / ຄລິບສອນ — ແອດມິນຈະເພີ່ມພາຍຫຼັງ]',
  ].join('\n');
}

module.exports = { syncServer };
