/**
 * .play — Cari dan kirim audio dari YouTube via scraping (tanpa API key)
 * Gunakan: .play <judul lagu>
 * Stop   : .stop
 */

const ytSearch = require('yt-search');
const ytdl = require('@distube/ytdl-core');

// Track download aktif per sender: sender -> { cancel }
const activeDownloads = {};

function getActiveDownloads() {
  return activeDownloads;
}

module.exports = {
  name: '.play',
  command: ['.play'],
  getActiveDownloads,

  execute: async (sock, sender, args, msg) => {
    const query = args.join(' ').trim();

    if (!query) {
      return sock.sendMessage(sender, {
        text: '🎵 Cara pakai: *.play <judul lagu>*\nContoh: .play dewa 19 kangen'
      }, { quoted: msg });
    }

    if (activeDownloads[sender]) {
      return sock.sendMessage(sender, {
        text: '⏳ Masih ada download aktif. Ketik *.stop* untuk membatalkan.'
      }, { quoted: msg });
    }

    await sock.sendMessage(sender, {
      text: `🔍 Mencari: *${query}*...`
    }, { quoted: msg });

    try {
      // ── 1. Cari video di YouTube ─────────────────────────────────
      const result = await ytSearch(query);
      const video = result.videos?.[0];

      if (!video) {
        return sock.sendMessage(sender, {
          text: '❌ Video tidak ditemukan. Coba kata kunci lain.'
        }, { quoted: msg });
      }

      // Batasi durasi maksimal 10 menit
      if (video.seconds > 600) {
        return sock.sendMessage(sender, {
          text: `❌ Video terlalu panjang (*${video.timestamp}*). Maksimal 10 menit.`
        }, { quoted: msg });
      }

      await sock.sendMessage(sender, {
        text:
          `🎵 *${video.title}*\n` +
          `👤 ${video.author.name}\n` +
          `⏱️ ${video.timestamp}\n` +
          `🔗 ${video.url}\n\n` +
          `⬇️ Mengunduh audio, harap tunggu...`
      }, { quoted: msg });

      // ── 2. Download audio ────────────────────────────────────────
      let cancelled = false;
      let stream = null;

      activeDownloads[sender] = {
        cancel: () => {
          cancelled = true;
          try { stream?.destroy(); } catch (e) {}
        }
      };

      stream = ytdl(video.url, {
        filter: 'audioonly',
        quality: 'lowestaudio'
      });

      const chunks = [];
      await new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      if (cancelled) {
        delete activeDownloads[sender];
        return;
      }

      delete activeDownloads[sender];

      const audioBuffer = Buffer.concat(chunks);

      // ── 3. Kirim sebagai audio ───────────────────────────────────
      await sock.sendMessage(sender, {
        audio: audioBuffer,
        mimetype: 'audio/mp4',
        fileName: `${video.title.replace(/[^\w\s]/gi, '')}.mp4`
      }, { quoted: msg });

    } catch (err) {
      delete activeDownloads[sender];
      console.error('[play] Error:', err.message);
      await sock.sendMessage(sender, {
        text: `❌ Gagal mengunduh audio:\n${err.message}\n\nCoba lagi atau gunakan judul lain.`
      }, { quoted: msg });
    }
  }
};
