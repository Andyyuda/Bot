const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const setting = require('./setting');
const { getPhoneNumber, isOwner } = require('./lib/helper');
const tg = require('./lib/telegram');

const PLUGIN_DIR = './plugins';
global.userState = {};

// 🔌 Load semua plugin
let plugins = [];
fs.readdirSync(PLUGIN_DIR).forEach(file => {
  if (file.endsWith('.js')) {
    const plugin = require(path.join(__dirname, PLUGIN_DIR, file));
    plugins.push(plugin);
    console.log(chalk.green(`✅ Plugin loaded: ${plugin.name}`));
  }
});
global.plugins = plugins;

// 📟 Tanya input via terminal
function tanyaInput(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();

  let modeLogin = null;
  let nomorTarget = null;

  if (!state.creds.registered) {
    if (tg.isConfigured) {
      // ─── LOGIN VIA TELEGRAM ───────────────────────────────────────
      console.log(chalk.cyan('📲 Bot belum terdaftar. Mengirim permintaan nomor ke Telegram...'));
      await tg.sendMessage(
        '🤖 <b>BotWA siap login!</b>\n\n' +
        '📱 Kirim nomor HP untuk <b>Pairing Code</b>:\n' +
        '<code>628xxxxxxxxxx</code> (tanpa + atau spasi)\n\n' +
        '💡 Atau ketik <b>qr</b> jika ingin scan QR Code.'
      );

      const input = await tg.waitReply(120000);
      const inputBersih = (input || '').trim().toLowerCase();

      if (inputBersih === 'qr') {
        modeLogin = 'qr';
        await tg.sendMessage('✅ Mode QR dipilih. QR akan dikirim sebentar...');
      } else {
        nomorTarget = (input || '').replace(/[^0-9]/g, '');
        if (!nomorTarget || nomorTarget.length < 10) {
          await tg.sendMessage('❌ Nomor tidak valid. Restart bot dan coba lagi.');
          return;
        }
        modeLogin = 'pairing';
        await tg.sendMessage(`⏳ Nomor diterima: <code>${nomorTarget}</code>\nMeminta pairing code...`);
      }
      // ─────────────────────────────────────────────────────────────
    } else {
      // ─── LOGIN VIA TERMINAL ───────────────────────────────────────
      console.log(chalk.bgCyan.black('\n╔══════════════════════════════════╗'));
      console.log(chalk.bgCyan.black('   🤖  BOTWA — LOGIN WHATSAPP BOT   '));
      console.log(chalk.bgCyan.black('╚══════════════════════════════════╝\n'));
      console.log(chalk.gray('  Masukkan nomor HP untuk Pairing Code.'));
      console.log(chalk.gray('  Ketik "qr" jika ingin scan QR Code.\n'));

      const input = await tanyaInput(chalk.cyan('📱 Nomor HP (628xxx) atau "qr": '));

      if (input.trim().toLowerCase() === 'qr') {
        modeLogin = 'qr';
        console.log(chalk.green('\n✅ Mode QR dipilih. QR akan muncul di bawah...\n'));
      } else {
        nomorTarget = input.replace(/[^0-9]/g, '');
        if (!nomorTarget || nomorTarget.length < 10) {
          console.log(chalk.red('❌ Nomor tidak valid. Coba lagi.'));
          return start();
        }
        modeLogin = 'pairing';
      }
      // ─────────────────────────────────────────────────────────────
    }
  }

  // Filter log Baileys yang tidak perlu (noise)
  const SKIP_ERRORS = ['failed to decrypt message', 'init queries'];
  const baileysLogger = {
    level: 'silent',
    trace: () => {}, debug: () => {}, info: () => {},
    warn: (o, m) => {
      if (SKIP_ERRORS.some(s => (m ?? '').includes(s))) return;
      console.log(chalk.yellow(`[WA] ${m ?? ''}`));
    },
    error: (o, m) => {
      if (SKIP_ERRORS.some(s => (m ?? '').includes(s))) return;
      console.log(chalk.red(`[WA ERROR] ${m ?? ''}`), JSON.stringify(o ?? {}));
    },
    fatal: (o, m) => console.log(chalk.bgRed.white(`[WA FATAL] ${m ?? ''}`)),
    child: function() { return this; }
  };

  const sock = makeWASocket({
    version,
    logger: baileysLogger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger)
    },
    printQRInTerminal: false,
    browser: Browsers.macOS('Safari'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false
  });

  sock.ev.on('creds.update', saveCreds);

  let sudahLogin = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // ── QR / Pairing Code ────────────────────────────────────────────
    if (qr && !state.creds.registered && !sudahLogin) {

      // Mode Pairing Code
      if (modeLogin === 'pairing' && nomorTarget) {
        sudahLogin = true;
        try {
          console.log(chalk.cyan('⏳ Meminta pairing code ke WhatsApp...'));
          const code = await sock.requestPairingCode(nomorTarget);
          const fmt = code.match(/.{1,4}/g).join('-');

          if (tg.isConfigured) {
            await tg.sendMessage(
              '🔑 <b>PAIRING CODE BOT WHATSAPP</b>\n\n' +
              `Kode: <code>${fmt}</code>\n` +
              `Nomor: <code>${nomorTarget}</code>\n\n` +
              '📋 Cara pakai:\n' +
              '1. Buka WhatsApp di HP\n' +
              '2. ⋮ → Perangkat Tertaut → Tautkan Perangkat\n' +
              '3. Tautkan dengan nomor telepon\n' +
              `4. Ketik kode: <b>${fmt}</b>\n\n` +
              '⚠️ Berlaku ±60 detik — masukkan SEGERA!'
            );
          } else {
            console.log(chalk.bgGreen.black('\n╔══════════════════════════════╗'));
            console.log(chalk.bgGreen.black('  🔑 PAIRING CODE BOT WHATSAPP  '));
            console.log(chalk.bgGreen.black('╚══════════════════════════════╝'));
            console.log(chalk.yellow('\n  Kode : ') + chalk.bold.white(fmt));
            console.log(chalk.cyan(`  Nomor: ${nomorTarget}\n`));
            console.log(chalk.gray('  1. Buka WhatsApp di HP'));
            console.log(chalk.gray('  2. ⋮ → Perangkat Tertaut → Tautkan Perangkat'));
            console.log(chalk.gray('  3. Tautkan dengan nomor telepon'));
            console.log(chalk.gray(`  4. Ketik kode: ${chalk.bold(fmt)}`));
            console.log(chalk.red('\n  ⚠️  Berlaku ±60 detik — masukkan SEGERA!\n'));
          }
        } catch (err) {
          const errMsg = `❌ Gagal dapat pairing code: ${err.message}\n💡 Coba rm -rf auth/ lalu restart.`;
          if (tg.isConfigured) await tg.sendMessage(errMsg);
          else console.log(chalk.red(errMsg));
          sudahLogin = false;
        }
      }

      // Mode QR
      if (modeLogin === 'qr') {
        if (tg.isConfigured) {
          try {
            const qrcode = require('qrcode');
            const buf = await qrcode.toBuffer(qr, { type: 'png', scale: 6, margin: 2 });
            await tg.sendPhoto(buf, '📷 <b>Scan QR ini dengan WhatsApp</b>\n⏰ Berlaku ~30 detik\n\nJika expired, QR baru akan dikirim otomatis.');
          } catch (e) {
            await tg.sendMessage(`❌ Gagal kirim QR: ${e.message}`);
          }
        } else {
          try {
            const qrTerminal = require('qrcode-terminal');
            console.log(chalk.cyan('\n📷 Scan QR berikut dengan WhatsApp:\n'));
            qrTerminal.generate(qr, { small: true });
            console.log(chalk.gray('  QR refresh otomatis tiap ~30 detik.\n'));
          } catch {
            console.log(chalk.red('❌ qrcode-terminal tidak tersedia.'));
          }
        }
      }
    }

    // ── Terhubung ────────────────────────────────────────────────────
    if (connection === 'open') {
      const info = `✅ <b>Bot WhatsApp terhubung!</b>\n👤 ${sock.user?.id}\n📛 ${sock.user?.name ?? '-'}`;
      console.log(chalk.green('\n✅ Terhubung ke WhatsApp!'));
      console.log(chalk.cyan(`👤 Bot : ${sock.user?.id}`));
      console.log(chalk.cyan(`📛 Nama: ${sock.user?.name ?? '-'}`));
      if (tg.isConfigured) await tg.sendMessage(info);
    }

    // ── Koneksi terputus ─────────────────────────────────────────────
    if (connection === 'close') {
      const reasonCode = lastDisconnect?.error?.output?.statusCode;

      if (reasonCode === DisconnectReason.loggedOut) {
        const msg = '❌ Logout permanen. Hapus folder auth/ untuk login ulang.';
        console.log(chalk.red(msg));
        if (tg.isConfigured) await tg.sendMessage(msg);
        fs.rmSync('./auth', { recursive: true, force: true });
        start();
      } else if (reasonCode === DisconnectReason.badSession) {
        const msg = '❌ Sesi rusak. Menghapus auth/ dan restart...';
        console.log(chalk.red(msg));
        if (tg.isConfigured) await tg.sendMessage(msg);
        fs.rmSync('./auth', { recursive: true, force: true });
        start();
      } else {
        console.log(chalk.yellow(`🔄 Koneksi terputus (${reasonCode ?? 'unknown'}), reconnect dalam 5 detik...`));
        setTimeout(start, 5000);
      }
    }
  });

  // 🧑‍🤝‍🧑 Handler join/leave grup
  sock.ev.on('group-participants.update', async (update) => {
    for (const plugin of plugins) {
      if (typeof plugin.handleParticipantUpdate === 'function') {
        try {
          await plugin.handleParticipantUpdate(sock, update);
        } catch (err) {
          console.error('❌ Plugin group error:', err);
        }
      }
    }
  });

  // 📩 Handler pesan masuk
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.remoteJid === 'status@broadcast') return;
    if (msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    const sender = remoteJid;
    const senderJid = msg.key.participant || remoteJid;
    const senderNumber = getPhoneNumber(senderJid);
    const isGroupMsg = remoteJid.endsWith('@g.us');
    const isPrivate = !isGroupMsg;
    const ownerCheck = isOwner(senderJid, setting.owner);

    let text = msg.message?.conversation ||
               msg.message?.extendedTextMessage?.text ||
               msg.message?.imageMessage?.caption ||
               msg.message?.videoMessage?.caption ||
               msg.message?.documentMessage?.caption ||
               msg.message?.buttonsResponseMessage?.selectedButtonId ||
               msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId || '';

    if (msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
      try {
        const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
        text = params.id;
      } catch (e) {}
    }

    if (!text) return;
    console.log(chalk.blue(`[IN] ${senderJid} -> ${remoteJid}: ${text}`));

    // ⛔ Cek mode akses
    let mode = 'off';
    for (const name of ['.onlyprivate', '.onlygc', '.onlyowner']) {
      const p = plugins.find(x => x.name === name);
      if (p && typeof p.getMode === 'function') {
        const result = p.getMode();
        if (result !== 'off') { mode = result; break; }
      }
    }

    if (
      (mode === 'private' && !isPrivate) ||
      (mode === 'group' && !isGroupMsg) ||
      (mode === 'owner' && !ownerCheck)
    ) return;

    // 🔇 Mute handler
    for (const plugin of plugins) {
      if (typeof plugin.handleMessage === 'function') {
        try { await plugin.handleMessage(sock, msg); } catch (e) {}
      }
    }

    // 🔒 Cek & hapus pesan jika user dimute (hanya di grup)
    if (isGroupMsg && msg.key.participant) {
      try {
        const muteDB = JSON.parse(fs.readFileSync('./mute.json'));
        if (muteDB[remoteJid]?.[senderJid] === true) {
          await sock.sendMessage(remoteJid, { delete: msg.key });
          return;
        }
      } catch (e) {}
    }

    // 🔄 Cek sesi
    const session = global.userState[sender];
    if (session) {
      const plugin = plugins.find(p => p.name === session.status);
      if (plugin && typeof plugin.handleSession === 'function') {
        return await plugin.handleSession(sock, sender, text, msg);
      }
    }

    // ⚙️ Eksekusi plugin
    const [command, ...args] = text.trim().split(' ');
    const plugin = plugins.find(p =>
      p.name === command.toLowerCase() || (Array.isArray(p.command) && p.command.includes(command.toLowerCase()))
    );

    if (plugin && typeof plugin.execute === 'function') {
      try {
        await plugin.execute(sock, sender, args, msg, text);
      } catch (err) {
        console.error('❌ Plugin error:', err);
        await sock.sendMessage(sender, { text: '⚠️ Terjadi error saat menjalankan perintah.' }, { quoted: msg });
      }
    }
  });
}

start();
