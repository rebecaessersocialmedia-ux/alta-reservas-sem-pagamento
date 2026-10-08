// POST /api/checkout — cria a reserva e devolve o link de pagamento InfinitePay
const crypto = require('crypto');
const { CONFIG, siteUrl, readBody, sheet, createLink } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const b = readBody(req);

  // Validação e recálculo no servidor (nunca confiar no valor do navegador)
  const dateLabel = CONFIG.dates[b.date];
  const guests = parseInt(b.guests, 10);
  const name = String(b.name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().slice(0, 160);
  const phoneDigits = String(b.phone || '').replace(/\D/g, '');
  const notes = String(b.notes || '').trim().slice(0, 600);
  if (!dateLabel) return res.status(400).json({ error: 'Data indisponível.' });
  if (!(guests >= 1 && guests <= CONFIG.maxGuests)) return res.status(400).json({ error: 'Número de pessoas inválido.' });
  if (name.split(/\s+/).length < 2) return res.status(400).json({ error: 'Informe nome e sobrenome.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (phoneDigits.length < 10 || phoneDigits.length > 11) return res.status(400).json({ error: 'WhatsApp inválido.' });
  if (!b.accepted) return res.status(400).json({ error: 'É necessário aceitar as condições.' });

  const menu = CONFIG.pricePerPerson * guests;
  const deposit = CONFIG.depositPerPerson * guests;
  const balance = menu - deposit;
  const code = 'ALT-' + crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  const site = siteUrl(req);

  let url;
  try {
    url = await createLink({
      order_nsu: code,
      redirect_url: `${site}/?reserva=${code}`,
      webhook_url: `${site}/api/webhook`,
      customer: { name, email, phone_number: '+55' + phoneDigits.replace(/^55(?=\d{10,11}$)/, '') },
      // Reserva no restaurante: preenche o endereço do Alta para o checkout não pedir CEP ao cliente
      address: { cep: '38400218', number: '52', complement: 'Alta Asian Cuisine' },
      items: [{
        quantity: guests,
        price: CONFIG.depositPerPerson * 100,
        description: `Garantia Menu Experiência · ${dateLabel}`,
      }],
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Não foi possível gerar o pagamento.', detail: String(e.message || e).slice(0, 400) });
  }

  await sheet({
    event: 'checkout', code, date: b.date, dateLabel, guests, name, email, notes,
    phone: b.phone || phoneDigits, menu, deposit, balance,
    device: b.device || '', utm: b.utm || '', session: b.session || '',
  });

  return res.status(200).json({ url, code });
};
