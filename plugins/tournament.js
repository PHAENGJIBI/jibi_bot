// ปลั๊กอิน: ลงทะเบียนนักแข่ง — แผงปุ่มค้างล่างสุดของห้อง 📝 ລົງທະບຽນ-ນັກແຂ່ງ
// กด 📝 → กล่อง: ชื่อ / Riot ID (พิมพ์) · แรงก์ (เลือก) · สังกัด (ไม่ใส่ก็ได้) · ติ๊กเคยเติมกับ P SHOP → JIBI โพสต์การ์ดนักแข่ง
// กดซ้ำ = แก้ข้อมูลเดิม · ❌ = ยกเลิก · เกิน MAX คน = ตัวสำรอง · ข้อมูลเก็บใน data/tourney-regs.json
const {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, MessageFlags,
  LabelBuilder, StringSelectMenuBuilder, CheckboxBuilder, SlashCommandBuilder, PermissionFlagsBits,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const store = require('../lib/store');

const EVENT = 'VALORANT DEATHMATCH MINI CUP #1';
const MAX = 10; // จำนวนนักแข่งตัวจริง

// ช่องในกล่องลงทะเบียน — แก้/เพิ่มได้ตรงนี้ (Discord ให้สูงสุด 5 ช่องต่อกล่อง)
// type: text = พิมพ์เอง · select = เลือกจากรายการ · checkbox = ติ๊ก
const RANKS = ['Unrated / ບໍ່ມີແຣງ', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
const FIELDS = [
  { id: 'name', type: 'text', label: 'ຊື່ (ຊື່ທີ່ໃຊ້ໃນງານແຂ່ງ)', placeholder: 'ເຊັ່ນ: ແພງ', max: 32, required: true },
  { id: 'riot', type: 'text', label: 'Riot ID (ຊື່#TAG)', placeholder: 'ເຊັ່ນ: PShop#LAO', max: 40, required: true },
  { id: 'rank', type: 'select', label: 'ແຣງ (Rank)', placeholder: 'ເລືອກແຣງຂອງເຈົ້າ', options: RANKS, required: true },
  { id: 'team', type: 'text', label: 'ສັງກັດ / ທີມ (ບໍ່ໃສ່ກໍໄດ້)', placeholder: 'ເຊັ່ນ: ຊື່ທີມ ຫຼື ຊື່ຮ້ານ', max: 40, required: false },
  { id: 'pshop', type: 'checkbox', label: 'ເຄີຍເຕີມເກມກັບຮ້ານ P SHOP ບໍ່?', description: 'ຕິກ ✅ ຖ້າເຄີຍເຕີມ' },
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
  return String(d.value || '').trim();
}

const isCodeChannel = (c) => c && c.type === ChannelType.GuildText && c.name.includes('ລະຫັດຫ້ອງ');
const isRegChannel = (c) => c && c.type === ChannelType.GuildText && c.name.includes('ລົງທະບຽນ');

module.exports = {
  id: 'tournament',
  name: 'ลงทะเบียนนักแข่ง (แผงปุ่ม + กล่องกรอกข้อมูล)',
  description: `ห้อง 📝 ລົງທະບຽນ-ນັກແຂ່ງ · กดปุ่ม → กรอก ชื่อ / Riot ID / แรงก์ / สังกัด → JIBI โพสต์การ์ดนักแข่ง (ตัวจริง ${MAX} คน เกินนั้นเป็นตัวสำรอง)`,
  commands: [
    new SlashCommandBuilder().setName('roomcode').setDescription('ສົ່ງລະຫັດຫ້ອງ Custom ໃຫ້ນັກແຂ່ງ (ແອດມິນ)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption((o) => o.setName('code').setDescription('ລະຫັດຫ້ອງ / Party Code').setRequired(true).setMaxLength(40))
      .addIntegerOption((o) => o.setName('game').setDescription('ເກມທີ (1-3)').setMinValue(1).setMaxValue(3))
      .addStringOption((o) => o.setName('map').setDescription('ແຜນທີ່ ເຊັ່ນ Ascent').setMaxLength(40))
      .addStringOption((o) => o.setName('note').setDescription('ໝາຍເຫດເພີ່ມ').setMaxLength(200)),
  ],
  setup({ client, guild, logTo }) {
    const db = store.load('tourney-regs', { panels: {}, players: {} });
    db.panels = db.panels || {}; db.players = db.players || {};
    const save = () => store.save('tourney-regs', db);
    const count = () => Object.keys(db.players).length;

    function panelMessage() {
      const n = count();
      const embed = new EmbedBuilder()
        .setColor(0xFFC400)
        .setTitle(`📝 ລົງທະບຽນນັກແຂ່ງ — ${EVENT}`)
        .setDescription([
          'ກົດ **📝 ລົງທະບຽນ** ດ້ານລຸ່ມ ແລ້ວພິມຂໍ້ມູນໃສ່ກ່ອງ:',
          '• ຊື່  • Riot ID  • ເລືອກແຣງ  • ສັງກັດ (ບໍ່ໃສ່ກໍໄດ້)  • ເຄີຍເຕີມເກມກັບ P SHOP ບໍ່',
          '',
          'ກົດອີກຄັ້ງ = **ແກ້ໄຂຂໍ້ມູນ** · ກົດ **❌ ຍົກເລີກ** ຖ້າບໍ່ແຂ່ງແລ້ວ',
          `ນັກແຂ່ງຕົວຈິງ ${MAX} ຄົນທຳອິດ — ຄົນທີ ${MAX + 1} ຂຶ້ນໄປ ເປັນ **ຕົວສຳຮອງ**`,
          '',
          `📊 ລົງທະບຽນແລ້ວ: **${Math.min(n, MAX)} / ${MAX}**${n > MAX ? ` · ສຳຮອງ ${n - MAX} ຄົນ` : ''}${n >= MAX ? ' · ຕົວຈິງເຕັມແລ້ວ ✅' : ''}`,
        ].join('\n'))
        .setFooter({ text: 'JIBI · P SHOP Gaming Hub' });
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
        .setFooter({ text: `Player No. / ເລກນັກແຂ່ງ #DM1-${String(p.no).padStart(3, '0')}`, iconURL: logo })
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
    const GAMES_TOTAL = 3;
    function codeMessage(user, o, now, expired) {
      const logo = guild.iconURL({ size: 256 });
      const laoTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Vientiane', hour: '2-digit', minute: '2-digit' });
      const laoDate = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Vientiane' });
      const n = Object.values(db.players).filter((p) => p.no <= MAX).length;
      const embed = new EmbedBuilder()
        .setColor(expired ? 0x80848E : 0xFFC400)
        .setTitle(`🔑 ລະຫັດຫ້ອງ${o.game ? ` — ເກມ ${o.game}` : ''}${expired ? ' · ໝົດອາຍຸແລ້ວ' : ''}`)
        .setDescription([
          o.game ? `🎮 **ເກມທີ:** ${box(`${o.game} | ${GAMES_TOTAL}`)}` : null,
          `🔑 **ລະຫັດ:** ${box(o.code)}`,
          `🕗 **ເວລາ:** ${box(`${laoTime} ໂມງ`)} (ເວລາລາວ · ${laoDate})`,
          o.map ? `🗺️ **ແຜນທີ່:** ${box(o.map)}` : null,
          `👥 **ນັກແຂ່ງ:** ${box(`${n} | ${MAX} ຄົນ`)}`,
          o.note ? `📝 **ໝາຍເຫດ:** ${o.note}` : null,
          '',
          expired ? '⛔ **ລະຫັດນີ້ໝົດອາຍຸແລ້ວ** — ໃຊ້ລະຫັດອັນລ່າສຸດດ້ານລຸ່ມ'
            : '📋 ກົດ **ກັອບລະຫັດ** → ເຂົ້າ Valorant → **PARTY CODE** → ວາງລະຫັດ → **JOIN**',
        ].filter((x) => x !== null).join('\n'))
        .setFooter({ text: `Room Code / ລະຫັດຫ້ອງ #DM1-G${o.game || 0}`, ...(logo ? { iconURL: logo } : {}) })
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
      if (!o.preview) logTo(`🔑 **${user.username}** ສົ່ງລະຫັດຫ້ອງ${o.game ? ` ເກມ ${o.game}` : ''}: ${o.code}`);
      return msg;
    }
    client.jibiRoomCode = sendRoomCode;

    client.on(Events.InteractionCreate, async (i) => {
      try {
        if (i.isButton() && i.customId.startsWith('tourney:copy:')) {
          // ตอบเป็นข้อความที่มีแค่รหัสอย่างเดียว — กดค้าง/คลิกขวา → Copy Text ได้ทันที
          return i.reply({ content: i.customId.slice('tourney:copy:'.length), flags: MessageFlags.Ephemeral });
        }
        if (i.isChatInputCommand() && i.commandName === 'roomcode') {
          await i.deferReply({ flags: MessageFlags.Ephemeral });
          const msg = await sendRoomCode(i.user, { code: i.options.getString('code').trim(), game: i.options.getInteger('game'), map: i.options.getString('map'), note: i.options.getString('note') });
          return i.editReply(`✅ ສົ່ງລະຫັດແລ້ວ — ${msg.url}`);
        }
        if (i.isButton() && i.customId === 'tourney:open') {
          const cur = db.players[i.user.id] || {};
          const modal = new ModalBuilder().setCustomId('tourney:modal').setTitle('ລົງທະບຽນນັກແຂ່ງ DEATHMATCH');
          modal.addLabelComponents(...FIELDS.map((f) => buildField(f, cur)));
          return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === 'tourney:modal') {
          await i.deferReply({ flags: MessageFlags.Ephemeral });
          const v = Object.fromEntries(FIELDS.map((f) => [f.id, readField(i, f)]));
          if (!v.riot.includes('#')) return i.editReply('❌ Riot ID ຕ້ອງມີ **#** ເຊັ່ນ `PShop#LAO` — ກົດ 📝 ແລ້ວໃສ່ໃໝ່');
          const ch = i.channel;
          const old = db.players[i.user.id];
          const no = old ? old.no : Math.max(0, ...Object.values(db.players).map((x) => x.no)) + 1;
          const p = { ...v, no, at: old ? old.at : Date.now(), channelId: ch.id, messageId: old && old.messageId, style: 4 };
          let msg = null;
          if (old && old.messageId) msg = await ch.messages.fetch(old.messageId).catch(() => null);
          if (msg) await msg.edit(cardMessage(i.member, p));
          else { const { attachments, ...m } = cardMessage(i.member, p); msg = await ch.send(m); p.messageId = msg.id; }
          db.players[i.user.id] = p; save();
          await bumpPanel(ch);
          logTo(`📝 **${i.user.username}** ${old ? 'ແກ້ໄຂ' : 'ລົງທະບຽນ'}ນັກແຂ່ງ #${no}: ${v.name} · ${v.riot} · ${v.rank}${v.team ? ` · ${v.team}` : ''} · ${v.pshop ? '✅ ເຄີຍເຕີມກັບ P SHOP' : '— ບໍ່ເຄີຍເຕີມກັບ P SHOP'}`);
          return i.editReply(`✅ ${old ? 'ແກ້ໄຂຂໍ້ມູນແລ້ວ' : `ລົງທະບຽນແລ້ວ! ເຈົ້າແມ່ນນັກແຂ່ງ #${no}${no > MAX ? ' (ຕົວສຳຮອງ)' : ''}`} — ${msg.url}`);
        }

        if (i.isButton() && i.customId === 'tourney:cancel') {
          const p = db.players[i.user.id];
          if (!p) return i.reply({ content: 'ເຈົ້າຍັງບໍ່ໄດ້ລົງທະບຽນ', flags: MessageFlags.Ephemeral });
          await i.deferReply({ flags: MessageFlags.Ephemeral });
          const m = await i.channel.messages.fetch(p.messageId).catch(() => null);
          if (m) await m.delete().catch(() => {});
          delete db.players[i.user.id]; save();
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
