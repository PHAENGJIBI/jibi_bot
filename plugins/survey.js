// ปลั๊กอิน: แบบสอบถามนักแข่ง — ห้อง 📝・ແບບສອບຖາມ-ນັກແຂ່ງ (เห็นเฉพาะยศ 🎯 ນັກແຂ່ງ)
// กดปุ่ม → 3 หน้าเลือกดาว/ตัวเลือก (ข้อความลับ เห็นคนเดียว) → กล่องพิมพ์ความเห็น → บันทึก data/survey.json
// คนละ 1 ครั้ง · แอดมินดูผลใน JIBI Hub (แท็บ 🏆 งานแข่ง)
const {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, MessageFlags,
} = require('discord.js');
const store = require('../lib/store');

const SURVEY = 'VALORANT DEATHMATCH MINI CUP #1';
const STARS = [
  [1, '⭐ 1 · ບໍ່ດີ'], [2, '⭐⭐ 2 · ພໍໃຊ້'], [3, '⭐⭐⭐ 3 · ປານກາງ'], [4, '⭐⭐⭐⭐ 4 · ດີ'], [5, '⭐⭐⭐⭐⭐ 5 · ດີຫຼາຍ'],
];
const RATE = [
  { id: 'q1', q: 'ການເຂົ້າເຊີບເວີ Discord ແລະ ເລືອກເກມຕອນເຂົ້າ — ງ່າຍບໍ?' },
  { id: 'q2', q: 'ການຫາຫ້ອງ ແລະ ອ່ານຂໍ້ມູນງານແຂ່ງ — ຊັດເຈນບໍ?' },
  { id: 'q3', q: 'ການລົງທະບຽນ (ກົດປຸ່ມ, ກອກຂໍ້ມູນ) — ງ່າຍບໍ?' },
  { id: 'q4', q: 'ການແຈ້ງເຕືອນ ແລະ ຮູ້ວ່າຕ້ອງເອົາລະຫັດຢູ່ຫ້ອງ 🔑 — ຮູ້ທັນເວລາບໍ?' },
  { id: 'q5', q: 'ການເຂົ້າຫ້ອງ Custom ດ້ວຍລະຫັດ — ສະດວກບໍ?' },
  { id: 'q6', q: 'ກົດກະຕິກາ ແລະ ຄວາມຍຸຕິທຳ' },
  { id: 'q7', q: 'ຄວາມມ່ວນຂອງການແຂ່ງ (Deathmatch 3 ເກມ)' },
  { id: 'q8', q: 'ການດູແລຂອງແອດມິນລະຫວ່າງແຂ່ງ' },
  { id: 'q9', q: 'ການປະກາດຜົນ ແລະ ກາດຜົນການແຂ່ງ' },
  { id: 'q10', q: 'ຄະແນນລວມຂອງງານທັງໝົດ' },
];
const CHOICE = [
  { id: 'q11', q: 'ງານໜ້າຢາກຫຼິ້ນແບບໃດ?', opts: ['Deathmatch ຄືເກົ່າ', 'ທີມ 5v5', '1v1', 'ແບບອື່ນ'] },
  { id: 'q12', q: 'ເວລາທີ່ສະດວກ (ເລືອກໄດ້ຫຼາຍຂໍ້)', opts: ['ຄືນວັນສຸກ', 'ວັນເສົາ', 'ວັນອາທິດ', 'ຄືນວັນທຳມະດາ'], multi: true },
  { id: 'q13', q: 'ຈະມາແຂ່ງອີກບໍ?', opts: ['ມາແນ່ນອນ', 'ອາດຈະມາ', 'ບໍ່ມາ'] },
];
const TEXT = [
  { id: 'q14', q: 'ສິ່ງທີ່ມັກທີ່ສຸດໃນງານນີ້', req: true },
  { id: 'q15', q: 'ສິ່ງທີ່ຄວນປັບປຸງ / ບັນຫາທີ່ພົບ', ph: 'ເຊັ່ນ ເລື່ອງປືນ, ແຣງ, ການແຈ້ງເຕືອນ…', req: true },
  { id: 'q16', q: 'ຢາກໃຫ້ເພີ່ມຫຍັງ?', ph: 'ລາງວັນ, ເກມອື່ນ ເຊັ່ນ R.E.P.O., PEAK…', req: false },
  { id: 'q17', q: 'ຄຳເຫັນອື່ນໆ', req: false },
];
const PAGES = [RATE.slice(0, 5), RATE.slice(5, 10), CHOICE];
const isSurveyCh = (c) => c && c.type === ChannelType.GuildText && c.name.includes('ແບບສອບຖາມ');

module.exports = {
  id: 'survey',
  name: 'แบบสอบถามนักแข่ง',
  description: 'ห้อง 📝 ແບບສອບຖາມ-ນັກແຂ່ງ · กดปุ่ม → ให้ดาว + เลือกคำตอบ + พิมพ์ความเห็น · คนละครั้ง · ดูผลใน Hub',
  setup({ client, guild, logTo }) {
    const db = store.load('survey', { panels: {}, responses: {} });
    db.panels = db.panels || {}; db.responses = db.responses || {};
    const save = () => store.save('survey', db);
    const draft = new Map(); // uid → { page, a: {} }

    function panelMessage() {
      const n = Object.keys(db.responses).length;
      const embed = new EmbedBuilder()
        .setColor(0xFFC400)
        .setTitle(`📝 ແບບສອບຖາມນັກແຂ່ງ — ${SURVEY}`)
        .setDescription([
          'ຂອບໃຈທີ່ມາຮ່ວມງານແຂ່ງເດີ້ 💛',
          'ນ້ອງ JIBI ຂໍລົບກວນເວລາ **2–3 ນາທີ** ຊ່ວຍຕອບແບບສອບຖາມໜ່ອຍ ເພື່ອໃຫ້ງານແຂ່ງຄັ້ງໜ້າດີກວ່າເກົ່າ',
          '',
          '⭐ ໃຫ້ດາວ 10 ຂໍ້ · 🗳️ ເລືອກຄຳຕອບ 3 ຂໍ້ · ✍️ ພິມຄຳເຫັນ',
          '🔒 ຄຳຕອບເຫັນສະເພາະແອດມິນ · ຕອບໄດ້ຄົນລະ 1 ຄັ້ງ',
          '',
          `📊 ຕອບແລ້ວ: **${n}** ຄົນ`,
        ].join('\n'))
        .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('survey:start').setStyle(ButtonStyle.Secondary).setLabel('📝 ຕອບແບບສອບຖາມ'),
      );
      return { embeds: [embed], components: [row] };
    }

    function pageMessage(uid) {
      const d = draft.get(uid);
      const qs = PAGES[d.page];
      const rows = qs.map((x) => {
        const num = x.id.slice(1);
        const isChoice = !!x.opts;
        const m = new StringSelectMenuBuilder()
          .setCustomId(`survey:sel:${x.id}`)
          .setPlaceholder(`${num}. ${x.q}`.slice(0, 150))
          .setMinValues(1).setMaxValues(x.multi ? x.opts.length : 1)
          .addOptions(isChoice
            ? x.opts.map((o) => ({ label: `${num}. ${o}`, value: o, default: [].concat(d.a[x.id] || []).includes(o) }))
            : STARS.map(([v, l]) => ({ label: `${num}. ${l}`, value: String(v), default: d.a[x.id] === v })));
        return new ActionRowBuilder().addComponents(m);
      });
      const title = ['⭐ ໜ້າ 1/4 — ຕັ້ງແຕ່ເຂົ້າເຊີບເວີ ຈົນເຂົ້າຫ້ອງແຂ່ງ', '⭐ ໜ້າ 2/4 — ລະຫວ່າງແຂ່ງ ແລະ ຫຼັງແຂ່ງ', '🗳️ ໜ້າ 3/4 — ເລືອກຄຳຕອບ'][d.page];
      const embed = new EmbedBuilder().setColor(0xFFC400).setTitle(title)
        .setDescription(qs.map((x) => `**${x.id.slice(1)}.** ${x.q}${d.a[x.id] !== undefined ? ' ✅' : ''}`).join('\n')
          + (d.page < 2 ? '\n\n_ເລືອກຄົບທຸກຂໍ້ ແລ້ວຈະໄປໜ້າຕໍ່ໄປເອງ_' : ''));
      if (d.page === 2) {
        const done = CHOICE.every((x) => d.a[x.id] !== undefined);
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('survey:text').setStyle(ButtonStyle.Primary).setLabel('✍️ ໜ້າ 4/4 — ພິມຄຳເຫັນ').setDisabled(!done),
        ));
      }
      return { embeds: [embed], components: rows };
    }

    async function refreshPanels() {
      for (const ch of guild.channels.cache.filter(isSurveyCh).values()) {
        const id = db.panels[ch.id];
        const msg = id ? await ch.messages.fetch(id).catch(() => null) : null;
        if (msg) await msg.edit(panelMessage()).catch(() => {});
      }
    }

    client.jibiSurvey = {
      async post({ mentionIds = [], text } = {}) {
        const ch = guild.channels.cache.find(isSurveyCh);
        if (!ch) throw new Error('ບໍ່ພົບຫ້ອງ ແບບສອບຖາມ');
        const content = [mentionIds.map((x) => `<@${x}>`).join(' '), text].filter(Boolean).join('\n') || undefined;
        const msg = await ch.send({ content, ...panelMessage(), allowedMentions: { users: mentionIds } });
        db.panels[ch.id] = msg.id; save();
        return msg;
      },
      results: () => ({
        survey: SURVEY,
        questions: { rate: RATE, choice: CHOICE, text: TEXT },
        responses: Object.entries(db.responses).map(([uid, r]) => ({ uid, ...r })),
      }),
    };

    client.on(Events.InteractionCreate, async (i) => {
      try {
        if (!i.customId || !i.customId.startsWith('survey:')) return;
        const uid = i.user.id;
        if (i.isButton() && i.customId === 'survey:start') {
          if (db.responses[uid]) return i.reply({ content: '✅ ອ້າຍ/ເອື້ອຍ ຕອບແບບສອບຖາມແລ້ວ — ຂອບໃຈຫຼາຍໆເດີ້ 💛', flags: MessageFlags.Ephemeral });
          if (!draft.has(uid)) draft.set(uid, { page: 0, a: {} });
          draft.get(uid).page = Math.min(draft.get(uid).page, 2);
          return i.reply({ ...pageMessage(uid), flags: MessageFlags.Ephemeral });
        }
        const d = draft.get(uid);
        if (!d) return i.reply({ content: '⏳ ໝົດເວລາ — ກົດ 📝 ຕອບແບບສອບຖາມ ໃໝ່ອີກຄັ້ງເດີ້', flags: MessageFlags.Ephemeral });
        if (i.isStringSelectMenu() && i.customId.startsWith('survey:sel:')) {
          const qid = i.customId.slice('survey:sel:'.length);
          const c = CHOICE.find((x) => x.id === qid);
          d.a[qid] = c ? (c.multi ? i.values : i.values[0]) : parseInt(i.values[0], 10);
          if (d.page < 2 && PAGES[d.page].every((x) => d.a[x.id] !== undefined)) d.page += 1;
          return i.update(pageMessage(uid));
        }
        if (i.isButton() && i.customId === 'survey:text') {
          const modal = new ModalBuilder().setCustomId('survey:modal').setTitle('✍️ ຄຳເຫັນຂອງທ່ານ');
          for (const t of TEXT) {
            const inp = new TextInputBuilder().setCustomId(t.id).setLabel(`${t.id.slice(1)}. ${t.q}`.slice(0, 45))
              .setStyle(TextInputStyle.Paragraph).setRequired(t.req).setMaxLength(1000);
            if (t.ph) inp.setPlaceholder(t.ph);
            modal.addComponents(new ActionRowBuilder().addComponents(inp));
          }
          return i.showModal(modal);
        }
        if (i.isModalSubmit() && i.customId === 'survey:modal') {
          for (const t of TEXT) d.a[t.id] = i.fields.getTextInputValue(t.id) || '';
          const m = i.member;
          const gender = m && m.roles.cache.find((r) => r.name.includes('ຍິງ')) ? 'ເອື້ອຍ' : 'ອ້າຍ';
          db.responses[uid] = { name: (m && m.displayName) || i.user.username, at: new Date().toISOString(), answers: d.a };
          save(); draft.delete(uid);
          logTo(`📝 ${db.responses[uid].name} ຕອບແບບສອບຖາມແລ້ວ (ລວມ ${Object.keys(db.responses).length} ຄົນ) · ຄະແນນລວມ ${d.a.q10}/5`);
          await refreshPanels();
          return i.reply({ content: `💛 ຂອບໃຈຫຼາຍໆເດີ້${gender} — ນ້ອງ JIBI ຈະເອົາໄປປັບປຸງງານແຂ່ງຄັ້ງໜ້າໃຫ້ດີກວ່າເກົ່າ! 🎯`, flags: MessageFlags.Ephemeral });
        }
      } catch (e) {
        console.error('[survey]', e.message);
        if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: '⚠️ ມີບັນຫາ ລອງໃໝ່ອີກຄັ້ງເດີ້', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    });
  },
};
