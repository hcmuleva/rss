/**
 * =====================================================================
 * Sponsor Controller
 * Company: emeelan
 * =====================================================================
 */

const pool = require('../config/database');
const Sponsor = require('../models/Sponsor');
const Invoice = require('../models/Invoice');

const SPONSOR_TYPES = new Set(['event', 'gathjod', 'magzine', 'temple_service', 'sanskar', 'education', 'other']);
const PAYMENT_MODES = new Set(['cash', 'upi', 'other']);

const getTempleName = async (templeId) => {
  const result = await pool.query('SELECT name FROM temples WHERE id = $1 LIMIT 1', [templeId]);
  return result.rows[0]?.name || `Temple ${templeId}`;
};

const getUserById = async (userId) => {
  const result = await pool.query(
    `SELECT id, first_name, last_name, father_name, gotra, email
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
};

const createSponsor = async (req, res) => {
  try {
    const {
      temple_id,
      sponsored_user_id,
      sponsor_type,
      payment_mode,
      amount,
      duration_start,
      duration_end,
      notes,
    } = req.body;

    if (!temple_id || !sponsored_user_id || !sponsor_type || !payment_mode || !amount) {
      return res.status(400).json({ success: false, message: 'temple_id, sponsored_user_id, sponsor_type, payment_mode and amount are required' });
    }

    if (!SPONSOR_TYPES.has(String(sponsor_type).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid sponsor_type' });
    }

    if (!PAYMENT_MODES.has(String(payment_mode).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid payment_mode' });
    }

    const sponsoredUser = await getUserById(Number(sponsored_user_id));
    if (!sponsoredUser) {
      return res.status(404).json({ success: false, message: 'Sponsored user not found' });
    }

    const adminUser = await getUserById(Number(req.user.id));
    const templeName = await getTempleName(Number(temple_id));

    const normalizedAmount = Number(amount);
    const sponsorTypeLabel = String(sponsor_type).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const sponsoredName = `${sponsoredUser.first_name || ''} ${sponsoredUser.last_name || ''}`.trim();
    const receiverName = `${adminUser?.first_name || 'Admin'} ${adminUser?.last_name || ''}`.trim();

    const invoice = await Invoice.create({
      user_id: Number(sponsored_user_id),
      user_name: sponsoredName || `User #${sponsored_user_id}`,
      user_email: sponsoredUser.email || '',
      family_name: sponsoredUser.gotra || null,
      created_by: Number(req.user.id),
      created_by_name: adminUser?.first_name || `Admin #${req.user.id}`,
      temple_name: templeName,
      subtotal: normalizedAmount,
      discount_amount: 0,
      total_amount: normalizedAmount,
      payment_method: String(payment_mode).toLowerCase(),
      payment_status: 'completed',
      line_items: [
        {
          service_id: 0,
          service_name: `${sponsorTypeLabel} Sponsorship`,
          quantity: 1,
          unit_price: normalizedAmount,
          total: normalizedAmount,
        },
      ],
      notes: [
        `Sponsored User: ${sponsoredName}`,
        `Father Name: ${sponsoredUser.father_name || '-'}`,
        `Gotra: ${sponsoredUser.gotra || '-'}`,
        `Receiver: ${receiverName}`,
        `Receiver Father Name: ${adminUser?.father_name || '-'}`,
        `Receiver Gotra: ${adminUser?.gotra || '-'}`,
        `Payment Mode: ${String(payment_mode).toUpperCase()}`,
        notes ? `Notes: ${notes}` : null,
      ].filter(Boolean).join(' | '),
    });

    const sponsorship = await Sponsor.create({
      temple_id: Number(temple_id),
      sponsored_user_id: Number(sponsored_user_id),
      sponsor_type: String(sponsor_type).toLowerCase(),
      payment_mode: String(payment_mode).toLowerCase(),
      amount: normalizedAmount,
      payment_status: 'completed',
      duration_start: duration_start || null,
      duration_end: duration_end || null,
      receiver_name: receiverName || null,
      receiver_user_id: Number(req.user.id),
      receiver_father_name: adminUser?.father_name || null,
      receiver_gotra: adminUser?.gotra || null,
      notes: notes || null,
      invoice_id: invoice.id,
      created_by: Number(req.user.id),
    });

    return res.status(201).json({
      success: true,
      message: 'Sponsorship created and invoice generated',
      data: {
        sponsorship,
        invoice,
      },
    });
  } catch (error) {
    console.error('Create sponsorship error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create sponsorship' });
  }
};

const getTempleSponsors = async (req, res) => {
  try {
    const templeId = Number(req.query.temple_id || req.params.templeId);
    if (!templeId) {
      return res.status(400).json({ success: false, message: 'temple_id is required' });
    }

    const sponsors = await Sponsor.getByTemple(templeId);
    return res.status(200).json({
      success: true,
      data: sponsors,
      count: sponsors.length,
    });
  } catch (error) {
    console.error('Get temple sponsors error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sponsors' });
  }
};

module.exports = {
  createSponsor,
  getTempleSponsors,
};
