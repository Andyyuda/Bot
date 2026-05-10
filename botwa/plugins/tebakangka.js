/**
 * .tebakangka — Game tebak angka 1-100
 * .tebak <angka> — menebak angka
 */

if (!global.tebakGame) global.tebakGame = new Map();

module.exports = {
  name: '.tebakangka',
  command: ['.tebakangka', '.ta', '.tebak'],

  async execute(conn, sender, args, msg) {
    const jid = msg.key.remoteJid;
    const cmd = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').split(' ')[0].toLowerCase().replace(/^\./, '');

    // --- Mulai game baru ---
    if (cmd === 'tebakangka' || cmd === 'ta') {
      const angka = Math.floor(Math.random() * 100) + 1;
      global.tebakGame.set(jid, { angka, coba: 0, max: 7, mulai: Date.now() });
      return conn.sendMessage(sender, {
        text: `🎮 *TEBAK ANGKA*\n\nAku sudah pilih angka antara *1 - 100*!\nKamu punya *7 kesempatan* untuk menebak.\n\nKetik: _.tebak <angka>_\nContoh: _.tebak 50_\n\n🕐 Game dimulai!`
      }, { quoted: msg });
    }

    // --- Menebak ---
    if (cmd === 'tebak') {
      const game = global.tebakGame.get(jid);
      if (!game) {
        return conn.sendMessage(sender, {
          text: `❌ Belum ada game aktif!\nMulai dengan *.tebakangka*`
        }, { quoted: msg });
      }

      const tebakan = parseInt(args[0]);
      if (isNaN(tebakan) || tebakan < 1 || tebakan > 100) {
        return conn.sendMessage(sender, {
          text: `⚠️ Masukkan angka antara 1-100!\nContoh: _.tebak 50_`
        }, { quoted: msg });
      }

      game.coba++;
      const sisa = game.max - game.coba;

      if (tebakan === game.angka) {
        global.tebakGame.delete(jid);
        const emoji = game.coba <= 3 ? '🏆' : game.coba <= 5 ? '🎉' : '😅';
        return conn.sendMessage(sender, {
          text: `${emoji} *BENAR!*\n\nAngkanya adalah *${game.angka}*!\nKamu berhasil dalam *${game.coba} percobaan*!\n\n${game.coba === 1 ? '🤯 LUAR BIASA! Tebakan pertama!' : game.coba <= 3 ? '⭐ Bagus sekali!' : '✅ Selamat!'}\n\nMain lagi? Ketik _.tebakangka_`
        }, { quoted: msg });
      }

      if (game.coba >= game.max) {
        global.tebakGame.delete(jid);
        return conn.sendMessage(sender, {
          text: `💀 *GAME OVER!*\n\nAngkanya adalah *${game.angka}*.\nSayang sekali, kamu kehabisan kesempatan!\n\nCoba lagi? Ketik _.tebakangka_`
        }, { quoted: msg });
      }

      const hint = tebakan < game.angka
        ? `📈 Terlalu *KECIL*! Coba yang lebih besar.`
        : `📉 Terlalu *BESAR*! Coba yang lebih kecil.`;

      return conn.sendMessage(sender, {
        text: `${hint}\n\n🎯 Tebakan: *${tebakan}*\n⏳ Sisa kesempatan: *${sisa}*\n\nKetik: _.tebak <angka>_`
      }, { quoted: msg });
    }
  }
};
