/**
 * =====================================================================
 * Family Member Auth Routes
 * Company: emeelan
 * =====================================================================
 * Routes for managing family member credentials
 */

const express = require('express');
const router = express.Router();
const familyMemberAuthController = require('../controllers/familyMemberAuthController');
const { protect } = require('../middleware/auth');

// Get manageable family members (with accounts)
router.get('/manageable', 
  protect, 
  familyMemberAuthController.getManageableFamilyMembers
);

// Resolve account user IDs for given email list
router.post('/resolve-user-ids',
  protect,
  familyMemberAuthController.resolveUserIdsByEmails
);

// Get tree members without accounts
router.get('/tree-members-without-accounts', 
  protect, 
  familyMemberAuthController.getTreeMembersWithoutAccounts
);

// Create account for family member
router.post('/create-account', 
  protect, 
  familyMemberAuthController.createAccountForFamilyMember
);

// Update email
router.patch('/update-email', 
  protect, 
  familyMemberAuthController.updateFamilyMemberEmail
);

// Update password
router.patch('/update-password', 
  protect, 
  familyMemberAuthController.updateFamilyMemberPassword
);

// Update credentials (email and/or password)
router.patch('/update-credentials', 
  protect, 
  familyMemberAuthController.updateFamilyMemberCredentials
);

module.exports = router;
