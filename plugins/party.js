// ปลั๊กอิน: หาปาร์ตี้ — แผงปุ่มค้างล่างสุดของห้อง 🤝 ຫາປາຕີ້ ทุกห้อง
// กด 🎮 ສ້າງປາຕີ້ → เลือกแรงก์/โหมด/จำนวนคน → JIBI โพสต์หาทีม + สร้างห้องเสียงปาร์ตี้ให้ทันที
// ห้องเสียงว่าง = ลบเอง + โพสต์ขึ้นว่าปิดแล้ว · /party ยังใช้ได้เหมือนเดิม
const {
  Events, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType, PermissionFlagsBits: P, OverwriteType, MessageFlags,
} = require('discord.js');
const store = require('../lib/store');

// แก้รายการแรงก์/โหมดของแต่ละเกมได้ตรงนี้
const GAMES = {
  valorant: {
    label: 'VALORANT', slots: 5,
    ranks: ['Unrated / ບໍ່ມີແຣງ', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant', 'ແຣງໃດກໍໄດ້'],
    modes: ['Competitive (Rank)', 'Unrated', 'Swiftplay', 'Spike Rush', 'Deathmatch', 'Team Deathmatch', 'Custom / ຊ້ອມ'],
  },
  delta: {
    label: 'DELTA FORCE', slots: 4,
    ranks: ['ມືໃໝ່', 'ກາງ', 'ເກັ່ງ', 'ໂປຣ', 'ລະດັບໃດກໍໄດ້'],
    modes: ['Operations', 'Warfare', 'ຊ້ອມ / ຫຼິ້ນຊິວໆ'],
  },
  heartopia: {
    label: 'HEARTOPIA', slots: 4,
    ranks: ['ມືໃໝ່', 'ຫຼິ້ນມາດົນແລ້ວ', 'ໃຜກໍໄດ້'],
    modes: ['ຫຼິ້ນນຳກັນ', 'ເຮັດເຄວສ / ກິດຈະກຳ', 'ສ້າງ / ຕົກແຕ່ງເຮືອນ', 'ລົມຫຼິ້ນ'],
  },
  steam: {
    label: 'ເກມ STEAM', slots: 4,
    ranks: ['ມືໃໝ່', 'ກາງ', 'ເກັ່ງ', 'ໃຜກໍໄດ້'],
    modes: ['Co-op', 'PvP', 'ຫຼິ້ນຊິວໆ', 'ຫາເກມໃໝ່ຫຼິ້ນ'],
  },
};
const gameKey = (ch) => {
  const n = ((ch && ch.parent && ch.parent.name) || (ch && ch.name) || '').toLowerCase();
  if (n.includes('valorant')) return 'valorant';
  if (n.includes('delta')) return 'delta';
  if (n.includes('heartopia')) return 'heartopia';
  return 'steam';
};
const isPartyChannel = (c) => c && c.type === ChannelType.GuildText && c.name.includes('ຫາປາຕີ້');

function postRows(voiceUrl, closed) {
  if (closed) return [];
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('party:join').setStyle(ButtonStyle.Success).setLabel('🙋 ເຂົ້າຮ່ວມ'),
    new ButtonBuilder().setCustomId('party:leave').setStyle(ButtonStyle.Secondary).setLabel('ອອກ'),
  );
  if (voiceUrl) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('🔊 ເຂົ້າຫ້ອງສຽງ').setURL(voiceUrl));
  return [row];
}

module.exports = {
  id: 'party',
  name: 'หาปาร์ตี้ (แผงปุ่ม + /party)',
  description: 'แผงปุ่มค้างล่างสุดของห้อง 🤝 ຫາປາຕີ້ · กดสร้างปาร์ตี้ → เลือกแรงก์/โหมด/จำนวนคน → JIBI โพสต์หาทีมและสร้างห้องเสียงปาร์ตี้ให้ (ว่าง = ลบเอง)',
  commands: [
    new SlashCommandBuilder().setName('party').setDescription('ໂພສຫາປາຕີ້ / ຫາທີມ')
      .addStringOption((o) => o.setName('detail').setDescription('ເຊັ່ນ Rank Gold, ຫາ 2 ຄົນ').setRequired(true).setMaxLength(200))
      .addIntegerOption((o) => o.setName('slots').setDescription('ຈຳນວນຄົນທັງໝົດ (ລວມເຈົ້າ)').setMinValue(2).setMaxValue(10)),
  ],
  setup({ client, guild, logTo }) {
    const panels = store.load('party-panels', {});          // channelId -> messageId
    const voices = store.load('party-voices', {});          // voiceId -> { channelId, messageId, createdAt }
    const drafts = new Map();                               // userId -> { channelId, rank, mode, slots }
    const savePanels = () => store.save('party-panels', panels);
    const saveVoices = () => store.save('party-voices', voices);

    // ---------- แผงปุ่ม (ค้างล่างสุดเสมอ) ----------
    function panelMessage(ch) {
      const g = GAMES[gameKey(ch)];
      const embed = new EmbedBuilder()
        .setColor(0xFFC400)
        .setTitle(`🤝 ຫາປາຕີ້ ${g.label}`)
        .setDescription('ກົດ **🎮 ສ້າງປາຕີ້** ດ້ານລຸ່ມ\n① ເລືອກແຣງ ② ເລືອກໂໝດ ③ ເລືອກຈຳນວນຄົນ → ກົດ **ສ້າງ**\nJIBI ຈະໂພສຫາທີມ ແລະ ສ້າງຫ້ອງສຽງໃຫ້ທັນທີ — ລໍຖ້າໝູ່ເຂົ້າໄດ້ເລີຍ 🎮')
        .setFooter({ text: 'ຫ້ອງສຽງປາຕີ້ຈະຫາຍເອງເມື່ອບໍ່ມີຄົນ · JIBI' });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('party:open').setStyle(ButtonStyle.Success).setLabel('🎮 ສ້າງປາຕີ້'));
      return { embeds: [embed], components: [row] };
    }
    async function bumpPanel(ch) {
      try {
        const oldId = panels[ch.id];
        if (oldId) { const old = await ch.messages.fetch(oldId).catch(() => null); if (old) await old.delete().catch(() => {}); }
        const msg = await ch.send(panelMessage(ch));
        panels[ch.id] = msg.id; savePanels();
      } catch (e) { console.error('[party] panel', e.message); }
    }
    async function ensurePanels() {
      for (const ch of guild.channels.cache.filter(isPartyChannel).values()) {
        const last = await ch.messages.fetch({ limit: 1 }).catch(() => null);
        const lastMsg = last && last.first();
        if (!lastMsg || lastMsg.id !== panels[ch.id]) await bumpPanel(ch);
        else await lastMsg.edit(panelMessage(ch)).catch(() => {});
      }
    }
    ensurePanels();

    // มีคนพิมพ์ในห้องหาปาร์ตี้ → ดันแผงลงไปล่างสุด (รอ 20 วิ กันสแปม)
    const bumpTimers = {};
    client.on(Events.MessageCreate, (msg) => {
      if (!msg.guild || msg.author.id === client.user.id || !isPartyChannel(msg.channel)) return;
      clearTimeout(bumpTimers[msg.channelId]);
      bumpTimers[msg.channelId] = setTimeout(() => bumpPanel(msg.channel), 20000);
    });

    // ---------- เมนูเลือก ----------
    function draftView(d, member) {
      const g = GAMES[gameKey(guild.channels.cache.get(d.channelId))];
      const here = member && member.voice && member.voice.channel;
      const opt = (arr, cur) => arr.map((x) => ({ label: x.slice(0, 100), value: x.slice(0, 100), default: x === cur }));
      const slotsOpts = Array.from({ length: 9 }, (_, k) => k + 2).map((n) => ({ label: `${n} ຄົນ`, value: String(n), default: n === d.slots }));
      return {
        content: `**ສ້າງປາຕີ້ ${g.label}** — ເລືອກໃຫ້ຄົບແລ້ວກົດປຸ່ມດ້ານລຸ່ມ${here ? `\n🔊 ເຈົ້າຢູ່ໃນຫ້ອງ **${here.name}** — ໃຊ້ຫ້ອງນີ້ໄດ້ເລີຍ ບໍ່ຕ້ອງສ້າງໃໝ່` : ''}`,
        components: [
          new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('party:rank').setPlaceholder('① ເລືອກແຣງ').addOptions(opt(g.ranks, d.rank))),
          new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('party:mode').setPlaceholder('② ເລືອກໂໝດ').addOptions(opt(g.modes, d.mode))),
          new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('party:slots').setPlaceholder('③ ຈຳນວນຄົນ').addOptions(slotsOpts)),
          new ActionRowBuilder().addComponents(...[
            here ? new ButtonBuilder().setCustomId('party:here').setStyle(ButtonStyle.Success).setLabel(`✅ ໃຊ້ຫ້ອງ ${here.name}`.slice(0, 80)).setDisabled(!(d.rank && d.mode)) : null,
            new ButtonBuilder().setCustomId('party:create').setStyle(here ? ButtonStyle.Secondary : ButtonStyle.Success).setLabel(here ? '➕ ສ້າງຫ້ອງໃໝ່' : '✅ ສ້າງ').setDisabled(!(d.rank && d.mode)),
          ].filter(Boolean)),
        ],
      };
    }

    // ---------- สร้างห้องเสียงปาร์ตี้ ----------
    async function makeVoice(member, ch, slots) {
      const prefix = (ch.parent ? ch.parent.name.split('|')[0] : '').trim();
      const cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.startsWith(prefix) && c.name.includes('ຫ້ອງລົມ')) || ch.parent;
      const overwrites = cat ? cat.permissionOverwrites.cache.map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield })) : [];
      overwrites.push({ id: member.id, type: OverwriteType.Member, allow: [P.ViewChannel, P.Connect, P.Speak, P.ManageChannels, P.MoveMembers, P.MuteMembers] });
      return guild.channels.create({
        name: `🎮 ປາຕີ້ ${member.displayName}`.slice(0, 95), type: ChannelType.GuildVoice,
        parent: cat ? cat.id : null, userLimit: slots, bitrate: guild.maximumBitrate, permissionOverwrites: overwrites,
      });
    }

    async function closeParty(voiceId) {
      const info = voices[voiceId];
      delete voices[voiceId]; saveVoices();
      const v = guild.channels.cache.get(voiceId);
      if (v && info && info.temp !== false) await v.delete('ปาร์ตี้ว่าง').catch(() => {});
      if (!info) return;
      try {
        const ch = await guild.channels.fetch(info.channelId);
        const msg = await ch.messages.fetch(info.messageId);
        const e = EmbedBuilder.from(msg.embeds[0]).setColor(0x80848E).setTitle(`${msg.embeds[0].title} · ປິດແລ້ວ`);
        await msg.edit({ embeds: [e], components: [] });
      } catch { /* โพสต์ถูกลบไปแล้ว */ }
    }

    client.on(Events.VoiceStateUpdate, async (oldS) => {
      const v = oldS.channel;
      if (v && voices[v.id] && v.members.size === 0) await closeParty(v.id);
    });
    setInterval(() => {
      for (const [id, info] of Object.entries(voices)) {
        const v = guild.channels.cache.get(id);
        if (!v) { closeParty(id); continue; }
        if (v.members.size === 0 && Date.now() - info.createdAt > 10 * 60000) closeParty(id);
      }
    }, 60000);

    // ---------- โพสต์ปาร์ตี้ ----------
    function partyEmbed(member, g, fields, slots, ids) {
      return new EmbedBuilder()
        .setColor(0xFFC400)
        .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
        .setTitle(`🤝 ຫາປາຕີ້ ${g.label}`)
        .addFields(...fields, { name: `ສະມາຊິກ (${ids.length}/${slots})`, value: ids.map((x) => `<@${x}>`).join('\n') })
        .setFooter({ text: `slots:${slots} · owner:${member.id}` })
        .setTimestamp();
    }

    client.on(Events.InteractionCreate, async (i) => {
      try {
        // เปิดเมนู
        if (i.isButton() && i.customId === 'party:open') {
          const g = GAMES[gameKey(i.channel)];
          const d = { channelId: i.channelId, slots: g.slots };
          drafts.set(i.user.id, d);
          return i.reply({ ...draftView(d, i.member), flags: MessageFlags.Ephemeral });
        }
        if (i.isStringSelectMenu() && ['party:rank', 'party:mode', 'party:slots'].includes(i.customId)) {
          const d = drafts.get(i.user.id);
          if (!d) return i.update({ content: 'ໝົດເວລາ — ກົດ 🎮 ສ້າງປາຕີ້ ໃໝ່', components: [] });
          const val = i.values[0];
          if (i.customId === 'party:rank') d.rank = val;
          if (i.customId === 'party:mode') d.mode = val;
          if (i.customId === 'party:slots') d.slots = Number(val);
          return i.update(draftView(d, i.member));
        }
        if (i.isButton() && (i.customId === 'party:create' || i.customId === 'party:here')) {
          const d = drafts.get(i.user.id);
          if (!d || !d.rank || !d.mode) return i.update({ content: 'ໝົດເວລາ — ກົດ 🎮 ສ້າງປາຕີ້ ໃໝ່', components: [] });
          drafts.delete(i.user.id);
          await i.update({ content: '⏳ ກຳລັງສ້າງປາຕີ້...', components: [] });
          const ch = guild.channels.cache.get(d.channelId);
          const g = GAMES[gameKey(ch)];
          const current = i.member.voice && i.member.voice.channel;
          const useHere = i.customId === 'party:here' && current;
          const voice = useHere ? current : await makeVoice(i.member, ch, d.slots);
          const embed = partyEmbed(i.member, g, [{ name: 'ແຣງ', value: d.rank, inline: true }, { name: 'ໂໝດ', value: d.mode, inline: true }], d.slots, [i.user.id]);
          const post = await ch.send({ embeds: [embed], components: postRows(voice.url), allowedMentions: { parse: [] } });
          const prevTemp = !!(voices[voice.id] && voices[voice.id].temp !== false);
          if (useHere && voices[voice.id]) { voices[voice.id].temp = false; await closeParty(voice.id).catch(() => {}); } // ปิดโพสต์เก่าของห้องนี้ (ไม่ลบห้อง)
          voices[voice.id] = { channelId: ch.id, messageId: post.id, createdAt: Date.now(), temp: useHere ? prevTemp : true }; saveVoices();
          if (!useHere && current) await i.member.voice.setChannel(voice).catch(() => {});
          await bumpPanel(ch);
          await i.editReply({ content: `✅ ສ້າງປາຕີ້ແລ້ວ! ຫ້ອງສຽງ: ${voice.url}` });
          return logTo(`🤝 **${i.user.username}** ສ້າງປາຕີ້ ${g.label} (${d.rank} · ${d.mode} · ${d.slots} ຄົນ)`);
        }

        // /party แบบพิมพ์
        if (i.isChatInputCommand() && i.commandName === 'party') {
          const slots = i.options.getInteger('slots') || 5;
          const g = GAMES[gameKey(i.channel)];
          const voice = i.member.voice && i.member.voice.channel;
          const embed = partyEmbed(i.member, g, [{ name: 'ລາຍລະອຽດ', value: i.options.getString('detail') }], slots, [i.user.id]);
          await i.reply({ embeds: [embed], components: postRows(voice ? voice.url : null), allowedMentions: { parse: [] } });
          if (isPartyChannel(i.channel)) await bumpPanel(i.channel);
          return;
        }

        // เข้าร่วม / ออก
        if (i.isButton() && (i.customId === 'party:join' || i.customId === 'party:leave')) {
          const old = i.message.embeds[0];
          if (!old) return;
          const slots = Number((old.footer?.text.match(/slots:(\d+)/) || [])[1] || 5);
          const memberField = old.fields.find((f) => f.name.startsWith('ສະມາຊິກ'));
          const ids = [...((memberField && memberField.value) || '').matchAll(/<@(\d+)>/g)].map((m) => m[1]);
          const has = ids.includes(i.user.id);
          if (i.customId === 'party:join') {
            if (has) return i.reply({ content: 'ເຈົ້າຢູ່ໃນປາຕີ້ແລ້ວ', flags: MessageFlags.Ephemeral });
            if (ids.length >= slots) return i.reply({ content: 'ປາຕີ້ເຕັມແລ້ວ 😢', flags: MessageFlags.Ephemeral });
            ids.push(i.user.id);
          } else {
            if (!has) return i.reply({ content: 'ເຈົ້າບໍ່ໄດ້ຢູ່ໃນປາຕີ້ນີ້', flags: MessageFlags.Ephemeral });
            ids.splice(ids.indexOf(i.user.id), 1);
          }
          const full = ids.length >= slots;
          const fields = old.fields.filter((f) => !f.name.startsWith('ສະມາຊິກ'));
          fields.push({ name: `ສະມາຊິກ (${ids.length}/${slots})${full ? ' · ເຕັມແລ້ວ ✅' : ''}`, value: ids.map((x) => `<@${x}>`).join('\n') || '-' });
          const embed = EmbedBuilder.from(old).setColor(full ? 0x80848E : 0xFFC400).setFields(fields);
          return i.update({ embeds: [embed], allowedMentions: { parse: [] } });
        }
      } catch (e) {
        console.error('[party]', e.message);
        if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: '❌ ມີບັນຫາ ລອງໃໝ່', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    });
  },
};
