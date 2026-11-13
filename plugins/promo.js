// ปลั๊กอิน: /promo — แอดมินสร้างโพสต์โปร/ข่าวพร้อมปุ่มสั่งซื้อ
const {
  Events, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, MessageFlags,
} = require('discord.js');

const isUrl = (u) => /^https?:\/\//.test(u || '');

module.exports = {
  id: 'promo',
  name: 'โพสต์โปร /promo',
  description: 'แอดมินพิมพ์ /promo → กรอกหัวข้อ/รายละเอียด/รูป → JIBI โพสต์สวยพร้อมปุ่ม Facebook / WhatsApp',
  commands: [
    new SlashCommandBuilder()
      .setName('promo').setDescription('ສ້າງໂພສໂປຣ / ຂ່າວ ພ້ອມປຸ່ມສັ່ງຊື້')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addChannelOption((o) => o.setName('channel').setDescription('ສົ່ງໄປຫ້ອງໃດ')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
      .addAttachmentOption((o) => o.setName('image').setDescription('ຮູບ 16:9 (ບໍ່ໃສ່ກໍໄດ້)'))
      .addBooleanOption((o) => o.setName('ping').setDescription('ແຈ້ງເຕືອນຄົນທີ່ເລືອກຮັບໂປຣ'))
      .addBooleanOption((o) => o.setName('buttons').setDescription('ໃສ່ປຸ່ມ Facebook / WhatsApp (ຄ່າເລີ່ມຕົ້ນ: ໃສ່)')),
  ],
  setup({ client, cfg, logTo }) {
    const pending = new Map();

    client.on(Events.InteractionCreate, async (i) => {
      try {
        if (i.isChatInputCommand() && i.commandName === 'promo') {
          const img = i.options.getAttachment('image');
          pending.set(i.user.id, {
            channelId: i.options.getChannel('channel').id,
            imageUrl: img ? img.url : null,
            ping: i.options.getBoolean('ping') ?? false,
            buttons: i.options.getBoolean('buttons') ?? true,
          });
          const modal = new ModalBuilder().setCustomId('promo-modal').setTitle('ສ້າງໂພສໂປຣ');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('ຫົວຂໍ້').setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('ລາຍລະອຽດ').setStyle(TextInputStyle.Paragraph).setMaxLength(3500).setRequired(false)),
          );
          return i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === 'promo-modal') {
          const p = pending.get(i.user.id);
          pending.delete(i.user.id);
          if (!p) return i.reply({ content: 'ໝົດເວລາ — ລອງພິມ /promo ໃໝ່', flags: MessageFlags.Ephemeral });
          const ch = i.guild.channels.cache.get(p.channelId);
          const n = ch.name.toLowerCase();
          const color = n.includes('valorant') ? 0xFFC400 : n.includes('steam') ? 0xFFC400 : 0xFFC400;
          const embed = new EmbedBuilder().setColor(color).setAuthor({ name: 'P SHOP GAMERPOWER' })
            .setTitle(i.fields.getTextInputValue('title')).setFooter({ text: 'JIBI · P SHOP Gaming Hub' }).setTimestamp();
          const desc = i.fields.getTextInputValue('desc');
          if (desc) embed.setDescription(desc);
          if (p.imageUrl) embed.setImage(p.imageUrl);

          const components = [];
          if (p.buttons) {
            const row = new ActionRowBuilder();
            if (isUrl(process.env.FACEBOOK_URL)) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('🛒 ສັ່ງຊື້ຜ່ານ Facebook').setURL(process.env.FACEBOOK_URL));
            if (isUrl(process.env.WHATSAPP_URL)) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('WhatsApp').setURL(process.env.WHATSAPP_URL));
            if (row.components.length) components.push(row);
          }
          const promoRole = i.guild.roles.cache.find((r) => r.name === cfg.roles.promo.name);
          await ch.send({
            content: p.ping && promoRole ? `<@&${promoRole.id}>` : undefined,
            embeds: [embed], components,
            allowedMentions: { roles: promoRole ? [promoRole.id] : [] },
          });
          await i.reply({ content: `✅ ສົ່ງໂພສໄປ ${ch} ແລ້ວ`, flags: MessageFlags.Ephemeral });
          return logTo(`📤 **${i.user.username}** ໂພສໂປຣ → ${ch.name}${p.ping ? ' (ແຈ້ງເຕືອນ)' : ''}`);
        }
      } catch (e) {
        console.error('[promo]', e.message);
        if (i.isRepliable() && !i.replied) i.reply({ content: '❌ ມີບັນຫາ ລອງໃໝ່', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    });
  },
};
