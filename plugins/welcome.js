// ปลั๊กอิน: การ์ดต้อนรับ — คนเข้าใหม่ได้การ์ดมีชื่อ + รูปโปรไฟล์ + แบนเนอร์เซิร์ฟ
// มีงานแข่งเปิดอยู่ (data/tourney-event.json) → ใส่ข้อมูลงาน + ถาม "มาแข่งไหม?" (ปุ่ม) ทั้งห้องต้อนรับและแชตโลก
// กด 🏆 ມາແຂ່ງ → ได้ยศ Valorant + บอกห้องกติกา/ลงทะเบียน/รหัส · กด 🎮 → ต้อนรับปกติ
const {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ChannelType,
} = require('discord.js');
const store = require('../lib/store');

const LAO_DAYS = ['ອາທິດ', 'ຈັນ', 'ອັງຄານ', 'ພຸດ', 'ພະຫັດ', 'ສຸກ', 'ເສົາ'];
const MEDALS = ['🥇', '🥈', '🥉', '🎖️ ທີ 4', '🎖️ ທີ 5', '🎖️ ທີ 6'];
function laoTime(iso) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600000);
  const p = (n) => String(n).padStart(2, '0');
  return `${LAO_DAYS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()} · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ໂມງ (ເວລາລາວ)`;
}

module.exports = {
  id: 'welcome',
  name: 'การ์ดต้อนรับ',
  description: 'คนเข้าเซิร์ฟใหม่ → การ์ดต้อนรับในห้อง 👋 ຍິນດີຕ້ອນຮັບ + แชตโลก · ถ้ามีงานแข่งเปิดอยู่ ใส่ข้อมูลงาน + ถามว่ามาแข่งไหม (ปุ่ม)',
  setup({ client, guild, logTo }) {
    const posted = new Map(); // uid → [{ chId, msgId }]
    const find = (part) => guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name.includes(part));
    const link = (part, fallback) => { const c = find(part); return c ? `<#${c.id}>` : fallback; };
    const liveEvent = () => {
      const ev = store.load('tourney-event', null);
      return ev && !ev.ended && ev.startAt && new Date(ev.startAt).getTime() > Date.now() ? ev : null;
    };

    function welcomeMessage(m, ev, short) {
      const embed = new EmbedBuilder()
        .setColor(0xFFC400)
        .setTitle(`👋 ຍິນດີຕ້ອນຮັບ ${m.displayName}!`)
        .setThumbnail(m.displayAvatarURL({ size: 256 }))
        .setFooter({ text: `ສະມາຊິກຄົນທີ ${guild.memberCount} · P SHOP GAMERPOWER` });
      if (!ev) {
        embed.setDescription('ເລືອກເກມທີ່ເຈົ້າຫຼິ້ນ ແລ້ວເປີດຫ້ອງ 📖 ຄູ່ມື ໄດ້ເລີຍ\nມີຄຳຖາມ ພິມ `/howto` ຕາມດ້ວຍສິ່ງທີ່ຢາກຮູ້');
        const banner = guild.bannerURL({ size: 1024 }) || guild.splashURL({ size: 1024 });
        if (banner && !short) embed.setImage(banner);
        return { content: `<@${m.id}>`, embeds: [embed], allowedMentions: { users: [m.id] } };
      }
      embed.setDescription([
        `## 🏆 ເຈົ້າເຂົ້າມາເພື່ອແຂ່ງ ${ev.name} ບໍ່?`,
        '**ຢາກແຂ່ງ → ກົດປຸ່ມແດງ ອັນດຽວພໍ 👇**',
      ].join('\n'));
      embed.addFields(
        { name: '📅 ວັນແຂ່ງ', value: `${laoTime(ev.startAt)}\n⚡ ມາຄົບກ່ອນ ອາດເລີ່ມກ່ອນເວລາ`, inline: true },
        { name: '🎮 ຮູບແບບ', value: `VALORANT Deathmatch\n${ev.max || 10} ຄົນ · ${ev.games || 3} ເກມ · ນັບ Kill ລວມ`, inline: true },
      );
      if (!short) {
        const banner = guild.bannerURL({ size: 1024 }) || guild.splashURL({ size: 1024 });
        if (banner) embed.setImage(banner);
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`wel:yes:${m.id}`).setStyle(ButtonStyle.Danger).setLabel('🏆 ແມ່ນ — ຢາກແຂ່ງ!'),
        new ButtonBuilder().setCustomId(`wel:no:${m.id}`).setStyle(ButtonStyle.Secondary).setLabel('🎮 ມາຫຼິ້ນ / ລົມທົ່ວໄປ'),
      );
      return { content: `<@${m.id}>`, embeds: [embed], components: [row], allowedMentions: { users: [m.id] } };
    }

    // ดูตัวอย่างการ์ด (ส่งไปห้องแอดมิน) — bridge: { action: 'welcome-preview', userId, channel }
    client.jibiWelcomePreview = async (uid, chName) => {
      const m = await guild.members.fetch(uid);
      const ch = find(chName || 'ແອດມິນ-ລົມກັນ');
      const ev = liveEvent();
      const a = await ch.send(welcomeMessage(m, ev, false));
      const b = ev ? await ch.send(welcomeMessage(m, ev, true)) : null;
      posted.set(m.id, [{ chId: ch.id, msgId: a.id }, ...(b ? [{ chId: ch.id, msgId: b.id }] : [])]);
      return [a.url, b && b.url];
    };
    client.on(Events.GuildMemberAdd, async (m) => {
      if (m.user.bot) return;
      try {
        const ev = liveEvent();
        const list = [];
        const wch = find('ຍິນດີຕ້ອນຮັບ');
        if (wch) { const msg = await wch.send(welcomeMessage(m, ev, false)); list.push({ chId: wch.id, msgId: msg.id }); }
        const world = find('ແຊັດໂລກ');
        if (world && ev) { const msg = await world.send(welcomeMessage(m, ev, true)); list.push({ chId: world.id, msgId: msg.id }); }
        posted.set(m.id, list);
      } catch (e) { console.error('[welcome]', e.message); }
    });

    client.on(Events.InteractionCreate, async (i) => {
      if (!i.isButton() || !i.customId.startsWith('wel:')) return;
      try {
        const [, ans, uid] = i.customId.split(':');
        if (i.user.id !== uid) return i.reply({ content: '🙂 ປຸ່ມນີ້ສຳລັບສະມາຊິກໃໝ່ຄົນນັ້ນ', flags: MessageFlags.Ephemeral });
        const ev = liveEvent();
        let text;
        let reply = null;
        if (ans === 'yes') {
          await guild.roles.fetch().catch(() => {});
          const role = guild.roles.cache.find((r) => r.name === 'Valorant');
          if (role && !i.member.roles.cache.has(role.id)) await i.member.roles.add(role).catch(() => {});
          const T = client.jibiTourney;
          const no = T && T.isPlayer ? T.isPlayer(i.user.id) : 0;
          if (no) reply = T.doneMessage(no);
          else if (T && T.regOpen && !T.regOpen()) text = '🔒 ປິດຮັບສະໝັກແລ້ວ — ຕິດຕາມງານແຂ່ງຄັ້ງໜ້າເດີ້ 💛';
          else {
            const rules = find('ກົດກະຕິກາ-βeta');
            const e = new EmbedBuilder().setColor(0xE24B4A)
              .setTitle('✅ ໄດ້ຍົດແລ້ວ! ເຫຼືອອີກ 1 ຂັ້ນເທົ່ານັ້ນ')
              .setDescription([
                '✅ 1 ກົດຢາກແຂ່ງ  →  👉 **2 ສະໝັກ (1 ນາທີ)**  →  🔒 3 ວັນແຂ່ງ ຮັບລະຫັດ',
                '',
                'ກົດ **📝 ສະໝັກເລີຍ** → ອ່ານກົດສັ້ນໆ → ກອກຊື່ + Riot ID → ສຳເລັດ',
                'ບໍ່ຕ້ອງໄປຫາຫ້ອງອື່ນ',
              ].join('\n'))
              .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
            const btns = [new ButtonBuilder().setCustomId('tourney:open').setStyle(ButtonStyle.Danger).setLabel('📝 ສະໝັກເລີຍ')];
            if (rules) btns.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}/${rules.id}`).setLabel('📜 ອ່ານກົດເຕັມ'));
            reply = { embeds: [e], components: [new ActionRowBuilder().addComponents(...btns)] };
          }
          logTo(`🏆 ສະມາຊິກໃໝ່ **${i.user.username}** ຕອບວ່າ ມາແຂ່ງ → ໃຫ້ຍົດ Valorant`);
        } else {
          text = '🎮 ຍິນດີຕ້ອນຮັບ! ເລືອກເກມທີ່ເຈົ້າຫຼິ້ນໃນ **Channels & Roles** ແລ້ວເປີດຫ້ອງ 📖 ຄູ່ມື ໄດ້ເລີຍ — ຖ້າປ່ຽນໃຈຢາກແຂ່ງ ກົດປຸ່ມ 🏆 ໄດ້ຕະຫຼອດ';
        }
        await i.reply({ ...(reply || { content: text }), flags: MessageFlags.Ephemeral });
        // ตอบแล้ว → ป้ายบอกผลบนการ์ดทั้งสองห้อง (ปุ่มยังกดเปลี่ยนใจได้)
        const label = ans === 'yes' ? '✅ ຢາກແຂ່ງ!' : '🎮 ມາຫຼິ້ນທົ່ວໄປ';
        for (const p of posted.get(uid) || [{ chId: i.channelId, msgId: i.message.id }]) {
          const ch = await guild.channels.fetch(p.chId).catch(() => null);
          const msg = ch && await ch.messages.fetch(p.msgId).catch(() => null);
          if (msg) await msg.edit({ content: `<@${uid}> · ${label}`, allowedMentions: { parse: [] } }).catch(() => {});
        }
        return null;
      } catch (e) {
        console.error('[welcome]', e.message);
        if (!i.replied) return i.reply({ content: '❌ ມີບັນຫາ ລອງໃໝ່', flags: MessageFlags.Ephemeral }).catch(() => {});
        return null;
      }
    });
  },
};
