/**
 * Helper untuk normalisasi JID WhatsApp
 * Mendukung format lama (@s.whatsapp.net) dan format baru LID (@lid)
 */

/**
 * Ambil nomor telepon dari JID dalam format apapun
 * Contoh:
 *   628xxx:5@lid     -> 628xxx
 *   628xxx@s.whatsapp.net -> 628xxx
 *   628xxx           -> 628xxx
 */
function getPhoneNumber(jid = '') {
  return jid.split(':')[0].split('@')[0];
}

/**
 * Normalisasi JID ke format standar @s.whatsapp.net
 * Contoh:
 *   628xxx:5@lid  -> 628xxx@s.whatsapp.net
 *   628xxx        -> 628xxx@s.whatsapp.net
 */
function normalizeJid(jid = '') {
  if (!jid) return '';
  const num = jid.split(':')[0].split('@')[0];
  return num + '@s.whatsapp.net';
}

/**
 * Cek apakah JID termasuk owner
 * Mendukung format @lid dan @s.whatsapp.net
 * @param {string} jid - JID pengirim
 * @param {string[]} ownerList - daftar nomor owner (hanya angka, tanpa @domain)
 */
function isOwner(jid, ownerList) {
  const num = getPhoneNumber(jid);
  return ownerList.some(o => getPhoneNumber(o) === num);
}

/**
 * Cek apakah JID adalah JID grup
 */
function isGroup(jid = '') {
  return jid.endsWith('@g.us');
}

/**
 * Ambil JID pengirim dari pesan (mendukung LID dan s.whatsapp.net)
 * Di grup: msg.key.participant
 * Di PM: msg.key.remoteJid
 */
function getSenderJid(msg) {
  return msg.key?.participant || msg.key?.remoteJid || '';
}

module.exports = { getPhoneNumber, normalizeJid, isOwner, isGroup, getSenderJid };
