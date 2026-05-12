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
  // 📥 YouTube — pakai cobalt.tools API (gratis, tanpa key)
  // ─────────────────────────────────────────────────────────────────────────────
  async function downloadYouTube(url, mode = 'video') {
    const apiUrl = 'https://api.cobalt.tools/';
    const body = {
      url,
      videoQuality  : '720',
      audioFormat   : 'mp3',
      downloadMode  : mode === 'audio' ? 'audio' : 'auto',
      twitterGif    : false,
      disableMetadata: false
    };

    const res = await fetch(apiUrl, {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept'      : 'application/json'
      },
      body: JSON.stringify(body),
      timeout: 20000
    });

    if (!res.ok) throw new Error('Cobalt API error: ' + res.status);
    const data = await res.json();

    if (data.status === 'error') throw new Error(data.error?.code || 'Gagal download');
    if (!data.url) throw new Error('URL download tidak ditemukan');

    return { downloadUrl: data.url, filename: data.filename || 'video.mp4' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 📥 TikTok — pakai tikwm.com (gratis, tanpa watermark)
  // ─────────────────────────────────────────────────────────────────────────────
  async function downloadTikTok(url) {
    const res = await fetch('https://www.tikwm.com/api/', {
      method : 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body   : 'url=' + encodeURIComponent(url) + '&hd=1',
      timeout: 20000
    });

    if (!res.ok) throw new Error('TikWM API error: ' + res.status);
    const data = await res.json();

    if (data.code !== 0) throw new Error(data.msg || 'Gagal ambil data TikTok');

    const d = data.data;
    return {
      title      : d.title || 'TikTok Video',
      author     : d.author?.nickname || '-',
      downloadUrl: d.hdplay || d.play,
      thumbnail  : d.cover,
      duration   : d.duration || 0,
      likes      : d.digg_count || 0,
      views      : d.play_count || 0
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 📥 Instagram — pakai cobalt juga
  // ─────────────────────────────────────────────────────────────────────────────
  async function downloadInstagram(url) {
    return await downloadYouTube(url, 'video'); // Cobalt support IG juga
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔄 Ambil buffer dari URL download
  // ─────────────────────────────────────────────────────────────────────────────
  async function getBuffer(url) {
    const res = await fetch(url, {
      timeout: 60000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error('Gagal download file: ' + res.status);

    // Cek ukuran file (max 50MB untuk WA)
    const size = parseInt(res.headers.get('content-length') || '0');
    if (size > 50 * 1024 * 1024) throw new Error('File terlalu besar (>50MB), tidak bisa dikirim via WhatsApp');

    return { buffer: await res.buffer(), contentType: res.headers.get('content-type') || '' };
  }

  function formatDurasi(detik) {
    const m = Math.floor(detik / 60);
    const s = detik % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function formatAngka(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
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
        const quotedText =
          msg.message.extendedTextMessage.contextInfo.quotedMessage?.conversation ||
          msg.message.extendedTextMessage.contextInfo.quotedMessage?.extendedTextMessage?.text || '';
        url = extractUrl(quotedText);
      }

      if (!url) {
        return await sock.sendMessage(sender, {
          text:
            '📥 *DOWNLOADER*\n' +
            '━━━━━━━━━━━━━━━━━━━━\n\n' +
            '📋 *Cara pakai:*\n' +
            '• *.dl [url]* — auto detect platform\n' +
            '• *.yt [url]* — YouTube video (720p)\n' +
            '• *.ytmp3 [url]* — YouTube audio (MP3)\n' +
            '• *.tt [url]* — TikTok tanpa watermark\n' +
            '• *.ig [url]* — Instagram Reels/Post\n\n' +
            '💡 Bisa juga reply pesan yang berisi link!'
        }, { quoted: msg });
      }

      // Tentukan mode
      let platform = detectPlatform(url);
      let mode     = 'video';

      if (cmd === '.ytmp3') { platform = 'youtube'; mode = 'audio'; }
      if (cmd === '.ytmp4') { platform = 'youtube'; mode = 'video'; }
      if (cmd === '.yt')    { platform = 'youtube'; }
      if (cmd === '.tt' || cmd === '.tiktok') { platform = 'tiktok'; }
      if (cmd === '.ig')    { platform = 'instagram'; }

      if (!platform) {
        return await sock.sendMessage(sender, {
          text: '❌ Link tidak dikenali. Pastikan URL dari YouTube, TikTok, atau Instagram.'
        }, { quoted: msg });
      }

      // Loading
      const loadingMsg = {
        youtube  : '⏳ Mengambil video YouTube...',
        tiktok   : '⏳ Mengambil video TikTok tanpa watermark...',
        instagram: '⏳ Mengambil video Instagram...'
      }[platform];

      await sock.sendMessage(sender, { text: loadingMsg }, { quoted: msg });

      try {
        // ── YouTube ────────────────────────────────────────────────────────────
        if (platform === 'youtube') {
          const { downloadUrl, filename } = await downloadYouTube(url, mode);
          const { buffer, contentType }  = await getBuffer(downloadUrl);

          if (mode === 'audio') {
            await sock.sendMessage(sender, {
              audio   : buffer,
              mimetype: 'audio/mpeg',
              fileName: filename || 'audio.mp3',
              ptt     : false
            }, { quoted: msg });
          } else {
            await sock.sendMessage(sender, {
              video   : buffer,
              mimetype: 'video/mp4',
              caption : '🎵 *' + (filename || 'YouTube Video') + '*\n🔗 ' + url
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
          const { downloadUrl } = await downloadInstagram(url);
          const { buffer }      = await getBuffer(downloadUrl);

          await sock.sendMessage(sender, {
            video  : buffer,
            caption: '📸 *Instagram Video*\n🔗 ' + url
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
  