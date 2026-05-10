const { isOwner } = require('../lib/helper');
const setting = require('../setting');

module.exports = {
  name: '.add',
  command: ['.add'],
  execute: async (conn, sender, args, msg) => {
    const groupId = msg.key.remoteJid;

    // ✅ Hanya bisa di grup
    if (!groupId.endsWith('@g.us')) {
      return conn.sendMessage(sender, { text: '❌ Perintah ini hanya bisa digunakan di dalam grup.' }, { quoted: msg });
    }

    // ✅ FIX LID: ambil JID pengirim dengan benar
    const pengirim = msg.key.participant || msg.key.remoteJid;
    const { getPhoneNumber } = require('../lib/helper');

    // ✅ Cek admin atau owner
    let senderIsAdmin = false;
    try {
      const groupMeta = await conn.groupMetadata(groupId);
      const admins = groupMeta.participants.filter(p => p.admin).map(p => p.id);
      senderIsAdmin = admins.some(a => getPhoneNumber(a) === getPhoneNumber(pengirim)) ||
                      isOwner(pengirim, setting.owner);
    } catch (e) {}

    if (!senderIsAdmin) {
      return conn.sendMessage(sender, { text: '❌ Hanya *admin grup* atau *owner* yang bisa menambahkan anggota.' }, { quoted: msg });
    }

    const nomor = args[0]?.replace(/[^0-9]/g, '');
    if (!nomor) {
      return conn.sendMessage(sender, { text: '⚠️ Contoh: .add 6281234567890' }, { quoted: msg });
    }

    const jid = nomor + '@s.whatsapp.net';
    try {
      // ✅ FIX: gunakan groupId (remoteJid) bukan sender
      await conn.groupParticipantsUpdate(groupId, [jid], 'add');
      await conn.sendMessage(sender, { text: `✅ Berhasil menambahkan @${nomor}`, mentions: [jid] }, { quoted: msg });
    } catch (e) {
      await conn.sendMessage(sender, { text: '❌ Gagal menambahkan. Mungkin pengguna menolak undangan grup.' }, { quoted: msg });
    }
  }
};
