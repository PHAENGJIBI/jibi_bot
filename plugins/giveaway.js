// ปลั๊กอิน: /giveaway — แจกของ กดปุ่มเข้าร่วม JIBI สุ่มผู้ชนะเอง (คนบูสต์ได้สิทธิ์ 2 เท่า)
const {
  Events, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, MessageFlags,
} = require('discord.js');
const store = require('../lib/store');

const ts = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;

module.exports = {
  id: 'giveaway',
  name: 'แจกของ /giveaway',
  description: 'แอดมินพิมพ์ /giveaway ของรางวัล + เวลา → สมาชิกกดเข้าร่วม → ครบเวลา JIBI สุ่มผู้ชนะ (คนบูสต์ได้ 2 สิทธิ์)',
  commands: [
    new SlashCommandBuilder().setName('giveaway').setDescription('ແຈກຂອງ')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addStringOption((o) => o.setName('prize').setDescription('ຂອງລາງວັນ ເຊັ່ນ 475 VP').setRequired(true).setMaxLength(150))
      .addIntegerOption((o) => o.setName('minutes').setDescription('ໄລຍະເວລາ (ນາທີ)').setRequired(true).setMinValue(1).setMaxValue(20160))
      .addIntegerOption((o) => o.setName('winners').setDescription('ຈຳນວນຜູ້ຊະນະ').setMinValue(1).setMaxValue(20)),
  ],
  setup({ client, guild, logTo }) {
    let list = store.load('giveaways', []);
    const persist = () => store.save('giveaways', list);
    const button = (disabled) => [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('giveaway:join').setStyle(ButtonStyle.Primary).setLabel('🎉 ເຂົ້າຮ່ວມ').setDisabled(!!disabled))];
    const embedOf = (g, ended, winners) => new EmbedBuilder()
      .setColor(ended ? 0x80848E : 0xFFC400)
      .setTitle(`🎁 ${g.prize}`)
      .setDescription(ended
        ? (winners.length ? `🏆 ຜູ້ຊະນະ: ${winners.map((w) => `<@${w}>`).join(', ')}` : 'ບໍ່ມີຜູ້ເຂົ້າຮ່ວມ')
        : `ກົດ **🎉 ເຂົ້າຮ່ວມ** ດ້ານລຸ່ມ\nໝົດເວລາ ${ts(g.endsAt)} · ຜູ້ຊະນະ ${g.winners} ຄົນ\n💎 ຄົນບູສໄດ້ 2 ສິດ`)
      .setFooter({ text: `ຜູ້ເຂົ້າຮ່ວມ ${g.entrants.length} ຄົນ · JIBI` });

    async function finish(g) {
      g.done = true; persist();
      try {
        const ch = await guild.channels.fetch(g.channelId);
        const msg = await ch.messages.fetch(g.messageId);
        const pool = [];
        for (const id of g.entrants) {
          const m = await guild.members.fetch(id).catch(() => null);
          if (!m) continue;
          pool.push(id); if (m.premiumSince) pool.push(id);
        }
        const winners = [];
        while (winners.length < g.winners && pool.length) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          winners.push(pick);
          for (let k = pool.length - 1; k >= 0; k--) if (pool[k] === pick) pool.splice(k, 1);
        }
        await msg.edit({ embeds: [embedOf(g, true, winners)], components: button(true) });
        if (winners.length) await ch.send({ content: `🎉 ຍິນດີນຳ ${winners.map((w) => `<@${w}>`).join(', ')} ໄດ້ຮັບ **${g.prize}**! ຕິດຕໍ່ແອດມິນເພື່ອຮັບລາງວັນ`, allowedMentions: { users: winners } });
        await logTo(`🎁 Giveaway "${g.prize}" ຈົບ · ຜູ້ຊະນະ: ${winners.length}`);
      } catch (e) { console.error('[giveaway]', e.message); }
    }

    setInterval(() => { for (const g of list) if (!g.done && Date.now() >= g.endsAt) finish(g); list = list.filter((g) => !g.done || Date.now() - g.endsAt < 7 * 864e5); }, 15000);

    client.on(Events.InteractionCreate, async (i) => {
      try {
        if (i.isChatInputCommand() && i.commandName === 'giveaway') {
          const g = { prize: i.options.getString('prize'), winners: i.options.getInteger('winners') || 1, endsAt: Date.now() + i.options.getInteger('minutes') * 60000, entrants: [], channelId: i.channelId };
          const msg = await i.channel.send({ embeds: [embedOf(g)], components: button() });
          g.messageId = msg.id; list.push(g); persist();
          return i.reply({ content: '✅ ເລີ່ມແຈກຂອງແລ້ວ', flags: MessageFlags.Ephemeral });
        }
        if (i.isButton() && i.customId === 'giveaway:join') {
          const g = list.find((x) => x.messageId === i.message.id && !x.done);
          if (!g) return i.reply({ content: 'ການແຈກນີ້ຈົບແລ້ວ', flags: MessageFlags.Ephemeral });
          if (g.entrants.includes(i.user.id)) return i.reply({ content: 'ເຈົ້າເຂົ້າຮ່ວມແລ້ວ ✅', flags: MessageFlags.Ephemeral });
          g.entrants.push(i.user.id); persist();
          await i.update({ embeds: [embedOf(g)] });
        }
      } catch (e) { console.error('[giveaway]', e.message); }
    });
  },
};
