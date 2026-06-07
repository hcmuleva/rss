import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { PageHeaderCard } from '../../core/components/PageHeaderCard';
import { StandardModal } from '../../core/components/StandardModal';
import { useProfile } from '../../core/context/ProfileContext';
import {
  superadminService,
  type Category,
  type Subcategory,
  type KaryakariniVersion,
  type TreeNode,
  type SubtreeNode,
  type Level,
  type LevelConstraint,
  type AuditLog,
} from '../../api/superadminService';

const LEVEL_LABELS: Record<string, string> = {
  rashtriya: 'राष्ट्रीय',
  prant: 'प्रान्त',
  sambhag: 'संभाग',
  vibhag: 'विभाग',
  jila: 'जिला',
  khand: 'खंड',
  mandal: 'मंडल',
  nagar: 'नगर',
  gram: 'ग्राम',
  basti: 'बस्ती',
  mohalla: 'मोहल्ला',
  mandal_basti: 'मंडल/बस्ती',
  nagar_mohalla: 'नगर/मोहल्ला',
};

const levelLabel = (level: string) => LEVEL_LABELS[String(level || '').toLowerCase()] || level;

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

type SuperAdminModule = {
  key: string;
  icon: MaterialIconName;
  titleHi: string;
  titleEn: string;
  description: string;
  features: string[];
};

const MODULES: SuperAdminModule[] = [
  {
    key: 'master',
    icon: 'category',
    titleHi: 'आयाम व टोली',
    titleEn: 'Aayam & Toli',
    description: 'आयाम व टोली एक साथ एड/एडिट/डिलीट करें',
    features: [],
  },
  {
    key: 'karyakshetra',
    icon: 'account-tree',
    titleHi: 'कार्यक्षेत्र',
    titleEn: 'Karyakshetra',
    description: 'स्तर अनुसार कार्यक्षेत्र देखें व डिलीट करें',
    features: [],
  },
  {
    key: 'constraints',
    icon: 'rule',
    titleHi: 'स्तर नियम',
    titleEn: 'Level Constraints',
    description: 'किस स्तर का पैरेंट कौन हो सकता है',
    features: ['पैरेंट स्तर नियम परिभाषित करें', 'अमान्य पैरेंट चयन रोकें', 'चक्रीय संरचना रोकें'],
  },
  {
    key: 'audit',
    icon: 'history',
    titleHi: 'ऑडिट लॉग',
    titleEn: 'Audit Log',
    description: 'सभी परिवर्तनों का रिकॉर्ड',
    features: ['हर बदलाव का लॉग', 'उपयोगकर्ता व समय', 'निष्क्रिय प्रविष्टियों की समीक्षा'],
  },
];

function ConfirmDeleteModal({
  visible,
  name,
  note,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  name: string;
  note?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <StandardModal
      visible={visible}
      onClose={onCancel}
      title="डिलीट कन्फर्म"
      footer={
        <>
          <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn]} onPress={onCancel} disabled={busy}>
            <Text style={styles.modalCancelText}>कैंसिल</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalBtn, styles.modalDeleteBtn, busy && styles.btnDisabled]}
            onPress={onConfirm}
            disabled={busy}
          >
            <MaterialIcons name="delete-outline" size={18} color="#fff" />
            <Text style={styles.modalDeleteText}>{busy ? 'डिलीट हो रहा है...' : 'डिलीट'}</Text>
          </TouchableOpacity>
        </>
      }
    >
      <View style={styles.confirmBody}>
        <View style={styles.confirmIcon}>
          <MaterialIcons name="warning-amber" size={28} color="#C0492F" />
        </View>
        <Text style={styles.confirmName}>{name}</Text>
        <Text style={styles.confirmMsg}>{note || 'क्या आप वाकई इसे डिलीट करना चाहते हैं?'}</Text>
      </View>
    </StandardModal>
  );
}

function InactiveToggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={onToggle} activeOpacity={0.7}>
      <MaterialIcons
        name={value ? 'check-box' : 'check-box-outline-blank'}
        size={20}
        color={theme.colors.primary}
      />
      <Text style={styles.toggleText}>इनएक्टिव भी दिखाएँ</Text>
    </TouchableOpacity>
  );
}

// ---------------- Category + Subcategory (merged) ----------------

function MasterManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subsByCat, setSubsByCat] = useState<Record<number, Subcategory[]>>({});
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [expandedCatId, setExpandedCatId] = useState<number | null>(null);

  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  const [newSubByCat, setNewSubByCat] = useState<Record<number, string>>({});
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [editingSubName, setEditingSubName] = useState('');

  const [pendingDelete, setPendingDelete] = useState<
    { type: 'category' | 'subcategory'; id: number; name: string } | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (withInactive: boolean) => {
    try {
      setLoading(true);
      const [cats, subs] = await Promise.all([
        superadminService.listCategories(withInactive),
        superadminService.listSubcategories(undefined, withInactive),
      ]);
      setCategories(cats);
      const grouped: Record<number, Subcategory[]> = {};
      subs.forEach((sub) => {
        (grouped[sub.category_id] = grouped[sub.category_id] || []).push(sub);
      });
      setSubsByCat(grouped);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'डेटा लोड नहीं हो पाया');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(includeInactive);
  }, [includeInactive, load]);

  const handleAddCategory = useCallback(async () => {
    const name = newCatName.trim();
    if (!name) {
      Alert.alert('आवश्यक', 'आयाम का नाम आवश्यक है');
      return;
    }
    try {
      await superadminService.createCategory(name);
      setNewCatName('');
      await load(includeInactive);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'आयाम एड नहीं हुआ');
    }
  }, [includeInactive, load, newCatName]);

  const handleSaveCategory = useCallback(async () => {
    if (editingCatId == null) return;
    const name = editingCatName.trim();
    if (!name) return;
    try {
      await superadminService.updateCategory(editingCatId, name);
      setEditingCatId(null);
      setEditingCatName('');
      await load(includeInactive);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'अपडेट नहीं हुआ');
    }
  }, [editingCatId, editingCatName, includeInactive, load]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      setDeleting(true);
      if (pendingDelete.type === 'category') {
        await superadminService.deactivateCategory(pendingDelete.id);
      } else {
        await superadminService.deactivateSubcategory(pendingDelete.id);
      }
      setPendingDelete(null);
      await load(includeInactive);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'डिलीट नहीं हुआ');
    } finally {
      setDeleting(false);
    }
  }, [includeInactive, load, pendingDelete]);

  const handleAddSub = useCallback(
    async (categoryId: number) => {
      const name = (newSubByCat[categoryId] || '').trim();
      if (!name) {
        Alert.alert('आवश्यक', 'टोली का नाम आवश्यक है');
        return;
      }
      try {
        await superadminService.createSubcategory(categoryId, name);
        setNewSubByCat((prev) => ({ ...prev, [categoryId]: '' }));
        await load(includeInactive);
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'टोली एड नहीं हुई');
      }
    },
    [includeInactive, load, newSubByCat]
  );

  const handleSaveSub = useCallback(async () => {
    if (editingSubId == null) return;
    const name = editingSubName.trim();
    if (!name) return;
    try {
      await superadminService.updateSubcategory(editingSubId, name);
      setEditingSubId(null);
      setEditingSubName('');
      await load(includeInactive);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'अपडेट नहीं हुआ');
    }
  }, [editingSubId, editingSubName, includeInactive, load]);



  return (
    <View style={styles.managerWrap}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={newCatName}
          onChangeText={setNewCatName}
          placeholder="नया आयाम एड करें"
          placeholderTextColor={theme.colors.text.disabled}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => void handleAddCategory()}>
          <MaterialIcons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>एड</Text>
        </TouchableOpacity>
      </View>

      <InactiveToggle value={includeInactive} onToggle={() => setIncludeInactive((p) => !p)} />

      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 16 }} />
      ) : categories.length === 0 ? (
        <Text style={styles.emptyText}>कोई आयाम नहीं मिला।</Text>
      ) : (
        categories.map((cat) => {
          const subs = subsByCat[cat.id] || [];
          const expanded = expandedCatId === cat.id;
          return (
            <View key={cat.id} style={[styles.catCard, !cat.is_active && styles.itemRowInactive]}>
              <View style={styles.catHeader}>
                {editingCatId === cat.id ? (
                  <>
                    <TextInput
                      style={[styles.input, styles.editInput]}
                      value={editingCatName}
                      onChangeText={setEditingCatName}
                      autoFocus
                    />
                    <TouchableOpacity onPress={() => void handleSaveCategory()}>
                      <MaterialIcons name="check" size={22} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingCatId(null); setEditingCatName(''); }}>
                      <MaterialIcons name="close" size={22} color={theme.colors.text.disabled} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.catTitleWrap}
                      onPress={() => setExpandedCatId(expanded ? null : cat.id)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name={expanded ? 'expand-less' : 'expand-more'}
                        size={22}
                        color={theme.colors.text.secondary}
                      />
                      <Text style={[styles.catTitle, !cat.is_active && styles.itemNameInactive]}>
                        {cat.name}{!cat.is_active ? '  (इनएक्टिव)' : ''}
                      </Text>
                      <Text style={styles.countBadge}>{subs.length}</Text>
                    </TouchableOpacity>
                    {cat.is_active ? (
                      <>
                        <TouchableOpacity onPress={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}>
                          <MaterialIcons name="edit" size={20} color={theme.colors.text.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setPendingDelete({ type: 'category', id: cat.id, name: cat.name })}>
                          <MaterialIcons name="delete-outline" size={20} color="#C0492F" />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity onPress={async () => { await superadminService.reactivateCategory(cat.id); await load(includeInactive); }}>
                        <MaterialIcons name="undo" size={20} color={theme.colors.primary} />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>

              {expanded ? (
                <View style={styles.subWrap}>
                  {subs.length === 0 ? (
                    <Text style={styles.emptySubText}>कोई टोली नहीं।</Text>
                  ) : (
                    subs.map((sub) => (
                      <View key={sub.id} style={[styles.subRow, !sub.is_active && styles.itemRowInactive]}>
                        {editingSubId === sub.id ? (
                          <>
                            <TextInput
                              style={[styles.input, styles.editInput]}
                              value={editingSubName}
                              onChangeText={setEditingSubName}
                              autoFocus
                            />
                            <TouchableOpacity onPress={() => void handleSaveSub()}>
                              <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setEditingSubId(null); setEditingSubName(''); }}>
                              <MaterialIcons name="close" size={20} color={theme.colors.text.disabled} />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <Text style={[styles.subName, !sub.is_active && styles.itemNameInactive]}>
                              • {sub.name}{!sub.is_active ? '  (इनएक्टिव)' : ''}
                            </Text>
                            {sub.is_active ? (
                              <>
                                <TouchableOpacity onPress={() => { setEditingSubId(sub.id); setEditingSubName(sub.name); }}>
                                  <MaterialIcons name="edit" size={18} color={theme.colors.text.secondary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setPendingDelete({ type: 'subcategory', id: sub.id, name: sub.name })}>
                                  <MaterialIcons name="delete-outline" size={18} color="#C0492F" />
                                </TouchableOpacity>
                              </>
                            ) : (
                              <TouchableOpacity onPress={async () => { await superadminService.reactivateSubcategory(sub.id); await load(includeInactive); }}>
                                <MaterialIcons name="undo" size={18} color={theme.colors.primary} />
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </View>
                    ))
                  )}

                  {cat.is_active ? (
                    <View style={styles.addSubRow}>
                      <TextInput
                        style={[styles.input, styles.editInput]}
                        value={newSubByCat[cat.id] || ''}
                        onChangeText={(val) => setNewSubByCat((prev) => ({ ...prev, [cat.id]: val }))}
                        placeholder="नई टोली एड करें"
                        placeholderTextColor={theme.colors.text.disabled}
                      />
                      <TouchableOpacity style={styles.addBtnSmall} onPress={() => void handleAddSub(cat.id)}>
                        <MaterialIcons name="add" size={16} color="#fff" />
                        <Text style={styles.addBtnText}>एड</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <ConfirmDeleteModal
        visible={!!pendingDelete}
        name={pendingDelete?.name || ''}
        note={
          pendingDelete?.type === 'category'
            ? 'इस आयाम की सभी टोली भी हट जाएँगी। क्या आप वाकई डिलीट करना चाहते हैं?'
            : 'क्या आप वाकई इस टोली को डिलीट करना चाहते हैं?'
        }
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </View>
  );
}

// ---------------- Karyakshetra (tree from existing node data) ----------------

type Crumb = { id: number; name: string; level: string };

function TreeManager() {
  const [versionId, setVersionId] = useState<number | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>([]);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<TreeNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [childWarning, setChildWarning] = useState<TreeNode | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formEditingId, setFormEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formLevel, setFormLevel] = useState('');
  const [saving, setSaving] = useState(false);

  const [bulkVisible, setBulkVisible] = useState(false);
  const [bulkName, setBulkName] = useState('');
  const [bulkLevel, setBulkLevel] = useState('');
  const [bulkPreview, setBulkPreview] = useState<SubtreeNode[] | null>(null);
  const [bulkConfirmVisible, setBulkConfirmVisible] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const currentParentId = breadcrumb.length ? breadcrumb[breadcrumb.length - 1].id : null;
  const currentParentLevel = breadcrumb.length ? breadcrumb[breadcrumb.length - 1].level : null;
  const currentNode = breadcrumb.length ? breadcrumb[breadcrumb.length - 1] : null;

  const nextLevelCode = useCallback(
    (parentLevelCode: string | null) => {
      if (!levels.length) return '';
      if (!parentLevelCode) return levels[0]?.code || '';
      const idx = levels.findIndex(
        (l) => String(l.code || '').toLowerCase() === String(parentLevelCode).toLowerCase()
      );
      if (idx < 0) return levels[0]?.code || '';
      return levels[Math.min(idx + 1, levels.length - 1)]?.code || '';
    },
    [levels]
  );

  const loadNodes = useCallback(async (vId: number, parentId: number | null) => {
    try {
      setLoading(true);
      setNodes(await superadminService.listTreeNodes(vId, parentId));
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'कार्यक्षेत्र लोड नहीं हो पाए');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [versions, levelRows] = await Promise.all([
          superadminService.listVersions(),
          superadminService.listLevels().catch(() => [] as Level[]),
        ]);
        setLevels(levelRows.filter((l) => l.code));
        const current = versions.find((v) => v.is_current) || versions[0];
        if (!current) {
          setLoading(false);
          Alert.alert('त्रुटि', 'कोई वर्शन नहीं मिला');
          return;
        }
        setVersionId(current.id);
        await loadNodes(current.id, null);
      } catch (err: any) {
        setLoading(false);
        Alert.alert('त्रुटि', err?.response?.data?.message || 'डेटा लोड नहीं हो पाया');
      }
    })();
  }, [loadNodes]);

  const drillInto = useCallback(
    (node: TreeNode) => {
      if (versionId == null) return;
      setBreadcrumb((prev) => [...prev, { id: node.id, name: node.name, level: node.level }]);
      void loadNodes(versionId, node.id);
    },
    [loadNodes, versionId]
  );

  const goToCrumb = useCallback(
    (index: number) => {
      if (versionId == null) return;
      if (index < 0) {
        setBreadcrumb([]);
        void loadNodes(versionId, null);
        return;
      }
      const next = breadcrumb.slice(0, index + 1);
      setBreadcrumb(next);
      void loadNodes(versionId, next[next.length - 1].id);
    },
    [breadcrumb, loadNodes, versionId]
  );

  const openAdd = useCallback(() => {
    setFormMode('add');
    setFormEditingId(null);
    setFormName('');
    setFormLevel(nextLevelCode(currentParentLevel));
    setFormVisible(true);
  }, [currentParentLevel, nextLevelCode]);

  const openEdit = useCallback((node: TreeNode) => {
    setFormMode('edit');
    setFormEditingId(node.id);
    setFormName(node.name);
    setFormLevel(String(node.level || '').toLowerCase());
    setFormVisible(true);
  }, []);

  const saveForm = useCallback(async () => {
    if (versionId == null) return;
    const name = formName.trim();
    const level = String(formLevel || '').trim().toLowerCase();
    if (!name) {
      Alert.alert('आवश्यक', 'नाम आवश्यक है');
      return;
    }
    if (!level) {
      Alert.alert('आवश्यक', 'स्तर चुनें');
      return;
    }
    try {
      setSaving(true);
      if (formMode === 'add') {
        await superadminService.createTreeNode(versionId, currentParentId, name, level);
        setFormVisible(false);
        await loadNodes(versionId, currentParentId);
      } else if (formEditingId != null) {
        await superadminService.updateTreeNode(formEditingId, versionId, name, level);
        setNodes((prev) => prev.map((n) => (n.id === formEditingId ? { ...n, name, level } : n)));
        setFormVisible(false);
      }
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'सेव नहीं हुआ');
    } finally {
      setSaving(false);
    }
  }, [currentParentId, formEditingId, formLevel, formMode, formName, loadNodes, versionId]);

  const openBulk = useCallback(() => {
    if (!currentNode) return;
    const listLevel = nodes[0]?.level || nextLevelCode(String(currentNode.level || ''));
    setBulkName(currentNode.name);
    setBulkLevel(String(listLevel || '').toLowerCase());
    setBulkPreview(null);
    setBulkConfirmVisible(false);
    setBulkVisible(true);
  }, [currentNode, nextLevelCode, nodes]);

  const proceedBulk = useCallback(async () => {
    if (versionId == null || !currentNode) return;
    const name = bulkName.trim();
    const level = String(bulkLevel || '').trim().toLowerCase();
    if (!name) {
      Alert.alert('आवश्यक', 'नाम आवश्यक है');
      return;
    }
    if (!level) {
      Alert.alert('आवश्यक', 'स्तर चुनें');
      return;
    }
    try {
      setBulkSaving(true);
      const sub = await superadminService.getNodeSubtree(currentNode.id, versionId, true);
      setBulkPreview(sub);
      setBulkConfirmVisible(true);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'कार्यक्षेत्र लोड नहीं हो पाए');
    } finally {
      setBulkSaving(false);
    }
  }, [bulkLevel, bulkName, currentNode, versionId]);

  const confirmBulk = useCallback(async () => {
    if (versionId == null || !currentNode) return;
    const name = bulkName.trim();
    const level = String(bulkLevel || '').trim().toLowerCase();
    try {
      setBulkSaving(true);
      const res = await superadminService.bulkUpdateSubtree(currentNode.id, versionId, name, level);
      setBulkConfirmVisible(false);
      setBulkVisible(false);
      setBulkPreview(null);
      setBreadcrumb((prev) =>
        prev.map((c, i) => (i === prev.length - 1 ? { ...c, name, level } : c))
      );
      await loadNodes(versionId, currentParentId);
      Alert.alert('सफल', `${res?.count || 0} कार्यक्षेत्र अपडेट हुए`);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'अपडेट नहीं हुआ');
    } finally {
      setBulkSaving(false);
    }
  }, [bulkLevel, bulkName, currentNode, currentParentId, loadNodes, versionId]);

  const onPressDelete = useCallback((node: TreeNode) => {
    if (node.child_count > 0) {
      setChildWarning(node);
      return;
    }
    setPendingDelete(node);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || versionId == null) return;
    try {
      setDeleting(true);
      await superadminService.deleteTreeNode(pendingDelete.id, versionId);
      setPendingDelete(null);
      await loadNodes(versionId, currentParentId);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'डिलीट नहीं हुआ');
    } finally {
      setDeleting(false);
    }
  }, [currentParentId, loadNodes, pendingDelete, versionId]);

  const currentListLevel =
    nodes[0]?.level ||
    (currentNode ? nextLevelCode(String(currentNode.level || '')) : levels[0]?.code || '');

  return (
    <View style={styles.managerWrap}>
      <View style={styles.crumbRow}>
        <TouchableOpacity onPress={() => goToCrumb(-1)} style={styles.crumbItem}>
          <MaterialIcons name="home" size={16} color={theme.colors.primary} />
          <Text style={styles.crumbText}>कार्यक्षेत्र</Text>
        </TouchableOpacity>
        {breadcrumb.map((c, idx) => (
          <View key={c.id} style={styles.crumbItem}>
            <MaterialIcons name="chevron-right" size={16} color={theme.colors.text.disabled} />
            <TouchableOpacity onPress={() => goToCrumb(idx)}>
              <Text style={styles.crumbText} numberOfLines={1}>{c.name}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.currentNodeCard}>
        <MaterialIcons
          name={currentNode ? 'place' : 'public'}
          size={18}
          color={theme.colors.primary}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.currentNodeLabel} numberOfLines={1}>
            {currentNode ? `आप यहाँ हैं: ${currentNode.name}` : 'मुख्य स्तर'}
          </Text>
          <Text style={styles.currentNodeName} numberOfLines={1}>
            {currentListLevel ? `${levelLabel(currentListLevel)} स्तर के कार्यक्षेत्र` : 'कार्यक्षेत्र'}
          </Text>
        </View>
        {currentListLevel ? (
          <View style={styles.currentNodeBadge}>
            <Text style={styles.currentNodeBadgeText}>{levelLabel(currentListLevel)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionBtnRow}>
        <TouchableOpacity style={styles.actionBtnPrimary} onPress={openAdd}>
          <MaterialIcons name="add" size={16} color="#fff" />
          <Text style={styles.actionBtnPrimaryText} numberOfLines={1}>नया एड करें</Text>
        </TouchableOpacity>
        {currentNode ? (
          <TouchableOpacity style={styles.actionBtnOutline} onPress={openBulk}>
            <MaterialIcons name="dynamic-feed" size={16} color={theme.colors.primary} />
            <Text style={styles.actionBtnOutlineText} numberOfLines={1}>सभी अपडेट करें</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 16 }} />
      ) : nodes.length === 0 ? (
        <Text style={styles.emptyText}>इस स्तर पर कोई कार्यक्षेत्र नहीं। ऊपर से एड करें।</Text>
      ) : (
        nodes.map((node) => {
          const hasChildren = node.child_count > 0;
          return (
            <TouchableOpacity
              key={node.id}
              style={styles.itemRow}
              onPress={() => drillInto(node)}
              activeOpacity={0.6}
            >
              <View style={styles.treeNameWrap}>
                <Text style={styles.itemName} numberOfLines={1}>{node.name}</Text>
                <View style={styles.treeMetaRow}>
                  {hasChildren ? (
                    <Text style={styles.metaText}>{node.child_count} उप-कार्यक्षेत्र</Text>
                  ) : (
                    <Text style={styles.metaTextMuted}>कोई उप-कार्यक्षेत्र नहीं</Text>
                  )}
                  {node.member_count > 0 ? (
                    <Text style={styles.metaText}>· {node.member_count} सदस्य</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.levelBadgeWrap}>
                <Text style={styles.levelBadge}>{levelLabel(node.level)}</Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(node)}>
                  <MaterialIcons name="edit" size={19} color={theme.colors.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => onPressDelete(node)}>
                  <MaterialIcons
                    name="delete-outline"
                    size={19}
                    color={hasChildren ? theme.colors.text.disabled : '#C0492F'}
                  />
                </TouchableOpacity>
                <MaterialIcons name="chevron-right" size={22} color={theme.colors.border} />
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <StandardModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={formMode === 'add' ? 'नया कार्यक्षेत्र एड करें' : 'कार्यक्षेत्र एडिट करें'}
        footer={
          <>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalCancelBtn]}
              onPress={() => setFormVisible(false)}
              disabled={saving}
            >
              <Text style={styles.modalCancelText}>कैंसिल</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalSaveBtn, saving && styles.btnDisabled]}
              onPress={() => void saveForm()}
              disabled={saving}
            >
              <MaterialIcons name="check" size={18} color="#fff" />
              <Text style={styles.modalDeleteText}>{saving ? 'सेव हो रहा है...' : 'सेव'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={styles.formBody}>
          <Text style={styles.formLabel}>नाम</Text>
          <TextInput
            style={styles.input}
            value={formName}
            onChangeText={setFormName}
            placeholder="कार्यक्षेत्र का नाम"
            placeholderTextColor={theme.colors.text.disabled}
            autoFocus
          />
          <Text style={styles.formLabel}>स्तर</Text>
          <View style={styles.chipWrap}>
            {levels.map((l) => {
              const code = String(l.code || '').toLowerCase();
              const active = code === formLevel;
              return (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setFormLevel(code)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{l.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </StandardModal>

      <StandardModal
        visible={bulkVisible}
        onClose={() => setBulkVisible(false)}
        title="सभी कार्यक्षेत्र एक साथ अपडेट करें"
        footer={
          <>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalCancelBtn]}
              onPress={() => setBulkVisible(false)}
              disabled={bulkSaving}
            >
              <Text style={styles.modalCancelText}>कैंसिल</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalSaveBtn, bulkSaving && styles.btnDisabled]}
              onPress={() => void proceedBulk()}
              disabled={bulkSaving}
            >
              <MaterialIcons name="arrow-forward" size={18} color="#fff" />
              <Text style={styles.modalDeleteText}>{bulkSaving ? 'लोड हो रहा है...' : 'आगे बढ़ें'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={styles.formBody}>
          <Text style={styles.bulkHint}>
            "{currentNode?.name || ''}" और इसके अंदर के सभी कार्यक्षेत्रों को नीचे दिए नाम व स्तर से बदला जाएगा।
          </Text>
          <Text style={styles.formLabel}>नया नाम</Text>
          <TextInput
            style={styles.input}
            value={bulkName}
            onChangeText={setBulkName}
            placeholder="कार्यक्षेत्र का नाम"
            placeholderTextColor={theme.colors.text.disabled}
          />
          <Text style={styles.formLabel}>नया स्तर</Text>
          <View style={styles.chipWrap}>
            {levels.map((l) => {
              const code = String(l.code || '').toLowerCase();
              const active = code === bulkLevel;
              return (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setBulkLevel(code)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{l.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </StandardModal>

      <StandardModal
        visible={bulkConfirmVisible}
        onClose={() => setBulkConfirmVisible(false)}
        title="पुष्टि करें"
        footer={
          <>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalCancelBtn]}
              onPress={() => setBulkConfirmVisible(false)}
              disabled={bulkSaving}
            >
              <Text style={styles.modalCancelText}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalSaveBtn, bulkSaving && styles.btnDisabled]}
              onPress={() => void confirmBulk()}
              disabled={bulkSaving}
            >
              <MaterialIcons name="check" size={18} color="#fff" />
              <Text style={styles.modalDeleteText}>{bulkSaving ? 'अपडेट हो रहा है...' : 'पुष्टि करें'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={styles.formBody}>
          <Text style={styles.bulkHint}>
            ये {bulkPreview?.length || 0} कार्यक्षेत्र बदलकर नाम "{bulkName.trim()}" व स्तर "{levelLabel(bulkLevel)}" हो जाएँगे:
          </Text>
          <ScrollView style={styles.bulkList} nestedScrollEnabled>
            {(bulkPreview || []).map((n) => (
              <View key={n.id} style={styles.bulkListItem}>
                <MaterialIcons name="subdirectory-arrow-right" size={14} color={theme.colors.text.disabled} />
                <Text style={styles.bulkListName} numberOfLines={1}>{n.name}</Text>
                <Text style={styles.bulkListLevel}>{levelLabel(n.level)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </StandardModal>

      <ConfirmDeleteModal
        visible={!!pendingDelete}
        name={pendingDelete?.name || ''}
        note="क्या आप वाकई इस कार्यक्षेत्र को डिलीट करना चाहते हैं? इसके सदस्य/टीम भी हट जाएँगे।"
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />

      <StandardModal
        visible={!!childWarning}
        onClose={() => setChildWarning(null)}
        title="डिलीट नहीं हो सकता"
        footer={
          <TouchableOpacity
            style={[styles.modalBtn, styles.modalSaveBtn]}
            onPress={() => setChildWarning(null)}
          >
            <Text style={styles.modalDeleteText}>समझ गया</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.confirmBody}>
          <View style={styles.warnIcon}>
            <MaterialIcons name="warning-amber" size={28} color="#B26A00" />
          </View>
          <Text style={styles.confirmName}>{childWarning?.name || ''}</Text>
          <Text style={styles.confirmMsg}>
            इस कार्यक्षेत्र में {childWarning?.child_count || 0} उप-कार्यक्षेत्र जुड़े हैं।
            {'\n'}पहले अंदर के सभी उप-कार्यक्षेत्र डिलीट करें, उसके बाद ही यह स्तर डिलीट होगा।
          </Text>
        </View>
      </StandardModal>
    </View>
  );
}

const ROOT_PARENT = '__root__';

function ConstraintsManager() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [constraints, setConstraints] = useState<LevelConstraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState<Level | null>(null);
  const [saving, setSaving] = useState(false);

  const [levelForm, setLevelForm] = useState<{
    visible: boolean;
    mode: 'add' | 'edit';
    id: number | null;
    name: string;
    code: string;
  }>({ visible: false, mode: 'add', id: null, name: '', code: '' });
  const [savingLevel, setSavingLevel] = useState(false);
  const [pendingDeleteLevel, setPendingDeleteLevel] = useState<Level | null>(null);
  const [deletingLevel, setDeletingLevel] = useState(false);
  const [levelWarning, setLevelWarning] = useState<Level | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [lv, cs] = await Promise.all([
        superadminService.listLevels(),
        superadminService.listLevelConstraints(),
      ]);
      setLevels(lv);
      setConstraints(cs);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'नियम लोड नहीं हो पाए');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = useCallback(
    (code: string | null) => {
      if (!code) return 'रूट (कोई पैरेंट नहीं)';
      const match = levels.find(
        (l) => String(l.code || '').toLowerCase() === String(code).toLowerCase()
      );
      return match?.name || code;
    },
    [levels]
  );

  const rulesFor = useCallback(
    (code: string | null) =>
      constraints.filter(
        (c) => String(c.child_level).toLowerCase() === String(code || '').toLowerCase()
      ),
    [constraints]
  );

  const addParent = useCallback(
    async (child: Level, parentValue: string) => {
      const childCode = String(child.code || '').toLowerCase();
      const parentLevel = parentValue === ROOT_PARENT ? null : parentValue;
      try {
        setSaving(true);
        await superadminService.createLevelConstraint(childCode, parentLevel);
        setPicker(null);
        await load();
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'नियम जोड़ा नहीं जा सका');
      } finally {
        setSaving(false);
      }
    },
    [load]
  );

  const removeParent = useCallback(
    async (id: number) => {
      try {
        await superadminService.deleteLevelConstraint(id);
        await load();
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'नियम हटाया नहीं जा सका');
      }
    },
    [load]
  );

  const openAddLevel = useCallback(() => {
    setLevelForm({ visible: true, mode: 'add', id: null, name: '', code: '' });
  }, []);

  const openEditLevel = useCallback((level: Level) => {
    setLevelForm({
      visible: true,
      mode: 'edit',
      id: level.id,
      name: level.name,
      code: String(level.code || ''),
    });
  }, []);

  const saveLevel = useCallback(async () => {
    const name = levelForm.name.trim();
    const code = levelForm.code.trim().toLowerCase();
    if (!name) {
      Alert.alert('आवश्यक', 'स्तर का नाम आवश्यक है');
      return;
    }
    if (levelForm.mode === 'add' && !code) {
      Alert.alert('आवश्यक', 'कोड आवश्यक है (अंग्रेज़ी में, जैसे: upkhand)');
      return;
    }
    try {
      setSavingLevel(true);
      if (levelForm.mode === 'add') {
        await superadminService.createLevel(name, code);
      } else if (levelForm.id != null) {
        await superadminService.updateLevel(levelForm.id, name);
      }
      setLevelForm((p) => ({ ...p, visible: false }));
      await load();
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'स्तर सेव नहीं हुआ');
    } finally {
      setSavingLevel(false);
    }
  }, [levelForm, load]);

  const onDeleteLevelTap = useCallback((level: Level) => {
    if ((level.place_count || 0) > 0 || (level.child_level_count || 0) > 0) {
      setLevelWarning(level);
      return;
    }
    setPendingDeleteLevel(level);
  }, []);

  const confirmDeleteLevel = useCallback(async () => {
    if (!pendingDeleteLevel) return;
    try {
      setDeletingLevel(true);
      await superadminService.deleteLevel(pendingDeleteLevel.id);
      setPendingDeleteLevel(null);
      await load();
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'स्तर डिलीट नहीं हुआ');
    } finally {
      setDeletingLevel(false);
    }
  }, [pendingDeleteLevel, load]);

  if (loading) {
    return <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 24 }} />;
  }

  const pickerOptions: { value: string; label: string }[] = picker
    ? (() => {
        const childCode = String(picker.code || '').toLowerCase();
        const existing = new Set(
          rulesFor(childCode).map((c) =>
            c.parent_level === null ? ROOT_PARENT : String(c.parent_level).toLowerCase()
          )
        );
        const opts: { value: string; label: string }[] = [];
        if (!existing.has(ROOT_PARENT)) opts.push({ value: ROOT_PARENT, label: nameOf(null) });
        levels.forEach((l) => {
          const code = String(l.code || '').toLowerCase();
          if (!code || code === childCode || existing.has(code)) return;
          opts.push({ value: code, label: l.name });
        });
        return opts;
      })()
    : [];

  return (
    <View style={styles.managerWrap}>
      <View style={styles.callout}>
        <MaterialIcons name="info-outline" size={18} color={theme.colors.primary} />
        <Text style={styles.calloutText}>
          स्तर जोड़ें/बदलें/डिलीट करें और तय करें कि हर स्तर किन पैरेंट स्तरों के नीचे आ सकता है। जिन स्तरों का कोई नियम नहीं, वे कहीं भी रखे जा सकते हैं।
        </Text>
      </View>

      <TouchableOpacity style={styles.addBtnWide} onPress={openAddLevel}>
        <MaterialIcons name="add" size={18} color="#fff" />
        <Text style={styles.addBtnText}>नया स्तर जोड़ें</Text>
      </TouchableOpacity>

      {levels.map((level) => {
        const rules = rulesFor(level.code);
        return (
          <View key={level.id} style={styles.constraintCard}>
            <View style={styles.constraintHeader}>
              <View style={styles.constraintTitleWrap}>
                <Text style={styles.constraintTitle} numberOfLines={1}>{level.name}</Text>
                {level.code ? <Text style={styles.constraintCode}>{level.code}</Text> : null}
              </View>
              <View style={styles.constraintActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEditLevel(level)}>
                  <MaterialIcons name="edit" size={19} color={theme.colors.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => onDeleteLevelTap(level)}>
                  <MaterialIcons name="delete-outline" size={19} color="#C0492F" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtnSmall} onPress={() => setPicker(level)}>
                  <MaterialIcons name="add" size={16} color="#fff" />
                  <Text style={styles.addBtnText}>पैरेंट</Text>
                </TouchableOpacity>
              </View>
            </View>
            {rules.length === 0 ? (
              <Text style={styles.metaTextMuted}>कोई नियम नहीं — कहीं भी रखा जा सकता है</Text>
            ) : (
              <View style={styles.chipWrap}>
                {rules.map((rule) => (
                  <View key={rule.id} style={styles.ruleChip}>
                    <Text style={styles.ruleChipText}>{nameOf(rule.parent_level)}</Text>
                    <TouchableOpacity onPress={() => void removeParent(rule.id)} hitSlop={8}>
                      <MaterialIcons name="close" size={15} color={theme.colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <StandardModal
        visible={!!picker}
        onClose={() => setPicker(null)}
        title={picker ? `${picker.name} किसके नीचे आ सकता है?` : ''}
        footer={
          <TouchableOpacity
            style={[styles.modalBtn, styles.modalCancelBtn]}
            onPress={() => setPicker(null)}
            disabled={saving}
          >
            <Text style={styles.modalCancelText}>बंद करें</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.formBody}>
          {pickerOptions.length === 0 ? (
            <Text style={styles.metaTextMuted}>सभी संभव पैरेंट पहले से जुड़े हैं।</Text>
          ) : (
            <View style={styles.chipWrap}>
              {pickerOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, saving && styles.btnDisabled]}
                  onPress={() => picker && void addParent(picker, opt.value)}
                  disabled={saving}
                >
                  <Text style={styles.chipText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </StandardModal>

      <StandardModal
        visible={levelForm.visible}
        onClose={() => setLevelForm((p) => ({ ...p, visible: false }))}
        title={levelForm.mode === 'add' ? 'नया स्तर जोड़ें' : 'स्तर एडिट करें'}
        footer={
          <>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalCancelBtn]}
              onPress={() => setLevelForm((p) => ({ ...p, visible: false }))}
              disabled={savingLevel}
            >
              <Text style={styles.modalCancelText}>कैंसिल</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalSaveBtn, savingLevel && styles.btnDisabled]}
              onPress={() => void saveLevel()}
              disabled={savingLevel}
            >
              <MaterialIcons name="check" size={18} color="#fff" />
              <Text style={styles.modalDeleteText}>{savingLevel ? 'सेव हो रहा है...' : 'सेव'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={styles.formBody}>
          <Text style={styles.formLabel}>नाम</Text>
          <TextInput
            style={styles.input}
            value={levelForm.name}
            onChangeText={(t) => setLevelForm((p) => ({ ...p, name: t }))}
            placeholder="स्तर का नाम (जैसे: उपखंड)"
            placeholderTextColor={theme.colors.text.disabled}
            autoFocus
          />
          <Text style={styles.formLabel}>कोड</Text>
          <TextInput
            style={[styles.input, levelForm.mode === 'edit' && styles.btnDisabled]}
            value={levelForm.code}
            onChangeText={(t) => setLevelForm((p) => ({ ...p, code: t }))}
            placeholder="अंग्रेज़ी कोड (जैसे: upkhand)"
            placeholderTextColor={theme.colors.text.disabled}
            autoCapitalize="none"
            editable={levelForm.mode === 'add'}
          />
          {levelForm.mode === 'edit' ? (
            <Text style={styles.metaTextMuted}>कोड बदला नहीं जा सकता।</Text>
          ) : null}
        </View>
      </StandardModal>

      <ConfirmDeleteModal
        visible={!!pendingDeleteLevel}
        name={pendingDeleteLevel?.name || ''}
        note="यह स्तर और इससे जुड़े सभी पैरेंट नियम हट जाएँगे। क्या आप वाकई इसे डिलीट करना चाहते हैं?"
        busy={deletingLevel}
        onCancel={() => setPendingDeleteLevel(null)}
        onConfirm={() => void confirmDeleteLevel()}
      />

      <StandardModal
        visible={!!levelWarning}
        onClose={() => setLevelWarning(null)}
        title="स्तर डिलीट नहीं हो सकता"
        footer={
          <TouchableOpacity
            style={[styles.modalBtn, styles.modalSaveBtn]}
            onPress={() => setLevelWarning(null)}
          >
            <Text style={styles.modalDeleteText}>समझ गया</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.confirmBody}>
          <View style={styles.warnIcon}>
            <MaterialIcons name="warning-amber" size={28} color="#B26A00" />
          </View>
          <Text style={styles.confirmName}>{levelWarning?.name || ''}</Text>
          <Text style={styles.confirmMsg}>
            {(levelWarning?.child_level_count || 0) > 0
              ? `इस स्तर के नीचे ${levelWarning?.child_level_count} उप-स्तर जुड़े हैं।\n`
              : ''}
            {(levelWarning?.place_count || 0) > 0
              ? `इस स्तर में ${levelWarning?.place_count} स्थान (कार्यक्षेत्र) हैं।\n`
              : ''}
            {'\n'}पहले सभी उप-स्तर और इस स्तर के सभी स्थान डिलीट करें, उसके बाद ही यह स्तर डिलीट होगा।
          </Text>
        </View>
      </StandardModal>
    </View>
  );
}

const ENTITY_LABELS: Record<string, string> = {
  category: 'आयाम',
  subcategory: 'टोली',
  level: 'स्तर',
  karyakshetra: 'कार्यक्षेत्र',
  level_constraint: 'स्तर नियम',
};

const ACTION_META: Record<string, { label: string; icon: MaterialIconName; color: string }> = {
  create: { label: 'जोड़ा', icon: 'add-circle-outline', color: '#2E7D32' },
  update: { label: 'बदला', icon: 'edit', color: '#1565C0' },
  deactivate: { label: 'निष्क्रिय किया', icon: 'block', color: '#B26A00' },
  reactivate: { label: 'फिर सक्रिय किया', icon: 'check-circle-outline', color: '#2E7D32' },
  delete: { label: 'डिलीट किया', icon: 'delete-outline', color: '#C0492F' },
  reorder: { label: 'क्रम बदला', icon: 'swap-vert', color: '#6A1B9A' },
};

const ENTITY_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'सभी' },
  { key: 'category', label: 'आयाम' },
  { key: 'subcategory', label: 'टोली' },
  { key: 'level', label: 'स्तर' },
  { key: 'karyakshetra', label: 'कार्यक्षेत्र' },
  { key: 'level_constraint', label: 'स्तर नियम' },
];

function formatAuditDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const AUDIT_PAGE_SIZE = 30;

function AuditLogManager() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [entityFilter, setEntityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(
    async (offset: number, replace: boolean) => {
      try {
        if (replace) setLoading(true);
        else setLoadingMore(true);
        const page = await superadminService.listAuditLogs({
          entityType: entityFilter || undefined,
          search: query || undefined,
          limit: AUDIT_PAGE_SIZE,
          offset,
        });
        setTotal(page.total);
        setLogs((prev) => (replace ? page.logs : [...prev, ...page.logs]));
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'ऑडिट लॉग लोड नहीं हो पाया');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [entityFilter, query]
  );

  useEffect(() => {
    void load(0, true);
  }, [load]);

  return (
    <View style={styles.managerWrap}>
      <View style={styles.callout}>
        <MaterialIcons name="history" size={18} color={theme.colors.primary} />
        <Text style={styles.calloutText}>मास्टर डेटा में हुए हर बदलाव का रिकॉर्ड — किसने, कब, क्या किया।</Text>
      </View>

      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={18} color={theme.colors.text.disabled} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="नाम या व्यक्ति से खोजें"
          placeholderTextColor={theme.colors.text.disabled}
          onSubmitEditing={() => setQuery(search.trim())}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity
            onPress={() => {
              setSearch('');
              setQuery('');
            }}
          >
            <MaterialIcons name="close" size={18} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.chipWrap}>
        {ENTITY_FILTERS.map((f) => {
          const active = entityFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key || 'all'}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setEntityFilter(f.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 24 }} />
      ) : logs.length === 0 ? (
        <Text style={styles.emptyText}>कोई रिकॉर्ड नहीं मिला।</Text>
      ) : (
        <>
          <Text style={styles.metaTextMuted}>कुल {total} रिकॉर्ड</Text>
          {logs.map((log) => {
            const meta = ACTION_META[log.action] || {
              label: log.action,
              icon: 'fiber-manual-record' as MaterialIconName,
              color: theme.colors.text.secondary,
            };
            const entity = ENTITY_LABELS[log.entity_type] || log.entity_type;
            return (
              <View key={log.id} style={styles.auditRow}>
                <View style={[styles.auditIcon, { backgroundColor: `${meta.color}1A` }]}>
                  <MaterialIcons name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={styles.auditBody}>
                  <Text style={styles.auditTitle}>
                    <Text style={{ fontWeight: '800' }}>{entity}</Text> {meta.label}
                    {log.entity_label ? <Text style={styles.auditLabel}>: {log.entity_label}</Text> : null}
                  </Text>
                  <Text style={styles.auditMeta}>
                    {log.actor_name || 'उपलब्ध नहीं'} · {formatAuditDate(log.created_at)}
                  </Text>
                </View>
              </View>
            );
          })}
          {logs.length < total ? (
            <TouchableOpacity
              style={[styles.loadMoreBtn, loadingMore && styles.btnDisabled]}
              onPress={() => void load(logs.length, false)}
              disabled={loadingMore}
            >
              <Text style={styles.loadMoreText}>{loadingMore ? 'लोड हो रहा है...' : 'और देखें'}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
}

export default function SuperAdminScreen() {
  const { user } = useProfile();
  const [activeModuleKey, setActiveModuleKey] = useState<string | null>(null);

  const isSuperAdmin = String(user?.role || '').toLowerCase() === 'superadmin';

  if (!isSuperAdmin) {
    return (
      <View style={styles.root}>
        <PageHeaderCard
          title="SuperAdmin"
          subtitle="Restricted Area"
          icon={<MaterialIcons name="lock" size={24} color={theme.colors.primary} />}
        />
        <View style={styles.deniedBox}>
          <MaterialIcons name="block" size={40} color={theme.colors.text.disabled} />
          <Text style={styles.deniedText}>यह पृष्ठ केवल सुपर एडमिन के लिए है।</Text>
        </View>
      </View>
    );
  }

  const activeModule = MODULES.find((m) => m.key === activeModuleKey) || null;
  const hasManager =
    activeModule?.key === 'master' ||
    activeModule?.key === 'karyakshetra' ||
    activeModule?.key === 'constraints' ||
    activeModule?.key === 'audit';

  return (
    <View style={styles.root}>
      <PageHeaderCard
        title="SuperAdmin"
        subtitle="मास्टर डेटा व वृक्ष कॉन्फ़िगरेशन"
        icon={<MaterialIcons name="settings-suggest" size={24} color={theme.colors.primary} />}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeModule ? (
          <View style={styles.detailWrap}>
            <TouchableOpacity style={styles.backRow} onPress={() => setActiveModuleKey(null)}>
              <MaterialIcons name="arrow-back" size={20} color={theme.colors.primary} />
              <Text style={styles.backText}>सभी मॉड्यूल</Text>
            </TouchableOpacity>

            <View style={styles.detailHeader}>
              <View style={styles.iconCircle}>
                <MaterialIcons name={activeModule.icon} size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{activeModule.titleHi}</Text>
                <Text style={styles.cardSub}>{activeModule.titleEn}</Text>
              </View>
            </View>

            {activeModule.key === 'master' ? (
              <MasterManager />
            ) : activeModule.key === 'karyakshetra' ? (
              <TreeManager />
            ) : activeModule.key === 'constraints' ? (
              <ConstraintsManager />
            ) : activeModule.key === 'audit' ? (
              <AuditLogManager />
            ) : (
              <>
                <View style={styles.callout}>
                  <MaterialIcons name="construction" size={18} color={theme.colors.primary} />
                  <Text style={styles.calloutText}>यह मॉड्यूल निर्माणाधीन है।</Text>
                </View>
                <Text style={styles.sectionLabel}>नियोजित सुविधाएँ</Text>
                {activeModule.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <MaterialIcons name="check-circle-outline" size={18} color={theme.colors.text.secondary} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        ) : (
          <>
            {MODULES.map((module) => (
              <TouchableOpacity
                key={module.key}
                style={styles.card}
                onPress={() => setActiveModuleKey(module.key)}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <MaterialIcons name={module.icon} size={24} color={theme.colors.primary} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{module.titleHi}</Text>
                  <Text style={styles.cardSub}>{module.description}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={theme.colors.border} />
              </TouchableOpacity>
            ))}
          </>
        )}
        {hasManager ? <View style={{ height: 24 }} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF9F7' },
  content: { padding: 16, gap: 16, paddingTop: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECDDD3',
    padding: 16,
    gap: 14,
    ...theme.shadows.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 2,
    lineHeight: 18,
  },
  detailWrap: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECDDD3',
    padding: 16,
    gap: 14,
    ...theme.shadows.sm,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF1E8',
    borderRadius: 12,
    padding: 12,
  },
  calloutText: { fontSize: 13, fontWeight: '600', color: theme.colors.text.primary },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 14, color: theme.colors.text.primary, flex: 1 },
  deniedBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  deniedText: { fontSize: 15, color: theme.colors.text.secondary, textAlign: 'center' },

  managerWrap: { gap: 12 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ECDDD3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text.primary,
    backgroundColor: '#fff',
  },
  editInput: { paddingVertical: 6 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { fontSize: 13, color: theme.colors.text.secondary },
  emptyText: { fontSize: 14, color: theme.colors.text.secondary, paddingVertical: 12 },
  emptySubText: { fontSize: 13, color: theme.colors.text.disabled, paddingVertical: 6 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#ECDDD3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  itemRowInactive: { backgroundColor: '#F7F2EF' },
  itemName: { fontSize: 15, fontWeight: '600', color: theme.colors.text.primary },
  itemNameInactive: { color: theme.colors.text.disabled, fontWeight: '500' },
  orderBadge: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  catCard: {
    borderWidth: 1,
    borderColor: '#ECDDD3',
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 12,
    gap: 8,
  },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  catTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text.primary, flexShrink: 1 },
  countBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    backgroundColor: '#FFF1E8',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  subWrap: { gap: 6, paddingLeft: 8, borderTopWidth: 1, borderTopColor: '#F0E6DF', paddingTop: 8 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subName: { flex: 1, fontSize: 14, color: theme.colors.text.primary },
  addSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },

  crumbRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2, marginBottom: 4 },
  crumbItem: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%' },
  crumbText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, maxWidth: 140 },
  treeNameWrap: { flex: 1, gap: 3, justifyContent: 'center' },
  levelBadgeWrap: { width: 78, alignItems: 'center', justifyContent: 'center' },
  levelBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    backgroundColor: '#FFF1E8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
    textAlign: 'center',
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  treeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: theme.colors.text.secondary },
  metaTextMuted: { fontSize: 12, color: theme.colors.text.disabled },
  addBtnWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
  },
  actionBtnRow: { flexDirection: 'row', gap: 8 },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  actionBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 12, flexShrink: 1 },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  actionBtnOutlineText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12, flexShrink: 1 },
  currentNodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  currentNodeLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.text.secondary },
  currentNodeName: { fontSize: 15, fontWeight: '800', color: theme.colors.text.primary },
  currentNodeBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  currentNodeBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  bulkHint: { fontSize: 13, color: theme.colors.text.secondary, lineHeight: 19 },
  bulkList: { maxHeight: 240, marginTop: 6 },
  bulkListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E7DF',
  },
  bulkListName: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.text.primary },
  bulkListLevel: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  formBody: { paddingHorizontal: 10, paddingVertical: 6, gap: 8 },
  formLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text.secondary, marginTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#ECDDD3',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.text.primary },
  chipTextActive: { color: '#fff' },
  constraintCard: {
    borderWidth: 1,
    borderColor: '#ECDDD3',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    backgroundColor: '#fff',
  },
  constraintHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  constraintTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  constraintTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text.primary },
  constraintCode: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    backgroundColor: '#F1E7DF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  constraintActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ruleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#ECDDD3',
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    backgroundColor: '#FFF7F2',
  },
  ruleChipText: { fontSize: 13, fontWeight: '600', color: theme.colors.text.primary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#ECDDD3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.text.primary, paddingVertical: 8 },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#ECDDD3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  auditIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  auditBody: { flex: 1, gap: 3 },
  auditTitle: { fontSize: 14, color: theme.colors.text.primary },
  auditLabel: { color: theme.colors.text.secondary },
  auditMeta: { fontSize: 12, color: theme.colors.text.disabled },
  loadMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
  },
  loadMoreText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
  },

  confirmBody: { alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12 },
  warnIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF3DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FCE9E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmName: { fontSize: 17, fontWeight: '800', color: theme.colors.text.primary, textAlign: 'center' },
  confirmMsg: { fontSize: 14, color: theme.colors.text.secondary, textAlign: 'center', lineHeight: 20 },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
  },
  modalCancelBtn: { backgroundColor: '#F0E6DF' },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: theme.colors.text.primary },
  modalDeleteBtn: { backgroundColor: '#C0492F' },
  modalDeleteText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
