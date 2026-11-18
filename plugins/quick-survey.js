// ปลั๊กอิน: แบบสอบถามสั้น "ใช้งานง่ายไหม?" สำหรับนักแข่งที่สมัครแล้ว (βETA VOL.2)
// โพสต์ในห้อง 📝・ແບບສອບຖາມ-ນັກແຂ່ງ + แท็กนักแข่ง + DM ทุกคน · ตอบ 4 ข้อ (เลือกหน้ายิ้ม) + ความเห็น (ไม่ใส่ก็ได้)
// แผงโชว์ "ตอบแล้ว X/Y" อัปเดตเอง · ผลเก็บใน data/quick-survey.json
const {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, MessageFlags,
} = require('discord.js');
const store = require('../lib/store');

const FACES = [['easy', '😄 ງ່າຍຫຼາຍ'], ['ok', '🙂 ພໍໄດ້'], ['hard', '😵 ງົງ / ຍາກ'], ['skip', '⏭️ ບໍ່ໄດ້ລອງ']];
// หน้า 2: ติดตรงไหนมากที่สุด
const STUCK = [
  ['none', '👍 ບໍ່ຕິດຫຍັງເລີຍ'],
  ['onboard', '🚪 ຄຳຖາມຕອນເຂົ້າເຊີບ ຫຼາຍໂພດ'],
  ['find', '🔎 ຫາຫ້ອງງານແຂ່ງບໍ່ເຫັນ / ຫ້ອງຫຼາຍ'],
  ['info', '📅 ບໍ່ຮູ້ວັນ-ເວລາ / ກົດ ຢູ່ໃສ'],
  ['form', '📝 ຟອມສະໝັກ ຍາວ / ງົງ'],
  ['riot', '🆔 ບໍ່ຮູ້ Riot ID ແມ່ນຫຍັງ'],
  ['lang', '🗣️ ອ່ານພາສາ/ຄຳສັບ ບໍ່ເຂົ້າໃຈ'],
  ['other', '❓ ອື່ນໆ (ພິມບອກໄດ້)'],
];
const QS = [
  { id: 'join', q: '1. ຕອນເຂົ້າເຊີບເວີ Discord ເທື່ອທຳອິດ' },
  { id: 'info', q: '2. ຕອນຫາຂໍ້ມູນງານແຂ່ງ (ວັນ, ເວລາ, ກົດ)' },
  { id: 'reg', q: '3. ຕອນກົດສະໝັກ + ກອກຟອມ' },
  { id: 'next', q: '4. ສະໝັກແລ້ວ ຮູ້ບໍວ່າຕ້ອງເຮັດຫຍັງຕໍ່' },
];
const isSurveyCh = (c) => c && c.type === ChannelType.GuildText && c.name.includes('ແບບສອບຖາມ');
const bar = (n, total) => { const t = Math.max(total, 1); const f = Math.round((n / t) * 10); return `${'🟩'.repeat(f)}${'⬛'.repeat(10 - f)}`; };

module.exports = {
  id: 'quick-survey',
  name: 'แบบสอบถามสั้น (ใช้งานง่ายไหม)',
  description: 'ถามนักแข่งที่สมัครแล้ว 4 ข้อแบบเลือกหน้ายิ้ม + ความเห็น · แท็ก + DM · แผงโชว์จำนวนคนตอบ',
  setup({ client, guild, logTo }) {
    const db = store.load('quick-survey', { panel: null, targets: [], responses: {} });
    db.responses = db.responses || {}; db.targets = db.targets || [];
    const save = () => store.save('quick-survey', db);
    const draft = new Map(); // uid → answers

    db.panels = db.panels || (db.panel ? [{ ...db.panel, kind: 'players' }] : []);
    const count = () => db.targets.filter((u) => db.responses[u]).length;
    function panelMessage(kind = 'players') {
      const n = count(); const total = db.targets.length;
      if (kind === 'open') {
        const all = Object.keys(db.responses).length;
        const e = new EmbedBuilder().setColor(0xFFC400)
          .setTitle('📝 ເຊີບເຮົາ ເຂົ້າໃຈງ່າຍບໍ? ຊ່ວຍບອກແດ່ 🙏')
          .setDescription([
            'ສະບາຍດີທຸກຄົນ ນ້ອງ JIBI ເອງ 👋',
            'ໃຜເຂົ້າມາເພາະ **VALORANT / βETA TOURNAMENT** ຂໍຖາມແດ່ເດີ້',
            '',
            '🤔 ເຂົ້າເຊີບມາ ເຂົ້າໃຈງ່າຍບໍ? ຢາກສະໝັກແຂ່ງ ຮູ້ບໍວ່າຕ້ອງກົດຫຍັງ?',
            '🧱 **ຕິດຕົງໃດຫຼາຍທີ່ສຸດ?**',
            '',
            '✅ ສະໝັກແລ້ວ ຫຼື ຍັງບໍ່ສະໝັກ ກໍຕອບໄດ້ໝົດ',
            '⏱️ **30 ວິນາທີ** — ເລືອກໜ້າຍິ້ມ 4 ຂໍ້ + ເລືອກຈຸດທີ່ຕິດ ຈົບ!',
            '🔒 ຄຳຕອບເຫັນສະເພາະແອດມິນ · ຈະເອົາໄປປັບເຊີບໃຫ້ງ່າຍຂຶ້ນ 💛',
            '',
            `📊 ຕອບແລ້ວ **${all}** ຄົນ`,
          ].join('\n'))
          .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('qs:start').setStyle(ButtonStyle.Danger).setLabel('📝 ຕອບເລີຍ (30 ວິ)'),
        );
        return { embeds: [e], components: [row] };
      }
      const e = new EmbedBuilder().setColor(0xFFC400)
        .setTitle('📝 ຂໍຖາມແດ່ — ໃຊ້ງານຍາກບໍ? 🙏')
        .setDescription([
          'ສະບາຍດີນັກແຂ່ງທຸກຄົນ ນ້ອງ JIBI ເອງ 👋',
          'ຂອບໃຈທີ່ສະໝັກ βETA TOURNAMENT VOL.2 ເດີ້ 💛',
          '',
          'ຢາກຮູ້ວ່າຕອນເຂົ້າເຊີບເວີ ຕອນສະໝັກ ມັນ **ງ່າຍ ຫຼື ງົງ** ແນວໃດແດ່',
          'ຈະເອົາໄປປັບລະບົບໃຫ້ດີຂຶ້ນ ໃຫ້ໝູ່ທີ່ມາໃໝ່ສະໝັກງ່າຍກວ່າເກົ່າ',
          '',
          '⏱️ ໃຊ້ເວລາ **30 ວິນາທີ** — ເລືອກໜ້າຍິ້ມ 4 ຂໍ້ ຈົບ!',
          '✍️ ຢາກບົ່ນ ຢາກແນະນຳ ພິມໄດ້ເລີຍ (ບໍ່ພິມກໍໄດ້)',
          '🔒 ຄຳຕອບເຫັນສະເພາະແອດມິນ',
          '',
          `📊 ຕອບແລ້ວ **${n}/${total}** ຄົນ\n${bar(n, total)}`,
        ].join('\n'))
        .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('qs:start').setStyle(ButtonStyle.Danger).setLabel('📝 ຕອບເລີຍ (30 ວິ)'),
      );
      return { embeds: [e], components: [row] };
    }

    function formMessage(uid) {
      const a = draft.get(uid) || {};
      const rows = QS.map((x) => new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`qs:sel:${x.id}`).setPlaceholder(x.q)
          .addOptions(FACES.map(([v, l]) => ({ label: `${x.q.split('.')[0]}. ${l}`, value: v, default: a[x.id] === v }))),
      ));
      const done = QS.every((x) => a[x.id]);
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('qs:next').setStyle(ButtonStyle.Success).setLabel('➡️ ຕໍ່ໄປ (ຂໍ້ສຸດທ້າຍ)').setDisabled(!done),
      ));
      const e = new EmbedBuilder().setColor(0xFFC400)
        .setTitle('ເລືອກໜ້າຍິ້ມ 4 ຂໍ້ 👇 (1/2)')
        .setDescription(`${QS.map((x) => `${a[x.id] ? '✅' : '▫️'} ${x.q}`).join('\n')}\n\n${done ? '👉 ຄົບແລ້ວ! ກົດ **ຕໍ່ໄປ**' : '_ບໍ່ໄດ້ລອງ ກໍເລືອກ ⏭️ ໄດ້ · ຄົບ 4 ຂໍ້ ປຸ່ມຕໍ່ໄປຈະກົດໄດ້_'}`);
      return { embeds: [e], components: rows };
    }
    function stuckMessage(uid) {
      const a = draft.get(uid) || {};
      const e = new EmbedBuilder().setColor(0xFFC400)
        .setTitle('🧱 ຕິດຕົງໃດຫຼາຍທີ່ສຸດ? (2/2)')
        .setDescription(`${a.stuck ? `✅ ${(STUCK.find((x) => x[0] === a.stuck) || [, ''])[1]}` : 'ເລືອກ 1 ຢ່າງ 👇'}\n\nແລ້ວກົດ **ສົ່ງເລີຍ** ຫຼື **ພິມຄຳເຫັນ** ເພີ່ມກໍໄດ້ (ບົ່ນໄດ້ເຕັມທີ່ 😄)`);
      return { embeds: [e], components: [
        new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('qs:sel:stuck').setPlaceholder('ຕິດຕົງໃດຫຼາຍທີ່ສຸດ?')
          .addOptions(STUCK.map(([v, l]) => ({ label: l, value: v, default: a.stuck === v })))),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('qs:send').setStyle(ButtonStyle.Success).setLabel('✅ ສົ່ງເລີຍ').setDisabled(!a.stuck),
          new ButtonBuilder().setCustomId('qs:comment').setStyle(ButtonStyle.Primary).setLabel('✍️ ພິມຄຳເຫັນ ແລ້ວສົ່ງ').setDisabled(!a.stuck),
          new ButtonBuilder().setCustomId('qs:back').setStyle(ButtonStyle.Secondary).setLabel('⬅️ ກັບ'),
        ),
      ] };
    }

    async function refreshPanel() {
      for (const pn of db.panels) {
        const ch = await guild.channels.fetch(pn.chId).catch(() => null);
        const msg = ch && await ch.messages.fetch(pn.msgId).catch(() => null);
        if (msg) await msg.edit(panelMessage(pn.kind)).catch(() => {});
      }
    }

    async function finish(i, comment) {
      const uid = i.user.id;
      const m = await guild.members.fetch(uid).catch(() => null);
      db.responses[uid] = { name: (m && m.displayName) || i.user.username, at: new Date().toISOString(), answers: draft.get(uid), comment: comment || '' };
      draft.delete(uid); save();
      const a = db.responses[uid].answers;
      const face = (v) => (FACES.find((f) => f[0] === v) || [, v])[1].split(' ')[0];
      const st = a.stuck ? ` · 🧱 ${(STUCK.find((x) => x[0] === a.stuck) || [, a.stuck])[1]}` : '';
      logTo(`📝 ${db.responses[uid].name} ຕອບແບບສອບຖາມສັ້ນແລ້ວ (ລວມ ${Object.keys(db.responses).length} ຄົນ · ນັກແຂ່ງ ${count()}/${db.targets.length}) · ${QS.map((x) => face(a[x.id])).join(' ')}${st}${comment ? ` · 💬 ${comment.slice(0, 200)}` : ''}`);
      await refreshPanel();
    }

    client.jibiQuickSurvey = {
      async post({ text, dm = true } = {}) {
        const ch = guild.channels.cache.find(isSurveyCh);
        if (!ch) throw new Error('ບໍ່ພົບຫ້ອງ ແບບສອບຖາມ');
        const players = client.jibiTourney ? client.jibiTourney.players().map((p) => p.uid) : [];
        if (!players.length) throw new Error('ຍັງບໍ່ມີນັກແຂ່ງ');
        db.targets = [...new Set([...db.targets, ...players])];
        const content = `${players.map((u) => `<@${u}>`).join(' ')}\n${text || 'ນ້ອງ JIBI ຂໍລົບກວນ 30 ວິນາທີ ເດີ້ 🙏 ກົດປຸ່ມແດງລຸ່ມນີ້ໄດ້ເລີຍ 👇'}`;
        const msg = await ch.send({ content, ...panelMessage(), allowedMentions: { users: players } });
        db.panel = { chId: ch.id, msgId: msg.id }; db.panels.push({ ...db.panel, kind: 'players' }); save();
        const dmRes = { ok: [], fail: [] };
        if (dm) {
          for (const u of players) {
            const mem = await guild.members.fetch(u).catch(() => null);
            const name = mem ? mem.displayName : '';
            const e = new EmbedBuilder().setColor(0xFFC400)
              .setTitle(`ສະບາຍດີ ${name} 👋 ນ້ອງ JIBI ເອງ`)
              .setDescription([
                'ຂອບໃຈທີ່ສະໝັກ **βETA TOURNAMENT VOL.2** ເດີ້ 💛',
                '',
                'ຂໍຖາມແດ່ ຕອນເຂົ້າເຊີບເວີ ກັບ ຕອນສະໝັກ ມັນ **ງ່າຍ ຫຼື ງົງ** ບໍ?',
                'ຈະເອົາໄປປັບປຸງໃຫ້ດີຂຶ້ນ 🙏 ໃຊ້ເວລາແຄ່ **30 ວິນາທີ**',
                '',
                '👇 ກົດປຸ່ມລຸ່ມນີ້ ຕອບໃນ DM ນີ້ໄດ້ເລີຍ',
              ].join('\n'))
              .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('qs:start').setStyle(ButtonStyle.Danger).setLabel('📝 ຕອບເລີຍ (30 ວິ)'),
              new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(msg.url).setLabel('ເບິ່ງໃນເຊີບເວີ'),
            );
            const ok = mem && await mem.send({ embeds: [e], components: [row] }).then(() => true).catch(() => false);
            (ok ? dmRes.ok : dmRes.fail).push(name || u);
          }
          logTo(`📨 DM ແບບສອບຖາມສັ້ນ: ສົ່ງຖຶງ ${dmRes.ok.length}/${players.length}${dmRes.fail.length ? ` · ສົ່ງບໍ່ໄດ້ (ປິດ DM): ${dmRes.fail.join(', ')}` : ''}`);
        }
        return { url: msg.url, targets: players.length, dm: dmRes };
      },
      // แผงแบบเปิด (แชตโลก): แท็กยศ Valorant + นักแข่งที่ยังไม่ตอบ · ใครก็ตอบได้
      async postOpen({ channel = 'ແຊັດໂລກ', role = 'Valorant' } = {}) {
        await guild.channels.fetch();
        const ch = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name.includes(channel));
        if (!ch) throw new Error(`ບໍ່ພົບຫ້ອງ ${channel}`);
        const r = role && guild.roles.cache.find((x) => x.name === role);
        const players = client.jibiTourney ? client.jibiTourney.players().map((p) => p.uid) : [];
        db.targets = [...new Set([...db.targets, ...players])];
        const pendingUsers = db.targets.filter((u) => !db.responses[u]);
        const tags = [r ? `<@&${r.id}>` : '', ...pendingUsers.map((u) => `<@${u}>`)].filter(Boolean).join(' ');
        const msg = await ch.send({ content: `${tags}\nນ້ອງ JIBI ຂໍລົບກວນ 30 ວິນາທີ ເດີ້ 🙏 ກົດປຸ່ມແດງລຸ່ມນີ້ໄດ້ເລີຍ 👇`, ...panelMessage('open'), allowedMentions: { roles: r ? [r.id] : [], users: pendingUsers } });
        db.panels.push({ chId: ch.id, msgId: msg.id, kind: 'open' }); save();
        logTo(`📝 ໂພສແບບສອບຖາມ "ເຊີບເຂົ້າໃຈງ່າຍບໍ" ໃນ #${ch.name} · ແທັກ ${r ? r.name : '-'} + ນັກແຂ່ງທີ່ຍັງບໍ່ຕອບ ${pendingUsers.length} ຄົນ`);
        return { url: msg.url, taggedPlayers: pendingUsers.length };
      },
      results: () => ({
        answered: count(), total: db.targets.length,
        waiting: db.targets.filter((u) => !db.responses[u]),
        responses: Object.entries(db.responses).map(([uid, r]) => ({ uid, ...r })),
      }),
    };

    client.on(Events.InteractionCreate, async (i) => {
      try {
        if (!i.customId || !i.customId.startsWith('qs:')) return;
        const uid = i.user.id;
        if (i.isButton() && i.customId === 'qs:start') {
          if (db.responses[uid]) return i.reply({ content: '✅ ຕອບແລ້ວເດີ້ — ຂອບໃຈຫຼາຍໆ 💛', flags: MessageFlags.Ephemeral });
          if (!draft.has(uid)) draft.set(uid, {});
          return i.reply({ ...formMessage(uid), flags: MessageFlags.Ephemeral });
        }
        if (!draft.has(uid)) {
          if (db.responses[uid]) return i.reply({ content: '✅ ຕອບແລ້ວເດີ້ — ຂອບໃຈຫຼາຍໆ 💛', flags: MessageFlags.Ephemeral });
          return i.reply({ content: '⏳ ໝົດເວລາ — ກົດ 📝 ຕອບເລີຍ ໃໝ່ອີກຄັ້ງເດີ້', flags: MessageFlags.Ephemeral });
        }
        if (i.isStringSelectMenu() && i.customId.startsWith('qs:sel:')) {
          const k = i.customId.slice('qs:sel:'.length);
          draft.get(uid)[k] = i.values[0];
          return i.update(k === 'stuck' ? stuckMessage(uid) : formMessage(uid));
        }
        if (i.isButton() && i.customId === 'qs:next') return i.update(stuckMessage(uid));
        if (i.isButton() && i.customId === 'qs:back') return i.update(formMessage(uid));
        if (i.isButton() && i.customId === 'qs:send') {
          await finish(i, '');
          return i.update({ content: '💛 ຂອບໃຈຫຼາຍໆເດີ້! ນ້ອງ JIBI ຈະເອົາໄປປັບປຸງໃຫ້ດີຂຶ້ນ — ພົບກັນວັນສຸກ 20:00 🎯', embeds: [], components: [] });
        }
        if (i.isButton() && i.customId === 'qs:comment') {
          const modal = new ModalBuilder().setCustomId('qs:modal').setTitle('✍️ ຄຳເຫັນ (ບົ່ນໄດ້ເຕັມທີ່ 😄)');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('hard').setLabel('ຕອນໃດງົງທີ່ສຸດ? (ບໍ່ໃສ່ກໍໄດ້)')
              .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000).setPlaceholder('ເຊັ່ນ ຫາຫ້ອງສະໝັກບໍ່ເຫັນ, ບໍ່ຮູ້ Riot ID ແມ່ນຫຍັງ…')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('idea').setLabel('ຄຳເຫັນທົ່ວໄປ / ຢາກໃຫ້ເພີ່ມຫຍັງ?')
              .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)),
          );
          return i.showModal(modal);
        }
        if (i.isModalSubmit() && i.customId === 'qs:modal') {
          const hard = i.fields.getTextInputValue('hard') || '';
          const idea = i.fields.getTextInputValue('idea') || '';
          await finish(i, [hard && `ງົງ: ${hard}`, idea && `ຄຳເຫັນ: ${idea}`].filter(Boolean).join(' | '));
          return i.reply({ content: '💛 ຂອບໃຈຫຼາຍໆເດີ້! ຄຳເຫັນນີ້ມີຄ່າຫຼາຍ ນ້ອງ JIBI ຈະເອົາໄປປັບປຸງ — ພົບກັນວັນສຸກ 20:00 🎯', flags: MessageFlags.Ephemeral });
        }
      } catch (e) {
        console.error('[quick-survey]', e.message);
        if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: '⚠️ ມີບັນຫາ ລອງໃໝ່ອີກຄັ້ງເດີ້', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    });
  },
};
