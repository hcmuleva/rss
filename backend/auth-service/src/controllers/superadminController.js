const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Level = require('../models/Level');
const Karyakshetra = require('../models/Karyakshetra');
const LevelConstraint = require('../models/LevelConstraint');
const AuditLog = require('../models/AuditLog');

const parsePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const audit = (req, action, entityType, { id, label, details } = {}) => {
  const actorName = req.user
    ? [req.user.first_name, req.user.father_name].filter(Boolean).join(' ').trim() || null
    : null;
  void AuditLog.record({
    actorId: req.user?.id || null,
    actorName,
    action,
    entityType,
    entityId: id || null,
    entityLabel: label || null,
    details: details || {},
  });
};

const listCategories = async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const categories = await Category.list({ includeInactive });
    return res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    console.error('List categories error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load categories',
    });
  }
};

const createCategory = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    const category = await Category.create({ name, createdBy: req.user?.id || null });
    audit(req, 'create', 'category', { id: category.id, label: category.name });
    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category },
    });
  } catch (error) {
    console.error('Create category error:', error);
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to create category',
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }
    const name = String(req.body?.name || '').trim();
    const category = await Category.update({ id, name });
    audit(req, 'update', 'category', { id: category.id, label: category.name });
    return res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: { category },
    });
  } catch (error) {
    console.error('Update category error:', error);
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to update category',
    });
  }
};

const deactivateCategory = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }
    const category = await Category.deactivate({ id });
    audit(req, 'deactivate', 'category', { id: category.id, label: category.name });
    return res.status(200).json({
      success: true,
      message: 'Category deactivated successfully',
      data: { category },
    });
  } catch (error) {
    console.error('Deactivate category error:', error);
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to deactivate category',
    });
  }
};

const reactivateCategory = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }
    const category = await Category.reactivate({ id });
    audit(req, 'reactivate', 'category', { id: category.id, label: category.name });
    return res.status(200).json({
      success: true,
      message: 'Category reactivated successfully',
      data: { category },
    });
  } catch (error) {
    console.error('Reactivate category error:', error);
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to reactivate category',
    });
  }
};

// ---------------- Subcategories (Toli) ----------------

const listSubcategories = async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const categoryId = parsePositiveNumber(req.query.categoryId);
    const subcategories = await Subcategory.list({ categoryId, includeInactive });
    return res.status(200).json({ success: true, data: { subcategories } });
  } catch (error) {
    console.error('List subcategories error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load subcategories' });
  }
};

const createSubcategory = async (req, res) => {
  try {
    const categoryId = parsePositiveNumber(req.body?.categoryId);
    const name = String(req.body?.name || '').trim();
    if (!categoryId) return res.status(400).json({ success: false, message: 'Valid category is required' });
    if (!name) return res.status(400).json({ success: false, message: 'Subcategory name is required' });
    const subcategory = await Subcategory.create({ categoryId, name, createdBy: req.user?.id || null });
    audit(req, 'create', 'subcategory', {
      id: subcategory.id,
      label: subcategory.name,
      details: { categoryId },
    });
    return res.status(201).json({
      success: true,
      message: 'Subcategory created successfully',
      data: { subcategory },
    });
  } catch (error) {
    console.error('Create subcategory error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to create subcategory' });
  }
};

const updateSubcategory = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid subcategory id' });
    const subcategory = await Subcategory.update({ id, name: String(req.body?.name || '').trim() });
    audit(req, 'update', 'subcategory', { id: subcategory.id, label: subcategory.name });
    return res.status(200).json({
      success: true,
      message: 'Subcategory updated successfully',
      data: { subcategory },
    });
  } catch (error) {
    console.error('Update subcategory error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to update subcategory' });
  }
};

const deactivateSubcategory = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid subcategory id' });
    const subcategory = await Subcategory.deactivate({ id });
    audit(req, 'deactivate', 'subcategory', { id: subcategory.id, label: subcategory.name });
    return res.status(200).json({
      success: true,
      message: 'Subcategory deactivated successfully',
      data: { subcategory },
    });
  } catch (error) {
    console.error('Deactivate subcategory error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to deactivate subcategory' });
  }
};

const reactivateSubcategory = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid subcategory id' });
    const subcategory = await Subcategory.reactivate({ id });
    audit(req, 'reactivate', 'subcategory', { id: subcategory.id, label: subcategory.name });
    return res.status(200).json({
      success: true,
      message: 'Subcategory reactivated successfully',
      data: { subcategory },
    });
  } catch (error) {
    console.error('Reactivate subcategory error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to reactivate subcategory' });
  }
};

// ---------------- Levels ----------------

const listLevels = async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const levels = await Level.list({ includeInactive });
    return res.status(200).json({ success: true, data: { levels } });
  } catch (error) {
    console.error('List levels error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load levels' });
  }
};

const createLevel = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Level name is required' });
    const level = await Level.create({
      name,
      code: req.body?.code,
      isDynamic: Boolean(req.body?.isDynamic),
      createdBy: req.user?.id || null,
    });
    audit(req, 'create', 'level', { id: level.id, label: level.name });
    return res.status(201).json({ success: true, message: 'Level created successfully', data: { level } });
  } catch (error) {
    console.error('Create level error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to create level' });
  }
};

const updateLevel = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid level id' });
    const level = await Level.update({ id, name: String(req.body?.name || '').trim() });
    audit(req, 'update', 'level', { id: level.id, label: level.name });
    return res.status(200).json({ success: true, message: 'Level updated successfully', data: { level } });
  } catch (error) {
    console.error('Update level error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to update level' });
  }
};

const moveLevel = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid level id' });
    const direction = String(req.body?.direction || req.query.direction || 'down');
    const levels = await Level.move({ id, direction });
    audit(req, 'reorder', 'level', { id, details: { direction } });
    return res.status(200).json({ success: true, message: 'Level reordered', data: { levels } });
  } catch (error) {
    console.error('Move level error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to reorder level' });
  }
};

const deactivateLevel = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid level id' });
    const level = await Level.deactivate({ id });
    audit(req, 'deactivate', 'level', { id: level.id, label: level.name });
    return res.status(200).json({ success: true, message: 'Level deactivated successfully', data: { level } });
  } catch (error) {
    console.error('Deactivate level error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to deactivate level' });
  }
};

const reactivateLevel = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid level id' });
    const level = await Level.reactivate({ id });
    audit(req, 'reactivate', 'level', { id: level.id, label: level.name });
    return res.status(200).json({ success: true, message: 'Level reactivated successfully', data: { level } });
  } catch (error) {
    console.error('Reactivate level error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to reactivate level' });
  }
};

const deleteLevel = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid level id' });

    const usage = await Level.usage({ id });
    if (!usage) return res.status(404).json({ success: false, message: 'Level not found' });

    if (usage.placeCount > 0 || usage.childLevelCount > 0) {
      const parts = [];
      if (usage.childLevelCount > 0) parts.push(`${usage.childLevelCount} उप-स्तर जुड़े हैं`);
      if (usage.placeCount > 0) parts.push(`${usage.placeCount} स्थान (कार्यक्षेत्र) हैं`);
      return res.status(409).json({
        success: false,
        blocked: true,
        placeCount: usage.placeCount,
        childLevelCount: usage.childLevelCount,
        message: `इस स्तर में ${parts.join(' और ')}। पहले सभी उप-स्तर और इस स्तर के सभी स्थान डिलीट करें।`,
      });
    }

    const level = await Level.remove({ id });
    if (level?.code) await LevelConstraint.removeForLevel(level.code);
    audit(req, 'delete', 'level', { id: level.id, label: level.name });
    return res.status(200).json({ success: true, message: 'Level deleted successfully', data: { level } });
  } catch (error) {
    console.error('Delete level error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to delete level' });
  }
};

// ---------------- Karyakshetra ----------------

const listKaryakshetras = async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const karyakshetras = await Karyakshetra.list({ includeInactive });
    return res.status(200).json({ success: true, data: { karyakshetras } });
  } catch (error) {
    console.error('List karyakshetras error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load karyakshetras' });
  }
};

const createKaryakshetra = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Karyakshetra name is required' });
    const karyakshetra = await Karyakshetra.create({ name, createdBy: req.user?.id || null });
    audit(req, 'create', 'karyakshetra', { id: karyakshetra.id, label: karyakshetra.name });
    return res.status(201).json({
      success: true,
      message: 'Karyakshetra created successfully',
      data: { karyakshetra },
    });
  } catch (error) {
    console.error('Create karyakshetra error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to create karyakshetra' });
  }
};

const updateKaryakshetra = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid karyakshetra id' });
    const karyakshetra = await Karyakshetra.update({ id, name: String(req.body?.name || '').trim() });
    audit(req, 'update', 'karyakshetra', { id: karyakshetra.id, label: karyakshetra.name });
    return res.status(200).json({
      success: true,
      message: 'Karyakshetra updated successfully',
      data: { karyakshetra },
    });
  } catch (error) {
    console.error('Update karyakshetra error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to update karyakshetra' });
  }
};

const deactivateKaryakshetra = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid karyakshetra id' });
    const karyakshetra = await Karyakshetra.deactivate({ id });
    audit(req, 'deactivate', 'karyakshetra', { id: karyakshetra.id, label: karyakshetra.name });
    return res.status(200).json({
      success: true,
      message: 'Karyakshetra deactivated successfully',
      data: { karyakshetra },
    });
  } catch (error) {
    console.error('Deactivate karyakshetra error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to deactivate karyakshetra' });
  }
};

const reactivateKaryakshetra = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid karyakshetra id' });
    const karyakshetra = await Karyakshetra.reactivate({ id });
    audit(req, 'reactivate', 'karyakshetra', { id: karyakshetra.id, label: karyakshetra.name });
    return res.status(200).json({
      success: true,
      message: 'Karyakshetra reactivated successfully',
      data: { karyakshetra },
    });
  } catch (error) {
    console.error('Reactivate karyakshetra error:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Failed to reactivate karyakshetra' });
  }
};

const listLevelConstraints = async (req, res) => {
  try {
    const constraints = await LevelConstraint.list();
    return res.status(200).json({ success: true, data: { constraints } });
  } catch (error) {
    console.error('List level constraints error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load level constraints' });
  }
};

const createLevelConstraint = async (req, res) => {
  try {
    const childLevel = String(req.body?.childLevel || '').trim();
    if (!childLevel) {
      return res.status(400).json({ success: false, message: 'child level is required' });
    }
    const constraint = await LevelConstraint.create({
      childLevel,
      parentLevel: req.body?.parentLevel,
    });
    audit(req, 'create', 'level_constraint', {
      id: constraint?.id,
      label: `${constraint?.child_level} ← ${constraint?.parent_level || 'root'}`,
    });
    return res
      .status(201)
      .json({ success: true, message: 'Level constraint saved', data: { constraint } });
  } catch (error) {
    console.error('Create level constraint error:', error);
    return res
      .status(400)
      .json({ success: false, message: error?.message || 'Failed to save level constraint' });
  }
};

const deleteLevelConstraint = async (req, res) => {
  try {
    const id = parsePositiveNumber(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid constraint id' });
    await LevelConstraint.remove({ id });
    audit(req, 'delete', 'level_constraint', { id });
    return res.status(200).json({ success: true, message: 'Level constraint removed' });
  } catch (error) {
    console.error('Delete level constraint error:', error);
    return res
      .status(400)
      .json({ success: false, message: error?.message || 'Failed to remove level constraint' });
  }
};

const listAuditLogs = async (req, res) => {
  try {
    const { logs, total } = await AuditLog.list({
      entityType: req.query.entityType ? String(req.query.entityType).trim() : undefined,
      action: req.query.action ? String(req.query.action).trim() : undefined,
      search: req.query.search ? String(req.query.search).trim() : undefined,
      limit: parsePositiveNumber(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    return res.status(200).json({ success: true, data: { logs, total } });
  } catch (error) {
    console.error('List audit logs error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load audit logs' });
  }
};

module.exports = {
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
};
