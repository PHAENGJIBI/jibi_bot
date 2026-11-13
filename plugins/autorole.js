// ปลั๊กอิน: ให้ยศ ລູກຄ້າ อัตโนมัติ + บันทึกคนเข้าใหม่/ยศที่ได้ใน bot-logs
const { Events } = require('discord.js');

module.exports = {
  id: 'autorole',
  name: 'ให้ยศลูกค้าอัตโนมัติ',
  description: 'เมื่อสมาชิกเลือกเกม ให้ยศ ລູກຄ້າ อัตโนมัติ และบันทึกคนเข้าใหม่ใน bot-logs',
  setup({ client, cfg, logTo }) {
    const gameRoleNames = Object.values(cfg.roles).filter((r) => r.game).map((r) => r.name);

    client.on(Events.GuildMemberAdd, async (m) => {
      await logTo(`🆕 ສະມາຊິກໃໝ່ເຂົ້າມາ: **${m.user.username}**`);
    });

    client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
      const added = newM.roles.cache.filter((r) => !oldM.roles.cache.has(r.id));
      if (!added.size) return;
      const customer = newM.guild.roles.cache.find((r) => r.name === cfg.roles.customer.name);
      const hasGame = newM.roles.cache.some((r) => gameRoleNames.includes(r.name));
      if (customer && hasGame && !newM.roles.cache.has(customer.id)) await newM.roles.add(customer).catch(() => {});
      if (!client.jibiBulk) await logTo(`✅ **${newM.user.username}** ໄດ້ຍົດ: ${added.map((r) => r.name).join(', ')}`);
    });
  },
};
