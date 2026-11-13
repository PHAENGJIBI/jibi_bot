// ปลั๊กอิน: /howto — ค้นหาโพสต์ในห้อง 📖 ຄູ່ມື
const { Events, SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  id: 'howto',
  name: 'ค้นหาคู่มือ /howto',
  description: 'สมาชิกพิมพ์ /howto แล้วตามด้วยคำ → JIBI ส่งลิงก์โพสต์ [How-to] ที่ตรงคำถาม',
  commands: [
    new SlashCommandBuilder()
      .setName('howto').setDescription('ຄົ້ນຫາຄູ່ມື [How-to]')
      .addStringOption((o) => o.setName('query').setDescription('ເຊັ່ນ VP, Steam, ເຂົ້າເກມບໍ່ໄດ້').setRequired(true)),
  ],
  setup({ client }) {
    client.on(Events.InteractionCreate, async (i) => {
      if (!i.isChatInputCommand() || i.commandName !== 'howto') return;
      try {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const q = i.options.getString('query').toLowerCase();
        const forums = i.guild.channels.cache.filter((c) => c.type === ChannelType.GuildForum && c.name.includes('ຄູ່ມື') && c.permissionsFor(i.member).has(PermissionFlagsBits.ViewChannel));
        const hits = [];
        for (const f of forums.values()) {
          for (const coll of [await f.threads.fetchActive().catch(() => null), await f.threads.fetchArchived({ limit: 100 }).catch(() => null)]) {
            if (!coll) continue;
            for (const t of coll.threads.values()) if (t.name.toLowerCase().includes(q) && !hits.some((h) => h.id === t.id)) hits.push(t);
          }
        }
        if (!hits.length) return i.editReply(`ບໍ່ພົບຄູ່ມືທີ່ກ່ຽວກັບ "${q}" — ລອງຄຳອື່ນ ຫຼື ສອບຖາມແອດມິນ`);
        return i.editReply(`📖 ພົບ ${hits.length} ຄູ່ມື:\n` + hits.slice(0, 10).map((t) => `• ${t.url}`).join('\n'));
      } catch (e) {
        console.error('[howto]', e.message);
        i.editReply('❌ ມີບັນຫາ ລອງໃໝ່').catch(() => {});
      }
    });
  },
};
