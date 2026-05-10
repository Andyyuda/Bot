/**
 * .play — Cari dan kirim audio dari YouTube via y2mate.nu (scraping, tanpa API key)
 * Gunakan: .play <judul lagu>
 * Stop   : .stop
 */

const ytSearch = require('yt-search');

const Y2MATE_HOME = 'https://v3.y2mate.nu/';
const IOTA_API   = 'https://iotacloud.org/api/';
const HEADERS    = {
  'Referer'   : Y2MATE_HOME,
  'Origin'    : 'https://v3.y2mate.nu',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept'    : 'application/json, text/plain, */*'
};

// Cache token y2mate (berlaku ~5 menit)
let tokenCache = null;
let tokenCacheTime = 0;

/**
 * Ambil authorization token dari halaman y2mate.nu
 */
async function getAuthToken() {
  const now = Date.now();
  if (tokenCache && now - tokenCacheTime < 5 * 60 * 1000) return tokenCache;

  const html = await fetch(Y2MATE_HOME, { headers: HEADERS }).then(r => r.text());
  const m = html.match(/var json = JSON\.parse\('([^']+)'\)/);
  if (!m) throw new Error('Gagal ambil token y2mate');

  const json = JSON.parse(m[1]);
  let auth = '';
  for (let t = 0; t < json[0].length; t++)
    auth += String.fromCharCode(json[0][t] - json[2][json[2].length - (t + 1)]);
  if (json[1]) auth = auth.split('').reverse().join('');
  if (auth.length > 32) auth = auth.substring(0, 32);

  tokenCache = auth;
  tokenCacheTime = now;
  return auth;
}

/**
 * Minta MP3 dari y2mate API, poll sampai selesai
 * @param {string} videoId  - YouTube video ID (11 karakter)
 * @param {Function} isCancelled - cek apakah download dibatalkan
 * @returns {string} URL MP3
 */
async function getMp3Url(videoId, isCancelled) {
  const auth = await getAuthToken();
  let retry = 1;
  const MAX_RETRY = 6; // max ~2 menit

  while (retry <= MAX_RETRY) {
    if (isCancelled()) throw new Error('CANCELLED');

    const ts  = Math.floor(Date.now() / 1000);
    const url = `${IOTA_API}?a=${encodeURIComponent(auth)}&r=${retry}&v=${videoId}&t=${ts}`;

    const res  = await fetch(url, { headers: HEADERS });
    const data = await res.json();

    if (data.progress === 'completed' && data.url) return data.url;

    if (data.progress === 'converting') {
      // Konversi sedang berjalan di server, tunggu 20 detik lalu retry
      await new Promise(r => setTimeout(r, 20000));
      retry++;
      continue;
    }

    // Error dari server — coba refresh token sekali
    if (retry === 1) {
      tokenCache = null;
      const freshAuth = await getAuthToken();
      const ts2  = Math.floor(Date.now() / 1000);
      const url2 = `${IOTA_API}?a=${encodeURIComponent(freshAuth)}&r=1&v=${videoId}&t=${ts2}`;
      const res2  = await fetch(url2, { headers: HEADERS });
      const data2 = await res2.json();
      if (data2.progress === 'completed' && data2.url) return data2.url;
      if (data2.progress === 'converting') {
        await new Promise(r => setTimeout(r, 20000));
        retry = 2;
        continue;
      }
    }

    throw new Error(`y2mate error: ${JSON.stringify(data)}`);
  }

  throw new Error('Timeout konversi y2mate setelah beberapa percobaan.');
}

// ── Track download aktif per sender ──────────────────────────────────────────
const activeDownloads = {};
function getActiveDownloads() { return activeDownloads; }

// ── Ekstrak video ID dari URL YouTube ────────────────────────────────────────
function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
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

    await sock.sendMessage(sender, { text: `🔍 Mencari: *${query}*...` }, { quoted: msg });

    let cancelled = false;
    activeDownloads[sender] = { cancel: () => { cancelled = true; } };

    try {
      // ── 1. Cari video YouTube ─────────────────────────────────────
      const result = await ytSearch(query);
      const video  = result.videos?.[0];

      if (!video) {
        delete activeDownloads[sender];
        return sock.sendMessage(sender, {
          text: '❌ Video tidak ditemukan. Coba kata kunci lain.'
        }, { quoted: msg });
      }

      if (video.seconds > 600) {
        delete activeDownloads[sender];
        return sock.sendMessage(sender, {
          text: `❌ Video terlalu panjang (*${video.timestamp}*). Maksimal 10 menit.`
        }, { quoted: msg });
      }

      const videoId = extractVideoId(video.url);
      if (!videoId) {
        delete activeDownloads[sender];
        return sock.sendMessage(sender, { text: '❌ Gagal ekstrak ID video.' }, { quoted: msg });
      }

      await sock.sendMessage(sender, {
        text:
          `🎵 *${video.title}*\n` +
          `👤 ${video.author.name}\n` +
          `⏱️ ${video.timestamp}\n\n` +
          `⬇️ Mengonversi audio via y2mate, harap tunggu...`
      }, { quoted: msg });

      // ── 2. Minta MP3 URL dari y2mate.nu ──────────────────────────
      const mp3Url = await getMp3Url(videoId, () => cancelled);

      if (cancelled) { delete activeDownloads[sender]; return; }

      // ── 3. Download MP3 ke buffer ─────────────────────────────────
      await sock.sendMessage(sender, { text: `📥 Mengunduh file MP3...` }, { quoted: msg });

      const mp3Res = await fetch(mp3Url, { headers: { 'Referer': Y2MATE_HOME } });
      if (!mp3Res.ok) throw new Error(`HTTP ${mp3Res.status} saat download MP3`);

      const arrayBuf = await mp3Res.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuf);

      if (cancelled) { delete activeDownloads[sender]; return; }
      delete activeDownloads[sender];

      // ── 4. Kirim sebagai audio ke WhatsApp ────────────────────────
      const safeTitle = video.title.replace(/[^\w\s]/gi, '').trim() || 'audio';
      await sock.sendMessage(sender, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${safeTitle}.mp3`
      }, { quoted: msg });

    } catch (err) {
      delete activeDownloads[sender];
      if (err.message === 'CANCELLED') return;
      console.error('[play] Error:', err.message);
      await sock.sendMessage(sender, {
        text: `❌ Gagal unduh audio:\n${err.message}\n\nCoba judul lain atau beberapa saat lagi.`
      }, { quoted: msg });
    }
  }
};
