const { isOwner, isBotAdmin, isSenderAdmin } = require('../lib/helper');
const setting = require('../setting');

module.exports = {
  name: '.kick',
  command: ['.kick'],
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
    } catch (e) {
      console.error('❌ Gagal cek admin:', e.message);
    }

    if (!senderIsAdmin) {
      return conn.sendMessage(sender, { text: '❌ Hanya *admin grup* atau *owner* yang bisa kick.' }, { quoted: msg });
    }

    if (!botIsAdmin) {
      return conn.sendMessage(sender, { text: '❌ Bot harus menjadi *admin grup* untuk kick anggota.' }, { quoted: msg });
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (!mentioned || mentioned.length === 0) {
      return conn.sendMessage(sender, { text: '⚠️ Tag seseorang untuk dikeluarkan. Contoh: .kick @628xxxx' }, { quoted: msg });
    }

    try {
      await conn.groupParticipantsUpdate(groupId, mentioned, 'remove');
      await conn.sendMessage(sender, { text: `✅ Berhasil mengeluarkan anggota.` }, { quoted: msg });
    } catch (e) {
      await conn.sendMessage(sender, { text: `❌ Gagal mengeluarkan anggota: ${e.message}` }, { quoted: msg });
    }
  }
};
