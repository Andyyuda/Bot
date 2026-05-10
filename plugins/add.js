const { isOwner, isBotAdmin, isSenderAdmin } = require('../lib/helper');
const setting = require('../setting');

module.exports = {
  name: '.add',
  command: ['.add'],
  execute: async (conn, sender, args, msg) => {
    const groupId = msg.key.remoteJid;

    if (!groupId.endsWith('@g.us')) {
      return conn.sendMessage(sender, { text: '❌ Perintah ini hanya bisa digunakan di dalam grup.' }, { quoted: msg });
    }

    const pengirim = msg.key.participant || msg.key.remoteJid;

    let botIsAdmin = false;
    let senderIsAdmin = false;
    try {
      const groupMeta = await conn.groupMetadata(groupId);
      botIsAdmin = isBotAdmin(conn, groupMeta.participants);
      senderIsAdmin = isSenderAdmin(pengirim, groupMeta.participants) ||
                      isOwner(pengirim, setting.owner);
    } catch (e) {}

    if (!senderIsAdmin) {
      return conn.sendMessage(sender, { text: '❌ Hanya *admin grup* atau *owner* yang bisa menambahkan anggota.' }, { quoted: msg });
    }

    if (!botIsAdmin) {
      return conn.sendMessage(sender, { text: '❌ Bot harus menjadi *admin grup* untuk menambahkan anggota.' }, { quoted: msg });
    }

    const nomor = args[0]?.replace(/[^0-9]/g, '');
    if (!nomor) {
      return conn.sendMessage(sender, { text: '⚠️ Contoh: .add 6281234567890' }, { quoted: msg });
    }

    const jid = nomor + '@s.whatsapp.net';
    try {
      await conn.groupParticipantsUpdate(groupId, [jid], 'add');
      await conn.sendMessage(sender, { text: `✅ Berhasil menambahkan @${nomor}`, mentions: [jid] }, { quoted: msg });
    } catch (e) {
      await conn.sendMessage(sender, { text: '❌ Gagal menambahkan. Mungkin pengguna menolak undangan grup.' }, { quoted: msg });
    }
  }
};
