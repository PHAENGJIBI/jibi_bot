// ปลั๊กอิน: SHOWMATCH 2v2 + ทายผลด้วยเครดิตจำลอง (ไม่ใช่เงินจริง)
// /showmatch → สุ่มนักแข่ง 4 คน (หรือแอดมินเลือกเอง) แล้วจัดทีมให้แรงค์สูสีที่สุด (สูงสุดคู่กับต่ำสุด)
// คนที่ไม่ได้ลงเล่นกด 🔴/🔵 เพื่อทายผล · ทุกคนเริ่มที่ 10,000 เครดิต · ขั้นต่ำ 1,000
// แอดมินกด 🔒 ปิดรับ → 🏆 ทีมที่ชนะ → แบ่งกองกลางให้ฝั่งที่ทายถูกตามสัดส่วน
const {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, MessageFlags, SlashCommandBuilder, PermissionFlagsBits, ChannelType,
} = require('discord.js');
const store = require('../lib/store');

const START = 10000; // เครดิตเริ่มต้นต่อคน
const MIN = 1000; // ลงขั้นต่ำ (และต้องลงทีละ 1,000)
const HOUSE = 5000; // ร้าน (P SHOP) ใส่กองให้ฝั่งละเท่านี้ — ถึงทุกคนเทฝั่งเดียว คนที่ทายถูกก็ยังได้กำไร (แต่น้อยลง)
const RANK_VALUE = { Iron: 1, Bronze: 2, Silver: 3, Gold: 4, Platinum: 5, Diamond: 6, Ascendant: 7, Immortal: 8, Radiant: 9 };
const RANK_EMOJI = { Iron: '⚫', Bronze: '🟤', Silver: '⚪', Gold: '🟡', Platinum: '🔷', Diamond: '💎', Ascendant: '🟢', Immortal: '🔴', Radiant: '🌟' };
const BET_CH = 'ທາຍຜົນ-showmatch';
const LB_CH = 'ເຄຣດິດ-showmatch';
const fmt = (n) => Number(n).toLocaleString('en-US');

function rankOf(rankStr) {
  const k = Object.keys(RANK_VALUE).find((x) => String(rankStr || '').startsWith(x));
  return k ? { name: k, value: RANK_VALUE[k], emoji: RANK_EMOJI[k] } : { name: 'Unrated', value: 3, emoji: '🏅' };
}

// จัด 4 คนเป็น 2 ทีมให้ผลรวมแรงค์ใกล้กันที่สุด — เท่ากันให้เลือกแบบ "สูงสุด+ต่ำสุด"
function balance(players) {
  const s = [...players].sort((a, b) => b.rank.value - a.rank.value);
  const [a, b, c, d] = s;
  const splits = [[[a, d], [b, c]], [[a, c], [b, d]], [[a, b], [c, d]]];
  const sum = (t) => t.reduce((x, p) => x + p.rank.value, 0);
  let best = splits[0];
  for (const sp of splits) if (Math.abs(sum(sp[0]) - sum(sp[1])) < Math.abs(sum(best[0]) - sum(best[1]))) best = sp;
  return { A: best[0], B: best[1], sumA: sum(best[0]), sumB: sum(best[1]) };
}

module.exports = {
  id: 'showmatch',
  name: 'SHOWMATCH 2v2 + ทายผล (เครดิตจำลอง)',
  description: '/showmatch จัดทีม 2v2 แรงค์สูสี · คนดูทายผลด้วยเครดิตจำลอง 10,000 (ขั้นต่ำ 1,000) · ไม่ใช่เงินจริง',
  commands: [
    new SlashCommandBuilder().setName('showmatch').setDescription('ເປີດ SHOWMATCH 2v2 + ທາຍຜົນ (ແອດມິນ)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addUserOption((o) => o.setName('p1').setDescription('ຜູ້ຫຼິ້ນ 1 (ບໍ່ໃສ່ = ສຸ່ມຈາກນັກແຂ່ງ)'))
      .addUserOption((o) => o.setName('p2').setDescription('ຜູ້ຫຼິ້ນ 2'))
      .addUserOption((o) => o.setName('p3').setDescription('ຜູ້ຫຼິ້ນ 3'))
      .addUserOption((o) => o.setName('p4').setDescription('ຜູ້ຫຼິ້ນ 4')),
  ],
  setup({ client, guild, logTo }) {
    const db = store.load('showmatch', { balances: {}, match: null, no: 0, lbMsg: null });
    const save = () => store.save('showmatch', db);
    const bal = (uid) => (db.balances[uid] === undefined ? START : db.balances[uid]);
    const findCh = (part) => guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name.includes(part));
    const isAdmin = (m) => m && m.permissions.has(PermissionFlagsBits.ManageGuild);

    function pools(m) {
      const p = { A: 0, B: 0, nA: 0, nB: 0 };
      for (const b of Object.values(m.bets)) { p[b.team] += b.amount; p[`n${b.team}`] += 1; }
      return p;
    }
    // ได้คืนเท่าไหร่ ถ้าลง x ฝั่ง side แล้วฝั่งนั้นชนะ (กองแต่ละฝั่ง = คนลง + ร้าน HOUSE)
    const payout = (x, mine, other) => x + Math.floor((x / (mine + HOUSE + x)) * (other + HOUSE));
    const preview = (p, side) => {
      const mine = side === 'A' ? p.A : p.B; const other = side === 'A' ? p.B : p.A;
      return [1000, 2000, 3000, 5000].map((x) => `ລົງ ${fmt(x)} → ໄດ້ຄືນ **${fmt(payout(x, mine, other))}**`).join('\n');
    };

    function teamText(team) {
      return team.map((p) => `${p.rank.emoji} ${p.name ? `**${p.name}**` : `<@${p.id}>`} · ${p.rank.name}`).join('\n');
    }
    function card(m) {
      const p = pools(m);
      const status = { open: '🟢 ເປີດຮັບທາຍຜົນ', locked: '🔒 ປິດຮັບແລ້ວ — ກຳລັງແຂ່ງ', done: '🏁 ຈົບແລ້ວ', cancel: '↩️ ຍົກເລີກ — ຄືນເຄຣດິດແລ້ວ' }[m.status];
      const e = new EmbedBuilder().setColor(m.status === 'done' ? 0xF2C14E : 0xFF4655)
        .setTitle(`⚔️ SHOWMATCH ${m.A.length}v${m.B.length} #${m.no}`)
        .setDescription([
          `**${status}**`,
          m.winner ? `🏆 **ທີມ ${m.winner === 'A' ? '🔴 A' : '🔵 B'} ຊະນະ!**` : null,
          '',
          m.demo ? '🧪 **ແມັດທົດລອງ** — ຜູ້ຫຼິ້ນເປັນຊື່ສົມມຸດ' : null,
          `💰 ທຸກຄົນມີ **${fmt(START)} ເຄຣດິດ** · ລົງຂັ້ນຕ່ຳ **${fmt(MIN)}** · ຄົນທີ່ລົງຫຼິ້ນທາຍບໍ່ໄດ້`,
          `🏪 P SHOP ໃສ່ກອງໃຫ້ **ຝັ່ງລະ ${fmt(HOUSE)}** — ທຸກຄົນລົງຝັ່ງດຽວກັນ ກໍ່ຍັງໄດ້ກຳໄລ (ແຕ່ໜ້ອຍລົງ)`,
          '🎮 ເຄຣດິດຈຳລອງ ຫຼິ້ນມ່ວນໆ — ບໍ່ແມ່ນເງິນຈິງ',
        ].filter((x) => x !== null).join('\n'))
        .addFields(
          { name: `🔴 ທີມ A · ແຣງລວມ ${m.sumA}`, value: teamText(m.A), inline: true },
          { name: `🔵 ທີມ B · ແຣງລວມ ${m.sumB}`, value: teamText(m.B), inline: true },
          { name: '​', value: '​', inline: false },
          { name: '🔴 ກອງ A', value: `ຄົນລົງ ${fmt(p.A)} (${p.nA} ຄົນ)\n+ ຮ້ານ ${fmt(HOUSE)} = **${fmt(p.A + HOUSE)}**`, inline: true },
          { name: '🔵 ກອງ B', value: `ຄົນລົງ ${fmt(p.B)} (${p.nB} ຄົນ)\n+ ຮ້ານ ${fmt(HOUSE)} = **${fmt(p.B + HOUSE)}**`, inline: true },
          { name: '\u200b', value: '\u200b', inline: false },
          { name: '🧮 ຖ້າລົງ 🔴 A ຕອນນີ້ ແລ້ວ A ຊະນະ', value: preview(p, 'A'), inline: true },
          { name: '🧮 ຖ້າລົງ 🔵 B ຕອນນີ້ ແລ້ວ B ຊະນະ', value: preview(p, 'B'), inline: true },
          { name: '📌 ໝາຍເຫດ', value: 'ຕົວເລກປ່ຽນຕາມຄົນລົງ — ຝັ່ງທີ່ຄົນລົງໜ້ອຍ ຈະໄດ້ຫຼາຍກວ່າ · ທາຍຜິດ = ເສຍທີ່ລົງ' },
        )
        .setFooter({ text: 'ຈ່າຍ = ກອງຝັ່ງແພ້ (ລວມຂອງຮ້ານ) ແບ່ງໃຫ້ຝັ່ງທີ່ທາຍຖືກ ຕາມສັດສ່ວນ · ເຄຣດິດຈຳລອງ · JIBI' });
      const rows = [];
      if (m.status === 'open') {
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('sm:bet:A').setStyle(ButtonStyle.Danger).setLabel('🔴 ລົງທີມ A'),
          new ButtonBuilder().setCustomId('sm:bet:B').setStyle(ButtonStyle.Primary).setLabel('🔵 ລົງທີມ B'),
          new ButtonBuilder().setCustomId('sm:me').setStyle(ButtonStyle.Secondary).setLabel('💰 ເຄຣດິດ & ລາງວັນຂອງຂ້ອຍ'),
        ));
      }
      if (m.status === 'open' || m.status === 'locked') {
        rows.push(new ActionRowBuilder().addComponents(
          ...(m.status === 'open' ? [new ButtonBuilder().setCustomId('sm:lock').setStyle(ButtonStyle.Secondary).setLabel('🔒 ປິດຮັບ (ແອດມິນ)')] : []),
          new ButtonBuilder().setCustomId('sm:win:A').setStyle(ButtonStyle.Secondary).setLabel('🏆 A ຊະນະ'),
          new ButtonBuilder().setCustomId('sm:win:B').setStyle(ButtonStyle.Secondary).setLabel('🏆 B ຊະນະ'),
          new ButtonBuilder().setCustomId('sm:cancel').setStyle(ButtonStyle.Secondary).setLabel('↩️ ຍົກເລີກ'),
        ));
      }
      return { embeds: [e], components: rows, allowedMentions: { parse: [] } };
    }
    async function refresh() {
      const m = db.match; if (!m) return;
      const ch = await guild.channels.fetch(m.chId).catch(() => null);
      const msg = ch && await ch.messages.fetch(m.msgId).catch(() => null);
      if (msg) await msg.edit(card(m)).catch(() => {});
    }
    async function leaderboard() {
      const ch = findCh(LB_CH); if (!ch) return;
      const top = Object.entries(db.balances).sort((a, b) => b[1] - a[1]).slice(0, 15);
      const medal = ['🥇', '🥈', '🥉'];
      const e = new EmbedBuilder().setColor(0xF2C14E).setTitle('💰 ອັນດັບເຄຣດິດ — SHOWMATCH')
        .setDescription(top.length ? top.map(([id, v], k) => `${medal[k] || `**${k + 1}.**`} <@${id}> · **${fmt(v)}**`).join('\n') : 'ຍັງບໍ່ມີໃຜທາຍຜົນ')
        .setFooter({ text: `ທຸກຄົນເລີ່ມ ${fmt(START)} ເຄຣດິດ · ເຄຣດິດຈຳລອງ ບໍ່ແມ່ນເງິນຈິງ` });
      const old = db.lbMsg && await ch.messages.fetch(db.lbMsg).catch(() => null);
      if (old) await old.edit({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
      else { const msg = await ch.send({ embeds: [e], allowedMentions: { parse: [] } }); db.lbMsg = msg.id; save(); }
    }

    async function startMatch(i) {
      if (db.match && ['open', 'locked'].includes(db.match.status)) throw new Error('ຍັງມີ SHOWMATCH ທີ່ບໍ່ທັນຈົບ — ກົດ 🏆 ຫຼື ↩️ ກ່ອນ');
      const regs = store.load('tourney-regs', { players: {} }).players || {};
      let ids = ['p1', 'p2', 'p3', 'p4'].map((k) => i.options.getUser(k)).filter(Boolean).map((u) => u.id);
      ids = [...new Set(ids)];
      if (ids.length && ids.length !== 4) throw new Error('ເລືອກຜູ້ຫຼິ້ນໃຫ້ຄົບ 4 ຄົນ ຫຼື ບໍ່ເລືອກເລີຍ (ສຸ່ມ)');
      if (!ids.length) {
        const pool = Object.keys(regs);
        if (pool.length < 4) throw new Error(`ນັກແຂ່ງທີ່ລົງທະບຽນມີ ${pool.length} ຄົນ — ຕ້ອງມີຢ່າງໜ້ອຍ 4 ຄົນ`);
        for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
        ids = pool.slice(0, 4);
      }
      const players = ids.map((id) => ({ id, rank: rankOf(regs[id] && regs[id].rank) }));
      const t = balance(players);
      const ch = findCh(BET_CH) || i.channel;
      db.no = (db.no || 0) + 1;
      db.match = { no: db.no, A: t.A, B: t.B, sumA: t.sumA, sumB: t.sumB, players: ids, bets: {}, status: 'open', chId: ch.id };
      const msg = await ch.send({ content: `⚔️ **SHOWMATCH 2v2 #${db.no}** ${ids.map((x) => `<@${x}>`).join(' ')}`, ...card(db.match), allowedMentions: { users: ids } });
      db.match.msgId = msg.id; save();
      logTo(`⚔️ ເປີດ SHOWMATCH #${db.no}: A(${t.sumA}) vs B(${t.sumB})`);
      return msg;
    }

    async function settle(winner, byName) {
      const m = db.match; const p = pools(m);
      const winPool = p[winner]; const losePool = p[winner === 'A' ? 'B' : 'A'];
      const lines = [];
      for (const [uid, b] of Object.entries(m.bets)) {
        let get = 0;
        if (b.team === winner) get = b.amount + Math.floor((b.amount / (winPool + HOUSE)) * (losePool + HOUSE));
        db.balances[uid] = bal(uid) + get;
        lines.push(b.team === winner ? `✅ <@${uid}> ລົງ ${fmt(b.amount)} → ໄດ້ຄືນ **${fmt(get)}** (ກຳໄລ +${fmt(get - b.amount)})` : `❌ <@${uid}> ລົງ ${fmt(b.amount)} → ເສຍ`);
      }
      m.status = 'done'; m.winner = winner; save();
      await refresh(); await leaderboard();
      const ch = await guild.channels.fetch(m.chId).catch(() => null);
      if (ch) await ch.send({ embeds: [new EmbedBuilder().setColor(0xF2C14E).setTitle(`🏆 SHOWMATCH #${m.no} — ທີມ ${winner === 'A' ? '🔴 A' : '🔵 B'} ຊະນະ!`)
        .setDescription(lines.join('\n') || 'ບໍ່ມີໃຜທາຍຜົນ').setFooter({ text: `ຕັດສິນໂດຍ ${byName}` })], allowedMentions: { parse: [] } });
      logTo(`🏆 SHOWMATCH #${m.no}: ${winner} ຊະນະ (ໂດຍ ${byName})`);
    }

    // แมตช์ทดลอง (ผู้เล่นชื่อสมมุติ) — เรียกจาก bridge: { action: 'showmatch-demo', players: [{name, rank}] }
    // ล้างข้อมูลทดลอง: เครดิตทุกคนกลับไปเริ่มใหม่ · ไม่มีแมตช์ค้าง
    client.jibiShowmatchReset = () => { db.balances = {}; db.match = null; db.no = 0; db.lbMsg = null; save(); return 'reset'; };
    client.jibiShowmatchDemo = async (list) => {
      if (db.match && ['open', 'locked'].includes(db.match.status)) throw new Error('ຍັງມີ SHOWMATCH ທີ່ບໍ່ທັນຈົບ');
      const players = list.slice(0, 4).map((p, k) => ({ id: `demo${k + 1}`, name: p.name, rank: rankOf(p.rank) }));
      const t = balance(players);
      const ch = findCh(BET_CH);
      if (!ch) throw new Error('ບໍ່ພົບຫ້ອງທາຍຜົນ');
      db.no = (db.no || 0) + 1;
      db.match = { no: db.no, demo: true, A: t.A, B: t.B, sumA: t.sumA, sumB: t.sumB, players: players.map((p) => p.id), bets: {}, status: 'open', chId: ch.id };
      const msg = await ch.send({ content: `⚔️ **SHOWMATCH 2v2 #${db.no}** 🧪 ແມັດທົດລອງ`, ...card(db.match) });
      db.match.msgId = msg.id; save();
      return msg.url;
    };
    // แมตช์กำหนดเอง (1v1 / 2v2 ...) — bridge: { action: 'showmatch-custom', A: ['ชื่อ'], B: ['ชื่อ'] }
    // ชื่อตรงกับนักแข่ง (ชื่อ / Riot ID / ชื่อ Discord) → ผูกกับคนนั้น (ทายผลไม่ได้ + ใช้แรงค์จากใบสมัคร)
    client.jibiShowmatchRelink = (name, uid) => {
      const m = db.match; if (!m) return false;
      let hit = false;
      for (const t of [m.A, m.B]) for (const p of t) if (!/^\d+$/.test(p.id) && String(p.name).toLowerCase() === String(name).toLowerCase()) { m.players = m.players.map((x) => (x === p.id ? uid : x)); p.id = uid; hit = true; }
      if (hit) { if (m.bets[uid]) { db.balances[uid] = bal(uid) + m.bets[uid].amount; delete m.bets[uid]; } save(); refresh(); }
      return hit;
    };
    client.jibiShowmatchCustom = async ({ A = [], B = [] } = {}) => {
      if (db.match && ['open', 'locked'].includes(db.match.status)) throw new Error('ຍັງມີ SHOWMATCH ທີ່ບໍ່ທັນຈົບ — ກົດ 🏆 ຫຼື ↩️ ກ່ອນ');
      if (!A.length || !B.length) throw new Error('ຕ້ອງມີຜູ້ຫຼິ້ນທັງ 2 ຝັ່ງ');
      const regs = store.load('tourney-regs', { players: {} }).players || {};
      await guild.members.fetch().catch(() => {});
      const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9\u0e80-\u0eff]/g, '');
      let k = 0;
      const resolve = (name) => {
        const n = norm(name);
        let id = Object.keys(regs).find((u) => [regs[u].name, String(regs[u].riot || '').split('#')[0]].some((v) => v && norm(v) && (n.includes(norm(v)) || norm(v).includes(n))));
        if (!id) { const m = guild.members.cache.find((x) => [x.displayName, x.user.username, x.user.globalName].some((v) => v && norm(v) === n)); if (m) id = m.id; }
        k += 1;
        return { id: id || `x${k}`, name, rank: rankOf(id && regs[id] ? regs[id].rank : null) };
      };
      const tA = A.map(resolve); const tB = B.map(resolve);
      const sum = (t) => t.reduce((x, p) => x + p.rank.value, 0);
      const ch = findCh(BET_CH);
      if (!ch) throw new Error('ບໍ່ພົບຫ້ອງທາຍຜົນ');
      db.no = (db.no || 0) + 1;
      const ids = [...tA, ...tB].map((p) => p.id);
      db.match = { no: db.no, A: tA, B: tB, sumA: sum(tA), sumB: sum(tB), players: ids, bets: {}, status: 'open', chId: ch.id };
      const real = ids.filter((x) => /^\d+$/.test(x));
      const vs = `${tA.map((p) => p.name).join(' + ')} 🆚 ${tB.map((p) => p.name).join(' + ')}`;
      const msg = await ch.send({ content: `⚔️ **SHOWMATCH ${tA.length}v${tB.length} #${db.no}** · ${vs}${real.length ? `\n${real.map((x) => `<@${x}>`).join(' ')}` : ''}`, ...card(db.match), allowedMentions: { users: real } });
      db.match.msgId = msg.id; save();
      logTo(`⚔️ ເປີດ SHOWMATCH #${db.no}: ${vs}`);
      return { url: msg.url, A: tA, B: tB };
    };
    client.on(Events.InteractionCreate, async (i) => {
      try {
        if (i.isChatInputCommand() && i.commandName === 'showmatch') {
          await i.deferReply({ flags: MessageFlags.Ephemeral });
          const msg = await startMatch(i);
          return i.editReply(`✅ ເປີດ SHOWMATCH ແລ້ວ — ${msg.url}`);
        }
        if (!(i.isButton() || i.isModalSubmit()) || !i.customId.startsWith('sm:')) return;
        const m = db.match;
        if (!m) return i.reply({ content: 'ຍັງບໍ່ມີ SHOWMATCH', flags: MessageFlags.Ephemeral });
        const [, act, team] = i.customId.split(':');

        if (act === 'me') {
          const b = m.bets[i.user.id]; const have = bal(i.user.id); const pp = pools(m);
          const side = (t) => ({ mine: t === 'A' ? pp.A : pp.B, other: t === 'A' ? pp.B : pp.A });
          const tn = (t) => (t === 'A' ? '🔴 A' : '🔵 B');
          const e = new EmbedBuilder().setColor(0xF2C14E).setTitle(`💰 ເຄຣດິດ & ລາງວັນຂອງເຈົ້າ — SHOWMATCH #${m.no}`)
            .addFields({ name: '💳 ເຄຣດິດຄົງເຫຼືອ', value: `**${fmt(have)}**`, inline: true });
          if (b) {
            const { mine, other } = side(b.team);
            const win = b.amount + Math.floor((b.amount / (mine + HOUSE)) * (other + HOUSE));
            e.addFields(
              { name: '🎲 ລົງໄວ້', value: `ທີມ ${tn(b.team)} · **${fmt(b.amount)}**`, inline: true },
              { name: '\u200b', value: '\u200b', inline: false },
              { name: `🏆 ຖ້າທີມ ${tn(b.team)} ຊະນະ`, value: `ໄດ້ຄືນ **${fmt(win)}**\nກຳໄລ **+${fmt(win - b.amount)}**\nເຄຣດິດຫຼັງຈົບ **${fmt(have + win)}**`, inline: true },
              { name: `💀 ຖ້າທີມ ${tn(b.team)} ແພ້`, value: `ເສຍ **${fmt(b.amount)}**\nເຄຣດິດຫຼັງຈົບ **${fmt(have)}**`, inline: true },
            );
            if (m.status === 'open' && have >= MIN) {
              const more = [1000, 2000, 3000].filter((x) => x <= have).map((x) => {
                const tot = b.amount + x; const w = tot + Math.floor((tot / (mine + x + HOUSE)) * (other + HOUSE));
                return `ເພີ່ມ ${fmt(x)} (ລວມ ${fmt(tot)}) → ໄດ້ຄືນ **${fmt(w)}**`;
              });
              if (more.length) e.addFields({ name: `➕ ຖ້າເພີ່ມໃສ່ທີມ ${tn(b.team)}`, value: more.join('\n') });
            }
          } else if (m.status === 'open') {
            const amts = [...new Set([1000, 2000, 3000, have - (have % 1000)])].filter((x) => x >= MIN && x <= have);
            const tbl = (t) => { const { mine, other } = side(t); return amts.map((x) => `ລົງ ${fmt(x)}${x === have - (have % 1000) && x > 3000 ? ' (ໝົດໜ້າຕັກ)' : ''} → ໄດ້ຄືນ **${fmt(payout(x, mine, other))}**`).join('\n') || '—'; };
            e.addFields(
              { name: '🎲 ຍັງບໍ່ໄດ້ລົງ', value: 'ກົດ 🔴 ຫຼື 🔵 ເພື່ອລົງ', inline: true },
              { name: '\u200b', value: '\u200b', inline: false },
              { name: '🧮 ຖ້າລົງ 🔴 A ແລ້ວ A ຊະນະ', value: tbl('A'), inline: true },
              { name: '🧮 ຖ້າລົງ 🔵 B ແລ້ວ B ຊະນະ', value: tbl('B'), inline: true },
            );
          }
          e.setFooter({ text: 'ຕົວເລກຄິດຈາກກອງຕອນນີ້ — ປ່ຽນໄດ້ຖ້າມີຄົນລົງເພີ່ມ · ທາຍຜິດ = ເສຍທີ່ລົງ · ເຄຣດິດຈຳລອງ' });
          return i.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
        }
        if (act === 'bet' && i.isButton()) {
          if (m.status !== 'open') return i.reply({ content: '🔒 ປິດຮັບທາຍຜົນແລ້ວ', flags: MessageFlags.Ephemeral });
          if (m.players.includes(i.user.id)) return i.reply({ content: '🎮 ເຈົ້າເປັນຜູ້ຫຼິ້ນໃນແມັດນີ້ — ທາຍຜົນບໍ່ໄດ້', flags: MessageFlags.Ephemeral });
          const had = m.bets[i.user.id];
          if (had && had.team !== team) return i.reply({ content: `ເຈົ້າລົງທີມ ${had.team} ໄປແລ້ວ — ປ່ຽນທີມບໍ່ໄດ້ (ເພີ່ມໄດ້ສະເພາະທີມເດີມ)`, flags: MessageFlags.Ephemeral });
          if (bal(i.user.id) < MIN) return i.reply({ content: `💸 ເຄຣດິດເຫຼືອ ${fmt(bal(i.user.id))} — ບໍ່ພໍລົງຂັ້ນຕ່ຳ ${fmt(MIN)}`, flags: MessageFlags.Ephemeral });
          const modal = new ModalBuilder().setCustomId(`sm:modal:${team}`).setTitle(`ລົງທີມ ${team === 'A' ? '🔴 A' : '🔵 B'} · ມີ ${fmt(bal(i.user.id))}`);
          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel(`ຈຳນວນ (ຂັ້ນຕ່ຳ ${fmt(MIN)} · ທີລະ 1,000)`).setStyle(TextInputStyle.Short).setPlaceholder('ເຊັ່ນ: 3000').setRequired(true).setMaxLength(7)));
          return i.showModal(modal);
        }
        if (act === 'modal' && i.isModalSubmit()) {
          if (m.status !== 'open') return i.reply({ content: '🔒 ປິດຮັບທາຍຜົນແລ້ວ', flags: MessageFlags.Ephemeral });
          const amount = parseInt(String(i.fields.getTextInputValue('amount')).replace(/[^\d]/g, ''), 10);
          if (!amount || amount < MIN || amount % 1000) return i.reply({ content: `❌ ໃສ່ຈຳນວນຢ່າງໜ້ອຍ ${fmt(MIN)} ແລະ ເປັນທີລະ 1,000`, flags: MessageFlags.Ephemeral });
          if (amount > bal(i.user.id)) return i.reply({ content: `❌ ເຄຣດິດບໍ່ພໍ — ມີ ${fmt(bal(i.user.id))}`, flags: MessageFlags.Ephemeral });
          const had = m.bets[i.user.id];
          if (had && had.team !== team) return i.reply({ content: 'ປ່ຽນທີມບໍ່ໄດ້', flags: MessageFlags.Ephemeral });
          db.balances[i.user.id] = bal(i.user.id) - amount;
          m.bets[i.user.id] = { team, amount: (had ? had.amount : 0) + amount }; save();
          await refresh();
          const pp = pools(m); const mine = m.bets[i.user.id].amount;
          const est = mine + Math.floor((mine / ((team === 'A' ? pp.A : pp.B) + HOUSE)) * ((team === 'A' ? pp.B : pp.A) + HOUSE));
          return i.reply({ content: `✅ ລົງທີມ ${team === 'A' ? '🔴 A' : '🔵 B'} ລວມ **${fmt(mine)}** · ເຫຼືອ ${fmt(bal(i.user.id))}\n🧮 ຖ້າທີມ ${team} ຊະນະ (ຕອນນີ້) ຈະໄດ້ຄືນ ~**${fmt(est)}** (ກຳໄລ +${fmt(est - mine)}) — ຕົວເລກປ່ຽນຕາມຄົນລົງ`, flags: MessageFlags.Ephemeral });
        }
        // ปุ่มแอดมิน
        if (['lock', 'win', 'cancel'].includes(act)) {
          if (!isAdmin(i.member)) return i.reply({ content: '⛔ ສະເພາະແອດມິນ', flags: MessageFlags.Ephemeral });
          if (!['open', 'locked'].includes(m.status)) return i.reply({ content: 'ແມັດນີ້ຈົບແລ້ວ', flags: MessageFlags.Ephemeral });
          await i.deferUpdate();
          if (act === 'lock') { m.status = 'locked'; save(); await refresh(); logTo(`🔒 ປິດຮັບທາຍຜົນ SHOWMATCH #${m.no}`); return null; }
          if (act === 'win') return settle(team, i.user.username);
          if (act === 'cancel') {
            for (const [uid, b] of Object.entries(m.bets)) db.balances[uid] = bal(uid) + b.amount;
            m.status = 'cancel'; save(); await refresh(); await leaderboard();
            logTo(`↩️ ຍົກເລີກ SHOWMATCH #${m.no} — ຄືນເຄຣດິດແລ້ວ`); return null;
          }
        }
        return null;
      } catch (e) {
        console.error(`[showmatch] ${e.message}`);
        if (i.deferred) return i.editReply(`❌ ${e.message}`).catch(() => {});
        if (i.isRepliable() && !i.replied) return i.reply({ content: `❌ ${e.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        return null;
      }
    });
  },
};
