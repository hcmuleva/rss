import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '../../core/components/ScreenHeader';
import { PageHeaderCard } from '../../core/components/PageHeaderCard';
import { StandardModal } from '../../core/components/StandardModal';
import { useProfile } from '../../core/context/ProfileContext';
import { karyakariniClient } from '../../api/client';
import { theme } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import type {
  KaryakariniInvitation,
  KaryakariniMyTeam,
  KaryakariniSentInvitationSummary,
  KaryakariniTask,
  KaryakariniVersion,
} from '../../services/karyakarini-module/types';

type MemberTab = 'myteams' | 'messages' | 'tasks';
type MessageTab = 'received' | 'sent';
const TASK_STATUS_OPTIONS = ['open', 'in_progress', 'completed', 'blocked', 'cancelled'] as const;

const toDateText = (value?: string | null) => {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString().slice(0, 10);
};

const statusColor = (status?: string | null) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'accepted') return '#15803d';
  if (normalized === 'rejected') return '#b91c1c';
  if (normalized === 'tentative') return '#b45309';
  return '#1d4ed8';
};

const parseLabelList = (value?: string | string[] | null) => {
  if (Array.isArray(value)) return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
  const raw = String(value || '').trim();
  if (!raw) return [] as string[];
  return [...new Set(raw.split(',').map((entry) => entry.trim()).filter(Boolean))];
};

export default function KaryakariniMemberScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { user, logout } = useProfile();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingInvitationId, setRespondingInvitationId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<MemberTab>('myteams');
  const [messageTab, setMessageTab] = useState<MessageTab>('received');
  const [versionId, setVersionId] = useState<number | null>(null);
  const [teams, setTeams] = useState<KaryakariniMyTeam[]>([]);
  const [invitations, setInvitations] = useState<KaryakariniInvitation[]>([]);
  const [sentSummaries, setSentSummaries] = useState<KaryakariniSentInvitationSummary[]>([]);
  const [tasks, setTasks] = useState<KaryakariniTask[]>([]);
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>(['all']);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<KaryakariniTask | null>(null);
  const [taskDraftStatus, setTaskDraftStatus] = useState<string>('open');
  const [taskDraftAttachments, setTaskDraftAttachments] = useState<{ url: string; type?: string; name?: string }[]>([]);
  const [taskAttachmentInput, setTaskAttachmentInput] = useState('');
  const [taskUploadingAttachment, setTaskUploadingAttachment] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const versionsRes = await karyakariniClient.get('/karyakarini/versions');
    const versions = (versionsRes?.data?.data?.versions || []) as KaryakariniVersion[];
    const selectedVersion = versions.find((v) => v.is_current) || versions[0] || null;
    const selectedVersionId = selectedVersion?.id || null;
    setVersionId(selectedVersionId);
    if (!selectedVersionId) {
      setTeams([]);
      setInvitations([]);
      setSentSummaries([]);
      setTasks([]);
      return;
    }

    const [teamsRes, invitationRes, sentRes, taskRes, unreadRes] = await Promise.all([
      karyakariniClient.get('/karyakarini/my/teams', { params: { versionId: selectedVersionId } }),
      karyakariniClient.get('/karyakarini/my/invitations', { params: { versionId: selectedVersionId, limit: 100 } }),
      karyakariniClient.get('/karyakarini/my/invitations/sent-summary', { params: { versionId: selectedVersionId, limit: 100 } }),
      karyakariniClient.get('/karyakarini/my/tasks', { params: { versionId: selectedVersionId, limit: 100 } }),
      karyakariniClient.get('/karyakarini/my/notifications/unread-count', { params: { versionId: selectedVersionId } }),
    ]);

    const loadedTeams = (teamsRes?.data?.data?.teams || []) as KaryakariniMyTeam[];
    const loadedTasks = (taskRes?.data?.data?.tasks || []) as KaryakariniTask[];
    setTeams(loadedTeams);
    setInvitations((invitationRes?.data?.data?.invitations || []) as KaryakariniInvitation[]);
    setSentSummaries((sentRes?.data?.data?.sent || []) as KaryakariniSentInvitationSummary[]);
    setTasks(loadedTasks);
    setNotificationUnreadCount(Number(unreadRes?.data?.data?.total || 0));

    if (loadedTeams.length === 0 && loadedTasks.length > 0) {
      setActiveTab('tasks');
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load karyakarini data');
    }
  }, [loadAll]);

  useEffect(() => {
    if (tab === 'messages' || tab === 'tasks' || tab === 'myteams') {
      setActiveTab(tab);
    }
  }, [tab]);

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);
        await loadData();
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, [loadData]);

  useEffect(() => {
    if (
      activeTab !== 'messages' ||
      messageTab !== 'received' ||
      !invitations.some((invitation) => !invitation.notification_read_at)
    ) {
      return;
    }
    const unreadIds = invitations.filter((invitation) => !invitation.notification_read_at).map((invitation) => Number(invitation.id));
    void karyakariniClient
      .post('/karyakarini/my/invitations/read', {
        invitationIds: unreadIds,
      })
      .then(() => {
        setNotificationUnreadCount((prev) => Math.max(0, prev - unreadIds.length));
      });
  }, [activeTab, invitations, messageTab]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const handleRespondInvitation = useCallback(
    async (invitationId: number, status: 'accepted' | 'rejected' | 'tentative') => {
      try {
        setRespondingInvitationId(invitationId);
        await karyakariniClient.patch(`/karyakarini/my/invitations/${invitationId}/respond`, { status });
        await loadData();
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Failed to update invitation');
      } finally {
        setRespondingInvitationId(null);
      }
    },
    [loadData]
  );

  const handleOpenTaskEditor = useCallback((task: KaryakariniTask) => {
    setEditingTask(task);
    setTaskDraftStatus(String(task.status || 'open').toLowerCase() || 'open');
    setTaskDraftAttachments([]);
    setTaskAttachmentInput('');
    setShowTaskModal(true);
  }, []);

  const handleUploadTaskAttachment = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission', 'Media library permission is required');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      const form = new FormData();
      form.append('folder', 'karyakarini');
      form.append('category', 'task');
      form.append(
        'file',
        {
          uri: asset.uri,
          name: asset.fileName || `task-${Date.now()}`,
          type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        } as any
      );

      setTaskUploadingAttachment(true);
      const response = await karyakariniClient.post('/karyakarini/upload/attachment', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const payload = response?.data?.data || {};
      const url = String(payload.url || '').trim();
      if (!url) {
        Alert.alert('Error', 'Failed to upload attachment');
        return;
      }
      setTaskDraftAttachments((prev) => [
        ...prev,
        {
          url,
          type: String(payload.fileType || asset.mimeType || '').trim() || undefined,
          name: String(payload.fileName || asset.fileName || `task-${Date.now()}`).trim(),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to upload attachment');
    } finally {
      setTaskUploadingAttachment(false);
    }
  }, []);

  const handleAddAttachmentLink = useCallback(() => {
    const url = taskAttachmentInput.trim();
    if (!url) return;
    setTaskDraftAttachments((prev) => [...prev, { url, type: 'document', name: url.split('/').pop() || 'attachment' }]);
    setTaskAttachmentInput('');
  }, [taskAttachmentInput]);

  const handleSaveTask = useCallback(async () => {
    if (!editingTask || !versionId) return;
    try {
      setSavingTask(true);
      const response = await karyakariniClient.patch(`/karyakarini/my/tasks/${editingTask.id}/status`, {
        versionId,
        status: taskDraftStatus,
        attachments: taskDraftAttachments,
      });
      const updated = (response?.data?.data?.task || null) as KaryakariniTask | null;
      setTasks((prev) => prev.map((entry) => (entry.id === editingTask.id ? { ...entry, ...(updated || {}), status: taskDraftStatus } : entry)));
      setShowTaskModal(false);
      setEditingTask(null);
      setTaskDraftAttachments([]);
      setTaskAttachmentInput('');
      Alert.alert('Success', 'Task updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update task');
    } finally {
      setSavingTask(false);
    }
  }, [editingTask, taskDraftAttachments, taskDraftStatus, versionId]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/auth/login' as any);
    } catch {
      Alert.alert('Error', 'Failed to logout');
    }
  }, [logout]);

  const handleOpenNotifications = useCallback(() => {
    router.push('/karyakarini-notifications' as any);
  }, []);

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => String(invitation.invitation_status || '').toLowerCase() === 'pending').length,
    [invitations]
  );
  const assignmentCards = useMemo(() => {
    const map = new Map<string, { key: string; nodeId: number; path: string; category: string; subcategory: string; pad: string; lastActivityAt: number; count: number }>();

    const addOrUpdate = (nodeId: number, path: string, cat: string, sub: string, pad: string, timestamp: number, isDirect: boolean) => {
      const category = cat.trim() || 'General';
      const subcategory = sub.trim();
      const key = `${nodeId}###${category}###${subcategory}`;
      const existing = map.get(key);
      map.set(key, {
        key: existing?.key || `${nodeId}-${category}-${subcategory}`,
        nodeId,
        path: existing?.path || path || `Node #${nodeId}`,
        category,
        subcategory,
        pad: existing?.pad || pad || 'Member',
        lastActivityAt: Math.max(existing?.lastActivityAt || 0, timestamp),
        count: (existing?.count || 0) + (isDirect ? 1 : 0),
      });
    };

    teams.forEach((team) => {
      const ts = new Date((team as any).updated_at || (team as any).created_at || team.start_date || 0).getTime();
      const nodeId = Number(team.node_id || 0);
      const path = String(team.hierarchy_path || team.node_name || '').trim();
      const pad = String(team.pad || '').trim();
      const categories = parseLabelList(team.categories && team.categories.length ? team.categories : team.category || '');
      const subcategories = parseLabelList(team.subcategories && team.subcategories.length ? team.subcategories : team.subcategory || '');

      if (subcategories.length > 0) {
        subcategories.forEach((sub) => {
          const cat = categories.find((c) => sub.toLowerCase().includes(c.toLowerCase())) || categories[0] || 'Category';
          addOrUpdate(nodeId, path, cat, sub, pad, ts, true);
        });
      } else if (categories.length > 0) {
        categories.forEach((cat) => addOrUpdate(nodeId, path, cat, '', pad, ts, true));
      }
    });

    tasks.forEach((task) => {
      const ts = new Date((task as any).updated_at || (task as any).created_at || task.task_date || 0).getTime();
      const nodeId = Number(task.node_id || 0);
      const path = String(task.hierarchy_path || task.node_name || '').trim();
      const cats = parseLabelList(task.task_categories);
      const subs = parseLabelList(task.task_subcategories);

      if (subs.length > 0) {
        subs.forEach((sub) => {
          const cat = cats.find((c) => sub.toLowerCase().includes(c.toLowerCase())) || cats[0] || 'Category';
          addOrUpdate(nodeId, path, cat, sub, 'Task Assignee', ts, true);
        });
      } else if (cats.length > 0) {
        cats.forEach((cat) => addOrUpdate(nodeId, path, cat, '', 'Task Assignee', ts, true));
      } else {
        addOrUpdate(nodeId, path, 'General', '', 'Task Assignee', ts, true);
      }
    });

    invitations.forEach((inv) => {
      const ts = new Date(inv.invited_at || inv.meeting_date || 0).getTime();
      const nodeId = Number(inv.invited_node_id || 0);
      const path = String(inv.invited_node_name || inv.meeting_node_name || `Node #${nodeId}`).trim();
      const cat = String(inv.invited_node_level || inv.meeting_node_level || 'Meetings').trim();
      addOrUpdate(nodeId, path, cat, '', 'Meeting Attendee', ts, true);
    });

    return Array.from(map.values())
      .filter((c) => c.count > 0 || c.lastActivityAt > 0)
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [teams, tasks, invitations]);

  const groupedTasks = useMemo(() => {
    const map = new Map<string, KaryakariniTask>();
    tasks.forEach((row) => {
      const key = `${row.title?.trim()}###${row.task_date}###${row.node_id}`;
      const assigneeObj = row.assigned_user_id ? {
        id: Number(row.assigned_user_id),
        name: row.assigned_first_name || `User #${row.assigned_user_id}`,
        father_name: row.assigned_father_name || '',
        mobile_number: row.assigned_mobile_number || '',
      } : null;

      if (!map.has(key)) {
        map.set(key, {
          ...row,
          assignees: assigneeObj ? [assigneeObj] : [],
        });
      } else {
        const existing = map.get(key)!;
        if (assigneeObj && !existing.assignees?.some((a) => a.id === assigneeObj.id)) {
          existing.assignees = [...(existing.assignees || []), assigneeObj];
        }
      }
    });
    return Array.from(map.values());
  }, [tasks]);

  const assignedTasks = useMemo(() => {
    const userId = Number((user as any)?.id || 0);
    if (userId <= 0) return groupedTasks;
    return groupedTasks.filter(
      (task) =>
        Number(task.assigned_user_id || 0) === userId ||
        task.assignees?.some((a) => a.id === userId) ||
        Number((task as any).created_by || 0) === userId ||
        teams.some((t) => Number(t.node_id) === Number(task.node_id))
    );
  }, [groupedTasks, user, teams]);

  const filteredTasks = useMemo(() => {
    if (selectedCategoryKeys.includes('all') || selectedCategoryKeys.length === 0) {
      return assignedTasks;
    }
    const selectedAssignments = assignmentCards.filter((c) => selectedCategoryKeys.includes(c.key));
    if (selectedAssignments.length === 0) return assignedTasks;

    return assignedTasks.filter((task) => {
      const taskCategories = parseLabelList(task.task_categories)
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean);
      const taskSubcategories = parseLabelList(task.task_subcategories)
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean);

      return selectedAssignments.some((assignment) => {
        const selectedCategory = String(assignment.category || '').trim().toLowerCase();
        const selectedSubcategory = String(assignment.subcategory || '').trim().toLowerCase();
        const nodeMatch = Number(task.node_id || 0) === Number(assignment.nodeId || 0);

        if (selectedSubcategory && taskSubcategories.includes(selectedSubcategory)) return true;
        if (selectedCategory && selectedCategory !== 'general' && taskCategories.includes(selectedCategory)) return true;
        
        if (taskCategories.length === 0 && nodeMatch && (!selectedCategory || selectedCategory === 'general')) {
            return true;
        }

        return false;
      });
    });
  }, [assignedTasks, assignmentCards, selectedCategoryKeys]);

  const tasksByCategory = useMemo(() => {
    const map = new Map<string, KaryakariniTask[]>();
    
    const allowedCategories = selectedCategoryKeys.includes('all') || selectedCategoryKeys.length === 0
      ? null
      : assignmentCards
          .filter((c) => selectedCategoryKeys.includes(c.key))
          .map((c) => String(c.subcategory || c.category || '').trim().toLowerCase());

    filteredTasks.forEach((task) => {
      const parsedCats = parseLabelList(task.task_categories);
      const cats = parsedCats.length > 0 ? parsedCats : ['General'];
        
      cats.forEach((c) => {
        const catName = String(c || '').trim() || 'General';
        
        if (allowedCategories && !allowedCategories.includes(catName.toLowerCase())) {
          return; 
        }

        if (!map.has(catName)) map.set(catName, []);
        if (!map.get(catName)!.some((t) => t.id === task.id)) {
          map.get(catName)!.push(task);
        }
      });
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTasks, selectedCategoryKeys, assignmentCards]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.helper}>Loading Karyakarini...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Karyakarini Member"
        user={user}
        onLogout={handleLogout}
        notificationCount={notificationUnreadCount}
        onPressNotifications={handleOpenNotifications}
      />

      <PageHeaderCard
        title="Karyakarini"
        subtitle="Team, Meetings & Tasks"
        icon={<MaterialIcons name="groups" size={24} color={theme.colors.primary} />}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {assignmentCards.length > 0 ? (
          <View style={styles.listWrap}>
            <Text style={styles.sectionTitle}>Assigned Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignmentRow}>
              <TouchableOpacity
                style={[styles.assignmentCard, selectedCategoryKeys.includes('all') && styles.assignmentCardActive]}
                onPress={() => {
                  setSelectedCategoryKeys(['all']);
                  setActiveTab('tasks');
                }}
              >
                <Text style={[styles.assignmentCardTitle, selectedCategoryKeys.includes('all') && styles.assignmentCardTitleActive]}>
                  All Categories
                </Text>
                <Text style={styles.assignmentCardMeta}>Show all tasks</Text>
              </TouchableOpacity>

              {assignmentCards.map((entry) => {
                const isSelected = !selectedCategoryKeys.includes('all') && selectedCategoryKeys.includes(entry.key);
                return (
                  <TouchableOpacity
                    key={entry.key}
                    style={[styles.assignmentCard, isSelected && styles.assignmentCardActive]}
                    onPress={() => {
                      let next = selectedCategoryKeys.filter((k) => k !== 'all');
                      if (next.includes(entry.key)) {
                        next = next.filter((k) => k !== entry.key);
                        if (next.length === 0) next = ['all'];
                      } else {
                        next = [...next, entry.key];
                      }
                      setSelectedCategoryKeys(next);
                      setActiveTab('tasks');
                    }}
                  >
                    <Text style={[styles.assignmentCardTitle, isSelected && styles.assignmentCardTitleActive]}>
                      {entry.subcategory || entry.category}
                    </Text>
                    <Text style={styles.assignmentCardMeta}>{entry.category}</Text>
                    <Text style={styles.assignmentCardMeta}>{entry.pad || '-'}</Text>
                    {entry.lastActivityAt > 0 ? (
                      <Text style={{ fontSize: 10, color: isSelected ? '#fff' : theme.colors.text.disabled, marginTop: 2, fontWeight: '600' }}>
                        Active: {new Date(entry.lastActivityAt).toLocaleDateString()}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {!selectedCategoryKeys.includes('all') ? (
              <TouchableOpacity onPress={() => setSelectedCategoryKeys(['all'])}>
                <Text style={styles.clearLink}>Reset to All Categories</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.tabSwitchRow}>
          <TouchableOpacity style={[styles.tabSwitchBtn, activeTab === 'myteams' && styles.tabSwitchBtnActive]} onPress={() => setActiveTab('myteams')}>
            <Text style={[styles.tabSwitchText, activeTab === 'myteams' && styles.tabSwitchTextActive]}>My Teams</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabSwitchBtn, activeTab === 'messages' && styles.tabSwitchBtnActive]} onPress={() => setActiveTab('messages')}>
            <Text style={[styles.tabSwitchText, activeTab === 'messages' && styles.tabSwitchTextActive]}>
              Messages {pendingInvitations > 0 ? `(${pendingInvitations})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabSwitchBtn, activeTab === 'tasks' && styles.tabSwitchBtnActive]} onPress={() => setActiveTab('tasks')}>
            <Text style={[styles.tabSwitchText, activeTab === 'tasks' && styles.tabSwitchTextActive]}>
              Tasks {filteredTasks.length > 0 ? `(${filteredTasks.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'myteams' ? (
          <View style={styles.listWrap}>
            {teams.length === 0 ? (
              <Text style={styles.helper}>No team assignment found.</Text>
            ) : (
              teams.map((team) => (
                <View key={`team-${team.id}`} style={styles.card}>
                  <Text style={styles.cardTitle}>{team.hierarchy_path || team.node_name || '-'}</Text>
                  <Text style={styles.cardMeta}>Pad: {team.pad || '-'} • Period: {team.period || '-'}</Text>
                  <Text style={styles.cardMeta}>
                    {toDateText(team.start_date)} to {toDateText(team.end_date)}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeTab === 'messages' ? (
          <View style={styles.listWrap}>
            <View style={styles.messageTabRow}>
              <TouchableOpacity
                style={[styles.messageTabBtn, messageTab === 'received' && styles.messageTabBtnActive]}
                onPress={() => setMessageTab('received')}
              >
                <Text style={[styles.messageTabText, messageTab === 'received' && styles.messageTabTextActive]}>Received</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.messageTabBtn, messageTab === 'sent' && styles.messageTabBtnActive]}
                onPress={() => setMessageTab('sent')}
              >
                <Text style={[styles.messageTabText, messageTab === 'sent' && styles.messageTabTextActive]}>Sent</Text>
              </TouchableOpacity>
            </View>

            {messageTab === 'received' ? (
              invitations.length === 0 ? (
                <Text style={styles.helper}>No invitations found.</Text>
              ) : (
                invitations.map((invitation) => {
                  const currentStatus = String(invitation.invitation_status || 'pending').toLowerCase();
                  return (
                    <View key={`invitation-${invitation.id}`} style={styles.card}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>{invitation.meeting_title || 'Meeting invitation'}</Text>
                        <Text style={[styles.statusBadge, { color: statusColor(currentStatus) }]}>{currentStatus}</Text>
                      </View>
                      <Text style={styles.cardMeta}>
                        {toDateText(invitation.meeting_date)} • {invitation.meeting_node_level || '-'}-{invitation.meeting_node_name || '-'}
                      </Text>
                      <Text style={styles.cardMeta}>Invited by: {invitation.invited_by_name || '-'}</Text>
                      {currentStatus === 'pending' ? (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.acceptBtn]}
                            disabled={respondingInvitationId === Number(invitation.id)}
                            onPress={() => void handleRespondInvitation(Number(invitation.id), 'accepted')}
                          >
                            <Text style={styles.actionText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.tentativeBtn]}
                            disabled={respondingInvitationId === Number(invitation.id)}
                            onPress={() => void handleRespondInvitation(Number(invitation.id), 'tentative')}
                          >
                            <Text style={styles.actionText}>Tentative</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn]}
                            disabled={respondingInvitationId === Number(invitation.id)}
                            onPress={() => void handleRespondInvitation(Number(invitation.id), 'rejected')}
                          >
                            <Text style={styles.actionText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )
            ) : sentSummaries.length === 0 ? (
              <Text style={styles.helper}>No sent meeting invitations found.</Text>
            ) : (
              <ScrollView horizontal style={styles.tableWrap} showsHorizontalScrollIndicator>
                <View>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, styles.colTitle]}>Meeting</Text>
                    <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
                    <Text style={[styles.tableHeaderCell, styles.colCount]}>Accepted</Text>
                    <Text style={[styles.tableHeaderCell, styles.colCount]}>Tentative</Text>
                    <Text style={[styles.tableHeaderCell, styles.colCount]}>Rejected</Text>
                  </View>
                  {sentSummaries.map((row) => (
                    <View key={`sent-${row.meeting_id}`} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.colTitle]} numberOfLines={2}>
                        {row.title}
                      </Text>
                      <Text style={[styles.tableCell, styles.colDate]}>{toDateText(row.meeting_date)}</Text>
                      <Text style={[styles.tableCell, styles.colCount]}>{Number(row.accepted_count || 0)}</Text>
                      <Text style={[styles.tableCell, styles.colCount]}>{Number(row.tentative_count || 0)}</Text>
                      <Text style={[styles.tableCell, styles.colCount]}>{Number(row.rejected_count || 0)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        ) : null}

        {activeTab === 'tasks' ? (
          <View style={styles.listWrap}>
            {!selectedCategoryKeys.includes('all') ? (
              <Text style={styles.subHeading}>
                Filtered by selected categories ({selectedCategoryKeys.length})
              </Text>
            ) : null}
            {tasksByCategory.length === 0 ? (
              <Text style={styles.helper}>No tasks assigned for selected category/location.</Text>
            ) : (
              tasksByCategory.map(([catName, catTasks]) => (
                <View key={`task-cat-group-${catName}`} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EDDCD2', paddingBottom: 8 }}>
                    <MaterialIcons name="category" size={20} color={theme.colors.primary} />
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text.primary }}>
                      {catName}
                    </Text>
                    <View style={{ backgroundColor: theme.colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>{catTasks.length}</Text>
                    </View>
                  </View>
                  <View style={{ gap: 12 }}>
                    {catTasks.map((task) => (
                      <View key={`task-${task.id}`} style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                          <Text style={styles.cardTitle}>{task.title}</Text>
                          <Text style={[styles.statusBadge, { color: statusColor(task.status) }]}>{String(task.status || 'open')}</Text>
                        </View>
                        <Text style={styles.cardMeta}>{task.hierarchy_path || task.node_name || '-'}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                          {Array.isArray(task.task_categories) && task.task_categories.map((cat, i) => (
                            <View key={`cat-${i}`} style={{ backgroundColor: theme.colors.primarySoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                              <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '700' }}>{cat}</Text>
                            </View>
                          ))}
                          {Array.isArray(task.task_subcategories) && task.task_subcategories.map((sub, i) => (
                            <View key={`sub-${i}`} style={{ backgroundColor: '#EFEFEF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                              <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontWeight: '700' }}>{sub}</Text>
                            </View>
                          ))}
                        </View>
                        {task.assignees && task.assignees.length > 0 ? (
                          <Text style={[styles.cardMeta, { color: theme.colors.primary, fontWeight: '600', marginBottom: 4 }]}>
                            👥 {task.assignees.length} Assignee{task.assignees.length > 1 ? 's' : ''}: {task.assignees.map((a) => a.name).join(', ')}
                          </Text>
                        ) : null}
                        <Text style={styles.cardMeta}>
                          Task: {toDateText(task.task_date)} • Due: {toDateText(task.due_date)}
                        </Text>
                        <Text style={styles.cardMeta}>Attachments: {Number(task.attachment_count || 0)}</Text>
                        <TouchableOpacity style={styles.taskEditBtn} onPress={() => handleOpenTaskEditor(task)}>
                          <Text style={styles.taskEditBtnText}>Edit Task</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      <StandardModal
        visible={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title="Edit Task"
        subtitle={editingTask?.title || '-'}
        footer={
          <>
            <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => setShowTaskModal(false)}>
              <Text style={styles.btnTextDark}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, savingTask && styles.btnDisabled]} disabled={savingTask} onPress={() => void handleSaveTask()}>
              <Text style={styles.btnText}>{savingTask ? 'Saving...' : 'Save Task'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        {editingTask ? (
          <View style={{ backgroundColor: '#FFF9F7', borderRadius: 16, padding: 14, gap: 8, marginBottom: 12, borderWidth: 1, borderColor: '#FCEFE6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="event-note" size={16} color={theme.colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>DUE DATE: {editingTask.task_date || '-'}</Text>
              </View>
              <View style={{ backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: '#EDDED5' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.text.secondary }}>#{editingTask.node_id}</Text>
              </View>
            </View>

            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.text.primary }}>{editingTask.title}</Text>
            {editingTask.description ? (
              <Text style={{ fontSize: 13, color: theme.colors.text.secondary, lineHeight: 18 }}>{editingTask.description}</Text>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {parseLabelList(editingTask.task_categories).map((cat, idx) => (
                <View key={`modal-cat-${idx}`} style={{ backgroundColor: theme.colors.primarySoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.primary }}>{cat}</Text>
                </View>
              ))}
              {parseLabelList(editingTask.task_subcategories).map((sub, idx) => (
                <View key={`modal-sub-${idx}`} style={{ backgroundColor: '#EFEFEF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.text.secondary }}>{sub}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusRow}>
          {TASK_STATUS_OPTIONS.map((status) => {
            const active = taskDraftStatus === status;
            return (
              <TouchableOpacity
                key={`status-${status}`}
                style={[styles.statusChip, active && styles.statusChipActive, { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14 }]}
                onPress={() => setTaskDraftStatus(status)}
              >
                <MaterialIcons
                  name={status === 'completed' ? 'check-circle' : status === 'in_progress' ? 'timelapse' : 'radio-button-unchecked'}
                  size={16}
                  color={active ? '#fff' : theme.colors.text.secondary}
                />
                <Text style={[styles.statusChipText, active && styles.statusChipTextActive, { fontSize: 13 }]}>{status.replace(/_/g, ' ').toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Upload Documents</Text>
        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, styles.inputFlex]}
            placeholder="Paste attachment URL (https://...)"
            value={taskAttachmentInput}
            onChangeText={setTaskAttachmentInput}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.inlineBtn} onPress={handleAddAttachmentLink}>
            <Text style={styles.inlineBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.inlineBtn, styles.uploadBtn, taskUploadingAttachment && styles.btnDisabled, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }]}
          disabled={taskUploadingAttachment}
          onPress={() => void handleUploadTaskAttachment()}
        >
          <MaterialIcons name="cloud-upload" size={18} color="#fff" />
          <Text style={styles.inlineBtnText}>{taskUploadingAttachment ? 'Uploading...' : 'Upload file from device'}</Text>
        </TouchableOpacity>

        <View style={styles.attachmentList}>
          {taskDraftAttachments.map((entry, idx) => (
            <View key={`task-attachment-${idx}`} style={[styles.attachmentItem, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#EDDED5' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <MaterialIcons name="insert-drive-file" size={18} color={theme.colors.primary} />
                <Text style={[styles.attachmentText, { flex: 1 }]} numberOfLines={1}>
                  {entry.name || entry.url}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setTaskDraftAttachments((prev) => prev.filter((_, i) => i !== idx))} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={18} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </StandardModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  helper: {
    color: theme.colors.text.secondary,
    fontSize: 13,
  },
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 34,
    height: 34,
  },
  headerBrand: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  content: {
    padding: 12,
    gap: 12,
    paddingBottom: 24,
  },
  heading: {
    fontSize: 18,
    color: theme.colors.text.primary,
    fontWeight: '700',
  },
  subHeading: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    color: theme.colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  headingSm: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  clearLink: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  assignmentRow: {
    gap: 8,
  },
  assignmentCard: {
    width: 180,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    padding: 10,
    gap: 4,
  },
  assignmentCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  assignmentCardTitle: {
    color: theme.colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  assignmentCardTitleActive: {
    color: theme.colors.primary,
  },
  assignmentCardMeta: {
    color: theme.colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  tabSwitchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabSwitchBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  tabSwitchBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  tabSwitchText: {
    color: theme.colors.text.secondary,
    fontWeight: '700',
    fontSize: 12,
  },
  tabSwitchTextActive: {
    color: theme.colors.primary,
  },
  listWrap: {
    gap: 10,
  },
  messageTabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  messageTabBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
  },
  messageTabBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  messageTabText: {
    color: theme.colors.text.secondary,
    fontWeight: '700',
    fontSize: 12,
  },
  messageTabTextActive: {
    color: theme.colors.primary,
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
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
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 9,
    fontSize: 12,
    color: theme.colors.text.primary,
  },
  colTitle: {
    width: 220,
  },
  colDate: {
    width: 110,
  },
  colCount: {
    width: 110,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    padding: 10,
    gap: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: theme.colors.text.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  cardMeta: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  taskEditBtn: {
    marginTop: 2,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  taskEditBtnText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#15803d',
  },
  tentativeBtn: {
    backgroundColor: '#b45309',
  },
  rejectBtn: {
    backgroundColor: '#b91c1c',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.65,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    maxHeight: '88%',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  statusChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  statusChipText: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  statusChipTextActive: {
    color: theme.colors.primary,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: theme.colors.text.primary,
    fontSize: 13,
  },
  inputFlex: {
    flex: 1,
  },
  inlineBtn: {
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  uploadBtn: {
    alignSelf: 'flex-start',
  },
  attachmentList: {
    maxHeight: 140,
  },
  attachmentItem: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  attachmentText: {
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: 12,
  },
  removeText: {
    color: theme.colors.error,
    fontSize: 11,
    fontWeight: '700',
  },
  btn: {
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  btnLight: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  btnTextDark: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
});
