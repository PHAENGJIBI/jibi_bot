// ปลั๊กอิน: แบบสอบถามหลังงานแข่ง (ละเอียด แต่ตอบเร็ว) — βETA VOL.2
// 4 หน้า × 4 ข้อ (เลือกตัวเลือก) + หน้าเขียนความเห็น 5 ช่อง (ไม่บังคับ)
// โพสต์ในห้องแบบสอบถาม + แท็ก + DM นักแข่งที่มาแข่ง · แผงโชว์ "ตอบแล้ว X/Y" · ผลเก็บใน data/post-survey.json
const {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, MessageFlags,
} = require('discord.js');
const store = require('../lib/store');

const STARS = [['5', '⭐⭐⭐⭐⭐ ດີຫຼາຍ'], ['4', '⭐⭐⭐⭐ ດີ'], ['3', '⭐⭐⭐ ພໍໃຊ້'], ['2', '⭐⭐ ບໍ່ຄ່ອຍດີ'], ['1', '⭐ ບໍ່ດີ']];
const PAGES = [
  { title: '🏆 ພາບລວມງານ', qs: [
    { id: 'overall', q: '1. ໃຫ້ຄະແນນງານນີ້ໂດຍລວມ', o: STARS },
    { id: 'again', q: '2. ງານໜ້າ ຈະມາແຂ່ງອີກບໍ?', o: [['yes', '🔥 ມາແນ່ນອນ'], ['maybe', '🤔 ອາດຈະມາ'], ['no', '🙅 ບໍ່ມາແລ້ວ']] },
    { id: 'recommend', q: '3. ຈະຊວນໝູ່ມາແຂ່ງບໍ?', o: [['yes', '👍 ຊວນແນ່ນອນ'], ['maybe', '🤔 ອາດຈະ'], ['no', '👎 ບໍ່ຊວນ']] },
    { id: 'source', q: '4. ຮູ້ຈັກງານນີ້ຈາກໃສ?', o: [['fb', '📘 Facebook / ເພຈ'], ['friend', '👥 ໝູ່ບອກ'], ['discord', '💬 ເຫັນໃນ Discord'], ['shop', '🏪 ລູກຄ້າຮ້ານ P SHOP'], ['other', '❓ ອື່ນໆ']] },
  ] },
  { title: '📝 ການສະໝັກ & ຂໍ້ມູນ', qs: [
    { id: 'reg', q: '5. ສະໝັກ + ກອກຟອມ ງ່າຍບໍ?', o: [['easy', '😄 ງ່າຍຫຼາຍ'], ['ok', '🙂 ພໍໄດ້'], ['hard', '😵 ຍາກ / ງົງ']] },
    { id: 'info', q: '6. ຂໍ້ມູນງານ (ວັນ, ເວລາ, ກົດ) ຊັດເຈນບໍ?', o: [['clear', '✅ ຊັດເຈນ'], ['ok', '🙂 ພໍເຂົ້າໃຈ'], ['unclear', '❌ ບໍ່ຊັດ / ຫາບໍ່ເຫັນ']] },
    { id: 'notify', q: '7. ແຈ້ງເຕືອນ / DM ຈາກ JIBI', o: [['many', '📢 ຫຼາຍໂພດ'], ['ok', '👌 ກຳລັງດີ'], ['few', '🔕 ໜ້ອຍໂພດ']] },
    { id: 'code', q: '8. ການສົ່ງລະຫັດຫ້ອງ ສະດວກບໍ?', o: [['easy', '😄 ເຫັນງ່າຍ ເຂົ້າໄວ'], ['ok', '🙂 ພໍໄດ້'], ['hard', '😵 ງົງ / ຊ້າ']] },
  ] },
  { title: '🎮 ຮູບແບບການແຂ່ງ', qs: [
    { id: 'length', q: '9. 5 ເກມ Deathmatch ຍາວບໍ?', o: [['long', '😮‍💨 ຍາວໂພດ'], ['ok', '👌 ກຳລັງດີ'], ['short', '⚡ ສັ້ນໄປ ຢາກຫຼິ້ນອີກ']] },
    { id: 'time', q: '10. ເວລາແຂ່ງ 20:00 ເປັນແນວໃດ?', o: [['ok', '👌 ກຳລັງດີ'], ['earlier', '⏪ ຢາກໃຫ້ໄວກວ່ານີ້'], ['later', '⏩ ຢາກໃຫ້ຊ້າກວ່ານີ້'], ['weekend', '📅 ຢາກໃຫ້ແຂ່ງວັນເສົາ-ອາທິດ']] },
    { id: 'weapon', q: '11. ກົດປືນ ງານໜ້າ', o: [['all', '🔫 ໃຊ້ໄດ້ທຸກປືນ (ຄືເກົ່າ)'], ['rifle', '🎯 Vandal / Phantom ເທົ່ານັ້ນ'], ['sheriff', '🤠 Sheriff ເທົ່ານັ້ນ'], ['mix', '🔀 ສະລັບກົດແຕ່ລະເກມ']] },
    { id: 'format', q: '12. ຢາກໃຫ້ງານໜ້າ ແຂ່ງແບບໃດ?', o: [['dm', '💀 Deathmatch ຄືເກົ່າ'], ['1v1', '⚔️ 1v1'], ['2v2', '👥 2v2'], ['5v5', '🏆 5v5 ທີມ'], ['mix', '🔀 ປະສົມຫຼາຍແບບ']] },
  ] },
  { title: '💰 ລາງວັນ & ງານໜ້າ', qs: [
    { id: 'prize', q: '13. ລາງວັນງານນີ້ ເປັນແນວໃດ?', o: [['great', '🤩 ດີຫຼາຍ'], ['ok', '👌 ພໍໃຈ'], ['low', '😐 ໜ້ອຍໄປ']] },
    { id: 'fee', q: '14. ຖ້າມີຄ່າສະໝັກ (ລາງວັນໃຫຍ່ຂຶ້ນ) ຈ່າຍໄດ້ເທົ່າໃດ?', o: [['0', '🆓 ຢາກໃຫ້ຟຣີ'], ['10k', '💵 10,000 ກີບ'], ['20k', '💵 20,000 ກີບ'], ['50k', '💰 50,000 ກີບ'], ['100k', '💰 100,000 ກີບ ຂຶ້ນໄປ']] },
    { id: 'freq', q: '15. ຢາກໃຫ້ຈັດງານແຂ່ງເລື້ອຍໆ ສໍ່າໃດ?', o: [['week', '📆 ທຸກອາທິດ'], ['2week', '🗓️ 2 ອາທິດເທື່ອ'], ['month', '📅 ເດືອນລະເທື່ອ'], ['any', '🤷 ແລ້ວແຕ່ຮ້ານ']] },
    { id: 'showmatch', q: '16. SHOWMATCH 1v1 + ທາຍຜົນ ມ່ວນບໍ?', o: [['fun', '🔥 ມ່ວນຫຼາຍ ຢາກມີອີກ'], ['ok', '🙂 ພໍໄດ້'], ['no', '😐 ບໍ່ຄ່ອຍມ່ວນ'], ['skip', '⏭️ ບໍ່ໄດ້ຫຼິ້ນ/ເບິ່ງ']] },
  ] },
];
const TEXTS = [
  { id: 'best', label: 'ມັກຫຍັງທີ່ສຸດໃນງານນີ້?', ph: 'ເຊັ່ນ ບັນຍາກາດ, ລາງວັນ, ການຈັດງານ…' },
  { id: 'worst', label: 'ບໍ່ມັກ / ຫງຸດຫງິດ ຕົງໃດ?', ph: 'ບົ່ນໄດ້ເຕັມທີ່ 😄' },
  { id: 'improve', label: 'ຢາກໃຫ້ປັບປຸງຫຍັງ ງານໜ້າ?', ph: 'ກົດ, ເວລາ, ລະບົບ Discord, ການສະໝັກ…' },
  { id: 'game', label: 'ຢາກໃຫ້ຈັດແຂ່ງເກມອື່ນບໍ? ເກມຫຍັງ?', ph: 'ເຊັ່ນ CS2, Delta Force, Tekken…' },
  { id: 'other', label: 'ຢາກບອກຫຍັງອີກ ກັບ P SHOP?', ph: 'ຫຍັງກໍໄດ້ 💛' },
];
const ALL_QS = PAGES.flatMap((p) => p.qs);
const isSurveyCh = (c) => c && c.type === ChannelType.GuildText && c.name.includes('ແບບສອບຖາມ');
const bar = (n, total) => { const f = Math.round((n / Math.max(total, 1)) * 10); return `${'🟩'.repeat(f)}${'⬛'.repeat(10 - f)}`; };

module.exports = {
  id: 'post-survey',
  name: 'แบบสอบถามหลังงานแข่ง (ละเอียด)',
  description: '16 ข้อเลือกตอบ 4 หน้า + ความเห็น 5 ช่อง · แท็ก + DM นักแข่ง · นับคนตอบ',
  setup({ client, guild, logTo }) {
    const db = store.load('post-survey', { panels: [], targets: [], responses: {} });
    const save = () => store.save('post-survey', db);
    const draft = new Map(); // uid → { page, a: {} }
    const count = () => db.targets.filter((u) => db.responses[u]).length;

    function panelMessage() {
      const n = count(); const total = db.targets.length;
      const e = new EmbedBuilder().setColor(0xFFC400)
        .setTitle('📝 ແບບສອບຖາມຫຼັງງານ — βETA TOURNAMENT VOL.2')
        .setDescription([
          'ຂອບໃຈນັກແຂ່ງທຸກຄົນ ທີ່ມາແຂ່ງຄືນນີ້ເດີ້ 💛🔥',
          'ນ້ອງ JIBI ຂໍຄວາມຄິດເຫັນແບບ **ລະອຽດ** ແດ່ — ເພື່ອໃຫ້ງານໜ້າ **ໃຫຍ່ຂຶ້ນ ມ່ວນຂຶ້ນ ລາງວັນຫຼາຍຂຶ້ນ**',
          '',
          '📋 **16 ຂໍ້ ກົດເລືອກ** (4 ໜ້າ) + ✍️ **ຄວາມເຫັນ** (ບໍ່ບັງຄັບ)',
          '⏱️ ໃຊ້ເວລາ **~2 ນາທີ** — ກົດເລືອກໄວໆ ຈົບ!',
          '🔒 ຄຳຕອບເຫັນສະເພາະແອດມິນ',
          '',
          `📊 ຕອບແລ້ວ **${n}/${total}** ຄົນ\n${bar(n, total)}`,
        ].join('\n'))
        .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
      return { embeds: [e], components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ps:start').setStyle(ButtonStyle.Danger).setLabel('📝 ເລີ່ມຕອບ (~2 ນາທີ)'),
      )] };
    }

    function pageMessage(uid) {
      const d = draft.get(uid); const pg = PAGES[d.page];
      const rows = pg.qs.map((x) => new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`ps:sel:${x.id}`).setPlaceholder(x.q)
          .addOptions(x.o.map(([v, l]) => ({ label: `${x.q.split('.')[0]}. ${l}`.slice(0, 100), value: v, default: d.a[x.id] === v }))),
      ));
      const done = pg.qs.every((x) => d.a[x.id]);
      const last = d.page === PAGES.length - 1;
      const nav = [];
      if (d.page > 0) nav.push(new ButtonBuilder().setCustomId('ps:back').setStyle(ButtonStyle.Secondary).setLabel('⬅️ ກັບ'));
      nav.push(new ButtonBuilder().setCustomId('ps:next').setStyle(ButtonStyle.Success).setDisabled(!done)
        .setLabel(last ? '✍️ ຕໍ່ໄປ: ຂຽນຄວາມເຫັນ' : `➡️ ໜ້າຕໍ່ໄປ (${d.page + 2}/${PAGES.length})`));
      if (last) nav.push(new ButtonBuilder().setCustomId('ps:send').setStyle(ButtonStyle.Primary).setDisabled(!done).setLabel('✅ ສົ່ງເລີຍ (ບໍ່ຂຽນ)'));
      rows.push(new ActionRowBuilder().addComponents(...nav));
      const e = new EmbedBuilder().setColor(0xFFC400)
        .setTitle(`${pg.title} · ໜ້າ ${d.page + 1}/${PAGES.length}`)
        .setDescription(`${pg.qs.map((x) => `${d.a[x.id] ? '✅' : '▫️'} ${x.q}`).join('\n')}\n\n${done ? '👉 ຄົບແລ້ວ! ກົດປຸ່ມສີຂຽວ' : '_ເລືອກໃຫ້ຄົບ 4 ຂໍ້ ປຸ່ມຈະກົດໄດ້_'}`);
      return { embeds: [e], components: rows };
    }

    async function refreshPanels() {
      for (const pn of db.panels) {
        const ch = await guild.channels.fetch(pn.chId).catch(() => null);
        const msg = ch && await ch.messages.fetch(pn.msgId).catch(() => null);
        if (msg) await msg.edit(panelMessage()).catch(() => {});
      }
    }
    async function finish(i, texts) {
      const uid = i.user.id;
      const m = await guild.members.fetch(uid).catch(() => null);
      db.responses[uid] = { name: (m && m.displayName) || i.user.username, at: new Date().toISOString(), answers: draft.get(uid).a, texts: texts || {} };
      draft.delete(uid); save();
      const t = Object.entries(texts || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v.slice(0, 120)}`).join(' | ');
      logTo(`📝 ${db.responses[uid].name} ຕອບແບບສອບຖາມຫຼັງງານແລ້ວ (${count()}/${db.targets.length}) · ⭐${db.responses[uid].answers.overall}${t ? ` · 💬 ${t}` : ''}`);
      await refreshPanels();
    }
    const thanks = '💛 ຂອບໃຈຫຼາຍໆເດີ້! ທຸກຄຳຕອບ ນ້ອງ JIBI ຈະເອົາໄປປັບງານໜ້າໃຫ້ດີຂຶ້ນ — ພົບກັນງານໜ້າ 🔥';

    client.jibiPostSurvey = {
      async post({ uids = [], dm = true } = {}) {
        const ch = guild.channels.cache.find(isSurveyCh);
        if (!ch) throw new Error('ບໍ່ພົບຫ້ອງ ແບບສອບຖາມ');
        if (!uids.length) throw new Error('ບໍ່ມີລາຍຊື່');
        db.targets = [...new Set([...db.targets, ...uids])];
        const content = `${uids.map((u) => `<@${u}>`).join(' ')}\nນ້ອງ JIBI ຂໍລົບກວນ ~2 ນາທີ ເດີ້ 🙏 ກົດປຸ່ມແດງລຸ່ມນີ້ 👇`;
        const msg = await ch.send({ content, ...panelMessage(), allowedMentions: { users: uids } });
        db.panels.push({ chId: ch.id, msgId: msg.id }); save();
        const res = { ok: [], fail: [] };
        if (dm) {
          for (const u of uids) {
            const mem = await guild.members.fetch(u).catch(() => null);
            const name = mem ? mem.displayName : '';
            const e = new EmbedBuilder().setColor(0xFFC400)
              .setTitle(`ສະບາຍດີ ${name} 👋 ນ້ອງ JIBI ເອງ`)
              .setDescription([
                'ຂອບໃຈທີ່ມາແຂ່ງ **βETA TOURNAMENT VOL.2** ຄືນນີ້ເດີ້ 💛🔥',
                '',
                'ຂໍຄວາມຄິດເຫັນແດ່ — ຈະເອົາໄປເຮັດໃຫ້ງານໜ້າ **ໃຫຍ່ຂຶ້ນ ມ່ວນຂຶ້ນ**',
                '📋 16 ຂໍ້ ກົດເລືອກ + ✍️ ຄວາມເຫັນ · ⏱️ **~2 ນາທີ**',
                '',
                '👇 ກົດປຸ່ມລຸ່ມນີ້ ຕອບໃນ DM ນີ້ໄດ້ເລີຍ',
              ].join('\n'))
              .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('ps:start').setStyle(ButtonStyle.Danger).setLabel('📝 ເລີ່ມຕອບ (~2 ນາທີ)'),
              new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(msg.url).setLabel('ເບິ່ງໃນເຊີບເວີ'),
            );
            const ok = mem && await mem.send({ embeds: [e], components: [row] }).then(() => true).catch(() => false);
            (ok ? res.ok : res.fail).push(name || u);
          }
          logTo(`📨 DM ແບບສອບຖາມຫຼັງງານ: ສົ່ງຖຶງ ${res.ok.length}/${uids.length}${res.fail.length ? ` · ສົ່ງບໍ່ໄດ້: ${res.fail.join(', ')}` : ''}`);
        }
        return { url: msg.url, dm: res };
      },
      results() {
        const label = (q, v) => ((q.o.find((x) => x[0] === v) || [, v])[1]);
        const tally = {};
        for (const q of ALL_QS) {
          tally[q.q] = {};
          for (const r of Object.values(db.responses)) { const l = label(q, r.answers[q.id]); tally[q.q][l] = (tally[q.q][l] || 0) + 1; }
        }
        return { answered: count(), total: db.targets.length, waiting: db.targets.filter((u) => !db.responses[u]), tally, responses: db.responses };
      },
    };

    client.on(Events.InteractionCreate, async (i) => {
      try {
        if (!i.customId || !i.customId.startsWith('ps:')) return;
        const uid = i.user.id;
        if (i.isButton() && i.customId === 'ps:start') {
          if (db.responses[uid]) return i.reply({ content: '✅ ຕອບແລ້ວເດີ້ — ຂອບໃຈຫຼາຍໆ 💛', flags: MessageFlags.Ephemeral });
          if (!draft.has(uid)) draft.set(uid, { page: 0, a: {} });
          draft.get(uid).page = 0;
          return i.reply({ ...pageMessage(uid), flags: MessageFlags.Ephemeral });
        }
        if (!draft.has(uid)) {
          if (db.responses[uid]) return i.reply({ content: '✅ ຕອບແລ້ວເດີ້ — ຂອບໃຈຫຼາຍໆ 💛', flags: MessageFlags.Ephemeral });
          return i.reply({ content: '⏳ ໝົດເວລາ — ກົດ 📝 ເລີ່ມຕອບ ໃໝ່ອີກຄັ້ງເດີ້', flags: MessageFlags.Ephemeral });
        }
        const d = draft.get(uid);
        if (i.isStringSelectMenu() && i.customId.startsWith('ps:sel:')) { d.a[i.customId.slice(7)] = i.values[0]; return i.update(pageMessage(uid)); }
        if (i.isButton() && i.customId === 'ps:back') { d.page = Math.max(0, d.page - 1); return i.update(pageMessage(uid)); }
        if (i.isButton() && i.customId === 'ps:next') {
          if (d.page < PAGES.length - 1) { d.page += 1; return i.update(pageMessage(uid)); }
          const modal = new ModalBuilder().setCustomId('ps:modal').setTitle('✍️ ຄວາມເຫັນ (ບໍ່ບັງຄັບ)');
          modal.addComponents(...TEXTS.map((t) => new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId(t.id).setLabel(t.label).setPlaceholder(t.ph).setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000),
          )));
          return i.showModal(modal);
        }
        if (i.isButton() && i.customId === 'ps:send') {
          await finish(i, {});
          return i.update({ content: thanks, embeds: [], components: [] });
        }
        if (i.isModalSubmit() && i.customId === 'ps:modal') {
          const texts = Object.fromEntries(TEXTS.map((t) => [t.id, i.fields.getTextInputValue(t.id) || '']));
          await finish(i, texts);
          return i.reply({ content: thanks, flags: MessageFlags.Ephemeral });
        }
      } catch (e) {
        console.error('[post-survey]', e.message);
        if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: '⚠️ ມີບັນຫາ ລອງໃໝ່ອີກຄັ້ງເດີ້', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    });
  },
};
