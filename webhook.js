// POST /api/webhook — notificação da InfinitePay quando o pagamento é aprovado
// O webhook não é assinado: o pagamento é sempre revalidado em /payment_check.
const { readBody, confirmPayment } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Método não permitido' });
  const b = readBody(req);
  try {
    const r = await confirmPayment({
      order_nsu: b.order_nsu,
      transaction_nsu: b.transaction_nsu,
      slug: b.invoice_slug || b.slug,
      receipt_url: b.receipt_url,
    });
    if (!r.paid) return res.status(400).json({ success: false, message: 'Pagamento não confirmado' });
    return res.status(200).json({ success: true, message: null });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ success: false, message: 'Erro ao processar' });
  }
};
