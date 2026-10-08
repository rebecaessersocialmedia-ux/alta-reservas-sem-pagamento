// GET /api/status?order_nsu=&transaction_nsu=&slug=&receipt_url=
// Usado na volta do checkout. Também confirma a reserva caso o webhook atrase.
const { confirmPayment } = require('./_lib');

module.exports = async (req, res) => {
  const q = req.query || {};
  try {
    const r = await confirmPayment({
      order_nsu: q.order_nsu, transaction_nsu: q.transaction_nsu,
      slug: q.slug, receipt_url: q.receipt_url,
    });
    return res.status(200).json({ paid: !!r.paid, method: r.method || null, row: r.row || null });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ paid: false });
  }
};
