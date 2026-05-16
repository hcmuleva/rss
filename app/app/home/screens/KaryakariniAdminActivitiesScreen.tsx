import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ScreenHeader } from '../../core/components/ScreenHeader';
import { PageHeaderCard } from '../../core/components/PageHeaderCard';
import { useProfile } from '../../core/context/ProfileContext';
import { karyakariniClient } from '../../api/client';
import { theme } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import type { KaryakariniActivityAssignment, KaryakariniAssignableNode, KaryakariniAssignableUser, KaryakariniVersion } from '../../services/karyakarini-module/types';

const ACTIVITY_OPTIONS = ['धर्मरक्षा सूत्र', 'धर्मरक्षा दिवस', 'भारतमाता पूजन', 'संत यात्रा'];

export default function KaryakariniAdminActivitiesScreen() {
  const { user } = useProfile();
  const [versionId, setVersionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes] = useState<KaryakariniAssignableNode[]>([]);
  const [rows, setRows] = useState<KaryakariniActivityAssignment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchedUsers, setSearchedUsers] = useState<KaryakariniAssignableUser[]>([]);
  const [form, setForm] = useState({
    activityName: ACTIVITY_OPTIONS[0],
    description: '',
    assignedUserId: '',
    nodeId: '',
  });

  const selectedUser = useMemo(
    () => searchedUsers.find((entry) => String(entry.id) === String(form.assignedUserId)) || null,
    [form.assignedUserId, searchedUsers]
  );

  const loadAll = useCallback(async () => {
    const versionRes = await karyakariniClient.get('/karyakarini/versions');
    const versions = (versionRes?.data?.data?.versions || []) as KaryakariniVersion[];
    const selectedVersion = versions.find((entry) => entry.is_current) || versions[0] || null;
    const nextVersionId = Number(selectedVersion?.id || 0);
    if (!nextVersionId) {
      setVersionId(null);
      setRows([]);
      setNodes([]);
      return;
    }
    setVersionId(nextVersionId);
    const [nodesRes, assignmentRes] = await Promise.all([
      karyakariniClient.get('/karyakarini/nodes/assignable', { params: { versionId: nextVersionId } }),
      karyakariniClient.get('/karyakarini/activity-assignments', { params: { versionId: nextVersionId, limit: 100 } }),
    ]);
    const loadedNodes = (nodesRes?.data?.data?.nodes || []) as KaryakariniAssignableNode[];
    setNodes(loadedNodes);
    setRows((assignmentRes?.data?.data?.assignments || []) as KaryakariniActivityAssignment[]);
    setForm((prev) => ({ ...prev, nodeId: prev.nodeId || (loadedNodes[0]?.id ? String(loadedNodes[0].id) : '') }));
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);
        await loadAll();
      } catch (err: any) {
        Alert.alert('त्रुटि', err?.response?.data?.message || 'गतिविधि असाइनमेंट डेटा लोड नहीं हो पाया');
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, [loadAll]);

  const handleSearchUser = useCallback(async () => {
    const mobile = searchQuery.replace(/\D/g, '');
    if (mobile.length < 10) {
      Alert.alert('खोज', 'कृपया कम से कम 10 अंकों का मोबाइल नंबर दर्ज करें');
      return;
    }
    try {
      setSearchingUsers(true);
      const response = await karyakariniClient.get('/karyakarini/members/search-users', { params: { q: mobile, limit: 20 } });
      setSearchedUsers((response?.data?.data?.users || []) as KaryakariniAssignableUser[]);
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'उपयोगकर्ता खोज नहीं हो पाई');
      setSearchedUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  }, [searchQuery]);

  const handleCreateAssignment = useCallback(async () => {
    if (!versionId) return;
    if (!form.assignedUserId) {
      Alert.alert('आवश्यक', 'कृपया एक उपयोगकर्ता चुनें');
      return;
    }
    try {
      setSaving(true);
      await karyakariniClient.post('/karyakarini/activity-assignments', {
        versionId,
        activityName: form.activityName,
        description: form.description.trim() || null,
        assignedUserId: Number(form.assignedUserId),
        nodeId: form.nodeId ? Number(form.nodeId) : null,
      });
      setForm((prev) => ({ ...prev, description: '', assignedUserId: '' }));
      await loadAll();
      Alert.alert('सफल', 'गतिविधि सफलतापूर्वक असाइन की गई');
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || 'गतिविधि असाइन नहीं हो पाई');
    } finally {
      setSaving(false);
    }
  }, [form.activityName, form.assignedUserId, form.description, form.nodeId, loadAll, versionId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="कार्यकारिणी एडमिन" showBack user={user} />
      <PageHeaderCard
        title="गतिविधि असाइनमेंट"
        subtitle="सदस्यों को गतिविधि असाइन करें"
        icon={<MaterialIcons name="assignment-ind" size={24} color={theme.colors.primary} />}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void (async () => { setRefreshing(true); await loadAll().catch(() => {}); setRefreshing(false); })()} />}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>असाइनमेंट बनाएं</Text>
          <Text style={styles.label}>गतिविधि नाम</Text>
          <View style={styles.chipRow}>
            {ACTIVITY_OPTIONS.map((entry) => {
              const selected = form.activityName === entry;
              return (
                <TouchableOpacity
                  key={`activity-opt-${entry}`}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setForm((prev) => ({ ...prev, activityName: entry }))}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{entry}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>नोड</Text>
          <View style={styles.selectList}>
            {nodes.map((node) => {
              const selected = String(node.id) === String(form.nodeId);
              return (
                <TouchableOpacity
                  key={`node-${node.id}`}
                  style={[styles.selectItem, selected && styles.selectItemActive]}
                  onPress={() => setForm((prev) => ({ ...prev, nodeId: String(node.id) }))}
                >
                  <Text style={[styles.selectText, selected && styles.selectTextActive]} numberOfLines={1}>
                    {node.hierarchy_path || node.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>मोबाइल नंबर से उपयोगकर्ता खोजें</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              value={searchQuery}
              onChangeText={(value) => setSearchQuery(value.replace(/[^\d]/g, '').slice(0, 15))}
              keyboardType="number-pad"
              placeholder="मोबाइल नंबर दर्ज करें"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={() => void handleSearchUser()} disabled={searchingUsers}>
              <Text style={styles.searchBtnText}>{searchingUsers ? '...' : 'खोजें'}</Text>
            </TouchableOpacity>
          </View>
          {selectedUser ? (
            <Text style={styles.selectedUserText}>
              चयनित: {[selectedUser.first_name, selectedUser.father_name].filter(Boolean).join(' ')} ({selectedUser.phone || selectedUser.email || '-'})
            </Text>
          ) : null}
          <View style={styles.selectList}>
            {searchedUsers.map((entry) => {
              const selected = String(entry.id) === String(form.assignedUserId);
              return (
                <TouchableOpacity
                  key={`user-${entry.id}`}
                  style={[styles.selectItem, selected && styles.selectItemActive]}
                  onPress={() => setForm((prev) => ({ ...prev, assignedUserId: String(entry.id) }))}
                >
                  <Text style={[styles.selectText, selected && styles.selectTextActive]}>
                    {[entry.first_name, entry.father_name].filter(Boolean).join(' ') || `उपयोगकर्ता #${entry.id}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>विवरण</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={form.description}
            onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
            placeholder="वैकल्पिक विवरण"
          />

          <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} disabled={saving} onPress={() => void handleCreateAssignment()}>
            <Text style={styles.saveBtnText}>{saving ? 'असाइन हो रहा है...' : 'गतिविधि असाइन करें'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>असाइन की गई गतिविधियाँ</Text>
          {rows.length === 0 ? (
            <Text style={styles.helper}>अभी तक कोई असाइनमेंट नहीं</Text>
          ) : (
            rows.map((entry) => (
              <View key={`assignment-${entry.id}`} style={styles.rowItem}>
                <Text style={styles.rowTitle}>{entry.activity_name}</Text>
                <Text style={styles.rowMeta}>किसे: {entry.assigned_user_name || `उपयोगकर्ता #${entry.assigned_user_id}`}</Text>
                <Text style={styles.rowMeta}>नोड: {entry.node_name || '-'}</Text>
                <Text style={styles.rowMeta}>तिथि: {String(entry.created_at || '').slice(0, 10) || '-'}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF9F7' },
  content: { padding: 14, gap: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, padding: 12, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text.primary },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.text.secondary, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  chipText: { fontSize: 11, fontWeight: '700', color: theme.colors.text.secondary },
  chipTextActive: { color: theme.colors.primary },
  selectList: { borderWidth: 1, borderColor: theme.colors.borderLight, borderRadius: 10, maxHeight: 160 },
  selectItem: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  selectItemActive: { backgroundColor: theme.colors.primarySoft },
  selectText: { fontSize: 12, color: theme.colors.text.primary, fontWeight: '600' },
  selectTextActive: { color: theme.colors.primary },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: theme.colors.text.primary,
  },
  inputFlex: { flex: 1 },
  searchBtn: { backgroundColor: theme.colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  searchBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  selectedUserText: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  saveBtn: { marginTop: 4, backgroundColor: theme.colors.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  helper: { color: theme.colors.text.secondary, fontSize: 12 },
  rowItem: { borderWidth: 1, borderColor: theme.colors.borderLight, borderRadius: 10, padding: 10, gap: 3 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text.primary },
  rowMeta: { fontSize: 11, color: theme.colors.text.secondary, fontWeight: '600' },
});
