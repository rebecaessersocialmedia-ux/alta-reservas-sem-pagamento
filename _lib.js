// Alta Asian Cuisine · funções compartilhadas do servidor (Vercel)
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   INFINITEPAY_HANDLE  InfiniteTag sem o $             ex.: alta-sushi
//   SHEETS_URL          URL /exec do Apps Script da planilha
//   SHEETS_SECRET       mesma senha definida em SECRET no Apps Script
//   CALLMEBOT_PHONE     número que recebe o aviso      ex.: 5534991629171
//   CALLMEBOT_APIKEY    apikey enviada pelo CallMeBot
//   SITE_URL            (opcional) ex.: https://reservas.altaasiancuisine.com.br

const IP_API = 'https://api.checkout.infinitepay.io';

const CONFIG = {
  pricePerPerson: 248,
  depositPerPerson: 50,
  maxGuests: 20,
  dates: {
    '2026-10-07': '07 de outubro',
    '2026-10-08': '08 de outubro',
    '2026-10-09': '09 de outubro',
    '2026-10-10': '10 de outubro',
  },
};

const env = (k, d = '') => String(process.env[k] || d).trim();
const handle = () => env('INFINITEPAY_HANDLE', 'alta-sushi').replace(/^\$/, '');
const brl = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR');

function siteUrl(req) {
  const fixed = env('SITE_URL');
  if (fixed) return fixed.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `https://${host}`;
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return req.body;
}

async function withTimeout(promise, ms) {
  let t;
  const timer = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); });
  try { return await Promise.race([promise, timer]); } finally { clearTimeout(t); }
}

// ── Planilha (Apps Script) ────────────────────────────────────────
async function sheet(data) {
  const url = env('SHEETS_URL');
  if (!url) return null;
  try {
    const r = await withTimeout(fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...data, secret: env('SHEETS_SECRET') }),
      redirect: 'follow',
    }), 8000);
    const txt = await r.text();
    try { return JSON.parse(txt); } catch (e) { return { ok: r.ok, raw: txt }; }
  } catch (e) {
    console.error('sheet', e);
    return null;
  }
}

// ── InfinitePay ───────────────────────────────────────────────────
async function createLink(payload) {
  const r = await fetch(`${IP_API}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: handle(), ...payload }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.url) throw new Error('InfinitePay /links ' + r.status + ' ' + JSON.stringify(data));
  return data.url;
}

async function paymentCheck({ order_nsu, transaction_nsu, slug }) {
  const r = await fetch(`${IP_API}/payment_check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: handle(), order_nsu, transaction_nsu, slug }),
  });
  const data = await r.json().catch(() => ({}));
  return data && data.success && data.paid ? data : null;
}

// ── WhatsApp (CallMeBot) ──────────────────────────────────────────
async function notifyWhatsapp(text) {
  const phone = env('CALLMEBOT_PHONE'), key = env('CALLMEBOT_APIKEY');
  if (!phone || !key) return false;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(key)}`;
  try { const r = await withTimeout(fetch(url), 8000); return r.ok; } catch (e) { console.error('callmebot', e); return false; }
}

// Confirma um pagamento: valida na InfinitePay, marca "Pago" na planilha
// e avisa a equipe no WhatsApp (uma única vez por reserva).
async function confirmPayment({ order_nsu, transaction_nsu, slug, receipt_url }) {
  if (!order_nsu || !transaction_nsu || !slug) return { paid: false };
  const check = await paymentCheck({ order_nsu, transaction_nsu, slug });
  if (!check) return { paid: false };

  const method = check.capture_method === 'pix' ? 'Pix' : `Cartão${check.installments > 1 ? ' ' + check.installments + 'x' : ''}`;
  const res = await sheet({
    event: 'pago', code: order_nsu, transaction_nsu, slug,
    receipt_url: receipt_url || '', method, paid_amount: (check.paid_amount || check.amount || 0) / 100,
  });

  if (!res || !res.already) {
    const row = (res && res.row) || {};
    const lines = [
      '✅ *RESERVA PAGA — Menu Experiência*',
      `*Código:* ${order_nsu}`,
      '',
      row.dateLabel ? `*Data:* ${row.dateLabel} · chegada 19:00` : null,
      row.guests ? `*Pessoas:* ${row.guests}` : null,
      row.name ? `*Nome:* ${row.name}` : null,
      row.phone ? `*WhatsApp:* ${row.phone}` : null,
      row.email ? `*E-mail:* ${row.email}` : null,
      row.notes ? `*Observações:* ${row.notes}` : null,
      '',
      `*Garantia paga:* ${brl((check.amount || 0) / 100)} (${method})`,
      row.balance ? `*Saldo no restaurante:* ${brl(row.balance)}` : null,
      receipt_url ? `*Comprovante:* ${receipt_url}` : null,
      `*Transação:* ${transaction_nsu}`,
    ].filter((l) => l !== null);
    await notifyWhatsapp(lines.join('\n'));
  }
  return { paid: true, method, amount: check.amount, row: res && res.row };
}

module.exports = { CONFIG, brl, siteUrl, readBody, sheet, createLink, confirmPayment };
