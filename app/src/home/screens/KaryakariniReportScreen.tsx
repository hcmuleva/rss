import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { karyakariniClient } from '../../api/client';
import { AppBottomNav } from '../../core/components/AppBottomNav';
import { ProfileMenu } from '../../core/components/ProfileMenu';
import { useProfile } from '../../core/context/ProfileContext';
import { theme } from '@/theme';
import type {
  KaryakariniCategoryActivity,
  KaryakariniMember,
  KaryakariniPagination,
  KaryakariniVersion,
} from '../../services/karyakarini-module/types';

type ReportTab = 'members' | 'activities' | 'projects';
const defaultPagination: KaryakariniPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };

const getInitials = (name?: string | null) =>
  String(name || '')
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

const parseLabelList = (value?: string | string[] | null) => {
  if (Array.isArray(value)) return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
  const raw = String(value || '').trim();
  if (!raw) return [] as string[];
  return [...new Set(raw.split(',').map((entry) => entry.trim()).filter(Boolean))];
};

export default function KaryakariniReportScreen() {
  const { user, logout } = useProfile();
  const [activeTab, setActiveTab] = useState<ReportTab>('members');
  const [versionId, setVersionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [memberRows, setMemberRows] = useState<KaryakariniMember[]>([]);
  const [memberPagination, setMemberPagination] = useState<KaryakariniPagination>(defaultPagination);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberFilterQuery, setMemberFilterQuery] = useState('');
  const [memberFilterCategory, setMemberFilterCategory] = useState('');
  const [memberFilterSubcategory, setMemberFilterSubcategory] = useState('');
  const [memberFilterNodeLevel, setMemberFilterNodeLevel] = useState('');

  const [activityRows, setActivityRows] = useState<KaryakariniCategoryActivity[]>([]);
  const [activityPagination, setActivityPagination] = useState<KaryakariniPagination>(defaultPagination);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activityFilterCategory, setActivityFilterCategory] = useState('');
  const [activityFilterSubcategory, setActivityFilterSubcategory] = useState('');
  const [activityFilterNodeLevel, setActivityFilterNodeLevel] = useState('');

  const loadMembers = useCallback(
    async (resolvedVersionId: number, page = 1) => {
      try {
        setMembersLoading(true);
        const response = await karyakariniClient.get('/karyakarini/my/report/members', {
          params: {
            versionId: resolvedVersionId,
            page,
            limit: 20,
            query: memberFilterQuery.trim() || undefined,
            category: memberFilterCategory.trim() || undefined,
            subcategory: memberFilterSubcategory.trim() || undefined,
            nodeLevel: memberFilterNodeLevel.trim() || undefined,
          },
        });
        setMemberRows((response?.data?.data?.members || []) as KaryakariniMember[]);
        setMemberPagination({
          ...defaultPagination,
          ...(response?.data?.data?.pagination || {}),
        });
      } catch (err: any) {
        setMemberRows([]);
        setMemberPagination(defaultPagination);
        Alert.alert('Error', err?.response?.data?.message || 'Failed to load report members');
      } finally {
        setMembersLoading(false);
      }
    },
    [memberFilterCategory, memberFilterNodeLevel, memberFilterQuery, memberFilterSubcategory]
  );

  const loadActivities = useCallback(
    async (resolvedVersionId: number, page = 1) => {
      try {
        setActivitiesLoading(true);
        const response = await karyakariniClient.get('/karyakarini/category-activities', {
          params: {
            versionId: resolvedVersionId,
            page,
            limit: 20,
            category: activityFilterCategory.trim() || undefined,
            subcategory: activityFilterSubcategory.trim() || undefined,
            nodeLevel: activityFilterNodeLevel.trim() || undefined,
          },
        });
        setActivityRows((response?.data?.data?.activities || []) as KaryakariniCategoryActivity[]);
        setActivityPagination({
          ...defaultPagination,
          ...(response?.data?.data?.pagination || {}),
        });
      } catch (err: any) {
        setActivityRows([]);
        setActivityPagination(defaultPagination);
        Alert.alert('Error', err?.response?.data?.message || 'Failed to load category activities');
      } finally {
        setActivitiesLoading(false);
      }
    },
    [activityFilterCategory, activityFilterNodeLevel, activityFilterSubcategory]
  );

  const loadAll = useCallback(async () => {
    const versionRes = await karyakariniClient.get('/karyakarini/versions');
    const versions = (versionRes?.data?.data?.versions || []) as KaryakariniVersion[];
    const selectedVersion = versions.find((item) => item.is_current) || versions[0] || null;
    const nextVersionId = Number(selectedVersion?.id || 0);
    if (!nextVersionId) return;
    setVersionId(nextVersionId);
    await Promise.all([loadMembers(nextVersionId, 1), loadActivities(nextVersionId, 1)]);
  }, [loadActivities, loadMembers]);

  useEffect(() => {
    if (!user) {
      router.replace('/auth/login' as any);
      return;
    }
    const boot = async () => {
      try {
        setLoading(true);
        await loadAll();
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, [loadAll, user]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/auth/login' as any);
    } catch {
      Alert.alert('Error', 'Failed to logout');
    }
  }, [logout]);

  const memberCanPrev = memberPagination.page > 1;
  const memberCanNext = memberPagination.page < Math.max(1, memberPagination.totalPages || 1);
  const activityCanPrev = activityPagination.page > 1;
  const activityCanNext = activityPagination.page < Math.max(1, activityPagination.totalPages || 1);

  const memberTableRows = useMemo(() => memberRows, [memberRows]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.helper}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.title}>Reports</Text>
        <ProfileMenu user={user as any} onLogout={handleLogout} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'members' && styles.tabBtnActive]} onPress={() => setActiveTab('members')}>
            <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>Members</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'activities' && styles.tabBtnActive]} onPress={() => setActiveTab('activities')}>
            <Text style={[styles.tabText, activeTab === 'activities' && styles.tabTextActive]}>Category Activities</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'projects' && styles.tabBtnActive]} onPress={() => setActiveTab('projects')}>
            <Text style={[styles.tabText, activeTab === 'projects' && styles.tabTextActive]}>Projects</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'members' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Members</Text>
            <View style={styles.filterRow}>
              <TextInput style={[styles.input, styles.filterInput]} value={memberFilterQuery} onChangeText={setMemberFilterQuery} placeholder="Search name/mobile" />
              <TextInput
                style={[styles.input, styles.filterInput]}
                value={memberFilterCategory}
                onChangeText={setMemberFilterCategory}
                placeholder="Category"
              />
            </View>
            <View style={styles.filterRow}>
              <TextInput
                style={[styles.input, styles.filterInput]}
                value={memberFilterSubcategory}
                onChangeText={setMemberFilterSubcategory}
                placeholder="Subcategory"
              />
              <TextInput
                style={[styles.input, styles.filterInput]}
                value={memberFilterNodeLevel}
                onChangeText={setMemberFilterNodeLevel}
                placeholder="Node level"
              />
            </View>
            <TouchableOpacity style={styles.applyBtn} onPress={() => versionId && void loadMembers(versionId, 1)}>
              <Text style={styles.applyBtnText}>Apply filters</Text>
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableWrap}>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.colAvatar]}>Avatar</Text>
                  <Text style={[styles.tableHeaderCell, styles.colName]}>Name</Text>
                  <Text style={[styles.tableHeaderCell, styles.colCategory]}>Category</Text>
                  <Text style={[styles.tableHeaderCell, styles.colSubcategory]}>Subcategory</Text>
                  <Text style={[styles.tableHeaderCell, styles.colNode]}>Node</Text>
                  <Text style={[styles.tableHeaderCell, styles.colMobile]}>Mobile</Text>
                </View>
                {membersLoading ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>Loading members...</Text>
                  </View>
                ) : memberTableRows.length === 0 ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>No members found</Text>
                  </View>
                ) : (
                  memberTableRows.map((row) => (
                    <View key={`report-member-${row.id}`} style={styles.tableRow}>
                      <View style={[styles.tableCell, styles.colAvatar]}>
                        {row.avatar ? (
                          <Image source={{ uri: row.avatar }} style={styles.avatar} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarFallbackText}>{getInitials(`${row.first_name || ''} ${row.father_name || ''}`)}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.tableCell, styles.colName]} numberOfLines={2}>
                        {[row.first_name, row.father_name].filter(Boolean).join(' ') || '-'}
                      </Text>
                      <Text style={[styles.tableCell, styles.colCategory]} numberOfLines={2}>
                        {parseLabelList(row.categories && row.categories.length ? row.categories : row.category || '').join(', ') || '-'}
                      </Text>
                      <Text style={[styles.tableCell, styles.colSubcategory]} numberOfLines={2}>
                        {parseLabelList(row.subcategories && row.subcategories.length ? row.subcategories : row.subcategory || '').join(', ') || '-'}
                      </Text>
                      <Text style={[styles.tableCell, styles.colNode]} numberOfLines={2}>{row.hierarchy_path || row.node_name || '-'}</Text>
                      <Text style={[styles.tableCell, styles.colMobile]} numberOfLines={1}>{row.mobile_number || '-'}</Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
            <View style={styles.paginationRow}>
              <Text style={styles.paginationText}>
                Page {memberPagination.page} / {Math.max(1, memberPagination.totalPages || 1)} • Total {memberPagination.total}
              </Text>
              <View style={styles.paginationActions}>
                <TouchableOpacity
                  style={[styles.pageBtn, (!memberCanPrev || membersLoading) && styles.pageBtnDisabled]}
                  disabled={!memberCanPrev || membersLoading}
                  onPress={() => versionId && void loadMembers(versionId, memberPagination.page - 1)}
                >
                  <Text style={styles.pageBtnText}>Prev</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pageBtn, (!memberCanNext || membersLoading) && styles.pageBtnDisabled]}
                  disabled={!memberCanNext || membersLoading}
                  onPress={() => versionId && void loadMembers(versionId, memberPagination.page + 1)}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {activeTab === 'activities' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Category Activities</Text>
            <View style={styles.filterRow}>
              <TextInput
                style={[styles.input, styles.filterInput]}
                value={activityFilterCategory}
                onChangeText={setActivityFilterCategory}
                placeholder="Category"
              />
              <TextInput
                style={[styles.input, styles.filterInput]}
                value={activityFilterSubcategory}
                onChangeText={setActivityFilterSubcategory}
                placeholder="Subcategory"
              />
            </View>
            <View style={styles.filterRow}>
              <TextInput
                style={[styles.input, styles.filterInput]}
                value={activityFilterNodeLevel}
                onChangeText={setActivityFilterNodeLevel}
                placeholder="Node level"
              />
              <TouchableOpacity style={styles.applyBtn} onPress={() => versionId && void loadActivities(versionId, 1)}>
                <Text style={styles.applyBtnText}>Apply filters</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableWrap}>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.colName]}>Title</Text>
                  <Text style={[styles.tableHeaderCell, styles.colCategory]}>Category</Text>
                  <Text style={[styles.tableHeaderCell, styles.colSubcategory]}>Subcategory</Text>
                  <Text style={[styles.tableHeaderCell, styles.colNode]}>Node</Text>
                  <Text style={[styles.tableHeaderCell, styles.colName]}>By</Text>
                </View>
                {activitiesLoading ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>Loading activities...</Text>
                  </View>
                ) : activityRows.length === 0 ? (
                  <View style={styles.tableEmpty}>
                    <Text style={styles.helper}>No activities found</Text>
                  </View>
                ) : (
                  activityRows.map((row) => (
                    <View key={`report-activity-${row.id}`} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.colDate]}>{String(row.created_at || '').slice(0, 10) || '-'}</Text>
                      <View style={[styles.tableCell, styles.colName]}>
                        <Text style={styles.cellTitle} numberOfLines={2}>{row.title || '-'}</Text>
                        {row.description ? <Text style={styles.cellSub} numberOfLines={2}>{row.description}</Text> : null}
                      </View>
                      <Text style={[styles.tableCell, styles.colCategory]} numberOfLines={2}>{row.category || '-'}</Text>
                      <Text style={[styles.tableCell, styles.colSubcategory]} numberOfLines={2}>{row.subcategory || '-'}</Text>
                      <Text style={[styles.tableCell, styles.colNode]} numberOfLines={2}>{row.hierarchy_path || row.node_name || '-'}</Text>
                      <View style={[styles.tableCell, styles.colName, styles.byRow]}>
                        {row.submitted_by_avatar ? (
                          <Image source={{ uri: row.submitted_by_avatar }} style={styles.byAvatar} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarFallbackText}>{getInitials(row.submitted_by_name)}</Text>
                          </View>
                        )}
                        <Text style={styles.cellTitle} numberOfLines={2}>{row.submitted_by_name || '-'}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
            <View style={styles.paginationRow}>
              <Text style={styles.paginationText}>
                Page {activityPagination.page} / {Math.max(1, activityPagination.totalPages || 1)} • Total {activityPagination.total}
              </Text>
              <View style={styles.paginationActions}>
                <TouchableOpacity
                  style={[styles.pageBtn, (!activityCanPrev || activitiesLoading) && styles.pageBtnDisabled]}
                  disabled={!activityCanPrev || activitiesLoading}
                  onPress={() => versionId && void loadActivities(versionId, activityPagination.page - 1)}
                >
                  <Text style={styles.pageBtnText}>Prev</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pageBtn, (!activityCanNext || activitiesLoading) && styles.pageBtnDisabled]}
                  disabled={!activityCanNext || activitiesLoading}
                  onPress={() => versionId && void loadActivities(versionId, activityPagination.page + 1)}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {activeTab === 'projects' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Projects</Text>
            <Text style={styles.helper}>TBD</Text>
          </View>
        ) : null}
      </ScrollView>

      <AppBottomNav activeKey="report" userRole={(user as any)?.role || null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  helper: { color: theme.colors.text.secondary, fontSize: 12 },
  topHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  title: { fontSize: 18, color: theme.colors.text.primary, fontWeight: '700' },
  content: { padding: 12, gap: 10, paddingBottom: 24 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  tabBtnActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  tabText: { fontSize: 12, fontWeight: '700', color: theme.colors.text.secondary },
  tabTextActive: { color: theme.colors.primary },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    padding: 10,
    gap: 8,
  },
  sectionTitle: { color: theme.colors.text.primary, fontSize: 14, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 12,
    color: theme.colors.text.primary,
  },
  filterInput: { flex: 1 },
  applyBtn: {
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tableWrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableHeaderCell: {
    paddingHorizontal: 8,
    paddingVertical: 9,
    color: theme.colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  tableCell: { paddingHorizontal: 8, paddingVertical: 9, color: theme.colors.text.primary, fontSize: 12 },
  tableEmpty: { paddingVertical: 14, alignItems: 'center' },
  colAvatar: { width: 80 },
  colDate: { width: 110 },
  colName: { width: 200 },
  colCategory: { width: 170 },
  colSubcategory: { width: 210 },
  colNode: { width: 260 },
  colMobile: { width: 130 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: theme.colors.text.secondary, fontSize: 10, fontWeight: '700' },
  cellTitle: { color: theme.colors.text.primary, fontSize: 12, fontWeight: '600' },
  cellSub: { color: theme.colors.text.secondary, fontSize: 10, fontWeight: '600', marginTop: 2 },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  byAvatar: { width: 24, height: 24, borderRadius: 12 },
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  paginationText: { color: theme.colors.text.secondary, fontSize: 12, fontWeight: '600', flex: 1 },
  paginationActions: { flexDirection: 'row', gap: 8 },
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
});
