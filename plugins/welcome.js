// ปลั๊กอิน: การ์ดต้อนรับ — คนเข้าใหม่ได้การ์ดมีชื่อ + รูปโปรไฟล์ + แบนเนอร์เซิร์ฟ
const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
  id: 'welcome',
  name: 'การ์ดต้อนรับ',
  description: 'คนเข้าเซิร์ฟใหม่ → JIBI โพสต์การ์ดต้อนรับ (ชื่อ, รูปโปรไฟล์, แบนเนอร์เซิร์ฟ) ในห้อง 👋 ຍິນດີຕ້ອນຮັບ',
  setup({ client, guild }) {
    client.on(Events.GuildMemberAdd, async (m) => {
      if (m.user.bot) return;
      try {
        const ch = guild.channels.cache.find((c) => c.name.includes('ຍິນດີຕ້ອນຮັບ'));
        if (!ch) return;
        const embed = new EmbedBuilder()
          .setColor(0xFFC400)
          .setTitle(`👋 ຍິນດີຕ້ອນຮັບ ${m.displayName}!`)
          .setDescription('ເລືອກເກມທີ່ເຈົ້າຫຼິ້ນ ແລ້ວເປີດຫ້ອງ 📖 ຄູ່ມື ໄດ້ເລີຍ\nມີຄຳຖາມ ພິມ `/howto` ຕາມດ້ວຍສິ່ງທີ່ຢາກຮູ້')
          .setThumbnail(m.displayAvatarURL({ size: 256 }))
          .setFooter({ text: `ສະມາຊິກຄົນທີ ${guild.memberCount} · P SHOP Gaming Hub` });
        const banner = guild.bannerURL({ size: 1024 }) || guild.splashURL({ size: 1024 });
        if (banner) embed.setImage(banner);
        await ch.send({ content: `<@${m.id}>`, embeds: [embed], allowedMentions: { users: [m.id] } });
      } catch (e) { console.error('[welcome]', e.message); }
    });
  },
};
