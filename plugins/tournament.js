// ปลั๊กอิน: ลงทะเบียนนักแข่ง — แผงปุ่มค้างล่างสุดของห้อง 📝 ລົງທະບຽນ-ນັກແຂ່ງ
// กด 📝 → กล่อง: ชื่อ / Riot ID (พิมพ์) · แรงก์ (เลือก) · สังกัด (ไม่ใส่ก็ได้) · ติ๊กเคยเติมกับ P SHOP → JIBI โพสต์การ์ดนักแข่ง
// กดซ้ำ = แก้ข้อมูลเดิม · ❌ = ยกเลิก · เกิน MAX คน = ตัวสำรอง · ข้อมูลเก็บใน data/tourney-regs.json
const {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, MessageFlags,
  LabelBuilder, StringSelectMenuBuilder, CheckboxBuilder, CheckboxGroupBuilder, CheckboxGroupOptionBuilder, SlashCommandBuilder, PermissionFlagsBits,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const store = require('../lib/store');

// ข้อมูลงานแข่ง (แก้ได้จาก JIBI Center Hub) — data/tourney-event.json
const EV_DEFAULT = { name: 'VALORANT DEATHMATCH MINI CUP #1', tag: 'DM1', regChannel: 'ລົງທະບຽນ', codeChannel: 'ລະຫັດຫ້ອງ', max: 10, startAt: null, reminders: [60, 30, 5], regOpen: true, sent: {} };
let EV = { ...EV_DEFAULT, ...store.load('tourney-event', {}) };
let EVENT = EV.name;
let MAX = EV.max; // จำนวนนักแข่งตัวจริง
const unix = (iso) => Math.floor(new Date(iso).getTime() / 1000);
// เวลาแบบตายตัว (เวลาลาว) — ไม่ใช้ <t:..:F> เพราะ Discord แปลงตามเขตเวลาเครื่องคนดู ทำให้เห็นเวลาเพี้ยน
const LAO_DAYS = ['ອາທິດ', 'ຈັນ', 'ອັງຄານ', 'ພຸດ', 'ພະຫັດ', 'ສຸກ', 'ເສົາ'];
function laoTime(iso) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600000); // UTC+7
  const p = (n) => String(n).padStart(2, '0');
  return `${LAO_DAYS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()} · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ໂມງ (ເວລາລາວ)`;
}
const EARLY = '⚡ ຖ້ານັກແຂ່ງມາຄົບກ່ອນ **ອາດເລີ່ມກ່ອນເວລາໄດ້** — ມາໃຫ້ໄວ!';

// ช่องในกล่องลงทะเบียน — แก้/เพิ่มได้ตรงนี้ (Discord ให้สูงสุด 5 ช่องต่อกล่อง)
// type: text = พิมพ์เอง · select = เลือกจากรายการ · checkbox = ติ๊ก
const RANKS = ['Unrated / ບໍ່ມີແຣງ', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
const FIELDS = [
  { id: 'name', type: 'text', label: 'ຊື່ (ຊື່ທີ່ໃຊ້ໃນງານແຂ່ງ)', placeholder: 'ເຊັ່ນ: ແພງ', max: 32, required: true },
  { id: 'riot', type: 'text', label: 'Riot ID (ຊື່#TAG)', placeholder: 'ເຊັ່ນ: PShop#LAO', max: 40, required: true },
  { id: 'rank', type: 'select', label: 'ແຣງ (Rank)', placeholder: 'ເລືອກແຣງຂອງເຈົ້າ', options: RANKS, required: true },
  { id: 'team', type: 'text', label: 'ສັງກັດ / ທີມ (ບໍ່ໃສ່ກໍໄດ້)', placeholder: 'ເຊັ່ນ: ຊື່ທີມ ຫຼື ຊື່ຮ້ານ', max: 40, required: false },
  { id: 'confirm', type: 'group', label: 'ຢືນຢັນ — ຕ້ອງຕິກ 3 ຂໍ້ທຳອິດ', description: 'ຂໍ້ສຸດທ້າຍ (P SHOP) ບໍ່ຕິກກໍໄດ້', options: [
    { value: 'rules', label: '📜 ອ່ານ ແລະ ເຂົ້າໃຈກົດທັງໝົດແລ້ວ', required: true },
    { value: 'code', label: '🔑 ຮູ້ແລ້ວ: ລະຫັດຫ້ອງສົ່ງຢູ່ຫ້ອງ 🔑・ລະຫັດຫ້ອງ ເທົ່ານັ້ນ', required: true },
    { value: 'admin', label: '👑 ຍອມຮັບຄຳຕັດສິນຂອງແອດມິນ ບໍ່ວ່າຈະເປັນແນວໃດ', description: 'ຄຳຕັດສິນຂອງແອດມິນຖືເປັນທີ່ສຸດ', required: true },
    { value: 'pshop', label: '🛒 ເຄີຍເຕີມເກມກັບຮ້ານ P SHOP' },
  ] },
];

function buildField(f, cur) {
  const label = new LabelBuilder().setLabel(f.label);
  if (f.description) label.setDescription(f.description);
  if (f.type === 'select') {
    return label.setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId(f.id).setPlaceholder(f.placeholder)
      .setRequired(f.required).setMinValues(1).setMaxValues(1)
      .addOptions(f.options.map((o) => ({ label: o, value: o, default: cur[f.id] === o }))));
  }
  if (f.type === 'checkbox') {
    return label.setCheckboxComponent(new CheckboxBuilder().setCustomId(f.id).setDefault(!!cur[f.id]));
  }
  if (f.type === 'group') {
    const had = Array.isArray(cur[f.id]) ? cur[f.id] : (cur.pshop ? ['pshop'] : []);
    return label.setCheckboxGroupComponent(new CheckboxGroupBuilder().setCustomId(f.id).setRequired(true)
      .setMinValues(f.options.filter((o) => o.required).length).setMaxValues(f.options.length)
      .addOptions(f.options.map((o) => {
        const b = new CheckboxGroupOptionBuilder().setValue(o.value).setLabel(o.label).setDefault(had.includes(o.value));
        if (o.description) b.setDescription(o.description);
        return b;
      })));
  }
  const input = new TextInputBuilder().setCustomId(f.id).setStyle(TextInputStyle.Short)
    .setPlaceholder(f.placeholder).setMaxLength(f.max).setRequired(f.required);
  if (cur[f.id]) input.setValue(cur[f.id]);
  return label.setTextInputComponent(input);
}
function readField(i, f) {
  const d = i.fields.fields.get(f.id);
  if (!d) return f.type === 'checkbox' ? false : '';
  if (f.type === 'select') return (d.values && d.values[0]) || '';
  if (f.type === 'checkbox') return d.value === true || d.value === 'true';
  if (f.type === 'group') return Array.isArray(d.values) ? d.values : [];
  return String(d.value || '').trim();
}

const isCodeChannel = (c) => c && c.type === ChannelType.GuildText && c.name.includes(EV.codeChannel || 'ລະຫັດຫ້ອງ');
const FULL_MSG = '😢 ນັກແຂ່ງ **ເຕັມແລ້ວ** — ປິດຮັບສະໝັກແລ້ວເດີ້ 🙏 ມາເບິ່ງ/ເຊຍໄດ້ ແລະ ຕິດຕາມງານໜ້າ 💛';
const isRegChannel = (c) => c && c.type === ChannelType.GuildText && c.name.includes(EV.regChannel || 'ລົງທະບຽນ');
const TAG = () => EV.tag || 'DM1';

// จำนวนเกม + รางวัล (แก้ใน data/tourney-event.json: games, prizes)
const GAMES = () => EV.games || 3;
const MEDALS = ['🥇', '🥈', '🥉', '🎖️ ທີ 4', '🎖️ ທີ 5', '🎖️ ທີ 6', '🎖️ ທີ 7', '🎖️ ທີ 8'];
const PRIZES = () => (EV.prizes || [100000, 50000]).map((p, k) => `${MEDALS[k] || `ທີ ${k + 1}`} ${Number(p).toLocaleString('en-US')} ກີບ`).join('\n');

module.exports = {
  id: 'tournament',
  name: 'ลงทะเบียนนักแข่ง (แผงปุ่ม + กล่องกรอกข้อมูล)',
  description: `ห้อง 📝 ລົງທະບຽນ-ນັກແຂ່ງ · กดปุ่ม → กรอก ชื่อ / Riot ID / แรงก์ / สังกัด → JIBI โพสต์การ์ดนักแข่ง (ตัวจริง ${MAX} คน เกินนั้นเป็นตัวสำรอง)`,
  commands: [
    new SlashCommandBuilder().setName('roomcode').setDescription('ສົ່ງລະຫັດຫ້ອງ Custom ໃຫ້ນັກແຂ່ງ (ແອດມິນ)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption((o) => o.setName('code').setDescription('ລະຫັດຫ້ອງ / Party Code').setRequired(true).setMaxLength(40))
      .addIntegerOption((o) => o.setName('game').setDescription('ເກມທີ (1-10)').setMinValue(1).setMaxValue(10))
      .addStringOption((o) => o.setName('map').setDescription('ແຜນທີ່ ເຊັ່ນ Ascent').setMaxLength(40))
      .addStringOption((o) => o.setName('note').setDescription('ໝາຍເຫດເພີ່ມ').setMaxLength(200)),
  ],
  setup({ client, guild, cfg, logTo }) {
    const db = store.load('tourney-regs', { panels: {}, players: {} });
    const pending = new Set(); // คนที่กำลังสมัคร (กันเกินจำนวน)
    db.panels = db.panels || {}; db.players = db.players || {};
    const save = () => store.save('tourney-regs', db);
    const count = () => Object.keys(db.players).length;

    const qaLink = () => { const c = guild.channels.cache.find((x) => x.type === ChannelType.GuildText && x.name.includes('ຖາມ-ຕອບ') && x.name.includes(EV.tag === 'B2' ? 'βeta' : '')); return c ? `<#${c.id}>` : '❓・ຖາມ-ຕອບ'; };
    const codeLink = () => { const c = guild.channels.cache.find(isCodeChannel); return c ? `<#${c.id}>` : '🔑・ລະຫັດຫ້ອງ'; };
    // ข้อมูลสำคัญหลังสมัคร (ตอบในห้อง + ส่ง DM)
    function infoText(no) {
      const t = EV.startAt ? Math.floor(new Date(EV.startAt).getTime() / 1000) : 0;
      return [
        `🏆 **${EVENT}**${no ? ` · ນັກແຂ່ງ #${no}${no > MAX ? ' (ຕົວສຳຮອງ)' : ''}` : ''}`,
        t ? `🕗 ເລີ່ມແຂ່ງ: ${laoTime(EV.startAt)}\n${EARLY}` : '🕗 ເວລາແຂ່ງ: ແອດມິນຈະປະກາດ ແລະ ແຈ້ງເຕືອນໃນຫ້ອງລະຫັດ',
        `🔑 **ລະຫັດຫ້ອງ Custom ຈະມີຢູ່ຫ້ອງ ${codeLink()} ເທົ່ານັ້ນ** (ບໍ່ສົ່ງທາງອື່ນ) — ແຈ້ງເຕືອນກໍ່ຢູ່ຫ້ອງນີ້ ຢ່າລືມເຂົ້າໄປເບິ່ງກ່ອນເວລາແຂ່ງເດີ້`,
        '🎮 ວິທີເຂົ້າຫ້ອງ: ກົດ 📋 ກັອບລະຫັດ → ເປີດ Valorant → PARTY CODE → ວາງລະຫັດ → JOIN',
      ].join('\n');
    }
    // กติกาแบบอ่านง่าย — แบ่งเป็นหัวข้อ (ใช้ตอนกด 📝 ก่อนกรอกใบสมัคร)
    function rulesEmbed() {
      const t = EV.startAt ? unix(EV.startAt) : 0;
      return new EmbedBuilder().setColor(0xFF4655)
        .setTitle('📜 ອ່ານກົດກ່ອນລົງທະບຽນ')
        .setDescription(`**${EVENT}**\n🔑 ສະໝັກແລ້ວ → ເອົາລະຫັດຫ້ອງທີ່ ${codeLink()} **ເທົ່ານັ້ນ**\nອ່ານໃຫ້ຄົບ ແລ້ວກົດ **✅ ຍອມຮັບ** ດ້ານລຸ່ມ\n⚠️ ກົດ ✅ = ຍອມຮັບກົດທັງໝົດ **ລວມທັງຄຳຕັດສິນຂອງແອດມິນ**`)
        .addFields(
          { name: '🕗 ວັນ-ເວລາ', value: t ? `${laoTime(EV.startAt)}\n(<t:${t}:R>)\n${EARLY}` : 'ແອດມິນຈະປະກາດ', inline: true },
          { name: '🎮 ຮູບແບບ', value: `Deathmatch · ${MAX} ຄົນ\n**${GAMES()} ເກມ** · ນັບ **Kill ລວມ**`, inline: true },
          { name: '🏆 ລາງວັນ', value: PRIZES(), inline: true },
          { name: '✅ ອະນຸຍາດ', value: '• ໃຊ້ໄດ້ **ທຸກປືນ**\n• **ທຸກແຣງ** ລົງແຂ່ງນຳກັນ\n• ສະຕຣີມໄດ້ (delay **2 ນາທີ**)', inline: true },
          { name: '🚫 ຫ້າມ', value: '• ໂກງ / ໂປຣແກຣມຊ່ວຍ\n→ **ຕັດສິດທັນທີ**', inline: true },
          { name: '⚖️ ຄະແນນເທົ່າກັນ', value: '1. Death ໜ້ອຍກວ່າ\n2. %Headshot ສູງກວ່າ\n3. ດວນ 1v1 (5 Kill)', inline: true },
          { name: '📝 ວັນແຂ່ງ', value: [
            '1. ໃຊ້ບັນຊີ Riot ຂອງຕົວເອງ (ຕາມທີ່ລົງທະບຽນ)',
            '2. ເຂົ້າຫ້ອງສຽງ 🔊 ກ່ອນເລີ່ມ **10 ນາທີ**',
            '3. ຊ້າເກີນ 10 ນາທີ = **ຕົວສຳຮອງລົງແທນ**',
          ].join('\n') },
          { name: '🔌 ເນັດຫຼຸດ / ຄອມມີບັນຫາ', value: [
            '• ຮີບເຂົ້າເກມຄືນ **ໃຫ້ໄວທີ່ສຸດ** — ເກມແຂ່ງຕໍ່ ບໍ່ຢຸດລໍ',
            '• **ບໍ່ມີການແຂ່ງໃໝ່ (Rematch) ໃຫ້ຄົນດຽວ**',
            '• **ຂໍ Surrender / ຍົກເລີກເກມ ບໍ່ໄດ້**',
            '• ນັບຄະແນນຕາມຈິງ — ເຂົ້າບໍ່ທັນ = ບໍ່ມີຄະແນນເກມນັ້ນ',
          ].join('\n') },
          { name: '👑 ຄຳຕັດສິນຂອງແອດມິນ = ທີ່ສຸດ', value: 'ກໍລະນີພິເສດ ຫຼື ມີບັນຫາໃດໆ ແອດມິນເປັນຜູ້ຕັດສິນ\n**ຄຳຕັດສິນຂອງແອດມິນຖືເປັນທີ່ສຸດ — ທຸກຄົນຕ້ອງຍອມຮັບ**' },
          { name: '🔑 ລະຫັດຫ້ອງ', value: `ມີຢູ່ ${codeLink()} **ເທົ່ານັ້ນ** — ເຫັນຫຼັງລົງທະບຽນ`, inline: true },
          { name: '❓ ມີຄຳຖາມ', value: `ຖາມທີ່ ${qaLink()} **ເທົ່ານັ້ນ**`, inline: true },
        )
        .setFooter({ text: '👑 ຄຳຕັດສິນຂອງແອດມິນຖືເປັນທີ່ສຸດ · JIBI · P SHOP GAMERPOWER' });
    }
    // สมัครเสร็จ (ขั้น 3) — บอกสิ่งที่ต้องทำต่ออย่างเดียว + ปุ่มลิงก์
    const chUrl = (c) => `https://discord.com/channels/${guild.id}/${c.id}`;
    function doneMessage(no) {
      const sub = no > MAX;
      const hm = (iso, minus) => { const d = new Date(new Date(iso).getTime() + 7 * 3600000 - minus * 60000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
      const day = EV.startAt ? laoTime(EV.startAt).split(' · ')[0] : 'ວັນແຂ່ງ';
      const voice = guild.channels.cache.find((c) => c.type === ChannelType.GuildVoice && c.name.includes('βETA'));
      const e = new EmbedBuilder().setColor(0x1D9E75)
        .setTitle(`🎉 ສະໝັກສຳເລັດ! ເຈົ້າແມ່ນນັກແຂ່ງ #${no}${sub ? ' (ຕົວສຳຮອງ)' : ''}`)
        .setDescription([
          '✅ 1 ກົດຢາກແຂ່ງ  →  ✅ 2 ສະໝັກ  →  👉 **3 ວັນແຂ່ງ**',
          '',
          `🎧 **${day} · ${EV.startAt ? hm(EV.startAt, 30) : '—'} ໂມງ** ເຂົ້າ Voice ${voice ? `<#${voice.id}>` : '**🔊 βETA TOURNAMENT**'}`,
          `🔑 ລະຫັດຫ້ອງຈະມາທີ່ ${codeLink()} (ເປີດໄດ້ແລ້ວດຽວນີ້) + DM`,
          sub ? '🔁 ເຈົ້າເປັນຕົວສຳຮອງ — ຖ້າມີຄົນບໍ່ມາ ແອດມິນຈະເອີ້ນ ມາລໍຖ້າໃນ Voice ໄດ້' : null,
        ].filter((x) => x !== null).join('\n'))
        .setFooter({ text: '👑 ຄຳຕັດສິນຂອງແອດມິນຖືເປັນທີ່ສຸດ · JIBI · P SHOP GAMERPOWER' });
      const code = guild.channels.cache.find(isCodeChannel);
      const qa = guild.channels.cache.find((x) => x.type === ChannelType.GuildText && x.name.includes('ຖາມ-ຕອບ') && x.name.includes(EV.tag === 'B2' ? 'βeta' : ''));
      const btns = [];
      if (code) btns.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(chUrl(code)).setLabel('🔑 ເປີດຫ້ອງລະຫັດ'));
      if (qa) btns.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(chUrl(qa)).setLabel('❓ ມີຄຳຖາມ'));
      return { embeds: [e], components: btns.length ? [new ActionRowBuilder().addComponents(...btns)] : [] };
    }
    // ข้อมูลหลังสมัครแบบอ่านง่าย (ตอบในห้อง + DM)
    function infoEmbed(no, edited) {
      const t = EV.startAt ? unix(EV.startAt) : 0;
      const e = new EmbedBuilder().setColor(0xFFC400)
        .setTitle(edited ? '✏️ ແກ້ໄຂຂໍ້ມູນແລ້ວ' : '✅ ລົງທະບຽນສຳເລັດ!')
        .setDescription(`**${EVENT}**`);
      const fields = [];
      if (no) fields.push({ name: '🎫 ເລກນັກແຂ່ງ', value: `**#${no}**${no > MAX ? ' · ຕົວສຳຮອງ' : ' · ຕົວຈິງ'}`, inline: true });
      fields.push({ name: '🕗 ເລີ່ມແຂ່ງ', value: t ? `${laoTime(EV.startAt)}\n(<t:${t}:R>)\n${EARLY}` : 'ແອດມິນຈະປະກາດ', inline: true });
      fields.push({ name: '🔑 ລະຫັດຫ້ອງ', value: `ມີຢູ່ ${codeLink()} **ເທົ່ານັ້ນ**\nແຈ້ງເຕືອນກໍ່ຢູ່ຫ້ອງນີ້` });
      fields.push({ name: '🎮 ວິທີເຂົ້າຫ້ອງ', value: '1. ກົດ 📋 ກັອບລະຫັດ\n2. ເປີດ Valorant → **PARTY CODE**\n3. ວາງລະຫັດ → **JOIN**' });
      fields.push({ name: '❓ ມີຄຳຖາມ', value: `ຖາມທີ່ ${qaLink()} ເທົ່ານັ້ນ` });
      fields.push({ name: '👑 ສຳຄັນ', value: '**ຄຳຕັດສິນຂອງແອດມິນຖືເປັນທີ່ສຸດ** · ເນັດຫຼຸດ/ຄອມມີບັນຫາ ບໍ່ມີ Rematch ໃຫ້ຄົນດຽວ' });
      return e.addFields(fields).setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
    }
    // ส่ง DM หานักแข่งทุกคน (คนที่ปิด DM จะส่งไม่ถึง → แจ้งชื่อในห้องแอดมิน)
    async function dmPlayers(ids, payload, label) {
      const fail = [];
      for (const id of ids) {
        const u = await client.users.fetch(id).catch(() => null);
        const ok = u && await u.send(payload).then(() => true).catch(() => false);
        if (!ok) fail.push(db.players[id] ? db.players[id].name : id);
      }
      logTo(`📨 DM ${label}: ສົ່ງຖຶງ ${ids.length - fail.length}/${ids.length}${fail.length ? ` · ສົ່ງບໍ່ໄດ້ (ປິດ DM): ${fail.join(', ')}` : ''}`);
    }
    // DM รหัสห้องตัวใหญ่ (ใช้รหัสเดียวทั้งงาน) — ส่งก่อนแข่ง ~1 ชม.
    function codeDMMessage(o) {
      const code = String(o.code).trim().toUpperCase();
      const start = EV.startAt ? laoTime(EV.startAt) : '';
      const mins = EV.startAt ? Math.round((new Date(EV.startAt).getTime() - Date.now()) / 60000) : null;
      const left = o.left || (mins && mins > 0 ? (mins >= 55 ? `ອີກ ${Math.round(mins / 60)} ຊົ່ວໂມງ` : `ອີກ ${mins} ນາທີ`) : 'ໃກ້ເລີ່ມແລ້ວ');
      const content = [
        o.test ? '-# 🧪 ຕົວຢ່າງ (ທົດສອບ) — ຍັງບໍ່ແມ່ນລະຫັດຈິງ' : null,
        `## ⏰ ${left} ເລີ່ມແຂ່ງ!`,
        `-# ${EVENT}${start ? ` · ${start}` : ''}`,
        '## 🔑 ລະຫັດຫ້ອງ',
        `# ${code}`,
        `\`\`\`${code}\`\`\``,
      ].filter((x) => x !== null).join('\n');
      const voiceUrl = o.voiceUrl || EV.voiceInvite || null;
      const e = new EmbedBuilder().setColor(0xFF4655)
        .setDescription([
          `✅ **ໃຊ້ລະຫັດນີ້ອັນດຽວ ທັງ ${GAMES()} ເກມ** ຈົນຈົບງານ`,
          '',
          '**ວິທີເຂົ້າ:**',
          '1️⃣ ກົດ **📋 ກັອບລະຫັດ** (ຫຼື ກົດຄ້າງທີ່ກ່ອງລະຫັດ)',
          '2️⃣ ເປີດ Valorant → **PARTY CODE**',
          '3️⃣ ວາງລະຫັດ → **JOIN** ✅',
          '',
          voiceUrl ? `🎧 ເຂົ້າ Voice ໄດ້ (ບໍ່ບັງຄັບ) → ກົດ **ເຂົ້າ Voice** ລຸ່ມນີ້` : null,
          '🤫 ຢ່າແຊລະຫັດໃຫ້ຄົນອື່ນເດີ້',
          '👑 ຄຳຕັດສິນຂອງແອດມິນຖືເປັນທີ່ສຸດ',
        ].filter((x) => x !== null).join('\n'))
        .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
      const btns = [new ButtonBuilder().setCustomId(`tourney:copy:${code}`.slice(0, 100)).setStyle(ButtonStyle.Success).setLabel('📋 ກັອບລະຫັດ')];
      if (voiceUrl) btns.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(voiceUrl).setLabel('🎧 ເຂົ້າ Voice'));
      return { content, embeds: [e], components: [new ActionRowBuilder().addComponents(...btns)] };
    }
    // DM แจ้งนักแข่ง "วันนี้แข่ง" + ปุ่มยืนยันมา/ไม่มา
    function todayDMMessage(name, test) {
      const hm = (min) => { const d = new Date(new Date(EV.startAt).getTime() + 7 * 3600000 - min * 60000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
      const code = guild.channels.cache.find(isCodeChannel);
      const content = test ? '-# 🧪 ຕົວຢ່າງ (ທົດສອບ) — ສົ່ງຫາແອດມິນຄົນດຽວ' : undefined;
      const e = new EmbedBuilder().setColor(0xFFC400)
        .setTitle(`🏆 ${EVENT}`)
        .setDescription([
          `ສະບາຍດີ **${name}** 👋 ນ້ອງ JIBI ເອງ`,
          '',
          `## 📅 ມື້ນີ້ · ${hm(0)} ໂມງ (ເວລາລາວ)`,
          '⚡ ມາຄົບກ່ອນ ອາດເລີ່ມກ່ອນເວລາ',
          '',
          '**ສິ່ງທີ່ຕ້ອງເຮັດມື້ນີ້:**',
          `🔑 **${hm(60)}** — ລະຫັດຫ້ອງເກມ ຈະໂພສຢູ່ຫ້ອງ ${code ? `<#${code.id}>` : '**🔑・ລະຫັດຫ້ອງ-βeta**'} (ໃຊ້ລະຫັດດຽວ ທັງ ${GAMES()} ເກມ)`,
          `🎮 **${hm(30)}** — ເປີດ Valorant ລໍຖ້າ`,
          `🏁 **${hm(0)}** — ເລີ່ມເກມ 1`,
          '',
          '⚠️ ເນັດຫຼຸດ/ຄອມມີບັນຫາ = ບໍ່ມີ Rematch ໃຫ້ຄົນດຽວ',
          '👑 ຄຳຕັດສິນຂອງແອດມິນຖືເປັນທີ່ສຸດ',
        ].join('\n'))
        .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
      return { content, embeds: [e] };
    }
    function panelMessage() {
      const n = count();
      if (EV.ended) {
        const done = new EmbedBuilder()
          .setColor(0xFFC400)
          .setTitle(`🏁 ສິ້ນສຸດແລ້ວ — ${EVENT}`)
          .setDescription(EV.summary || '🏁 ງານແຂ່ງຈົບລົງແລ້ວ — ຂອບໃຈທຸກຄົນທີ່ມາຮ່ວມ 💛')
          .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
        return { embeds: [done], components: [] };
      }
      const embed = new EmbedBuilder()
        .setColor(0xFFC400)
        .setTitle(`📝 ລົງທະບຽນນັກແຂ່ງ — ${EVENT}`)
        .setDescription([
          'ກົດ **📝 ລົງທະບຽນ** ດ້ານລຸ່ມ ແລ້ວພິມຂໍ້ມູນໃສ່ກ່ອງ:',
          '• ຊື່  • Riot ID  • ເລືອກແຣງ  • ສັງກັດ (ບໍ່ໃສ່ກໍໄດ້)  • ເຄີຍເຕີມເກມກັບ P SHOP ບໍ່',
          '',
          'ກົດອີກຄັ້ງ = **ແກ້ໄຂຂໍ້ມູນ** · ກົດ **❌ ຍົກເລີກ** ຖ້າບໍ່ແຂ່ງແລ້ວ',
          '',
          `📌 **ສຳຄັນ — ອ່ານກ່ອນສະໝັກ:** ລົງທະບຽນແລ້ວ ຈະເຫັນຫ້ອງ ${codeLink()} (ເຫັນສະເພາະນັກແຂ່ງ)`,
          '• ແຈ້ງເຕືອນກ່ອນແຂ່ງ ແລະ **ລະຫັດຫ້ອງ Custom** ຈະສົ່ງຢູ່ຫ້ອງນັ້ນເທົ່ານັ້ນ',
          '• ໃກ້ເວລາແຂ່ງ ໃຫ້ເຂົ້າໄປເບິ່ງຫ້ອງນັ້ນ ແລ້ວກົດ 📋 ກັອບລະຫັດ → Valorant → PARTY CODE → JOIN',
          `ນັກແຂ່ງຕົວຈິງ ${MAX} ຄົນທຳອິດ — ຄົນທີ ${MAX + 1} ຂຶ້ນໄປ ເປັນ **ຕົວສຳຮອງ**`,
          `❓ ມີຄຳຖາມ: ຖາມທີ່ ${qaLink()} ເທົ່ານັ້ນ`,
          '',
          '👑 **ສຳຄັນ: ຄຳຕັດສິນຂອງແອດມິນຖືເປັນທີ່ສຸດ** — ລົງທະບຽນ = ຍອມຮັບ ແລະ ຕ້ອງຍອມຮັບໃຫ້ໄດ້',
          '🔌 ເນັດຫຼຸດ / ຄອມມີບັນຫາ: ບໍ່ມີ Rematch ໃຫ້ຄົນດຽວ · ຂໍ Surrender ບໍ່ໄດ້',
          '',
          `📊 ລົງທະບຽນແລ້ວ: **${Math.min(n, MAX)} / ${MAX}**${n > MAX ? ` · ສຳຮອງ ${n - MAX} ຄົນ` : ''}${n >= MAX ? ' · ຕົວຈິງເຕັມແລ້ວ ✅' : ''}`,
          EV.startAt ? `⏰ ເລີ່ມແຂ່ງ: **${laoTime(EV.startAt)}** · <t:${unix(EV.startAt)}:R>\n${EARLY}` : null,
          EV.regOpen ? null : (n >= MAX ? '🔒 **ນັກແຂ່ງເຕັມແລ້ວ — ປິດຮັບສະໝັກ** · ຄົນທີ່ລົງທະບຽນແລ້ວ ຍັງແກ້ໄຂ/ຍົກເລີກໄດ້' : '🔒 **ປິດຮັບສະໝັກແລ້ວ** — ຄົນທີ່ລົງທະບຽນແລ້ວ ຍັງແກ້ໄຂ/ຍົກເລີກໄດ້'),
        ].filter((x) => x !== null).join('\n'))
        .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tourney:open').setStyle(ButtonStyle.Secondary).setLabel('📝 ລົງທະບຽນ / ແກ້ໄຂ'),
        new ButtonBuilder().setCustomId('tourney:cancel').setStyle(ButtonStyle.Secondary).setLabel('❌ ຍົກເລີກ'),
      );
      return { embeds: [embed], components: [row] };
    }
    async function bumpPanel(ch) {
      try {
        const oldId = db.panels[ch.id];
        if (oldId) { const old = await ch.messages.fetch(oldId).catch(() => null); if (old) await old.delete().catch(() => {}); }
        const msg = await ch.send(panelMessage());
        db.panels[ch.id] = msg.id; save();
      } catch (e) { console.error('[tournament] panel', e.message); }
    }
    (async () => {
      for (const ch of guild.channels.cache.filter(isRegChannel).values()) {
        const last = await ch.messages.fetch({ limit: 1 }).catch(() => null);
        const lastMsg = last && last.first();
        if (!lastMsg || lastMsg.id !== db.panels[ch.id]) await bumpPanel(ch);
        else await lastMsg.edit(panelMessage()).catch(() => {}); // อัปเดตสี/ข้อความแผงเดิม
      }
    })();

    // การ์ดนักแข่ง — สไตล์ STATUS: อีโมจิ + หัวข้อตัวหนา + ค่าในกรอบ · โลโก้ร้านมุมขวา · เส้นสายรุ้งด้านล่าง
    const RAINBOW = path.join(__dirname, '..', 'assets', 'shine.gif'); // เส้นเหลือง-ขาว ขยับได้
    const RANK_EMOJI = { Iron: '⚫', Bronze: '🟤', Silver: '⚪', Gold: '🟡', Platinum: '🔷', Diamond: '💎', Ascendant: '🟢', Immortal: '🔴', Radiant: '🌟' };
    const box = (x) => `\`${String(x).replace(/`/g, "'")}\``;
    function cardMessage(member, p) {
      const sub = p.no > MAX;
      const logo = guild.iconURL({ size: 256 }) || member.displayAvatarURL();
      const rankKey = Object.keys(RANK_EMOJI).find((k) => String(p.rank).startsWith(k));
      const avatar = member.displayAvatarURL({ size: 512, extension: 'png', forceStatic: false });
      const embed = new EmbedBuilder()
        .setColor(sub ? 0x80848E : 0xFFC400)
        .setTitle(`🎯 ນັກແຂ່ງ #${p.no}${sub ? ' · ຕົວສຳຮອງ' : ''}`)
        .setThumbnail(avatar)
        .setDescription([
          `### 👤 ຊື່: ${box(p.name)}`,
          `### 🎮 Riot ID: ${box(p.riot)}`,
          `### ${rankKey ? RANK_EMOJI[rankKey] : '🏅'} ແຣງ: ${box(p.rank)}`,
          `### 🛡️ ສັງກັດ: ${box(p.team || '—')}`,
          `### 💬 Discord: <@${member.id}>`,
          `### ${sub ? '⏳' : '✅'} ສະຖານະ: ${box(sub ? 'ຕົວສຳຮອງ' : `ຕົວຈິງ ${p.no} | ${MAX}`)}`,
        ].join('\n'))
        .setFooter({ text: `Player No. / ເລກນັກແຂ່ງ #${TAG()}-${String(p.no).padStart(3, '0')}`, iconURL: logo })
        .setTimestamp(p.at);
      const files = [];
      if (fs.existsSync(RAINBOW)) { embed.setImage('attachment://shine.gif'); files.push({ attachment: RAINBOW, name: 'shine.gif' }); }
      return { embeds: [embed], files, attachments: [], allowedMentions: { parse: [] } };
    }
    // ทำการ์ดเก่าให้เป็นแบบใหม่ตอนเปิดบอท
    (async () => {
      for (const [uid, p] of Object.entries(db.players)) {
        try {
          const ch = await guild.channels.fetch(p.channelId);
          const msg = await ch.messages.fetch(p.messageId);
          const member = await guild.members.fetch(uid);
          if (p.style !== 4) { await msg.edit(cardMessage(member, p)); p.style = 4; save(); }
        } catch (e) { console.error('[tournament] refresh', e.message); }
      }
    })();

    // ---------- /roomcode: ส่งรหัสห้องทันที พร้อมเวลา (เวลาลาว) — สไตล์เดียวกับการ์ดนักแข่ง ----------

    function codeMessage(user, o, now, expired) {
      const logo = guild.iconURL({ size: 256 });
      const laoTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Vientiane', hour: '2-digit', minute: '2-digit' });
      const laoDate = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Vientiane' });
      const n = Object.values(db.players).filter((p) => p.no <= MAX).length;
      const embed = new EmbedBuilder()
        .setColor(expired ? 0x80848E : 0xFFC400)
        .setTitle(`🔑 ລະຫັດຫ້ອງ${o.game ? ` — ເກມ ${o.game}` : ''}${expired ? ' · ໝົດອາຍຸແລ້ວ' : ''}`)
        .setDescription([
          o.game ? `🎮 **ເກມທີ:** ${box(`${o.game} | ${GAMES()}`)}` : null,
          `🔑 **ລະຫັດ:** ${box(o.code)}`,
          `🕗 **ເວລາ:** ${box(`${laoTime} ໂມງ`)} (ເວລາລາວ · ${laoDate})`,
          o.map ? `🗺️ **ແຜນທີ່:** ${box(o.map)}` : null,
          `👥 **ນັກແຂ່ງ:** ${box(`${n} | ${MAX} ຄົນ`)}`,
          o.note ? `📝 **ໝາຍເຫດ:** ${o.note}` : null,
          '',
          expired ? '⛔ **ລະຫັດນີ້ໝົດອາຍຸແລ້ວ** — ໃຊ້ລະຫັດອັນລ່າສຸດດ້ານລຸ່ມ'
            : '📋 ກົດ **ກັອບລະຫັດ** → ເຂົ້າ Valorant → **PARTY CODE** → ວາງລະຫັດ → **JOIN**',
        ].filter((x) => x !== null).join('\n'))
        .setFooter({ text: `Room Code / ລະຫັດຫ້ອງ #${TAG()}-G${o.game || 0}`, ...(logo ? { iconURL: logo } : {}) })
        .setTimestamp(now);
      if (logo) embed.setThumbnail(logo);
      const files = [];
      if (fs.existsSync(RAINBOW)) { embed.setImage('attachment://shine.gif'); files.push({ attachment: RAINBOW, name: 'shine.gif' }); }
      const components = expired ? [] : [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tourney:copy:${o.code}`.slice(0, 100)).setStyle(ButtonStyle.Success).setLabel('📋 ກັອບລະຫັດ'))];
      return { embeds: [embed], files, components };
    }
    async function sendRoomCode(user, o) {
      const ch = o.channel ? guild.channels.cache.find((c) => c.name === o.channel || c.name.includes(o.channel)) : guild.channels.cache.find(isCodeChannel);
      if (!ch) throw new Error(`ບໍ່ພົບຫ້ອງ ${o.channel || '🔑 ລະຫັດຫ້ອງ'}`);
      const now = new Date();
      const lastKey = o.preview ? 'lastPreview' : 'lastCode';
      // รหัสเก่า → สีเทา "ໝົດອາຍຸ" + เอาปุ่มออก
      if (db[lastKey]) {
        const old = await ch.messages.fetch(db[lastKey].id).catch(() => null);
        if (old) await old.edit({ ...codeMessage(user, db[lastKey].o, new Date(db[lastKey].at), true), attachments: [] }).catch(() => {});
      }
      const ids = o.preview ? [] : Object.entries(db.players).filter(([, p]) => p.no <= MAX).map(([id]) => id);
      const head = o.preview ? '🧪 **ຕົວຢ່າງ** (ບໍ່ໄດ້ແທັກໃຜ)' : ids.map((x) => `<@${x}>`).join(' ');
      const msg = await ch.send({ content: head || undefined, ...codeMessage(user, o, now, false), allowedMentions: { users: ids } });
      db[lastKey] = { id: msg.id, o: { code: o.code, game: o.game, map: o.map, note: o.note }, at: now.getTime() }; save();
      if (!o.preview) {
        logTo(`🔑 **${user.username}** ສົ່ງລະຫັດຫ້ອງ${o.game ? ` ເກມ ${o.game}` : ''}: ${o.code}`);
        const dmE = new EmbedBuilder().setColor(0xFF4655)
          .setTitle(`🔑 ລະຫັດຫ້ອງ${o.game ? ` ເກມ ${o.game}` : ''} ອອກແລ້ວ!`)
          .setDescription(`**${EVENT}**\n\n👉 **[ກົດທີ່ນີ້ ເພື່ອເບິ່ງລະຫັດ](${msg.url})**\nລະຫັດມີຢູ່ ${ch} ເທົ່ານັ້ນ — ເຂົ້າຫ້ອງໄວໆເດີ້!`)
          .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
        dmPlayers(ids, { embeds: [dmE] }, `ລະຫັດຫ້ອງ${o.game ? ` ເກມ ${o.game}` : ''}`);
      }
      return msg;
    }
    client.jibiRoomCode = sendRoomCode;

    // ---------- ยศ 🎯 ນັກແຂ່ງ: เห็นห้อง 🔑 ລະຫັດຫ້ອງ ----------
    const playerRole = () => guild.roles.cache.find((r) => r.name === (cfg.roles.player && cfg.roles.player.name));
    async function setPlayerRole(uid, on) {
      const role = playerRole();
      if (!role) return;
      const m = await guild.members.fetch(uid).catch(() => null);
      if (!m) return;
      if (on && !m.roles.cache.has(role.id)) await m.roles.add(role).catch((e) => console.error('[tournament] role', e.message));
      if (!on && m.roles.cache.has(role.id)) await m.roles.remove(role).catch((e) => console.error('[tournament] role', e.message));
    }
    // ให้ยศคนที่ลงทะเบียนไว้แล้ว (หลังเปิดบอท รอซิงก์สร้างยศก่อน)
    // ให้ยศคนที่ลงทะเบียน + ถอดยศคนที่ไม่ได้อยู่ในรายชื่องานนี้ (เช่น นักแข่งงานเก่า) → ห้อง 🔑 เห็นเฉพาะนักแข่งงานนี้
    const ensureRoles = async () => {
      await guild.roles.fetch().catch(() => {});
      for (const uid of Object.keys(db.players)) await setPlayerRole(uid, true);
      const role = playerRole();
      if (role) await guild.members.fetch().catch(() => {});
      if (role) for (const m of role.members.values()) if (!db.players[m.id]) await m.roles.remove(role).catch(() => {});
    };
    setTimeout(ensureRoles, 20000);
    setInterval(ensureRoles, 5 * 60000);

    // ---------- แจ้งเตือนก่อนเริ่ม (นับถอยหลังเรียลไทม์ด้วย <t:..:R>) ----------
    function reminderMessage(minsLeft) {
      const t = unix(EV.startAt);
      const n = Object.values(db.players).filter((p) => p.no <= MAX).length;
      const embed = new EmbedBuilder()
        .setColor(0xFFC400)
        .setTitle(minsLeft > 0 ? `⏰ ອີກ ${minsLeft} ນາທີ ເລີ່ມແຂ່ງ!` : '🔥 ເຖິງເວລາແຂ່ງແລ້ວ!')
        .setDescription([
          `## ເລີ່ມ <t:${t}:R>`,
          `🏆 **${EVENT}**`,
          `🕗 **ເວລາເລີ່ມ:** ${laoTime(EV.startAt)}`,
          EARLY,
          `👥 **ນັກແຂ່ງ:** ${box(`${n} | ${MAX} ຄົນ`)}`,
          '',
          '✅ ເປີດ Valorant ລໍຖ້າໄວ້ເລີຍ — ລະຫັດຫ້ອງຈະສົ່ງໃນຫ້ອງນີ້ 💛',
        ].join('\n'))
        .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
      const files = [];
      if (fs.existsSync(RAINBOW)) { embed.setImage('attachment://shine.gif'); files.push({ attachment: RAINBOW, name: 'shine.gif' }); }
      return { embeds: [embed], files };
    }
    async function sendReminder(force) {
      if (EV.ended) return null;
      if (!EV.startAt) throw new Error('ຍັງບໍ່ໄດ້ຕັ້ງເວລາເລີ່ມແຂ່ງ');
      const ch = guild.channels.cache.find(isCodeChannel);
      if (!ch) throw new Error('ບໍ່ພົບຫ້ອງ 🔑 ລະຫັດຫ້ອງ');
      const minsLeft = Math.max(0, Math.round((new Date(EV.startAt).getTime() - Date.now()) / 60000));
      const ids = Object.keys(db.players);
      const msg = await ch.send({ content: ids.map((x) => `<@${x}>`).join(' ') || undefined, ...reminderMessage(minsLeft), allowedMentions: { users: ids } });
      logTo(`⏰ ແຈ້ງເຕືອນນັກແຂ່ງ${force ? ' (ສັ່ງເອງ)' : ''}: ອີກ ${minsLeft} ນາທີ`);
      const dmE = new EmbedBuilder().setColor(0xFFC400)
        .setTitle(minsLeft > 0 ? `⏰ ອີກ ${minsLeft} ນາທີ ເລີ່ມແຂ່ງ!` : '🔥 ເຖິງເວລາແຂ່ງແລ້ວ!')
        .setDescription(`**${EVENT}**`)
        .addFields(
          { name: '🕗 ເລີ່ມ', value: `${laoTime(EV.startAt)}\n(<t:${unix(EV.startAt)}:R>)`, inline: true },
          { name: '⚡ ອາດເລີ່ມກ່ອນ', value: 'ຖ້ານັກແຂ່ງມາຄົບກ່ອນ ອາດເລີ່ມກ່ອນເວລາ', inline: true },
          { name: '🔊 ເຂົ້າຫ້ອງສຽງ', value: 'ກ່ອນເລີ່ມ 10 ນາທີ', inline: true },
          { name: '🔑 ລະຫັດຫ້ອງ', value: `ເບິ່ງທີ່ ${ch} ເທົ່ານັ້ນ` },
        ).setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
      dmPlayers(ids, { embeds: [dmE] }, `ເຕືອນອີກ ${minsLeft} ນາທີ`);
      return msg;
    }
    setInterval(async () => {
      try {
        if (!EV.startAt || !Array.isArray(EV.reminders)) return;
        const start = new Date(EV.startAt).getTime(), now = Date.now();
        if (now >= start) return;
        EV.sent = EV.sent || {};
        const due = EV.reminders.filter((m) => now >= start - m * 60000 && !EV.sent[`${EV.startAt}|${m}`]);
        if (!due.length) return;
        for (const m of due) EV.sent[`${EV.startAt}|${m}`] = Date.now();
        store.save('tourney-event', EV);
        await sendReminder(false);
      } catch (e) { console.error('[tournament] reminder', e.message); }
    }, 20000);

    async function refreshPanels() {
      for (const ch of guild.channels.cache.filter(isRegChannel).values()) {
        const id = db.panels[ch.id];
        const msg = id ? await ch.messages.fetch(id).catch(() => null) : null;
        if (msg) await msg.edit(panelMessage()).catch(() => {}); else await bumpPanel(ch);
      }
    }

    // ---------- API ให้ JIBI Center Hub ----------
    const api = {
      getEvent: () => { const { sent, ...e } = EV; return e; },
      async setEvent(patch) {
        const next = { ...EV };
        if (patch.name !== undefined) next.name = String(patch.name).trim().slice(0, 80) || EV_DEFAULT.name;
        if (patch.max !== undefined) next.max = Math.max(1, Math.min(100, parseInt(patch.max, 10) || 10));
        if (patch.startAt !== undefined) {
          const d = patch.startAt ? new Date(patch.startAt) : null;
          if (d && Number.isNaN(d.getTime())) throw new Error('ເວລາບໍ່ຖືກ');
          next.startAt = d ? d.toISOString() : null;
        }
        if (patch.reminders !== undefined) next.reminders = [...new Set((patch.reminders || []).map((x) => parseInt(x, 10)).filter((x) => x > 0 && x <= 1440))].sort((a, b) => b - a);
        if (patch.regOpen !== undefined) next.regOpen = !!patch.regOpen;
        if (patch.voiceInvite !== undefined) next.voiceInvite = /^https:\/\/discord\.(gg|com)\//.test(String(patch.voiceInvite)) ? String(patch.voiceInvite) : null;
        if (patch.ended !== undefined) { next.ended = patch.ended ? (EV.ended || new Date().toISOString()) : null; if (patch.ended) next.regOpen = false; }
        if (patch.summary !== undefined) next.summary = String(patch.summary || '').slice(0, 3800) || null;
        next.sent = EV.sent || {};
        const regChanged = !!EV.regOpen !== !!next.regOpen;
        EV = next; EVENT = EV.name; MAX = EV.max;
        store.save('tourney-event', EV);
        await refreshPanels();
        // เปิด/ปิดรับสมัคร → ซิงก์คำถามตอนเข้าเซิร์ฟ (ซ่อน/โชว์คำถาม βeta)
        if (regChanged && client.jibiSyncNow) client.jibiSyncNow(EV.regOpen ? 'ເປີດຮັບສະໝັກ' : 'ປິດຮັບສະໝັກ').catch((e) => console.error('[tournament] sync', e.message));
        logTo(`🏆 ອັບເດດງານແຂ່ງ: ${EVENT}${EV.startAt ? ` · ເລີ່ມ ${laoTime(EV.startAt)}` : ''} · ${EV.regOpen ? 'ເປີດຮັບສະໝັກ' : 'ປິດຮັບສະໝັກ'}`);
        return api.getEvent();
      },
      players: () => Object.entries(db.players).map(([uid, p]) => ({ uid, ...p })).sort((a, b) => a.no - b.no),
      async removePlayer(uid, by) {
        const p = db.players[uid];
        if (!p) throw new Error('ບໍ່ພົບນັກແຂ່ງ');
        const ch = await guild.channels.fetch(p.channelId).catch(() => null);
        if (ch) { const m = await ch.messages.fetch(p.messageId).catch(() => null); if (m) await m.delete().catch(() => {}); }
        delete db.players[uid]; save();
        await setPlayerRole(uid, false);
        if (ch) await bumpPanel(ch);
        logTo(`🗑️ **${by || 'Hub'}** ລຶບນັກແຂ່ງ #${p.no} ${p.name}`);
        return true;
      },
      sendCode: (o, by) => sendRoomCode({ username: by || 'Hub' }, o),
      async todayDM(o = {}) {
        const ids = o.userIds && o.userIds.length ? o.userIds : Object.entries(db.players).filter(([, p]) => p.no <= MAX).map(([id]) => id);
        const res = { ok: [], fail: [] };
        for (const id of ids) {
          const u = await client.users.fetch(id).catch(() => null);
          const mem = await guild.members.fetch(id).catch(() => null);
          const name = (db.players[id] && db.players[id].name) || (mem && mem.displayName) || (u && u.username) || '';
          const ok = u && await u.send(todayDMMessage(name, !!o.test)).then(() => true).catch(() => false);
          (ok ? res.ok : res.fail).push(name || id);
        }
        logTo(`📨 DM "ມື້ນີ້ແຂ່ງ"${o.test ? ' (🧪 ທົດສອບ)' : ''}: ສົ່ງຖຶງ ${res.ok.length}/${ids.length}${res.fail.length ? ` · ສົ່ງບໍ່ໄດ້ (ປິດ DM): ${res.fail.join(', ')}` : ''}`);
        return res;
      },
      rsvp: () => Object.values(db.players).map((p) => ({ no: p.no, name: p.name, rsvp: p.rsvp || null })),
      // DM รหัสตัวใหญ่ · userIds = ทดสอบส่งเฉพาะคน · ไม่ใส่ = นักแข่งตัวจริงทุกคน
      async codeDM(o) {
        if (!o || !o.code) throw new Error('ໃສ່ລະຫັດກ່ອນ');
        const ids = o.userIds && o.userIds.length ? o.userIds : Object.entries(db.players).filter(([, p]) => p.no <= MAX).map(([id]) => id);
        const payload = codeDMMessage(o);
        const res = { ok: [], fail: [] };
        for (const id of ids) {
          const u = await client.users.fetch(id).catch(() => null);
          const ok = u && await u.send(payload).then(() => true).catch(() => false);
          (ok ? res.ok : res.fail).push(u ? u.username : id);
        }
        logTo(`📨 DM ລະຫັດຫ້ອງ${o.test ? ' (🧪 ທົດສອບ)' : ''} ${String(o.code).toUpperCase()}: ສົ່ງຖຶງ ${res.ok.length}/${ids.length}${res.fail.length ? ` · ສົ່ງບໍ່ໄດ້: ${res.fail.join(', ')}` : ''}`);
        return res;
      },
      remindNow: () => sendReminder(true),
      refreshPanels,
    };
    api.isPlayer = (uid) => (db.players[uid] ? db.players[uid].no : 0);
    api.regOpen = () => !!EV.regOpen && !EV.ended;
    api.doneMessage = doneMessage;
    client.jibiTourney = api;

    client.on(Events.InteractionCreate, async (i) => {
      try {
        if (i.isButton() && i.customId.startsWith('tourney:rsvp:')) {
          const ans = i.customId.endsWith(':yes') ? 'yes' : 'no';
          const p = db.players[i.user.id];
          if (!p) return i.reply({ content: ans === 'yes' ? '✅ ຮັບຊາບ! (ທົດສອບ — ເຈົ້າບໍ່ໄດ້ຢູ່ໃນລາຍຊື່ນັກແຂ່ງ)' : '❌ ຮັບຊາບ (ທົດສອບ)', flags: MessageFlags.Ephemeral });
          p.rsvp = ans; p.rsvpAt = Date.now(); save();
          const yes = Object.values(db.players).filter((x) => x.rsvp === 'yes').length;
          logTo(`${ans === 'yes' ? '✅' : '❌'} #${p.no} **${p.name}** ${ans === 'yes' ? 'ຢືນຢັນມາແຂ່ງ' : '**ມາບໍ່ໄດ້** — ຕ້ອງຫາຄົນແທນ!'} (ຢືນຢັນມາແລ້ວ ${yes}/${MAX})`);
          return i.reply({ content: ans === 'yes' ? '✅ ຮັບຊາບ! ພົບກັນຄືນນີ້ 20:00 ເດີ້ 🔥 ລະຫັດຫ້ອງຈະສົ່ງມາທາງ DM ນີ້' : '😢 ຮັບຊາບ — ແຈ້ງແອດມິນແລ້ວ ຂອບໃຈທີ່ບອກເດີ້ 🙏 (ກົດ ✅ ໄດ້ ຖ້າປ່ຽນໃຈ)', flags: MessageFlags.Ephemeral });
        }
        if (i.isButton() && i.customId.startsWith('tourney:copy:')) {
          // ตอบเป็นข้อความที่มีแค่รหัสอย่างเดียว — กดค้าง/คลิกขวา → Copy Text ได้ทันที
          return i.reply({ content: i.customId.slice('tourney:copy:'.length), flags: MessageFlags.Ephemeral });
        }
        if (i.isChatInputCommand() && i.commandName === 'roomcode') {
          await i.deferReply({ flags: MessageFlags.Ephemeral });
          const msg = await sendRoomCode(i.user, { code: i.options.getString('code').trim(), game: i.options.getInteger('game'), map: i.options.getString('map'), note: i.options.getString('note') });
          return i.editReply(`✅ ສົ່ງລະຫັດແລ້ວ — ${msg.url}`);
        }
        if (EV.ended && i.isButton() && (i.customId === 'tourney:open' || i.customId === 'tourney:cancel')) return i.reply({ content: '🏁 ງານແຂ່ງນີ້ສິ້ນສຸດແລ້ວ — ຕິດຕາມງານແຂ່ງຄັ້ງໜ້າເດີ້ 💛', flags: MessageFlags.Ephemeral });
        if (i.isButton() && i.customId === 'tourney:open') {
          if (!EV.regOpen && !db.players[i.user.id]) return i.reply({ content: FULL_MSG, flags: MessageFlags.Ephemeral });
          // คนใหม่ → โชว์กติกา + ข้อมูลทั้งหมดก่อน ต้องกด ✅ ຍອມຮັບ ถึงจะได้กรอก
          if (!db.players[i.user.id]) {
            const rules = rulesEmbed();
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('tourney:accept').setStyle(ButtonStyle.Success).setLabel('✅ ຍອມຮັບກົດ ແລະ ລົງທະບຽນ'));
            return i.reply({ embeds: [rules], components: [row], flags: MessageFlags.Ephemeral });
          }
        }
        if (i.isButton() && (i.customId === 'tourney:open' || i.customId === 'tourney:accept')) {
          if (!EV.regOpen && !db.players[i.user.id]) return i.reply({ content: FULL_MSG, flags: MessageFlags.Ephemeral });
          const cur = db.players[i.user.id] || {};
          const modal = new ModalBuilder().setCustomId('tourney:modal').setTitle(`ລົງທະບຽນ ${EVENT}`.slice(0, 45));
          modal.addLabelComponents(...FIELDS.map((f) => buildField(f, cur)));
          return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === 'tourney:modal') {
          await i.deferReply({ flags: MessageFlags.Ephemeral });
          const v = Object.fromEntries(FIELDS.map((f) => [f.id, readField(i, f)]));
          if (!v.riot.includes('#')) return i.editReply('❌ Riot ID ຕ້ອງມີ **#** ເຊັ່ນ `PShop#LAO` — ກົດ 📝 ແລ້ວໃສ່ໃໝ່');
          const conf = FIELDS.find((f) => f.id === 'confirm');
          const missing = conf.options.filter((o) => o.required && !v.confirm.includes(o.value));
          if (missing.length) return i.editReply(`❌ ຕ້ອງຕິກຢືນຢັນໃຫ້ຄົບ:\n${missing.map((o) => `• ${o.label}`).join('\n')}\n\nກົດ 📝 ແລ້ວລອງໃໝ່`);
          v.pshop = v.confirm.includes('pshop');
          const old = db.players[i.user.id];
          // สมัครจากห้องอื่น (เช่น การ์ดต้อนรับ) → การ์ดนักแข่งไปลงห้องลงทะเบียนเสมอ
          const ch = isRegChannel(i.channel) ? i.channel
            : (old && await guild.channels.fetch(old.channelId).catch(() => null)) || guild.channels.cache.find(isRegChannel);
          if (!ch) return i.editReply('❌ ບໍ່ພົບຫ້ອງລົງທະບຽນ — ແຈ້ງແອດມິນ');
          // ครบ 10 คน = เต็ม (กันสมัครพร้อมกันเกิน: จองที่ไว้ก่อนแบบทันที)
          if (!old && (!EV.regOpen || Object.keys(db.players).length + pending.size >= MAX)) return i.editReply(FULL_MSG);
          if (!old) pending.add(i.user.id);
          try {
          const no = old ? old.no : Math.max(0, ...Object.values(db.players).map((x) => x.no)) + 1;
          const p = { ...v, no, at: old ? old.at : Date.now(), channelId: ch.id, messageId: old && old.messageId, style: 4, acceptedRules: true };
          let msg = null;
          if (old && old.messageId) msg = await ch.messages.fetch(old.messageId).catch(() => null);
          if (msg) await msg.edit(cardMessage(i.member, p));
          else { const { attachments, ...m } = cardMessage(i.member, p); msg = await ch.send(m); p.messageId = msg.id; }
          db.players[i.user.id] = p; save();
          } finally { pending.delete(i.user.id); }
          const v2 = db.players[i.user.id]; const no = v2.no; const msg = { url: `https://discord.com/channels/${guild.id}/${v2.channelId}/${v2.messageId}` };
          if (!old && EV.regOpen && Object.keys(db.players).length >= MAX) {
            await api.setEvent({ regOpen: false });
            logTo(`🔒 ນັກແຂ່ງຄົບ ${MAX} ຄົນແລ້ວ → ປິດຮັບສະໝັກອັດຕະໂນມັດ (ແຜງ + ການ໌ດຕ້ອນຮັບ + ຄຳຖາມຕອນເຂົ້າເຊີບ)`);
          }
          await setPlayerRole(i.user.id, true);
          await bumpPanel(ch);
          logTo(`📝 **${i.user.username}** ${old ? 'ແກ້ໄຂ' : 'ລົງທະບຽນ'}ນັກແຂ່ງ #${no}: ${v.name} · ${v.riot} · ${v.rank}${v.team ? ` · ${v.team}` : ''} · ${v.pshop ? '✅ ເຄີຍເຕີມກັບ P SHOP' : '— ບໍ່ເຄີຍເຕີມກັບ P SHOP'}`);
          if (!old) {
            i.user.send({ embeds: [infoEmbed(no, false)] }).catch(() => {});
          }
          if (!old) return i.editReply(doneMessage(no));
          return i.editReply({ content: `🎯 ກາດນັກແຂ່ງຂອງເຈົ້າ: ${msg.url}`, embeds: [infoEmbed(no, true)] });
        }

        if (i.isButton() && i.customId === 'tourney:cancel') {
          const p = db.players[i.user.id];
          if (!p) return i.reply({ content: 'ເຈົ້າຍັງບໍ່ໄດ້ລົງທະບຽນ', flags: MessageFlags.Ephemeral });
          await i.deferReply({ flags: MessageFlags.Ephemeral });
          const m = await i.channel.messages.fetch(p.messageId).catch(() => null);
          if (m) await m.delete().catch(() => {});
          delete db.players[i.user.id]; save();
          await setPlayerRole(i.user.id, false);
          await bumpPanel(i.channel);
          logTo(`❌ **${i.user.username}** ຍົກເລີກການລົງທະບຽນ (#${p.no} ${p.name})`);
          return i.editReply('ຍົກເລີກການລົງທະບຽນແລ້ວ');
        }
      } catch (e) {
        console.error(`[tournament] ${e.message} · ${i.customId || i.commandName} · ช้า ${Date.now() - i.createdTimestamp}ms · ping ${client.ws.ping}ms`);
        if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: '❌ ມີບັນຫາ ລອງໃໝ່', flags: MessageFlags.Ephemeral }).catch(() => {});
        else if (i.deferred) i.editReply('❌ ມີບັນຫາ ລອງໃໝ່').catch(() => {});
      }
    });
  },
};
