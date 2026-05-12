const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔧 Deteksi platform dari URL
  // ─────────────────────────────────────────────────────────────────────────────
  function detectPlatform(url) {
    if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
    if (/tiktok\.com/.test(url))             return 'tiktok';
    if (/instagram\.com/.test(url))          return 'instagram';
    return null;
  }

  function extractUrl(text) {
    const match = text.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 📥 YouTube — scraping savefrom.net
  // ─────────────────────────────────────────────────────────────────────────────
  async function downloadYouTube(url, mode = 'video') {
    // savefrom.net internal API
    const params = new URLSearchParams({
      sf_url : url,
      new_web: '1',
      lang   : 'id'
    });

    const res = await fetch('https://worker.sf-tools.com/savefrom.php', {
      method : 'POST',
      headers: {
        'Content-Type'   : 'application/x-www-form-urlencoded',
        'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer'        : 'https://id.savefrom.net/',
        'Origin'         : 'https://id.savefrom.net',
        'Accept'         : 'application/json, text/javascript, */*',
      },
      body   : params.toString(),
      timeout: 20000
    });

    if (!res.ok) throw new Error('savefrom.net error: ' + res.status);
    const data = await res.json();

    if (!data || data.err) throw new Error(data.err || 'Gagal ambil data dari savefrom');

    const title  = data.meta?.title || 'YouTube Video';
    const thumb  = data.meta?.thumb || '';
    const dur    = data.meta?.duration || '';

    // Pisahkan link audio dan video
    const links = Array.isArray(data.url) ? data.url : [];

    if (mode === 'audio') {
      // Cari format mp3/audio
      const audio = links.find(l => l.meta?.q === 'mp3' || (l.ext === 'mp3') || (l.meta?.q?.includes('audio')));
      if (!audio) throw new Error('Format audio (MP3) tidak tersedia untuk video ini');
      return { title, thumb, dur, downloadUrl: audio.url.replace(/\\/g, ''), ext: 'mp3' };
    }

    // Prioritas kualitas video: 720p → 480p → 360p → yang ada
    const prioritas = ['720p', '480p', '360p', '240p', '144p'];
    let chosen = null;

    for (const q of prioritas) {
      chosen = links.find(l =>
        (l.meta?.q === q || l.meta?.q?.includes(q.replace('p', ''))) &&
        (l.ext === 'mp4' || !l.ext)
      );
      if (chosen) break;
    }

    if (!chosen) chosen = links.find(l => l.ext === 'mp4' || !l.ext);
    if (!chosen) throw new Error('Format video tidak tersedia');

    const quality = chosen.meta?.q || '?';
    return {
      title,
      thumb,
      dur,
      quality,
      downloadUrl: chosen.url.replace(/\\/g, ''),
      ext        : chosen.ext || 'mp4'
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 📥 TikTok — tikwm.com (tanpa watermark)
  // ─────────────────────────────────────────────────────────────────────────────
  async function downloadTikTok(url) {
    const res = await fetch('https://www.tikwm.com/api/', {
      method : 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body   : 'url=' + encodeURIComponent(url) + '&hd=1',
      timeout: 20000
    });

    if (!res.ok) throw new Error('TikWM error: ' + res.status);
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.msg || 'Gagal ambil data TikTok');

    const d = data.data;
    return {
      title      : d.title || 'TikTok Video',
      author     : d.author?.nickname || '-',
      downloadUrl: d.hdplay || d.play,
      duration   : d.duration || 0,
      likes      : d.digg_count || 0,
      views      : d.play_count || 0
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 📥 Instagram — pakai savefrom juga
  // ─────────────────────────────────────────────────────────────────────────────
  async function downloadInstagram(url) {
    const params = new URLSearchParams({ sf_url: url, new_web: '1', lang: 'id' });

    const res = await fetch('https://worker.sf-tools.com/savefrom.php', {
      method : 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent'  : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer'     : 'https://id.savefrom.net/',
        'Origin'      : 'https://id.savefrom.net'
      },
      body   : params.toString(),
      timeout: 20000
    });

    if (!res.ok) throw new Error('savefrom.net error: ' + res.status);
    const data = await res.json();
    if (!data || data.err) throw new Error(data.err || 'Gagal ambil data Instagram');

    const links = Array.isArray(data.url) ? data.url : [];
    const video = links.find(l => l.ext === 'mp4' || l.type?.includes('video')) || links[0];
    if (!video) throw new Error('Video tidak ditemukan');

    return {
      title      : data.meta?.title || 'Instagram Video',
      downloadUrl: video.url.replace(/\\/g, '')
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔄 Download buffer dari URL
  // ─────────────────────────────────────────────────────────────────────────────
  async function getBuffer(url) {
    const res = await fetch(url, {
      timeout: 90000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer'   : 'https://id.savefrom.net/'
      }
    });
    if (!res.ok) throw new Error('Gagal download file: ' + res.status);

    const size = parseInt(res.headers.get('content-length') || '0');
    if (size > 64 * 1024 * 1024) throw new Error('File terlalu besar (>64MB) untuk dikirim via WhatsApp');

    return { buffer: await res.buffer(), contentType: res.headers.get('content-type') || '' };
  }

  function formatAngka(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  function formatDurasi(detik) {
    const m = Math.floor(detik / 60);
    const s = detik % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 📦 Export Plugin
  // ─────────────────────────────────────────────────────────────────────────────
  module.exports = {
    name   : '.dl',
    command: ['.dl', '.download', '.yt', '.ytmp3', '.ytmp4', '.tt', '.tiktok', '.ig'],

    async execute(sock, sender, args, msg, text) {
      const cmd     = text.trim().split(' ')[0].toLowerCase();
      const rawArgs = args.join(' ').trim();

      // Ambil URL dari args atau dari pesan yang di-reply
      let url = extractUrl(rawArgs);
      if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const q =
          msg.message.extendedTextMessage.contextInfo.quotedMessage?.conversation ||
          msg.message.extendedTextMessage.contextInfo.quotedMessage?.extendedTextMessage?.text || '';
        url = extractUrl(q);
      }

      if (!url) {
        return await sock.sendMessage(sender, {
          text:
            '📥 *DOWNLOADER*\n' +
            '━━━━━━━━━━━━━━━━━━━━\n\n' +
            '📋 *Cara pakai:*\n' +
            '• *.dl [url]* — auto detect platform\n' +
            '• *.yt [url]* — YouTube video (720p)\n' +
            '• *.ytmp3 [url]* — YouTube audio MP3\n' +
            '• *.tt [url]* — TikTok tanpa watermark\n' +
            '• *.ig [url]* — Instagram Reels/Post\n\n' +
            '💡 Bisa juga reply pesan yang berisi link!'
        }, { quoted: msg });
      }

      // Tentukan platform & mode
      let platform = detectPlatform(url);
      let mode     = 'video';

      if (cmd === '.ytmp3')              { platform = 'youtube';   mode = 'audio'; }
      if (cmd === '.ytmp4' || cmd === '.yt') { platform = 'youtube'; }
      if (cmd === '.tt' || cmd === '.tiktok') { platform = 'tiktok'; }
      if (cmd === '.ig')                 { platform = 'instagram'; }

      if (!platform) {
        return await sock.sendMessage(sender, {
          text: '❌ Link tidak dikenali. Pastikan URL dari YouTube, TikTok, atau Instagram.'
        }, { quoted: msg });
      }

      const loadingText = {
        youtube  : mode === 'audio' ? '🎵 Mengambil audio YouTube (MP3)...' : '🎬 Mengambil video YouTube (720p)...',
        tiktok   : '🎵 Mengambil video TikTok tanpa watermark...',
        instagram: '📸 Mengambil video Instagram...'
      }[platform];

      await sock.sendMessage(sender, { text: loadingText }, { quoted: msg });

      try {
        // ── YouTube ────────────────────────────────────────────────────────────
        if (platform === 'youtube') {
          const info = await downloadYouTube(url, mode);
          const { buffer } = await getBuffer(info.downloadUrl);

          if (mode === 'audio') {
            await sock.sendMessage(sender, {
              audio   : buffer,
              mimetype: 'audio/mpeg',
              fileName: info.title + '.mp3',
              ptt     : false
            }, { quoted: msg });
          } else {
            await sock.sendMessage(sender, {
              video  : buffer,
              caption:
                '🎬 *' + info.title + '*\n' +
                '📺 Kualitas: ' + (info.quality || '?') + '\n' +
                '⏱️ Durasi: ' + (info.dur || '-') + '\n\n' +
                '📥 via savefrom.net'
            }, { quoted: msg });
          }
          return;
        }

        // ── TikTok ─────────────────────────────────────────────────────────────
        if (platform === 'tiktok') {
          const info = await downloadTikTok(url);
          const { buffer } = await getBuffer(info.downloadUrl);

          await sock.sendMessage(sender, {
            video  : buffer,
            caption:
              '🎵 *' + info.title + '*\n' +
              '👤 ' + info.author + '\n' +
              '❤️ ' + formatAngka(info.likes) + '  👁️ ' + formatAngka(info.views) + '\n' +
              '⏱️ ' + formatDurasi(info.duration) + '\n\n' +
              '✅ Tanpa watermark'
          }, { quoted: msg });
          return;
        }

        // ── Instagram ──────────────────────────────────────────────────────────
        if (platform === 'instagram') {
          const info = await downloadInstagram(url);
          const { buffer } = await getBuffer(info.downloadUrl);

          await sock.sendMessage(sender, {
            video  : buffer,
            caption: '📸 *' + info.title + '*\n\n📥 via savefrom.net'
          }, { quoted: msg });
          return;
        }

      } catch (err) {
        await sock.sendMessage(sender, {
          text:
            '❌ *Gagal download!*\n\n' +
            '📋 Alasan: ' + err.message + '\n\n' +
            '💡 *Tips:*\n' +
            '• Pastikan video tidak private\n' +
            '• Untuk YouTube, coba link pendek youtu.be/xxx\n' +
            '• Coba lagi beberapa saat'
        }, { quoted: msg });
      }
    }
  };
  