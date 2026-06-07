const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/admin');
const {
  listCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
  reactivateCategory,
  listSubcategories,
  createSubcategory,
  updateSubcategory,
  deactivateSubcategory,
  reactivateSubcategory,
  listLevels,
  createLevel,
  updateLevel,
  moveLevel,
  deactivateLevel,
  reactivateLevel,
  deleteLevel,
  listKaryakshetras,
  createKaryakshetra,
  updateKaryakshetra,
  deactivateKaryakshetra,
  reactivateKaryakshetra,
  listLevelConstraints,
  createLevelConstraint,
  deleteLevelConstraint,
  listAuditLogs,
} = require('../controllers/superadminController');

router.use(protect);
router.use(isSuperAdmin);

// Categories (Aayam) master data
router.get('/categories', listCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.patch('/categories/:id/deactivate', deactivateCategory);
router.patch('/categories/:id/reactivate', reactivateCategory);

// Subcategories (Toli) master data
router.get('/subcategories', listSubcategories);
router.post('/subcategories', createSubcategory);
router.put('/subcategories/:id', updateSubcategory);
router.patch('/subcategories/:id/deactivate', deactivateSubcategory);
router.patch('/subcategories/:id/reactivate', reactivateSubcategory);

// Levels master data
router.get('/levels', listLevels);
router.post('/levels', createLevel);
router.put('/levels/:id', updateLevel);
router.patch('/levels/:id/move', moveLevel);
router.patch('/levels/:id/deactivate', deactivateLevel);
router.patch('/levels/:id/reactivate', reactivateLevel);
router.delete('/levels/:id', deleteLevel);

// Karyakshetra master data
router.get('/karyakshetras', listKaryakshetras);
router.post('/karyakshetras', createKaryakshetra);
router.put('/karyakshetras/:id', updateKaryakshetra);
router.patch('/karyakshetras/:id/deactivate', deactivateKaryakshetra);
router.patch('/karyakshetras/:id/reactivate', reactivateKaryakshetra);

// Level constraints (parent-level rules)
router.get('/level-constraints', listLevelConstraints);
router.post('/level-constraints', createLevelConstraint);
router.delete('/level-constraints/:id', deleteLevelConstraint);

// Audit log
router.get('/audit-logs', listAuditLogs);

module.exports = router;
