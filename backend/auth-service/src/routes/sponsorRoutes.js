/**
 * =====================================================================
 * Sponsor Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createSponsor, getTempleSponsors } = require('../controllers/sponsorController');

router.use(protect);

router.get('/', getTempleSponsors);
router.post('/', createSponsor);

module.exports = router;
