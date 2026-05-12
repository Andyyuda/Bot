const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔧 Utility
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

  function getVideoId(url) {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?\s/]+)/);
    return m ? m[1] : null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 📥 YouTube — y2mate.com (analyze → convert)
  // ─────────────────────────────────────────────────────────────────────────────
  async function ytAnalyze(url) {
    const res = await fetch('https://www.y2mate.com/mates/id153/analyze/ajax', {
      method : 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent'  : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Referer'     : 'https://www.y2mate.com/',
        'Origin'      : 'https://www.y2mate.com',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body   : 'k_query=' + encodeURIComponent(url) + '&k_page=home&hl=id&q_auto=0',
      timeout: 20000
    });
    if (!res.ok) throw new Error('y2mate analyze error: ' + res.status);
    return res.json();
  }

  async function ytConvert(videoId, key, ftype, fquality) {
    const res = await fetch('https://www.y2mate.com/mates/id153/convert', {
      method : 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent'  : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Referer'     : 'https://www.y2mate.com/',
        'Origin'      : 'https://www.y2mate.com',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body   : 'type=youtube&_id=' + videoId + '&v_id=' + videoId + '&ajax=1&token=' + encodeURIComponent(key) + '&ftype=' + ftype + '&fquality=' + fquality,
      timeout: 30000
    });
    if (!res.ok) throw new Error('y2mate convert error: ' + res.status);
    return res.json();
  }

  async function downloadYouTube(url, mode = 'video') {
    const videoId = getVideoId(url);
    if (!videoId) throw new Error('URL YouTube tidak valid');

    // Step 1: Analyze
    const analyze = await ytAnalyze(url);
    if (!analyze?.vid) throw new Error('Gagal menganalisis video YouTube');

    const title = analyze.title || 'YouTube Video';

    if (mode === 'audio') {
      // Cari format mp3
      const mp3Links = analyze?.links?.mp3;
      if (!mp3Links) throw new Error('Format audio tidak tersedia');

      // Ambil kualitas tertinggi yang ada
      const q = Object.keys(mp3Links).find(k => mp3Links[k]?.f === 'mp3') || Object.keys(mp3Links)[0];
      const item = mp3Links[q];
      if (!item?.k) throw new Error('Token convert tidak ditemukan');

      const convert = await ytConvert(analyze.vid, item.k, 'mp3', q);
      if (!convert?.dlink) throw new Error('Link download audio tidak tersedia');

      return { title, downloadUrl: convert.dlink, ext: 'mp3' };
    }

    // Mode video — prioritas kualitas
    const mp4Links = analyze?.links?.mp4;
    if (!mp4Links) throw new Error('Format video tidak tersedia');

    const prioritas = ['720', '480', '360', '240', '144'];
    let chosen = null;
    let chosenQ = null;

    for (const q of prioritas) {
      if (mp4Links[q]) { chosen = mp4Links[q]; chosenQ = q + 'p'; break; }
    }
    if (!chosen) {
      const firstKey = Object.keys(mp4Links)[0];
      chosen = mp4Links[firstKey];
      chosenQ = firstKey + 'p';
    }
    if (!chosen?.k) throw new Error('Token convert tidak ditemukan');

    const convert = await ytConvert(analyze.vid, chosen.k, 'mp4', chosenQ.replace('p',''));
    if (!convert?.dlink) throw new Error('Link download video tidak tersedia');

    return { title, quality: chosenQ, downloadUrl: convert.dlink, ext: 'mp4' };
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
  // 📥 Instagram — cobalt.tools
  // ─────────────────────────────────────────────────────────────────────────────
  async function downloadInstagram(url) {
    const res = await fetch('https://api.cobalt.tools/', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body   : JSON.stringify({ url, downloadMode: 'auto' }),
      timeout: 20000
    });
    if (!res.ok) throw new Error('Cobalt error: ' + res.status);
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.error?.code || 'Gagal download IG');
    if (!data.url) throw new Error('URL tidak ditemukan');
    return { title: 'Instagram Video', downloadUrl: data.url };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔄 Download buffer
  // ─────────────────────────────────────────────────────────────────────────────
  async function getBuffer(url) {
    const res = await fetch(url, {
      timeout: 120000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' }
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

      let platform = detectPlatform(url);
      let mode     = 'video';

      if (cmd === '.ytmp3')                   { platform = 'youtube';   mode = 'audio'; }
      if (cmd === '.ytmp4' || cmd === '.yt')  { platform = 'youtube'; }
      if (cmd === '.tt' || cmd === '.tiktok') { platform = 'tiktok'; }
      if (cmd === '.ig')                      { platform = 'instagram'; }

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
                '📺 Kualitas: ' + (info.quality || '?') + '\n\n' +
                '📥 via y2mate'
            }, { quoted: msg });
          }
          return;
        }

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

        if (platform === 'instagram') {
          const info = await downloadInstagram(url);
          const { buffer } = await getBuffer(info.downloadUrl);

          await sock.sendMessage(sender, {
            video  : buffer,
            caption: '📸 *' + info.title + '*\n\n📥 via cobalt.tools'
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
            '• Untuk YouTube, coba link youtu.be/xxx\n' +
            '• Coba lagi beberapa saat'
        }, { quoted: msg });
      }
    }
  };
  