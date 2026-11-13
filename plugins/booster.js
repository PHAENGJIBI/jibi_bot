// ปลั๊กอิน: ขอบคุณคนบูสต์ — ประกาศขอบคุณในห้องประกาศ + บันทึกใน bot-logs
const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
  id: 'booster',
  name: 'ขอบคุณคนบูสต์',
  description: 'มีคนบูสต์เซิร์ฟ → JIBI ประกาศขอบคุณในห้องประกาศ (ยศ Server Booster + ห้องลับได้อัตโนมัติจาก Discord)',
  setup({ client, guild, logTo }) {
    client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
      if (oldM.premiumSince || !newM.premiumSince) return;
      try {
        const ch = guild.channels.cache.find((c) => c.name.includes('ປະກາດສຳຄັນ'));
        const embed = new EmbedBuilder()
          .setColor(0xFFC400)
          .setTitle('💎 ຂອບໃຈທີ່ບູສເຊີບເວີ!')
          .setDescription(`**${newM.displayName}** ບູສ P SHOP GAMERPOWER ແລ້ວ 🎉\nເຊີບເວີມີທັງໝົດ **${guild.premiumSubscriptionCount || 0}** ບູສ`)
          .setThumbnail(newM.displayAvatarURL({ size: 256 }))
          .setFooter({ text: 'JIBI · P SHOP GAMERPOWER' });
        if (ch) await ch.send({ content: `<@${newM.id}>`, embeds: [embed], allowedMentions: { users: [newM.id] } });
        await logTo(`💎 **${newM.user.username}** ບູສເຊີບເວີ`);
      } catch (e) { console.error('[booster]', e.message); }
    });
  },
};
