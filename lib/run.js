// 🎮 ຣັນງານແຂ່ງ — ຕົວຄວບຄຸມງານແຂ່ງແບບແມນນວລ (ໃຊ້ໃນ JIBI Hub ແຖບ "รันงานแข่ง")
// ບໍ່ຕ້ອງໃຊ້ AI: ຕາຕະລາງເວລາ · ເຊັກຊື່ · ສົ່ງລະຫັດ · ປຸ່ມສົ່ງຂໍ້ຄວາມດ່ວນ · ຈົດຄະແນນ · ປະກາດຜົນ
// ຂໍ້ມູນເກັບໃນ data/run-state.json
const { EmbedBuilder } = require('discord.js');
const store = require('./store');

const YELLOW = 0xFFC400;
const RED = 0xE5484D;
const GREEN = 0x3DD68C;
const FOOTER = 'JIBI · P SHOP GAMERPOWER';
const CH = {
  announce: '📢・ປະກາດ-βeta',
  code: '🔑・ລະຫັດຫ້ອງ-βeta',
  results: '🏆・ຜົນການແຂ່ງ-βeta',
  qa: '❓・ຖາມ-ຕອບ-βeta',
  reg: '📝・ລົງທະບຽນ-βeta',
  rules: '📜・ກົດກະຕິກາ-βeta',
  world: '🌏・ແຊັດໂລກ',
  valchat: '💬・ຫ້ອງແຊັດ（valorant）',
  voice: '🔊 βETA TOURNAMENT',
};
const ROLE_PLAYER = '🎯 ນັກແຂ່ງ';
const ROLE_VALO = 'Valorant';
const MEDAL = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

const blank = () => ({ done: {}, checkin: {}, scores: {}, games: {}, log: [] });

// ຕາຕະລາງວຽກ (ພາສາລາວ) — act = ປຸ່ມທີ່ກົດໄດ້ຢູ່ແຖວນັ້ນ
const TIMELINE = [
  { id: 'd1-check', day: 'D-1', time: '18:00', title: 'ກວດລາຍຊື່ນັກແຂ່ງ', desc: 'ເບິ່ງວ່າຄົບ 10 ຄົນບໍ່ · ໃຜເປັນຕົວສຳຮອງ · Riot ID ຖືກບໍ່', go: 'roster' },
  { id: 'd1-post', day: 'D-1', time: '20:00', title: 'ໂພສ "ພຣຸ່ງນີ້ແຂ່ງແລ້ວ"', desc: 'ປະກາດ-βeta + ແຊັດໂລກ (ແທັກ Valorant)', act: 'd1' },
  { id: 'prep', day: 'D-DAY', time: '18:30', title: 'ກຽມເຄື່ອງ', desc: 'ເປີດ Valorant · ກຽມ Custom Deathmatch · OBS/ສະຕຣີມ · ເປີດ Hub ນີ້ໄວ້' },
  { id: 'remind60', day: 'D-DAY', time: '19:00', title: 'ແຈ້ງເຕືອນ 1 ຊົ່ວໂມງ + ເປີດເຊັກຊື່', desc: 'JIBI ສົ່ງເຕືອນອັດຕະໂນມັດ · ກົດປຸ່ມເພື່ອເອີ້ນນັກແຂ່ງເຂົ້າ Voice', act: 'checkin' },
  { id: 'checkin', day: 'D-DAY', time: '19:30', title: 'ເຊັກຊື່ນັກແຂ່ງ', desc: 'ຕິກ ✅ ຄົນທີ່ມາແລ້ວ ໃນ "ລາຍຊື່ & ເຊັກຊື່" · ຄົນທີ່ຍັງບໍ່ມາ → ກົດຕາມ', go: 'roster', act: 'absent' },
  { id: 'sub', day: 'D-DAY', time: '19:45', title: 'ຂາດຄົນ → ເອີ້ນຕົວສຳຮອງ', desc: 'ຖ້າຍັງບໍ່ມາ ໃຫ້ເອີ້ນຕົວສຳຮອງ (ເລກ 11 ຂຶ້ນໄປ)', act: 'sub' },
  { id: 'soon', day: 'D-DAY', time: '19:55', title: 'ແຈ້ງ "ອີກ 5 ນາທີ"', desc: 'ໃຫ້ທຸກຄົນເປີດຫ້ອງລະຫັດລໍຖ້າ (ຄົບແລ້ວເລີ່ມກ່ອນໄດ້)', act: 'soon' },
  { id: 'g1', day: 'D-DAY', time: '20:00', title: 'ເກມ 1 — ສ້າງຫ້ອງ ແລ້ວສົ່ງລະຫັດ', desc: 'ໃສ່ລະຫັດໃນ "ບອດເກມ" → ສົ່ງ · ຈົບແລ້ວຈົດຄະແນນ', go: 'games', game: 1 },
  { id: 'g2', day: 'D-DAY', time: '~20:20', title: 'ເກມ 2', desc: 'ກົດ "ຈົບເກມ" → ສົ່ງລະຫັດເກມໃໝ່ → ຈົດຄະແນນ', go: 'games', game: 2 },
  { id: 'g3', day: 'D-DAY', time: '~20:40', title: 'ເກມ 3', desc: 'ສົ່ງຜົນລະຫວ່າງທາງໄດ້ (ຕາຕະລາງຄະແນນ)', go: 'games', game: 3 },
  { id: 'g4', day: 'D-DAY', time: '~21:00', title: 'ເກມ 4', desc: '', go: 'games', game: 4 },
  { id: 'g5', day: 'D-DAY', time: '~21:20', title: 'ເກມ 5 (ເກມສຸດທ້າຍ)', desc: '', go: 'games', game: 5 },
  { id: 'results', day: 'D-DAY', time: '~21:40', title: 'ປະກາດຜົນ + ລາງວັນ', desc: 'ກວດຄະແນນ → ກົດ "ປະກາດຜົນສຸດທ້າຍ" ໄປຫ້ອງ 🏆', go: 'scores' },
  { id: 'close', day: 'D-DAY', time: '~21:50', title: 'ປິດງານ + ຂອບໃຈ', desc: 'ໂພສຂອບໃຈ · ນັດຮັບລາງວັນ · ຈົບ Event', act: 'thanks' },
];

function createRun({ client, guild, logTo }) {
  let S = { ...blank(), ...store.load('run-state', {}) };
  const save = () => store.save('run-state', S);
  const T = () => { if (!client.jibiTourney) throw new Error('ປລັກອິນງານແຂ່ງບໍ່ໄດ້ເປີດ'); return client.jibiTourney; };
  const log = (t) => { S.log.unshift({ at: Date.now(), t }); S.log = S.log.slice(0, 60); save(); logTo(`🎮 ${t}`); };

  const chan = async (name) => {
    await guild.channels.fetch();
    const c = guild.channels.cache.find((x) => x.name === name) || guild.channels.cache.find((x) => x.name.includes(name));
    if (!c) throw new Error(`ບໍ່ພົບຫ້ອງ ${name}`);
    return c;
  };
  const link = async (key) => { try { return `<#${(await chan(CH[key])).id}>`; } catch { return `#${CH[key]}`; } };
  const role = (name) => guild.roles.cache.find((r) => r.name === name);

  async function post(chName, { title, text, color = YELLOW, roles = [], everyone = false, users = [], fields }) {
    const ch = await chan(chName);
    const rs = roles.map(role).filter(Boolean);
    const head = [everyone ? '@everyone' : '', ...rs.map((r) => `<@&${r.id}>`), ...users.map((u) => `<@${u}>`)].filter(Boolean).join(' ');
    const e = new EmbedBuilder().setColor(color).setFooter({ text: FOOTER }).setTimestamp();
    if (title) e.setTitle(title.slice(0, 256));
    if (text) e.setDescription(text.slice(0, 4000));
    if (fields) e.addFields(fields.slice(0, 25));
    const m = await ch.send({ content: head || undefined, embeds: [e], allowedMentions: { parse: everyone ? ['everyone'] : [], roles: rs.map((r) => r.id), users } });
    return { url: m.url, channel: ch.name };
  }

  // ---------- ນັກແຂ່ງ ----------
  async function roster() {
    const ev = T().getEvent();
    const ps = T().players();
    await guild.members.fetch().catch(() => {});
    return ps.map((p) => {
      const m = guild.members.cache.get(p.uid);
      return {
        uid: p.uid, no: p.no, name: p.name || (m ? m.displayName : '?'), riot: p.riot, rank: p.rank, team: p.team || '',
        discord: m ? m.user.username : '(ອອກຈາກເຊີບແລ້ວ)', inServer: !!m, inVoice: !!(m && m.voice && m.voice.channel && m.voice.channel.name.includes('βETA')),
        sub: p.no > ev.max && !p.forceMain, checkin: S.checkin[p.uid] || null,
      };
    });
  }
  const mainPlayers = (r) => r.filter((p) => !p.sub || p.checkin === 'here');
  const notHere = (r) => r.filter((p) => !p.sub && p.checkin !== 'here');

  // ---------- ຄະແນນ ----------
  function table(rows, upTo = 5) {
    const out = rows.map((p) => {
      const g = S.scores[p.uid] || {};
      let k = 0, d = 0, hsSum = 0, hsN = 0, played = 0;
      for (let n = 1; n <= upTo; n++) {
        const x = g[n]; if (!x || x.k === '' || x.k == null) continue;
        played++; k += +x.k || 0; d += +x.d || 0;
        if (x.hs !== '' && x.hs != null) { hsSum += +x.hs || 0; hsN++; }
      }
      return { uid: p.uid, no: p.no, name: p.name, riot: p.riot, k, d, hs: hsN ? Math.round((hsSum / hsN) * 10) / 10 : 0, played };
    }).filter((x) => x.played > 0);
    out.sort((a, b) => b.k - a.k || a.d - b.d || b.hs - a.hs);
    out.forEach((x, i) => {
      const prev = out[i - 1];
      x.tie = !!(prev && prev.k === x.k && prev.d === x.d && prev.hs === x.hs);
      x.pos = i + 1;
    });
    return out;
  }

  // ---------- ຂໍ້ຄວາມສຳເລັດຮູບ (ພາສາລາວ) ----------
  const PRESETS = {
    d1: { label: '📣 ພຣຸ່ງນີ້ແຂ່ງແລ້ວ', async run() {
      const ev = T().getEvent();
      const text = `**${ev.name}** ແຂ່ງ **ພຣຸ່ງນີ້ 20:00 (ເວລາລາວ)** 🔥\n\n🔑 ລະຫັດຫ້ອງສົ່ງຢູ່ ${await link('code')} **ເທົ່ານັ້ນ**\n📜 ອ່ານກົດ ${await link('rules')}\n❓ ມີຄຳຖາມ ${await link('qa')}\n\n⚡ ມາຄົບກ່ອນ ອາດເລີ່ມກ່ອນເວລາໄດ້ — ມາໃຫ້ທັນເດີ້!`;
      return [await post(CH.announce, { title: '📣 ພຣຸ່ງນີ້ແຂ່ງແລ້ວ!', text, roles: [ROLE_PLAYER, ROLE_VALO] }), await post(CH.world, { title: '📣 ພຣຸ່ງນີ້ແຂ່ງແລ້ວ!', text, roles: [ROLE_VALO] })];
    } },
    checkin: { label: '🎧 ເອີ້ນເຂົ້າ Voice / ເຊັກຊື່', async run() {
      return [await post(CH.announce, { title: '🎧 ເປີດເຊັກຊື່ແລ້ວ!', text: `ນັກແຂ່ງທຸກຄົນ ເຂົ້າ Voice **${CH.voice}** ໄດ້ເລີຍ\nແອດມິນຈະເຊັກຊື່ກ່ອນ **19:45**\n\n🔑 ລະຫັດຫ້ອງຈະສົ່ງຢູ່ ${await link('code')} — ເປີດຫ້ອງນີ້ໄວ້ເລີຍ\n⏰ ບໍ່ມາຕາມເວລາ = ໃຫ້ຕົວສຳຮອງແທນ`, roles: [ROLE_PLAYER] })];
    } },
    absent: { label: '🚨 ຕາມຄົນທີ່ຍັງບໍ່ມາ', async run(o) {
      const r = await roster();
      const miss = o.uids && o.uids.length ? r.filter((p) => o.uids.includes(p.uid)) : notHere(r);
      if (!miss.length) throw new Error('ທຸກຄົນມາຄົບແລ້ວ 🎉');
      return [await post(CH.announce, { title: '🚨 ຍັງບໍ່ເຫັນເຈົ້າ!', color: RED, users: miss.map((p) => p.uid), text: `${miss.map((p) => `• **#${p.no} ${p.name}**`).join('\n')}\n\nກະລຸນາເຂົ້າ Voice **${CH.voice}** ດ່ວນ ຫຼື ແຈ້ງໃນ ${await link('qa')}\n⏰ ບໍ່ມາພາຍໃນ **5 ນາທີ** = ໃຫ້ຕົວສຳຮອງແທນ` })];
    } },
    sub: { label: '🔁 ເອີ້ນຕົວສຳຮອງ', async run() {
      const r = await roster();
      const subs = r.filter((p) => p.sub);
      if (!subs.length) throw new Error('ບໍ່ມີຕົວສຳຮອງໃນລາຍຊື່');
      return [await post(CH.announce, { title: '🔁 ເອີ້ນຕົວສຳຮອງ!', users: subs.map((p) => p.uid), text: `ມີບ່ອນວ່າງ! ຕົວສຳຮອງ ${subs.map((p) => `**#${p.no} ${p.name}**`).join(', ')}\nເຂົ້າ Voice **${CH.voice}** ດ່ວນ — ມາກ່ອນໄດ້ກ່ອນ ຕາມລຳດັບເລກ` })];
    } },
    soon: { label: '⏳ ອີກ 5 ນາທີ', async run() {
      return [await post(CH.code, { title: '⏳ ອີກ 5 ນາທີ ສົ່ງລະຫັດຫ້ອງ!', text: `ເປີດ Valorant ລໍຖ້າເລີຍ\nລະຫັດຈະສົ່ງ **ຢູ່ຫ້ອງນີ້** 🔑\n\nກົດ 📋 ກັອບລະຫັດ → **PARTY CODE** → **JOIN**`, roles: [ROLE_PLAYER] })];
    } },
    next: { label: '🏁 ຈົບເກມ → ລໍຖ້າເກມຕໍ່ໄປ', async run(o) {
      const ev = T().getEvent(); const g = parseInt(o.game, 10) || 1; const games = ev.games || 5;
      if (g >= games) return [await post(CH.code, { title: `🏁 ຈົບເກມ ${g} — ຈົບການແຂ່ງແລ້ວ!`, color: GREEN, text: `ຂອບໃຈທຸກຄົນ 🙏 ແອດມິນກຳລັງລວມຄະແນນ\nຜົນຈະປະກາດຢູ່ ${await link('results')}`, roles: [ROLE_PLAYER] })];
      return [await post(CH.code, { title: `🏁 ຈົບເກມ ${g}/${games}`, text: `ພັກ 2-3 ນາທີ ☕\nລະຫັດ **ເກມ ${g + 1}** ຈະສົ່ງຢູ່ຫ້ອງນີ້ ໄວໆນີ້ — ຢ່າອອກໄປໄກ!`, roles: [ROLE_PLAYER] })];
    } },
    delay: { label: '⏰ ເລື່ອນເວລາ', async run(o) {
      const min = parseInt(o.min, 10) || 10;
      return [await post(CH.announce, { title: `⏰ ເລື່ອນເວລາ ${min} ນາທີ`, color: RED, text: `${o.reason ? `ເຫດຜົນ: ${o.reason}\n` : ''}ຂໍອະໄພ 🙏 ຈະເລີ່ມ/ສືບຕໍ່ໃນອີກ **${min} ນາທີ**\nລະຫັດຫ້ອງຍັງສົ່ງຢູ່ ${await link('code')} ຄືເກົ່າ`, roles: [ROLE_PLAYER] })];
    } },
    pause: { label: '⛔ ຢຸດຊົ່ວຄາວ (ມີບັນຫາ)', async run(o) {
      return [await post(CH.code, { title: '⛔ ຢຸດຊົ່ວຄາວ', color: RED, text: `${o.reason ? `${o.reason}\n\n` : ''}ຢ່າຫາກເຂົ້າຫ້ອງເກົ່າ — ລໍຖ້າແອດມິນສົ່ງ **ລະຫັດໃໝ່** ຢູ່ຫ້ອງນີ້\n👑 ຄຳຕັດສິນຂອງແອດມິນຖືເປັນທີ່ສຸດ`, roles: [ROLE_PLAYER] })];
    } },
    resume: { label: '▶️ ສືບຕໍ່ແລ້ວ', async run() {
      return [await post(CH.code, { title: '▶️ ສືບຕໍ່ການແຂ່ງແລ້ວ!', color: GREEN, text: 'ບັນຫາແກ້ແລ້ວ ✅ ລໍຖ້າລະຫັດຢູ່ຫ້ອງນີ້ ຫຼື ໃຊ້ລະຫັດລ່າສຸດ', roles: [ROLE_PLAYER] })];
    } },
    thanks: { label: '🙏 ຂອບໃຈ / ປິດງານ', async run() {
      const ev = T().getEvent();
      const text = `**${ev.name}** ຈົບລົງແລ້ວ 🎉\nຂອບໃຈນັກແຂ່ງທຸກຄົນ ແລະ ທຸກຄົນທີ່ມາເບິ່ງ ❤️\n\n🏆 ຜົນ & ລາງວັນ: ${await link('results')}\n🎁 ຜູ້ໄດ້ລາງວັນ: ແອດມິນຈະຕິດຕໍ່ຫາທາງ DM\n\nພົບກັນໃໝ່ງານໜ້າ — **P SHOP GAMERPOWER** 💛`;
      return [await post(CH.announce, { title: '🙏 ຂອບໃຈທຸກຄົນ!', color: GREEN, text, roles: [ROLE_PLAYER] }), await post(CH.world, { title: '🏆 ງານແຂ່ງຈົບແລ້ວ!', color: GREEN, text })];
    } },
  };

  // ---------- ປະກາດຜົນ ----------
  function prizeText(i) {
    const pz = T().getEvent().prizes || [];
    return pz[i] ? `${Number(pz[i]).toLocaleString('en-US')} ກີບ` : '';
  }
  async function publishResults({ upTo, final }) {
    const r = await roster();
    const games = T().getEvent().games || 5;
    const n = Math.max(1, Math.min(games, parseInt(upTo, 10) || games));
    const rows = table(r, n);
    if (!rows.length) throw new Error('ຍັງບໍ່ມີຄະແນນ');
    const lines = rows.map((x, i) => `${MEDAL[i] || `**${i + 1}.**`} **${x.name}** — **${x.k}** Kill · ${x.d} Death · HS ${x.hs}%${final && prizeText(i) ? ` · 💰 ${prizeText(i)}` : ''}`);
    const ev = T().getEvent();
    const title = final ? `🏆 ຜົນສຸດທ້າຍ — ${ev.name}` : `📊 ຕາຕະລາງຄະແນນ ຫຼັງເກມ ${n}/${games}`;
    const text = `${lines.join('\n')}\n\n⚖️ ຄະແນນເທົ່າກັນ: Death ໜ້ອຍກວ່າ → %HS ສູງກວ່າ${final ? '\n👑 ຄຳຕັດສິນຂອງແອດມິນຖືເປັນທີ່ສຸດ\n🎁 ແອດມິນຈະ DM ຫາຜູ້ໄດ້ລາງວັນ' : ''}`;
    const winners = final ? rows.slice(0, (ev.prizes || []).length).map((x) => x.uid) : [];
    const res = await post(CH.results, { title, text, color: final ? GREEN : YELLOW, roles: [ROLE_PLAYER], users: winners });
    if (final) S.games.final = Date.now();
    log(final ? 'ປະກາດຜົນສຸດທ້າຍແລ້ວ' : `ສົ່ງຕາຕະລາງຄະແນນ ຫຼັງເກມ ${n}`);
    return res;
  }

  const api = {
    TIMELINE,
    roster,
    table: async (upTo) => table(await roster(), upTo),
    checkin(uids, status) { for (const u of uids || []) { if (status) S.checkin[u] = status; else delete S.checkin[u]; } save(); return S.checkin; },
    setScores(list, by = 'Hub') {
      // list: [{ uid | riot | name, game, k, d, hs }]
      const ps = T().players();
      let n = 0;
      for (const s of list || []) {
        const key = String(s.riot || s.name || '').toLowerCase();
        const p = ps.find((x) => x.uid === s.uid) || ps.find((x) => key && (String(x.riot).toLowerCase() === key || String(x.riot).toLowerCase().split('#')[0] === key.split('#')[0] || String(x.name || '').toLowerCase() === key));
        const g = parseInt(s.game, 10);
        if (!p || !(g >= 1 && g <= 10)) continue;
        S.scores[p.uid] = S.scores[p.uid] || {};
        const clean = (v) => (v === '' || v == null ? '' : Math.max(0, Number(v) || 0));
        S.scores[p.uid][g] = { k: clean(s.k), d: clean(s.d), hs: clean(s.hs) };
        n++;
      }
      save();
      if (n && by !== 'Hub') log(`${by} ໃສ່ຄະແນນ ${n} ແຖວ`);
      return { saved: n };
    },
  };
  client.jibiRun = api;

  const routes = {
    'GET /api/run': async () => {
      const ev = T().getEvent();
      const r = await roster();
      return { event: ev, timeline: TIMELINE, presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v.label])), players: r, state: S, table: table(r, ev.games || 5) };
    },
    'POST /api/run/done': async (b) => { if (b.on) S.done[b.id] = Date.now(); else delete S.done[b.id]; save(); return S.done; },
    'POST /api/run/checkin': async (b) => {
      if (b.status) S.checkin[b.uid] = b.status; else delete S.checkin[b.uid];
      save(); return S.checkin;
    },
    'POST /api/run/checkin-all': async (b) => { for (const u of b.uids || []) S.checkin[u] = b.status || 'here'; save(); return S.checkin; },
    'POST /api/run/scores': async (b) => api.setScores(b.list || [b]),
    'POST /api/run/quick': async (b) => {
      const p = PRESETS[b.preset]; if (!p) throw new Error('ບໍ່ມີປຸ່ມນີ້');
      const res = await p.run(b);
      log(`ສົ່ງ: ${p.label}${b.game ? ` (ເກມ ${b.game})` : ''}`);
      return res;
    },
    'POST /api/run/custom': async (b) => {
      if (!b.text) throw new Error('ພິມຂໍ້ຄວາມກ່ອນ');
      const target = CH[b.channel] || b.channel;
      const roles = []; if (b.pingPlayers) roles.push(ROLE_PLAYER); if (b.pingValo) roles.push(ROLE_VALO);
      const res = await post(target, { title: b.title || null, text: b.text, color: b.urgent ? RED : YELLOW, roles, everyone: !!b.everyone });
      log(`ສົ່ງຂໍ້ຄວາມເອງ ໄປ #${res.channel}`);
      return res;
    },
    'POST /api/run/code': async (b) => {
      if (!b.code) throw new Error('ໃສ່ລະຫັດກ່ອນ');
      const g = parseInt(b.game, 10) || null;
      const m = await T().sendCode({ code: String(b.code).trim().slice(0, 40), game: g, map: b.map || null, note: b.note || null }, 'Hub');
      if (g) { S.games[g] = { ...(S.games[g] || {}), code: String(b.code).trim(), codeAt: Date.now() }; save(); }
      log(`ສົ່ງລະຫັດ ${g ? `ເກມ ${g}` : ''}: ${b.code}`);
      return { url: m.url };
    },
    'POST /api/run/game': async (b) => {
      const g = parseInt(b.game, 10); if (!g) throw new Error('game?');
      S.games[g] = { ...(S.games[g] || {}), endAt: b.end ? Date.now() : null }; save();
      if (b.end && b.announce) { await PRESETS.next.run({ game: g }); log(`ຈົບເກມ ${g} + ແຈ້ງນັກແຂ່ງ`); }
      return S.games;
    },
    'POST /api/run/results': async (b) => publishResults(b),
    'POST /api/run/remind': async () => { const m = await T().remindNow(); log('ສົ່ງແຈ້ງເຕືອນ (ແຜງນັບຖອຍຫຼັງ)'); return { url: m.url }; },
    'POST /api/run/reg': async (b) => { await T().setEvent({ regOpen: !!b.open }); log(b.open ? 'ເປີດຮັບສະໝັກ' : 'ປິດຮັບສະໝັກ'); return true; },
    'POST /api/run/reset': async (b) => {
      if (b.confirm !== 'RESET') throw new Error('ພິມ RESET ເພື່ອຢືນຢັນ');
      store.save(`run-state-backup-${Date.now()}`, S);
      S = blank(); save(); logTo('🎮 ລ້າງຂໍ້ມູນຣັນງານແຂ່ງ (ສຳຮອງໄວ້ແລ້ວ)');
      return true;
    },
  };
  return routes;
}

module.exports = { createRun };
