// ปลั๊กอิน: เลเวล — คุยในแชท/อยู่ห้องเสียง = ได้ XP · ถึงเลเวลที่กำหนดได้ยศอัตโนมัติ · /rank /top
const { Events, SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const store = require('../lib/store');

const MSG_XP = 15;        // ต่อข้อความ (มีคูลดาวน์ 60 วิ)
const VOICE_XP = 5;       // ต่อนาทีในห้องเสียง (ต้องมีคนอื่นอยู่ด้วย)
const levelOf = (xp) => Math.floor(Math.sqrt(xp / 100));

module.exports = {
  id: 'level',
  name: 'เลเวล & ยศ /rank /top',
  description: 'คุยแชท +15 XP (ทุก 60 วิ) · อยู่ห้องเสียงกับเพื่อน +5 XP/นาที · Lv.5 / 10 / 20 ได้ยศอัตโนมัติ',
  commands: [
    new SlashCommandBuilder().setName('rank').setDescription('ເບິ່ງເລເວລຂອງເຈົ້າ'),
    new SlashCommandBuilder().setName('top').setDescription('10 ອັນດັບເລເວລສູງສຸດ'),
  ],
  setup({ client, guild, cfg, logTo }) {
    const db = store.load('levels', {});
    let dirty = false;
    const tiers = Object.entries(cfg.roles).filter(([, r]) => r.level).map(([, r]) => r).sort((a, b) => a.level - b.level);

    async function addXp(member, amount) {
      if (!member || member.user.bot) return;
      const u = (db[member.id] ||= { xp: 0, last: 0 });
      const before = levelOf(u.xp);
      u.xp += amount; dirty = true;
      const after = levelOf(u.xp);
      if (after > before) {
        for (const t of tiers) {
          if (before < t.level && after >= t.level) {
            const role = guild.roles.cache.find((r) => r.name === t.name);
            if (role) await member.roles.add(role).catch(() => {});
            await logTo(`⬆️ **${member.user.username}** ຂຶ້ນ Lv.${after} ໄດ້ຍົດ ${t.name}`);
          }
        }
      }
    }

    client.on(Events.MessageCreate, async (msg) => {
      if (!msg.guild || msg.author.bot) return;
      const u = (db[msg.author.id] ||= { xp: 0, last: 0 });
      if (Date.now() - u.last < 60000) return;
      u.last = Date.now();
      await addXp(msg.member, MSG_XP);
    });

    setInterval(async () => {
      for (const ch of guild.channels.cache.filter((c) => c.isVoiceBased()).values()) {
        const humans = ch.members.filter((m) => !m.user.bot);
        if (humans.size < 2) continue;
        for (const m of humans.values()) if (!m.voice.selfDeaf) await addXp(m, VOICE_XP);
      }
    }, 60000);
    setInterval(() => { if (dirty) { store.save('levels', db); dirty = false; } }, 30000);

    client.on(Events.InteractionCreate, async (i) => {
      try {
        if (!i.isChatInputCommand()) return;
        if (i.commandName === 'rank') {
          const u = db[i.user.id] || { xp: 0 };
          const lv = levelOf(u.xp);
          const next = (lv + 1) ** 2 * 100;
          const rank = Object.entries(db).sort((a, b) => b[1].xp - a[1].xp).findIndex(([id]) => id === i.user.id) + 1;
          const e = new EmbedBuilder().setColor(0xFFC400).setAuthor({ name: i.member.displayName, iconURL: i.member.displayAvatarURL() })
            .setDescription(`**Lv.${lv}** · ${u.xp} XP\nອີກ ${next - u.xp} XP ຂຶ້ນ Lv.${lv + 1}${rank ? `\nອັນດັບ #${rank}` : ''}`);
          return i.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
        }
        if (i.commandName === 'top') {
          const top = Object.entries(db).sort((a, b) => b[1].xp - a[1].xp).slice(0, 10);
          const lines = top.map(([id, u], k) => `**${k + 1}.** <@${id}> — Lv.${levelOf(u.xp)} (${u.xp} XP)`);
          const e = new EmbedBuilder().setColor(0xFFC400).setTitle('🏆 10 ອັນດັບເລເວລ').setDescription(lines.join('\n') || 'ຍັງບໍ່ມີຂໍ້ມູນ');
          return i.reply({ embeds: [e], allowedMentions: { parse: [] } });
        }
      } catch (e) { console.error('[level]', e.message); }
    });
  },
};
