// ปลั๊กอิน: Highlight Board — ข้อความ/คลิปที่ได้ ⭐ ครบ 5 → JIBI นำไปโชว์ในห้อง ⭐ highlight
const { Events, EmbedBuilder } = require('discord.js');
const store = require('../lib/store');

const NEED = 5;

module.exports = {
  id: 'highlight',
  name: 'Highlight Board ⭐',
  description: `ข้อความหรือคลิปที่ได้ ⭐ ครบ ${NEED} ดวง → JIBI นำไปโชว์ในห้อง ⭐・highlight`,
  setup({ client, guild }) {
    const posted = new Set(store.load('highlight', []));
    client.on(Events.MessageReactionAdd, async (reaction) => {
      try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.emoji.name !== '⭐' || reaction.count < NEED) return;
        const msg = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
        if (!msg.guild || msg.author.bot || posted.has(msg.id)) return;
        const board = guild.channels.cache.find((c) => c.name.includes('highlight') && !(c.parent && c.parent.name.startsWith('📦 ARCHIVE')));
        if (!board || board.id === msg.channelId) return;
        posted.add(msg.id); store.save('highlight', [...posted].slice(-2000));
        const embed = new EmbedBuilder()
          .setColor(0xFFC400)
          .setAuthor({ name: msg.member ? msg.member.displayName : msg.author.username, iconURL: msg.author.displayAvatarURL() })
          .setDescription(`${msg.content || ''}\n\n[➡️ ໄປທີ່ຂໍ້ຄວາມ](${msg.url})`.trim())
          .setFooter({ text: `⭐ ${reaction.count} · #${msg.channel.name}` })
          .setTimestamp(msg.createdAt);
        const img = msg.attachments.find((a) => (a.contentType || '').startsWith('image/'));
        if (img) embed.setImage(img.url);
        const video = msg.attachments.find((a) => (a.contentType || '').startsWith('video/'));
        await board.send({ content: video ? video.url : undefined, embeds: [embed], allowedMentions: { parse: [] } });
      } catch (e) { console.error('[highlight]', e.message); }
    });
  },
};
