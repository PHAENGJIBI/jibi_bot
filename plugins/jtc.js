// ปลั๊กอิน: Join-to-Create — เข้าห้อง "➕ ສ້າງຫ້ອງ ..." แล้ว JIBI สร้างห้องเสียงส่วนตัวให้ทันที ห้องว่าง = ลบเอง
const { Events, ChannelType, PermissionFlagsBits: P, OverwriteType } = require('discord.js');
const store = require('../lib/store');

module.exports = {
  id: 'jtc',
  name: 'ห้องเสียงสร้างเอง (Join-to-Create)',
  description: 'สมาชิกเข้าห้อง ➕ ສ້າງຫ້ອງ … แล้ว JIBI สร้างห้องเสียงส่วนตัว 5 คนให้ เจ้าของห้องเตะ/ย้ายคนได้ คนออกหมดห้องหายเอง',
  setup({ client, guild }) {
    const temp = new Set(store.load('jtc-temp', []));
    const persist = () => store.save('jtc-temp', [...temp]);
    const isTrigger = (ch) => ch && ch.type === ChannelType.GuildVoice && ch.name.startsWith('➕');

    async function cleanup(ch) {
      if (ch && temp.has(ch.id) && ch.members.size === 0) {
        temp.delete(ch.id); persist();
        await ch.delete('ห้องว่าง (Join-to-Create)').catch(() => {});
      }
    }

    client.on(Events.VoiceStateUpdate, async (oldS, newS) => {
      try {
        if (newS.channel && isTrigger(newS.channel) && newS.member && !newS.member.user.bot) {
          const m = newS.member;
          const parent = newS.channel.parent;
          const overwrites = parent ? parent.permissionOverwrites.cache.map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield })) : [];
          overwrites.push({ id: m.id, type: OverwriteType.Member, allow: [P.ViewChannel, P.Connect, P.Speak, P.ManageChannels, P.MoveMembers, P.MuteMembers] });
          const ch = await guild.channels.create({
            name: `🔊 ຫ້ອງຂອງ ${m.displayName}`.slice(0, 95),
            type: ChannelType.GuildVoice,
            parent: parent ? parent.id : null,
            userLimit: 5,
            bitrate: guild.maximumBitrate,
            permissionOverwrites: overwrites,
          });
          temp.add(ch.id); persist();
          await m.voice.setChannel(ch).catch(() => cleanup(ch));
        }
        if (oldS.channel && oldS.channelId !== newS.channelId) await cleanup(oldS.channel);
      } catch (e) { console.error('[jtc]', e.message); }
    });

    // ล้างห้องว่างที่ค้างจากรอบก่อน
    for (const id of [...temp]) {
      const ch = guild.channels.cache.get(id);
      if (!ch) { temp.delete(id); continue; }
      cleanup(ch);
    }
    persist();
  },
};
