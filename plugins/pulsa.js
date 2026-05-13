/**
 * Plugin Jualan Pulsa — isipulsa.web.id
 *
 * Perintah (owner only untuk beli):
 *   .saldo              — cek saldo akun isipulsa
 *   .trx [n]            — lihat n transaksi terakhir (default 5)
 *   .produk             — list kategori produk tersedia
 *   .cekop <nomor>      — deteksi operator dari nomor HP
 *   .beli <nomor> <voucher_id> — beli pulsa/paket (owner only)
 *
 * Voucher ID: cari di app isipulsa, lalu catat ID-nya untuk dipakai di .beli
 *
 * Konfigurasi: setting.js → isipulsa.username / token / appVersionCode
 */

const https   = require('https');
const zlib    = require('zlib');
const qs      = require('querystring');
const setting = require('../setting.js');

const BASE     = 'isipulsa.web.id';
const cfg      = setting.isipulsa || {};
const USERNAME = cfg.username        || '';
const TOKEN    = cfg.token           || '';
const VER      = cfg.appVersionCode  || '250608';

// ─── pending confirmations: Map<senderId, {nomor, voucherId, expiry}>
const pending = new Map();
const CONFIRM_TTL = 60_000; // 60 detik

// ─── cache validators (operator detector)
let validatorCache = null;
let validatorTime  = 0;
const VALIDATOR_TTL = 3_600_000; // 1 jam

// ───────────────────────── helper fetch ──────────────────────────
function apiCall(path, params) {
  return new Promise((resolve, reject) => {
    const body = qs.stringify({
      app_version_code: VER,
      auth_username   : USERNAME,
      auth_token      : TOKEN,
      ...params,
    });
    const req = https.request(
      {
        hostname: BASE,
        path,
        method : 'POST',
        headers: {
          'content-type'   : 'application/x-www-form-urlencoded',
          'user-agent'     : 'okhttp/4.12.0',
          'accept-encoding': 'gzip',
          'content-length' : Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          const parse = (buf) => {
            try { resolve(JSON.parse(buf.toString())); }
            catch (e) { reject(e); }
          };
          const enc = res.headers['content-encoding'] || '';
          if (enc.includes('gzip')) zlib.gunzip(raw, (e, b) => (e ? reject(e) : parse(b)));
          else parse(raw);
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function apiGet(params)   { return apiCall('/api/v2/get', params); }
function apiOrder(params) { return apiCall('/api/v2/order', params); }

// ─── deteksi operator dari nomor
async function getValidators() {
  if (validatorCache && Date.now() - validatorTime < VALIDATOR_TTL) return validatorCache;
  const res = await apiGet({ vss: 1, 'requests[2]': 'validators' });
  if (res.validators?.success) {
    validatorCache = res.validators.results;
    validatorTime  = Date.now();
  }
  return validatorCache || [];
}

function detectOperator(nomor, validators) {
  let n = String(nomor).replace(/\D/g, '');
  if (n.startsWith('62')) n = '0' + n.slice(2);
  for (const v of validators) {
    if (v.regex && new RegExp(v.regex).test(n)) return v.name;
  }
  return null;
}

// ─── format rupiah
function rp(num) { return `Rp ${Number(num).toLocaleString('id-ID')}`; }

// ───────────────────────── commands ──────────────────────────────
module.exports = {
  name: 'pulsa',
  command: ['.saldo', '.trx', '.produk', '.cekop', '.beli'],

  async handleMessage(conn, sender, text, msg) {
    // Cek konfirmasi beli yang pending
    const conf = pending.get(sender);
    if (conf) {
      if (Date.now() > conf.expiry) { pending.delete(sender); return false; }

      const t = text.trim().toLowerCase();
      if (t === 'ya' || t === 'iya' || t === 'y') {
        pending.delete(sender);
        await conn.sendMessage(sender, { text: '⏳ Memproses transaksi...' }, { quoted: msg });
        try {
          const res = await apiOrder({
            voucher_id: conf.voucherId,
            phone     : conf.nomor,
            payment   : 'balance',
          });
          if (res.status) {
            await conn.sendMessage(sender,
              { text: `✅ *Transaksi Berhasil!*\n\n📞 Nomor: ${conf.nomor}\n🎁 Voucher: ${conf.voucherId}\n📝 ID Transaksi: ${res.id || '-'}\n\nSaldo akan dikurangi sesuai harga paket.` },
              { quoted: msg }
            );
          } else {
            await conn.sendMessage(sender,
              { text: `❌ *Transaksi Gagal*\n\n${res.message || 'Terjadi kesalahan, coba lagi.'}` },
              { quoted: msg }
            );
          }
        } catch (e) {
          await conn.sendMessage(sender, { text: `❌ Error: ${e.message}` }, { quoted: msg });
        }
        return true;
      }
      if (t === 'tidak' || t === 'batal' || t === 'cancel' || t === 'no' || t === 'n') {
        pending.delete(sender);
        await conn.sendMessage(sender, { text: '❎ Transaksi dibatalkan.' }, { quoted: msg });
        return true;
      }
    }
    return false;
  },

  async execute(conn, sender, args, msg) {
    const reply = (text) => conn.sendMessage(sender, { text }, { quoted: msg });
    const cmd   = (msg.body || '').split(' ')[0].toLowerCase();

    if (!USERNAME || !TOKEN) {
      return reply('⚠️ Kredensial isipulsa belum diisi di setting.js\n(isipulsa.username & isipulsa.token)');
    }

    // ── .saldo
    if (cmd === '.saldo') {
      try {
        const res = await apiGet({ vss: 1, 'requests[0]': 'balance' });
        if (!res.success) return reply(`❌ ${res.message || 'Gagal mengambil saldo'}`);
        const b = res.balance?.results;
        return reply(
          `💰 *Saldo Akun isipulsa*\n\n` +
          `👤 Username: *${USERNAME}*\n` +
          `💵 Saldo: *${b?.balance_str || rp(b?.balance || 0)}*`
        );
      } catch (e) { return reply(`❌ Error: ${e.message}`); }
    }

    // ── .trx [n]
    if (cmd === '.trx') {
      const limit = parseInt(args[0]) || 5;
      try {
        const res = await apiGet({ vss: 1, 'requests[1]': 'transactions' });
        if (!res.success) return reply(`❌ ${res.message || 'Gagal mengambil transaksi'}`);
        const { total, results } = res.transactions?.results || {};
        if (!results?.length) return reply('📭 Belum ada transaksi.');

        let teks = `🧾 *Transaksi Terakhir (${Math.min(limit, results.length)} dari ${total})*\n\n`;
        for (const t of results.slice(0, limit)) {
          const icon = t.is_success ? '✅' : t.is_in_process ? '⏳' : t.is_refund ? '↩️' : '❌';
          teks += `${icon} *${t.product?.name || '-'}*\n`;
          teks += `   📞 ${t.phone}\n`;
          teks += `   🎁 ${t.voucher?.name || '-'}\n`;
          teks += `   💵 ${t.price_str} | ${t.date}\n\n`;
        }
        return reply(teks.trim());
      } catch (e) { return reply(`❌ Error: ${e.message}`); }
    }

    // ── .produk
    if (cmd === '.produk') {
      try {
        const res = await apiGet({ vss: 1, 'requests[3]': 'products' });
        if (!res.success) return reply(`❌ ${res.message || 'Gagal mengambil produk'}`);
        const products = res.products?.results || [];
        if (!products.length) return reply('📭 Tidak ada produk tersedia.');

        let teks = `🛒 *Kategori Produk isipulsa*\n\n`;
        for (const p of products) {
          teks += `• ${p.name} — \`${p.id}\`\n`;
        }
        teks += `\n_Cari voucher ID di app isipulsa, lalu beli dengan:_\n*.beli <nomor> <voucher_id>*`;
        return reply(teks);
      } catch (e) { return reply(`❌ Error: ${e.message}`); }
    }

    // ── .cekop <nomor>
    if (cmd === '.cekop') {
      if (!args[0]) return reply('Usage: *.cekop <nomor>*\nContoh: .cekop 085212345678');
      try {
        const validators = await getValidators();
        const op = detectOperator(args[0], validators);
        return reply(
          op
            ? `📡 Nomor *${args[0]}* terdeteksi: *${op}*`
            : `❓ Operator tidak dikenali untuk nomor *${args[0]}*`
        );
      } catch (e) { return reply(`❌ Error: ${e.message}`); }
    }

    // ── .beli <nomor> <voucher_id> (owner only)
    if (cmd === '.beli') {
      const setting = require('../setting.js');
      const senderNum = sender.split('@')[0].split(':')[0];
      const isOwner   = setting.owner.some(o => senderNum.includes(o) || o.includes(senderNum));
      if (!isOwner) return reply('⛔ Perintah ini hanya untuk owner.');

      if (!args[0] || !args[1]) {
        return reply(
          '📲 *Beli Pulsa / Paket*\n\n' +
          'Usage: *.beli <nomor> <voucher_id>*\n\n' +
          'Contoh:\n' +
          '*.beli 085212345678 4210*\n\n' +
          '_Lihat voucher ID di app isipulsa atau pakai .produk_'
        );
      }

      let nomor = args[0].replace(/[\s\-]/g, '');
      if (nomor.startsWith('62')) nomor = '0' + nomor.slice(2);
      const voucherId = args[1];

      // Deteksi operator dulu
      let opInfo = '';
      try {
        const validators = await getValidators();
        const op = detectOperator(nomor, validators);
        if (op) opInfo = `📡 Operator: *${op}*\n`;
      } catch {}

      // Simpan pending confirmation
      pending.set(sender, { nomor, voucherId, expiry: Date.now() + CONFIRM_TTL });

      return reply(
        `⚠️ *Konfirmasi Pembelian*\n\n` +
        `📞 Nomor: *${nomor}*\n` +
        opInfo +
        `🎁 Voucher ID: *${voucherId}*\n` +
        `💳 Bayar via: Saldo Akun\n\n` +
        `Ketik *ya* untuk lanjut atau *batal* untuk membatalkan.\n` +
        `_(Expires dalam 60 detik)_`
      );
    }
  },
};
