import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { karyakariniClient } from '../../api/client';
import { useProfile } from '../../core/context/ProfileContext';
import { theme } from '@/theme';
import type {
  KaryakariniAttachment,
  KaryakariniCategoryActivity,
  KaryakariniMyTeam,
  KaryakariniPagination,
  KaryakariniVersion,
} from '../../services/karyakarini-module/types';

const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024;
const defaultPagination: KaryakariniPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };

const parseLabelList = (value?: string | string[] | null) => {
  if (Array.isArray(value)) return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
  const raw = String(value || '').trim();
  if (!raw) return [] as string[];
  return [...new Set(raw.split(',').map((entry) => entry.trim()).filter(Boolean))];
};

const initials = (name?: string | null) =>
  String(name || '')
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

export default function KaryakariniCategoryActivityScreen() {
  const { user } = useProfile();
  const params = useLocalSearchParams<{ category?: string; subcategory?: string }>();
  const initialCategory = String(params.category || '').trim();
  const initialSubcategory = String(params.subcategory || '').trim();
  const [versionId, setVersionId] = useState<number | null>(null);
  const [teams, setTeams] = useState<KaryakariniMyTeam[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [rows, setRows] = useState<KaryakariniCategoryActivity[]>([]);
  const [pagination, setPagination] = useState<KaryakariniPagination>(defaultPagination);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailsItem, setDetailsItem] = useState<KaryakariniCategoryActivity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    nodeId: '',
    category: initialCategory,
    subcategory: initialSubcategory,
    title: '',
    description: '',
    attachments: [] as KaryakariniAttachment[],
  });

  const subcategoryOptions = useMemo(() => {
    if (!teams.length) return [] as string[];
    const rows = new Set<string>();
    teams.forEach((team) => {
      const teamCategories = parseLabelList(team.categories && team.categories.length ? team.categories : team.category || '');
      const teamSubcategories = parseLabelList(team.subcategories && team.subcategories.length ? team.subcategories : team.subcategory || '');
      const categoryMatch = !form.category || teamCategories.includes(form.category);
      if (!categoryMatch) return;
      teamSubcategories.forEach((sub) => rows.add(sub));
    });
    return [...rows].sort((a, b) => a.localeCompare(b));
  }, [form.category, teams]);

  const loadActivities = useCallback(
    async (nextVersionId: number, page = 1) => {
      try {
        setLoadingList(true);
        const response = await karyakariniClient.get('/karyakarini/my/category-activities', {
          params: {
            versionId: nextVersionId,
            page,
            limit: 20,
            category: form.category || undefined,
            subcategory: form.subcategory || undefined,
          },
        });
        setRows((response?.data?.data?.activities || []) as KaryakariniCategoryActivity[]);
        setPagination({
          ...defaultPagination,
          ...(response?.data?.data?.pagination || {}),
        });
      } catch (err: any) {
        setRows([]);
        setPagination(defaultPagination);
        Alert.alert('Error', err?.response?.data?.message || 'Failed to load activities');
      } finally {
        setLoadingList(false);
      }
    },
    [form.category, form.subcategory]
  );

  const load = useCallback(async () => {
    const versionRes = await karyakariniClient.get('/karyakarini/versions');
    const versions = (versionRes?.data?.data?.versions || []) as KaryakariniVersion[];
    const selectedVersion = versions.find((entry) => entry.is_current) || versions[0] || null;
    const nextVersionId = Number(selectedVersion?.id || 0);
    if (!nextVersionId) return;
    setVersionId(nextVersionId);

    const teamRes = await karyakariniClient.get('/karyakarini/my/teams', { params: { versionId: nextVersionId } });
    const rows = (teamRes?.data?.data?.teams || []) as KaryakariniMyTeam[];
    setTeams(rows);
    setForm((prev) => {
      const derivedCategory = prev.category || parseLabelList(rows[0]?.categories?.length ? rows[0].categories : rows[0]?.category || '')[0] || '';
      const derivedSubcategory =
        prev.subcategory || parseLabelList(rows[0]?.subcategories?.length ? rows[0].subcategories : rows[0]?.subcategory || '')[0] || '';
      return {
        ...prev,
        nodeId: prev.nodeId || (rows[0]?.node_id ? String(rows[0].node_id) : ''),
        category: derivedCategory,
        subcategory: derivedSubcategory,
      };
    });
    await loadActivities(nextVersionId, 1);
  }, [loadActivities]);

  useEffect(() => {
    if (!user) {
      router.replace('/auth/login' as any);
      return;
    }
    void load().catch(() => {});
  }, [load, user]);

  const resetCreateForm = useCallback(() => {
    const category = initialCategory || form.category;
    setForm((prev) => ({
      ...prev,
      category,
      subcategory: initialSubcategory || prev.subcategory,
      title: '',
      description: '',
      attachments: [],
    }));
  }, [form.category, initialCategory, initialSubcategory]);

  const uploadAttachment = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: [
          'image/*',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
        ],
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const fileSize = Number(asset.size || 0);
      if (fileSize > MAX_ATTACHMENT_BYTES) {
        Alert.alert('File too large', 'Please upload file up to 30MB only.');
        return;
      }

      const formData = new FormData();
      formData.append('folder', 'karyakarini');
      formData.append('category', 'category-activity');
      const assetFile = (asset as any)?.file;
      if (assetFile) {
        formData.append('file', assetFile);
      } else {
        formData.append(
          'file',
          {
            uri: asset.uri,
            name: asset.name || `activity-${Date.now()}`,
            type: asset.mimeType || 'application/octet-stream',
          } as any
        );
      }
      setUploading(true);
      const response = await karyakariniClient.post('/karyakarini/upload/attachment', formData);
      const payload = response?.data?.data || {};
      const url = String(payload.url || '').trim();
      if (!url) return;
      setForm((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments,
          { url, type: String(payload.fileType || '').trim() || undefined, name: String(payload.fileName || '').trim() || undefined },
        ],
      }));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!versionId) return;
    if (!form.nodeId || !form.title.trim() || !form.subcategory.trim()) {
      Alert.alert('Required', 'Node, title and subcategory are required');
      return;
    }
    try {
      setSubmitting(true);
      await karyakariniClient.post('/karyakarini/my/category-activities', {
        versionId,
        nodeId: Number(form.nodeId),
        category: form.category.trim() || null,
        subcategory: form.subcategory.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        attachments: form.attachments,
      });
      Alert.alert('Success', 'Category activity submitted');
      setShowCreateModal(false);
      setForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        attachments: [],
      }));
      await loadActivities(versionId, 1);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit activity');
    } finally {
      setSubmitting(false);
    }
  }, [form, loadActivities, versionId]);

  const handleOpenAttachment = useCallback(async (url?: string | null) => {
    const safeUrl = String(url || '').trim();
    if (!safeUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(safeUrl);
      if (!canOpen) {
        Alert.alert('Attachment', 'Cannot open attachment');
        return;
      }
      await Linking.openURL(safeUrl);
    } catch {
      Alert.alert('Attachment', 'Failed to open attachment');
    }
  }, []);

  const canPrev = pagination.page > 1;
  const canNext = pagination.page < Math.max(1, pagination.totalPages || 1);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Category Activity</Text>
          <Text style={styles.subHeading}>Your submitted activities</Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => {
            resetCreateForm();
            setShowCreateModal(true);
          }}
        >
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterText}>Category: {form.category || 'All'}</Text>
        <Text style={styles.filterText}>Subcategory: {form.subcategory || 'All'}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableWrap}>
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
            <Text style={[styles.tableHeaderCell, styles.colTitle]}>Title</Text>
            <Text style={[styles.tableHeaderCell, styles.colCategory]}>Category</Text>
            <Text style={[styles.tableHeaderCell, styles.colSubcategory]}>Subcategory</Text>
            <Text style={[styles.tableHeaderCell, styles.colNode]}>Node</Text>
            <Text style={[styles.tableHeaderCell, styles.colCreatedBy]}>Created By</Text>
            <Text style={[styles.tableHeaderCell, styles.colAttachment]}>Attachments</Text>
            <Text style={[styles.tableHeaderCell, styles.colAction]}>Action</Text>
          </View>
          {loadingList ? (
            <View style={styles.tableEmpty}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.helperText}>Loading activities...</Text>
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.tableEmpty}>
              <Text style={styles.helperText}>No activity created yet</Text>
            </View>
          ) : (
            rows.map((entry) => (
              <View key={`activity-${entry.id}`} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colDate]}>{String(entry.created_at || '').slice(0, 10) || '-'}</Text>
                <View style={[styles.tableCell, styles.colTitle]}>
                  <Text style={styles.cellTitle} numberOfLines={2}>{entry.title}</Text>
                  {entry.description ? <Text style={styles.cellSub} numberOfLines={2}>{entry.description}</Text> : null}
                </View>
                <Text style={[styles.tableCell, styles.colCategory]} numberOfLines={2}>{entry.category || '-'}</Text>
                <Text style={[styles.tableCell, styles.colSubcategory]} numberOfLines={2}>{entry.subcategory || '-'}</Text>
                <Text style={[styles.tableCell, styles.colNode]} numberOfLines={2}>{entry.hierarchy_path || entry.node_name || '-'}</Text>
                <View style={[styles.tableCell, styles.colCreatedBy, styles.createdByWrap]}>
                  {entry.submitted_by_avatar ? (
                    <Image source={{ uri: entry.submitted_by_avatar }} style={styles.creatorAvatar} />
                  ) : (
                    <View style={styles.creatorAvatarFallback}>
                      <Text style={styles.creatorAvatarFallbackText}>{initials(entry.submitted_by_name)}</Text>
                    </View>
                  )}
                  <Text style={styles.createdByText} numberOfLines={2}>{entry.submitted_by_name || '-'}</Text>
                </View>
                <View style={[styles.tableCell, styles.colAttachment]}>
                  {Array.isArray(entry.attachments) && entry.attachments.length > 0 ? (
                    entry.attachments.map((attachment, index) => (
                      <TouchableOpacity
                        key={`activity-attachment-${entry.id}-${index}`}
                        style={styles.downloadBtn}
                        onPress={() => void handleOpenAttachment(attachment?.url)}
                      >
                        <MaterialIcons name="attach-file" size={14} color={theme.colors.primary} />
                        <Text style={styles.downloadText} numberOfLines={1}>
                          {attachment?.name || `Download ${index + 1}`}
                        </Text>
                        <MaterialIcons name="download" size={14} color={theme.colors.primary} />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.tableCell}>0</Text>
                  )}
                </View>
                <View style={[styles.tableCell, styles.colAction]}>
                  <TouchableOpacity style={styles.viewBtn} onPress={() => setDetailsItem(entry)}>
                    <Text style={styles.viewBtnText}>View</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.pagination}>
        <Text style={styles.pageText}>
          Page {pagination.page} / {Math.max(1, pagination.totalPages || 1)} • Total {pagination.total}
        </Text>
        <View style={styles.pageActions}>
          <TouchableOpacity
            style={[styles.pageBtn, (!canPrev || loadingList) && styles.pageBtnDisabled]}
            disabled={!canPrev || loadingList}
            onPress={() => versionId && void loadActivities(versionId, pagination.page - 1)}
          >
            <Text style={styles.pageBtnText}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pageBtn, (!canNext || loadingList) && styles.pageBtnDisabled]}
            disabled={!canNext || loadingList}
            onPress={() => versionId && void loadActivities(versionId, pagination.page + 1)}
          >
            <Text style={styles.pageBtnText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => router.back()}>
          <Text style={styles.btnTextDark}>Back</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Category Activity</Text>

            <Text style={styles.label}>Node</Text>
            <View style={styles.selectList}>
              {teams.map((team) => {
                const selected = String(team.node_id) === String(form.nodeId);
                return (
                  <TouchableOpacity
                    key={`team-node-${team.id}-${team.node_id}`}
                    style={[styles.selectItem, selected && styles.selectItemActive]}
                    onPress={() => setForm((prev) => ({ ...prev, nodeId: String(team.node_id) }))}
                  >
                    <Text style={[styles.selectItemText, selected && styles.selectItemTextActive]}>
                      {team.hierarchy_path || team.node_name || `Node #${team.node_id}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Category</Text>
            <TextInput style={[styles.input, styles.readOnlyInput]} value={form.category || 'General'} editable={false} />

            <Text style={styles.label}>Subcategory</Text>
            <View style={styles.selectList}>
              {subcategoryOptions.map((entry) => {
                const selected = form.subcategory === entry;
                return (
                  <TouchableOpacity
                    key={`subcategory-option-${entry}`}
                    style={[styles.selectItem, selected && styles.selectItemActive]}
                    onPress={() => setForm((prev) => ({ ...prev, subcategory: entry }))}
                  >
                    <Text style={[styles.selectItemText, selected && styles.selectItemTextActive]}>{entry}</Text>
                  </TouchableOpacity>
                );
              })}
              {subcategoryOptions.length === 0 ? <Text style={styles.helperText}>No assigned subcategory options</Text> : null}
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))} />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={form.description}
              onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
            />

            <Text style={styles.label}>Attachments</Text>
            <TouchableOpacity style={[styles.btn, uploading && styles.btnDisabled]} disabled={uploading} onPress={() => void uploadAttachment()}>
              <Text style={styles.btnText}>{uploading ? 'Uploading...' : 'Upload from device (max 30MB)'}</Text>
            </TouchableOpacity>
            {form.attachments.map((item, idx) => (
              <View key={`activity-attachment-${idx}`} style={styles.attachmentRow}>
                <Text style={styles.attachmentText} numberOfLines={1}>{item.name || item.url}</Text>
                <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.btnTextDark}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} disabled={submitting} onPress={() => void submit()}>
                <Text style={styles.btnText}>{submitting ? 'Saving...' : 'Save Activity'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(detailsItem)} animationType="fade" transparent onRequestClose={() => setDetailsItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Activity Details</Text>
            <Text style={styles.detailTitle}>{detailsItem?.title || '-'}</Text>
            <Text style={styles.detailLine}>Date: {String(detailsItem?.created_at || '').slice(0, 19).replace('T', ' ') || '-'}</Text>
            <Text style={styles.detailLine}>Category: {detailsItem?.category || '-'}</Text>
            <Text style={styles.detailLine}>Subcategory: {detailsItem?.subcategory || '-'}</Text>
            <Text style={styles.detailLine}>Node: {detailsItem?.hierarchy_path || detailsItem?.node_name || '-'}</Text>
            <View style={styles.detailCreatorRow}>
              {detailsItem?.submitted_by_avatar ? (
                <Image source={{ uri: detailsItem.submitted_by_avatar }} style={styles.creatorAvatar} />
              ) : (
                <View style={styles.creatorAvatarFallback}>
                  <Text style={styles.creatorAvatarFallbackText}>{initials(detailsItem?.submitted_by_name)}</Text>
                </View>
              )}
              <Text style={styles.detailLine}>Created By: {detailsItem?.submitted_by_name || '-'}</Text>
            </View>
            <Text style={styles.detailLabel}>Description</Text>
            <Text style={styles.detailText}>{detailsItem?.description || '-'}</Text>
            <Text style={styles.detailLabel}>Attachments</Text>
            {detailsItem?.attachments && detailsItem.attachments.length > 0 ? (
              detailsItem.attachments.map((attachment, index) => (
                <TouchableOpacity
                  key={`details-attachment-${index}`}
                  style={styles.downloadBtn}
                  onPress={() => void handleOpenAttachment(attachment?.url)}
                >
                  <MaterialIcons name="attach-file" size={14} color={theme.colors.primary} />
                  <Text style={styles.downloadText} numberOfLines={1}>
                    {attachment?.name || `Download ${index + 1}`}
                  </Text>
                  <MaterialIcons name="download" size={14} color={theme.colors.primary} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.detailText}>No attachments</Text>
            )}
            <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setDetailsItem(null)}>
              <Text style={styles.btnTextDark}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF9F7' },
  content: { padding: 16, gap: 10, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { fontSize: 20, fontWeight: '700', color: theme.colors.text.primary },
  subHeading: { fontSize: 12, color: theme.colors.text.secondary, fontWeight: '600' },
  createBtn: {
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  createBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  filterText: { fontSize: 12, color: theme.colors.text.secondary, fontWeight: '600' },
  label: { marginTop: 2, fontSize: 12, fontWeight: '700', color: theme.colors.text.secondary },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  readOnlyInput: {
    backgroundColor: theme.colors.surfaceContainerHighest,
    color: theme.colors.text.secondary,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  tableWrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  tableHeaderCell: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    color: theme.colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 12,
    color: theme.colors.text.primary,
    justifyContent: 'center',
  },
  colDate: { width: 110 },
  colTitle: { width: 220 },
  colCategory: { width: 180 },
  colSubcategory: { width: 200 },
  colNode: { width: 260 },
  colCreatedBy: { width: 200 },
  colAttachment: { width: 260 },
  colAction: { width: 110 },
  cellTitle: { fontSize: 12, color: theme.colors.text.primary, fontWeight: '700' },
  cellSub: { fontSize: 11, color: theme.colors.text.secondary, marginTop: 2 },
  createdByWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  creatorAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.surfaceContainerHighest },
  creatorAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarFallbackText: { color: theme.colors.text.secondary, fontSize: 10, fontWeight: '700' },
  createdByText: { flex: 1, fontSize: 12, color: theme.colors.text.primary, fontWeight: '600' },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: 4,
    backgroundColor: '#fff',
  },
  downloadText: { flex: 1, fontSize: 11, color: theme.colors.primary, fontWeight: '700' },
  viewBtn: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  viewBtnText: { color: theme.colors.primary, fontSize: 11, fontWeight: '700' },
  tableEmpty: { padding: 14, alignItems: 'center', gap: 8, minWidth: 1100 },
  helperText: { fontSize: 12, color: theme.colors.text.secondary },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pageText: { fontSize: 12, color: theme.colors.text.secondary, fontWeight: '600', flex: 1 },
  pageActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  pageBtnDisabled: { opacity: 0.45 },
  pageBtnText: { color: theme.colors.text.primary, fontSize: 12, fontWeight: '700' },
  selectList: { borderWidth: 1, borderColor: theme.colors.borderLight, borderRadius: 10, backgroundColor: '#fff', maxHeight: 170 },
  selectItem: { paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  selectItemActive: { backgroundColor: theme.colors.primarySoft },
  selectItemText: { color: theme.colors.text.primary, fontSize: 12, fontWeight: '600' },
  selectItemTextActive: { color: theme.colors.primary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 14 },
  modalCard: { backgroundColor: '#FFF9F7', borderRadius: 14, padding: 12, gap: 8, maxHeight: '92%' },
  modalTitle: { fontSize: 16, color: theme.colors.text.primary, fontWeight: '700' },
  detailTitle: { fontSize: 15, color: theme.colors.text.primary, fontWeight: '700' },
  detailLine: { fontSize: 12, color: theme.colors.text.primary, fontWeight: '600' },
  detailCreatorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: { marginTop: 2, fontSize: 12, color: theme.colors.text.secondary, fontWeight: '700' },
  detailText: { fontSize: 12, color: theme.colors.text.primary },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btn: {
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  btnLight: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnTextDark: { color: theme.colors.text.secondary, fontSize: 12, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  attachmentRow: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  attachmentText: { flex: 1, color: theme.colors.text.primary, fontSize: 12 },
  removeText: { color: theme.colors.error, fontSize: 11, fontWeight: '700' },
});
