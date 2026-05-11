/**
 * .tebakkata — Game tebak kata (hangman versi WhatsApp)
 * Ketik huruf untuk menebak
 */

const KOSAKATA = [
  { kata: 'smartphone', petunjuk: '📱 Gadget elektronik genggam' },
  { kata: 'programer', petunjuk: '💻 Orang yang membuat aplikasi/software' },
  { kata: 'internet', petunjuk: '🌐 Jaringan komputer global' },
  { kata: 'indonesia', petunjuk: '🇮🇩 Nama negara kita' },
  { kata: 'pancasila', petunjuk: '⚖️ Dasar negara Indonesia' },
  { kata: 'nusantara', petunjuk: '🏝️ Nama ibu kota baru Indonesia' },
  { kata: 'kerupuk', petunjuk: '🍘 Makanan renyah khas Indonesia' },
  { kata: 'rendang', petunjuk: '🍖 Masakan Padang terkenal di dunia' },
  { kata: 'batik', petunjuk: '👘 Kain warisan budaya Indonesia' },
  { kata: 'gamelan', petunjuk: '🎵 Alat musik tradisional Jawa' },
  { kata: 'wayang', petunjuk: '🎭 Pertunjukan boneka tradisional' },
  { kata: 'satelit', petunjuk: '🛸 Benda yang mengorbit planet' },
  { kata: 'algoritma', petunjuk: '🔢 Langkah-langkah memecahkan masalah' },
  { kata: 'database', petunjuk: '🗄️ Tempat menyimpan data terstruktur' },
  { kata: 'kecerdasan', petunjuk: '🧠 Kemampuan berpikir dan belajar' },
  { kata: 'keberanian', petunjuk: '💪 Tidak takut menghadapi tantangan' },
  { kata: 'persahabatan', petunjuk: '🤝 Hubungan pertemanan yang erat' },
  { kata: 'petualangan', petunjuk: '🗺️ Perjalanan penuh tantangan' },
  { kata: 'kehidupan', petunjuk: '🌱 Keberadaan makhluk hidup' },
  { kata: 'kemerdekaan', petunjuk: '🇮🇩 Bebas dari penjajahan' },
];

const MAX_SALAH = 6;
const HANGMAN = [
  '```\n   ___\n  |   |\n  |\n  |\n  |\n__|__```',
  '```\n   ___\n  |   |\n  |   O\n  |\n  |\n__|__```',
  '```\n   ___\n  |   |\n  |   O\n  |   |\n  |\n__|__```',
  '```\n   ___\n  |   |\n  |   O\n  |  /|\n  |\n__|__```',
  '```\n   ___\n  |   |\n  |   O\n  |  /|\\\n  |\n__|__```',
  '```\n   ___\n  |   |\n  |   O\n  |  /|\\\n  |  /\n__|__```',
  '```\n   ___\n  |   |\n  |   O\n  |  /|\\\n  |  / \\\n__|__```',
];

if (!global.tebakKata) global.tebakKata = new Map();

function tampilKata(kata, tebak) {
  return kata.split('').map(h => tebak.has(h) ? h : '_').join(' ');
}

module.exports = {
  name: '.tebakkata',
  command: ['.tebakkata', '.hangman', '.tk'],

  async execute(conn, sender, args, msg) {
    const jid = msg.key.remoteJid;
    const input = args.join('').toLowerCase().trim();
    const cmd   = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().split(' ')[0].toLowerCase();

    // Mulai game baru
    if (cmd === '.tebakkata' || cmd === '.hangman' || cmd === '.tk') {
      // Kalau ada input huruf di game yang sudah jalan
      const game = global.tebakKata.get(jid);

      if (game && input.length === 1 && /[a-z]/.test(input)) {
        // Proses tebakan huruf
        if (game.tebak.has(input)) {
          return conn.sendMessage(sender, {
            text: `⚠️ Huruf *${input.toUpperCase()}* sudah ditebak sebelumnya!\n\n${tampilKata(game.kata, game.tebak)}\n\nHuruf salah: *${[...game.salah].join(', ').toUpperCase() || '-'}*`
          }, { quoted: msg });
        }

        game.tebak.add(input);
        const benar = game.kata.includes(input);
        if (!benar) game.salah.push(input);

        const display  = tampilKata(game.kata, game.tebak);
        const selesai  = game.kata.split('').every(h => game.tebak.has(h));
        const gameover = game.salah.length >= MAX_SALAH;

        if (selesai) {
          global.tebakKata.delete(jid);
          return conn.sendMessage(sender, {
            text: `🎉 *SELAMAT! KAMU BENAR!*\n\nKata: *${game.kata.toUpperCase()}*\n💡 ${game.petunjuk}\n\nSalah: ${game.salah.length}x\nMain lagi? Ketik _.tebakkata_`
          }, { quoted: msg });
        }

        if (gameover) {
          global.tebakKata.delete(jid);
          return conn.sendMessage(sender, {
            text: `${HANGMAN[MAX_SALAH]}\n\n💀 *GAME OVER!*\nJawabannya: *${game.kata.toUpperCase()}*\n💡 ${game.petunjuk}\n\nMain lagi? _.tebakkata_`
          }, { quoted: msg });
        }

        global.tebakKata.set(jid, game);
        return conn.sendMessage(sender, {
          text: `${HANGMAN[game.salah.length]}\n\n${benar ? '✅ Benar!' : `❌ Salah! (${game.salah.length}/${MAX_SALAH})`}\n\n📝 ${display}\n💡 ${game.petunjuk}\n\n❌ Salah: *${game.salah.join(', ').toUpperCase() || '-'}*\n\nTebak huruf: _.tk <huruf>_`
        }, { quoted: msg });
      }

      // Mulai game baru
      const pilih = KOSAKATA[Math.floor(Math.random() * KOSAKATA.length)];
      const game2 = { kata: pilih.kata, petunjuk: pilih.petunjuk, tebak: new Set(), salah: [] };
      global.tebakKata.set(jid, game2);

      const display = tampilKata(pilih.kata, game2.tebak);
      return conn.sendMessage(sender, {
        text: `${HANGMAN[0]}\n\n🎮 *TEBAK KATA (Hangman)*\n\n📝 ${display}\n💡 Petunjuk: ${pilih.petunjuk}\n📏 Panjang: ${pilih.kata.length} huruf\n\nCara main: ketik _.tk <huruf>_ untuk menebak\nContoh: _.tk a_`
      }, { quoted: msg });
    }
  }
};
