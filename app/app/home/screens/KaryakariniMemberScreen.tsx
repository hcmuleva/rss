import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '../../core/components/ScreenHeader';
import { PageHeaderCard } from '../../core/components/PageHeaderCard';
import { StandardModal } from '../../core/components/StandardModal';
import { useProfile } from '../../core/context/ProfileContext';
import { karyakariniClient } from '../../api/client';
import { theme } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import type {
  KaryakariniAttachment,
  KaryakariniCategoryActivity,
  KaryakariniInvitation,
  KaryakariniMyTeam,
  KaryakariniTask,
  KaryakariniVersion,
} from '../../services/karyakarini-module/types';

type MemberTab = 'tasks' | 'myteams' | 'activities';
const TASK_STATUS_OPTIONS = ['open', 'in_progress', 'completed', 'blocked', 'cancelled'] as const;
type AssignmentCard = {
  key: string;
  nodeId: number;
  path: string;
  nodeName?: string;
  nodeLevel?: string;
  category: string;
  subcategory: string;
  pad: string;
  lastActivityAt: number;
  count: number;
  source: 'team' | 'task' | 'invitation' | 'activity';
};

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

const normalizePath = (p?: string | null) => {
  return String(p || '').split('>').map((part) => part.trim().toLowerCase()).filter(Boolean).join(' > ');
};

const sanitizeCountInput = (value: string) => String(value || '').replace(/[^\d]/g, '').slice(0, 5);
const readCountValue = (value: string) => Math.max(0, Number(String(value || '').replace(/[^\d]/g, '')) || 0);
const deriveCategoriesFromSubcategories = (subcategories: string[]) => {
  const normalized = subcategories.map((s) => String(s || '').trim()).filter(Boolean);
  if (!normalized.length) return [] as string[];
  // Derive category from subcategory name heuristically (first word / capitalize)
  return [normalized[0]];
};

export default function KaryakariniMemberScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { user, logout } = useProfile();
  const isAdmin = useMemo(() => {
    return ['admin', 'superadmin', 'templeadmin'].includes(String(user?.role || '').toLowerCase());
  }, [user]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MemberTab>('tasks');
  const [versionId, setVersionId] = useState<number | null>(null);
  const [teams, setTeams] = useState<KaryakariniMyTeam[]>([]);
  const [invitations, setInvitations] = useState<KaryakariniInvitation[]>([]);
  const [tasks, setTasks] = useState<KaryakariniTask[]>([]);
  const [activities, setActivities] = useState<KaryakariniCategoryActivity[]>([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityUploadingAttachment, setActivityUploadingAttachment] = useState(false);
  const [activityContext, setActivityContext] = useState<AssignmentCard | null>(null);
  const [editingActivity, setEditingActivity] = useState<KaryakariniCategoryActivity | null>(null);
  const [activityForm, setActivityForm] = useState({
    title: '',
    description: '',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    status: 'open',
    includePopulation: false,
    maleCount: '0',
    femaleCount: '0',
    childrenCount: '0',
    attachmentInput: '',
    attachments: [] as KaryakariniAttachment[],
  });
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<KaryakariniTask | null>(null);
  const [taskContext, setTaskContext] = useState<AssignmentCard | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    taskDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    status: 'open',
    includePopulation: false,
    maleCount: '0',
    femaleCount: '0',
    childrenCount: '0',
    attachmentInput: '',
    attachments: [] as KaryakariniAttachment[],
  });
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
      setTasks([]);
      setActivities([]);
      return;
    }

    const [teamsRes, invitationRes, taskRes, unreadRes, assignmentRes] = await Promise.allSettled([
      karyakariniClient.get('/karyakarini/my/teams', { params: { versionId: selectedVersionId } }),
      karyakariniClient.get('/karyakarini/my/invitations', { params: { versionId: selectedVersionId, limit: 100 } }),
      karyakariniClient.get('/karyakarini/my/tasks', { params: { versionId: selectedVersionId, limit: 100 } }),
      karyakariniClient.get('/karyakarini/my/notifications/unread-count', { params: { versionId: selectedVersionId } }),
      karyakariniClient.get('/karyakarini/my/category-activities', { params: { versionId: selectedVersionId, limit: 100 } }),
    ]);

    const getValue = (result: PromiseSettledResult<any>) =>
      result.status === 'fulfilled' ? result.value : null;

    const loadedTeams = (getValue(teamsRes)?.data?.data?.teams || []) as KaryakariniMyTeam[];
    const loadedTasks = (getValue(taskRes)?.data?.data?.tasks || []) as KaryakariniTask[];
    setTeams(loadedTeams);
    setInvitations((getValue(invitationRes)?.data?.data?.invitations || []) as KaryakariniInvitation[]);
    setTasks(loadedTasks);
    setActivities((getValue(assignmentRes)?.data?.data?.activities || []) as KaryakariniCategoryActivity[]);
    setNotificationUnreadCount(Number(getValue(unreadRes)?.data?.data?.total || 0));
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
    if (tab === 'tasks' || tab === 'myteams' || tab === 'activities') {
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
    void loadData();
  }, [activeTab, selectedCategoryKey, loadData]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const handleDownloadAttachment = useCallback(async (url?: string | null, fileName?: string | null) => {
    const safeUrl = String(url || '').trim();
    if (!safeUrl) return;
    try {
      if (Platform.OS === 'web') {
        try {
          const response = await fetch(safeUrl);
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName || safeUrl.split('/').pop() || 'download';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        } catch {
          const a = document.createElement('a');
          a.href = safeUrl;
          a.download = fileName || safeUrl.split('/').pop() || 'download';
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        const safeFileName = (fileName || safeUrl.split('/').pop() || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileUri = `${(FileSystem as any).documentDirectory}${safeFileName}`;
        const downloadResult = await (FileSystem as any).downloadAsync(safeUrl, fileUri);
        if (downloadResult.status === 200) {
          Alert.alert('Download Complete', `File saved to: ${downloadResult.uri}`);
        } else {
          Alert.alert('Error', 'Failed to download file');
          Linking.openURL(safeUrl).catch(() => {});
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to download file. Opening link directly.');
      Linking.openURL(safeUrl).catch(() => {});
    }
  }, []);

  const handleOpenTaskEditor = useCallback((task: KaryakariniTask) => {
    const nextContext: AssignmentCard = {
      key: `task-context-${task.id}`,
      nodeId: Number(task.node_id || 0),
      path: String(task.hierarchy_path || task.node_name || '').trim() || '-',
      nodeName: String(task.node_name || '').trim() || undefined,
      nodeLevel: String(task.node_level || '').trim() || undefined,
      category: parseLabelList(task.task_categories)[0] || 'General',
      subcategory: parseLabelList(task.task_subcategories)[0] || '',
      pad: 'Task Assignee',
      lastActivityAt: new Date((task as any).updated_at || (task as any).created_at || task.task_date || 0).getTime(),
      count: 1,
      source: 'task',
    };

    setTaskContext(nextContext);
    setEditingTask(task);
    setTaskForm({
      title: String(task.title || '').trim(),
      description: String(task.description || '').trim(),
      taskDate: task.task_date || new Date().toISOString().slice(0, 10),
      dueDate: task.due_date || '',
      status: String(task.status || 'open').toLowerCase() || 'open',
      includePopulation: Number(task.male_count || 0) > 0 || Number(task.female_count || 0) > 0 || Number(task.children_count || 0) > 0,
      maleCount: String(Number(task.male_count || 0)),
      femaleCount: String(Number(task.female_count || 0)),
      childrenCount: String(Number(task.children_count || 0)),
      attachmentInput: '',
      attachments: Array.isArray(task.attachments) ? [...task.attachments] : [],
    });
    setShowTaskModal(true);
  }, []);

  const handleOpenTaskCreate = useCallback(() => {
    if (selectedCategoryKey === 'all' || !selectedCategoryKey) {
      Alert.alert('Select scope', 'Please select exactly one subcategory card to create a task.');
      return;
    }
    const [nodeIdPart, categoryPart, subcategoryPart] = String(selectedCategoryKey).split('###');
    const nodeId = Number(nodeIdPart || 0);
    const category = String(categoryPart || '').trim();
    const subcategory = String(subcategoryPart || '').trim();
    if (!nodeId || !subcategory) {
      Alert.alert('Select scope', 'Please select a subcategory card to create a task.');
      return;
    }
    const matchingTeam = teams.find((entry) => Number(entry.node_id || 0) === nodeId) || null;
    const matchingTask = tasks.find((entry) => Number(entry.node_id || 0) === nodeId) || null;

    setTaskContext({
      key: selectedCategoryKey,
      nodeId,
      path: String(matchingTeam?.hierarchy_path || matchingTask?.hierarchy_path || matchingTeam?.node_name || matchingTask?.node_name || '').trim(),
      nodeName: String(matchingTeam?.node_name || matchingTask?.node_name || '').trim() || undefined,
      nodeLevel: String(matchingTeam?.node_level || matchingTask?.node_level || '').trim() || undefined,
      category: category || 'General',
      subcategory,
      pad: 'Task Assignee',
      lastActivityAt: 0,
      count: 1,
      source: 'team',
    });
    setEditingTask(null);
    setTaskForm({
      title: '',
      description: '',
      taskDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      status: 'open',
      includePopulation: false,
      maleCount: '0',
      femaleCount: '0',
      childrenCount: '0',
      attachmentInput: '',
      attachments: [],
    });
    setShowTaskModal(true);
  }, [selectedCategoryKey, tasks, teams]);

  const handleUploadTaskAttachment = useCallback(async () => {
    try {
      setTaskUploadingAttachment(true);
      const picked = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      const form = new FormData();
      form.append('folder', 'karyakarini');
      form.append('category', 'task');
      const assetFile = (asset as any)?.file;
      if (assetFile) {
        form.append('file', assetFile);
      } else {
        form.append('file', {
          uri: asset.uri,
          name: asset.name || `task-${Date.now()}`,
          type: asset.mimeType || 'application/octet-stream',
        } as any);
      }

      const response = await karyakariniClient.post('/karyakarini/upload/attachment', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const payload = response?.data?.data || {};
      const url = String(payload.url || '').trim();
      if (!url) {
        Alert.alert('Error', 'Failed to upload attachment');
        return;
      }
      setTaskForm((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments,
          {
            url,
            type: String(payload.fileType || asset.mimeType || '').trim() || 'document',
            name: String(payload.fileName || asset.name || `task-${Date.now()}`).trim(),
          },
        ],
      }));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to upload attachment');
    } finally {
      setTaskUploadingAttachment(false);
    }
  }, []);

  const handleAddAttachmentLink = useCallback(() => {
    const url = taskForm.attachmentInput.trim();
    if (!url) return;
    setTaskForm((prev) => ({
      ...prev,
      attachmentInput: '',
      attachments: [...prev.attachments, { url, type: 'document', name: url.split('/').pop() || 'attachment' }],
    }));
  }, [taskForm.attachmentInput]);

  const handleSaveTask = useCallback(async () => {
    if (!versionId || !taskContext) return;
    if (!taskForm.title.trim()) {
      Alert.alert('Required', 'Task title is required');
      return;
    }

    try {
      setSavingTask(true);
      const payload = {
        versionId,
        nodeId: Number(taskContext.nodeId || 0),
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        taskDate: taskForm.taskDate,
        dueDate: taskForm.dueDate.trim() || null,
        status: taskForm.status,
        maleCount: taskForm.includePopulation ? Number(taskForm.maleCount || 0) : 0,
        femaleCount: taskForm.includePopulation ? Number(taskForm.femaleCount || 0) : 0,
        childrenCount: taskForm.includePopulation ? Number(taskForm.childrenCount || 0) : 0,
        category: taskContext.category || null,
        subcategory: taskContext.subcategory || null,
        categories: taskContext.category ? [taskContext.category] : [],
        subcategories: taskContext.subcategory ? [taskContext.subcategory] : [],
        attachments: taskForm.attachments,
      };

      if (editingTask?.id) {
        await karyakariniClient.put(`/karyakarini/tasks/${editingTask.id}`, payload);
      } else {
        await karyakariniClient.post('/karyakarini/tasks', payload);
      }

      await loadData();
      setShowTaskModal(false);
      setEditingTask(null);
      setTaskContext(null);
      setTaskForm({
        title: '',
        description: '',
        taskDate: new Date().toISOString().slice(0, 10),
        dueDate: '',
        status: 'open',
        includePopulation: false,
        maleCount: '0',
        femaleCount: '0',
        childrenCount: '0',
        attachmentInput: '',
        attachments: [],
      });
      Alert.alert('Success', editingTask?.id ? 'Task updated successfully' : 'Task created successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || `Failed to ${editingTask?.id ? 'update' : 'create'} task`);
    } finally {
      setSavingTask(false);
    }
  }, [editingTask?.id, loadData, taskContext, taskForm, versionId]);

  const handleUploadActivityAttachment = useCallback(async () => {
    try {
      setActivityUploadingAttachment(true);
      const picked = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      const form = new FormData();
      form.append('folder', 'karyakarini');
      form.append('category', 'activity-submission');
      const assetFile = (asset as any)?.file;
      if (assetFile) {
        form.append('file', assetFile);
      } else {
        form.append('file', {
          uri: asset.uri,
          name: asset.name || `activity-${Date.now()}`,
          type: asset.mimeType || 'application/octet-stream',
        } as any);
      }

      const response = await karyakariniClient.post('/karyakarini/upload/attachment', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const payload = response?.data?.data || {};
      const url = String(payload.url || '').trim();
      if (!url) return;
      setActivityForm((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments,
          {
            url,
            type: String(payload.fileType || asset.mimeType || '').trim() || 'document',
            name: String(payload.fileName || asset.name || `activity-${Date.now()}`).trim(),
          },
        ],
      }));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to upload attachment');
    } finally {
      setActivityUploadingAttachment(false);
    }
  }, []);

  const handleAddActivityAttachmentLink = useCallback(() => {
    const url = activityForm.attachmentInput.trim();
    if (!url) return;
    setActivityForm((prev) => ({
      ...prev,
      attachmentInput: '',
      attachments: [...prev.attachments, { url, type: 'document', name: url.split('/').pop() || 'attachment' }],
    }));
  }, [activityForm.attachmentInput]);

  const handleSaveActivity = useCallback(async () => {
    if (!versionId || !activityContext) return;
    if (!activityForm.title.trim()) {
      Alert.alert('Required', 'Activity title is required');
      return;
    }
    try {
      setSavingActivity(true);
      const payload = {
        versionId,
        nodeId: activityContext.nodeId,
        category: activityContext.category,
        subcategory: activityContext.subcategory,
        title: activityForm.title.trim(),
        description: activityForm.description.trim() || null,
        fromDate: activityForm.fromDate,
        toDate: activityForm.toDate,
        status: activityForm.status,
        maleCount: activityForm.includePopulation ? Number(activityForm.maleCount || 0) : 0,
        femaleCount: activityForm.includePopulation ? Number(activityForm.femaleCount || 0) : 0,
        childrenCount: activityForm.includePopulation ? Number(activityForm.childrenCount || 0) : 0,
        attachments: activityForm.attachments,
      };

      if (editingActivity?.id) {
        await karyakariniClient.put(`/karyakarini/my/category-activities/${editingActivity.id}`, payload);
      } else {
        await karyakariniClient.post('/karyakarini/my/category-activities', payload);
      }

      setShowActivityModal(false);
      setActivityContext(null);
      setEditingActivity(null);
      setActivityForm({
        title: '',
        description: '',
        fromDate: new Date().toISOString().slice(0, 10),
        toDate: new Date().toISOString().slice(0, 10),
        status: 'open',
        includePopulation: false,
        maleCount: '0',
        femaleCount: '0',
        childrenCount: '0',
        attachmentInput: '',
        attachments: [],
      });
      await loadData();
      Alert.alert('Success', editingActivity?.id ? 'Activity updated successfully' : 'Activity submitted successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || `Failed to ${editingActivity?.id ? 'update' : 'submit'} activity`);
    } finally {
      setSavingActivity(false);
    }
  }, [activityForm, activityContext, loadData, versionId, editingActivity?.id]);

  const handleDeleteTask = useCallback(async (taskId: number) => {
    Alert.alert(
      'कार्य हटाएं',
      'क्या आप वाकई इस कार्य को हटाना चाहते हैं?',
      [
        { text: 'रद्द करें', style: 'cancel' },
        {
          text: 'हटाएं',
          style: 'destructive',
          onPress: async () => {
            try {
              await karyakariniClient.delete(`/karyakarini/tasks/${taskId}`);
              await loadData();
              Alert.alert('Success', 'कार्य सफलता से हटा दिया गया है');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'कार्य हटाने में विफल');
            }
          }
        }
      ]
    );
  }, [loadData]);

  const handleDeleteActivity = useCallback(async (activityId: number) => {
    Alert.alert(
      'गतिविधि हटाएं',
      'क्या आप वाकई इस गतिविधि को हटाना चाहते हैं?',
      [
        { text: 'रद्द करें', style: 'cancel' },
        {
          text: 'हटाएं',
          style: 'destructive',
          onPress: async () => {
            try {
              await karyakariniClient.delete(`/karyakarini/my/category-activities/${activityId}`);
              await loadData();
              Alert.alert('Success', 'गतिविधि सफलता से हटा दी गई है');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'गतिविधि हटाने में विफल');
            }
          }
        }
      ]
    );
  }, [loadData]);

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

  const assignmentCards = useMemo<AssignmentCard[]>(() => {
    const map = new Map<string, AssignmentCard>();

    const addOrUpdate = (
      nodeId: number,
      path: string,
      nodeName: string,
      nodeLevel: string,
      cat: string,
      sub: string,
      pad: string,
      timestamp: number,
      isDirect: boolean,
      source: AssignmentCard['source']
    ) => {
      const category = cat.trim() || 'General';
      const subcategory = sub.trim();
      const key = `${nodeId}###${category}###${subcategory}`;
      const existing = map.get(key);
      map.set(key, {
        key: existing?.key || key,
        nodeId,
        path: existing?.path || path || `Node #${nodeId}`,
        nodeName: existing?.nodeName || nodeName || undefined,
        nodeLevel: existing?.nodeLevel || nodeLevel || undefined,
        category,
        subcategory,
        pad: existing?.pad || pad || 'Member',
        lastActivityAt: Math.max(existing?.lastActivityAt || 0, timestamp),
        count: (existing?.count || 0) + (isDirect ? 1 : 0),
        source: existing?.source || source,
      });
    };

    teams.forEach((team) => {
      const ts = new Date((team as any).updated_at || (team as any).created_at || team.start_date || 0).getTime();
      const nodeId = Number(team.node_id || 0);
      const path = String(team.hierarchy_path || team.node_name || '').trim();
      const nodeName = String(team.node_name || '').trim();
      const nodeLevel = String(team.node_level || '').trim();
      const pad = String(team.pad || '').trim();
      const categories = parseLabelList(team.categories && team.categories.length ? team.categories : team.category || '');
      const subcategories = parseLabelList(team.subcategories && team.subcategories.length ? team.subcategories : team.subcategory || '');

      if (subcategories.length > 0) {
        subcategories.forEach((sub) => {
          const derivedCategories = categories.length ? categories : deriveCategoriesFromSubcategories([sub]);
          const cat = derivedCategories[0] || 'Category';
          addOrUpdate(nodeId, path, nodeName, nodeLevel, cat, sub, pad, ts, true, 'team');
        });
      }
    });

    return Array.from(map.values())
      .filter((c) => c.count > 0)
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [teams]);

  const subcategoryCards = useMemo(
    () =>
      assignmentCards.filter(
        (entry) => entry.source !== 'invitation' && String(entry.subcategory || '').trim().length > 0
      ),
    [assignmentCards]
  );

  const hasSelectedSubcategory = useMemo(() => {
    if (selectedCategoryKey === 'all' || !selectedCategoryKey) return false;
    return subcategoryCards.some((entry) => entry.key === selectedCategoryKey);
  }, [selectedCategoryKey, subcategoryCards]);

  const handleOpenActivityCreate = useCallback(() => {
    if (!hasSelectedSubcategory) {
      Alert.alert('Required', 'Please select a subcategory first');
      return;
    }
    const selectedAssignment = assignmentCards.find(
      (c) => c.key === selectedCategoryKey && c.source !== 'invitation'
    );
    if (!selectedAssignment) return;
    setActivityContext(selectedAssignment);
    setEditingActivity(null);
    setActivityForm({
      title: '',
      description: '',
      fromDate: new Date().toISOString().slice(0, 10),
      toDate: new Date().toISOString().slice(0, 10),
      status: 'open',
      includePopulation: false,
      maleCount: '0',
      femaleCount: '0',
      childrenCount: '0',
      attachmentInput: '',
      attachments: [],
    });
    setShowActivityModal(true);
  }, [assignmentCards, hasSelectedSubcategory, selectedCategoryKey]);

  const handleOpenActivityEditor = useCallback((activity: KaryakariniCategoryActivity) => {
    const nextContext: AssignmentCard = {
      key: `activity-context-${activity.id}`,
      nodeId: Number(activity.node_id || 0),
      path: String(activity.hierarchy_path || activity.node_name || '').trim() || '-',
      nodeName: String(activity.node_name || '').trim() || undefined,
      nodeLevel: String(activity.node_level || '').trim() || undefined,
      category: activity.category || 'General',
      subcategory: activity.subcategory || '',
      pad: 'Activity Submitter',
      lastActivityAt: new Date(activity.updated_at || activity.created_at || 0).getTime(),
      count: 1,
      source: 'activity',
    };

    setActivityContext(nextContext);
    setEditingActivity(activity);
    setActivityForm({
      title: String(activity.title || '').trim(),
      description: String(activity.description || '').trim(),
      fromDate: activity.from_date || new Date().toISOString().slice(0, 10),
      toDate: activity.to_date || new Date().toISOString().slice(0, 10),
      status: String(activity.status || 'open').toLowerCase() || 'open',
      includePopulation: Number(activity.male_count || 0) > 0 || Number(activity.female_count || 0) > 0 || Number(activity.children_count || 0) > 0,
      maleCount: String(Number(activity.male_count || 0)),
      femaleCount: String(Number(activity.female_count || 0)),
      childrenCount: String(Number(activity.children_count || 0)),
      attachmentInput: '',
      attachments: Array.isArray(activity.attachments) ? [...activity.attachments] : [],
    });
    setShowActivityModal(true);
  }, []);

  useEffect(() => {
    if (!selectedCategoryKey && subcategoryCards.length > 0) {
      setSelectedCategoryKey(subcategoryCards[0].key);
    } else if (selectedCategoryKey && selectedCategoryKey !== 'all' && !subcategoryCards.some((entry) => entry.key === selectedCategoryKey)) {
      if (subcategoryCards.length > 0) {
        setSelectedCategoryKey(subcategoryCards[0].key);
      } else {
        setSelectedCategoryKey('all');
      }
    }
  }, [selectedCategoryKey, subcategoryCards]);

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
        teams.some(
          (t) =>
            Number(t.node_id) === Number(task.node_id) ||
            (Boolean(t.hierarchy_path) && Boolean(task.hierarchy_path) && String(task.hierarchy_path).startsWith(String(t.hierarchy_path)))
        )
    );
  }, [groupedTasks, user, teams]);

  const filteredTasks = useMemo(() => {
    if (selectedCategoryKey === 'all' || !selectedCategoryKey) {
      return assignedTasks;
    }
    const selectedAssignment = assignmentCards.find(
      (c) => c.key === selectedCategoryKey && c.source !== 'invitation'
    );
    if (!selectedAssignment) return assignedTasks;

    return assignedTasks.filter((task) => {
      const taskCategories = parseLabelList(task.task_categories)
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean);
      const taskSubcategories = parseLabelList(task.task_subcategories)
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean);

      const actPath = normalizePath(task.hierarchy_path);
      const selPath = normalizePath(selectedAssignment.path);
      const nodeMatch =
        Number(task.node_id || 0) === Number(selectedAssignment.nodeId || 0) ||
        (Boolean(selPath) && Boolean(actPath) && (actPath === selPath || actPath.startsWith(selPath + ' > ')));

      if (!nodeMatch) return false;
      const selectedCategory = String(selectedAssignment.category || '').trim().toLowerCase();
      const selectedSubcategory = String(selectedAssignment.subcategory || '').trim().toLowerCase();

      if (selectedSubcategory) return taskSubcategories.includes(selectedSubcategory);
      if (selectedCategory && selectedCategory !== 'general') return taskCategories.includes(selectedCategory);
      return true;
    });
  }, [assignedTasks, assignmentCards, selectedCategoryKey]);

  const tasksByCategory = useMemo(() => {
    const map = new Map<string, KaryakariniTask[]>();

    const allowedCategory = selectedCategoryKey === 'all' || !selectedCategoryKey
      ? null
      : assignmentCards
          .filter((c) => c.key === selectedCategoryKey && c.source !== 'invitation')
          .map((c) => ({
            nodeId: Number(c.nodeId || 0),
            path: String(c.path || '').trim(),
            sub: String(c.subcategory || '').trim().toLowerCase(),
            cat: String(c.category || '').trim().toLowerCase(),
          }))[0] || null;

    filteredTasks.forEach((task) => {
      const taskSubs = parseLabelList(task.task_subcategories);
      const groupNames = taskSubs.length > 0 ? taskSubs : ['General'];

      groupNames.forEach((subName) => {
        const normalizedSub = String(subName || '').trim().toLowerCase();
        if (allowedCategory) {
          const actPath = normalizePath(task.hierarchy_path);
          const selPath = normalizePath(allowedCategory.path);
          const matchedNode =
            allowedCategory.nodeId === Number(task.node_id || 0) ||
            (Boolean(selPath) && Boolean(actPath) && (actPath === selPath || actPath.startsWith(selPath + ' > ')));

          if (!matchedNode) return;
          if (allowedCategory.sub && allowedCategory.sub !== normalizedSub) return;
          if (!allowedCategory.sub && allowedCategory.cat) {
            const taskCats = parseLabelList(task.task_categories).map((cat) => String(cat || '').trim().toLowerCase());
            if (!taskCats.includes(allowedCategory.cat)) return;
          }
        }

        const groupKey = String(subName || '').trim() || 'General';
        if (!map.has(groupKey)) map.set(groupKey, []);
        if (!map.get(groupKey)!.some((t) => t.id === task.id)) {
          map.get(groupKey)!.push(task);
        }
      });
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTasks, selectedCategoryKey, assignmentCards]);

  const filteredActivities = useMemo(() => {
    if (selectedCategoryKey === 'all' || !selectedCategoryKey) return activities;
    const selectedAssignment = assignmentCards.find(
      (c) => c.key === selectedCategoryKey && c.source !== 'invitation'
    );
    if (!selectedAssignment) return activities;
    return activities.filter((activity) => {
      const actPath = normalizePath(activity.hierarchy_path);
      const selPath = normalizePath(selectedAssignment.path);
      const nodeMatch =
        Number(activity.node_id || 0) === Number(selectedAssignment.nodeId || 0) ||
        (Boolean(selPath) && Boolean(actPath) && (actPath === selPath || actPath.startsWith(selPath + ' > ')));

      const selectedSub = String(selectedAssignment.subcategory || '').trim().toLowerCase();
      const actSub = String(activity.subcategory || '').trim().toLowerCase();
      if (!nodeMatch) return false;
      if (selectedSub) return actSub === selectedSub;
      return true;
    });
  }, [activities, assignmentCards, selectedCategoryKey]);

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
        title="कार्यकारिणी"
        subtitle="कार्य, टीम सदस्य और गतिविधियाँ"
        icon={<MaterialIcons name="groups" size={24} color={theme.colors.primary} />}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {subcategoryCards.length > 0 ? (
          <View style={styles.listWrap}>
            <Text style={styles.sectionTitle}>सौंपी गई श्रेणियाँ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignmentRow}>
              {subcategoryCards.map((entry) => {
                const isSelected = selectedCategoryKey !== 'all' && selectedCategoryKey === entry.key;
                return (
                  <TouchableOpacity
                    key={entry.key}
                    style={[styles.assignmentCard, isSelected && styles.assignmentCardActive]}
                    onPress={() => {
                      setSelectedCategoryKey(entry.key);
                    }}
                  >
                    <Text style={[styles.assignmentCardTitle, isSelected && styles.assignmentCardTitleActive]}>
                      {entry.subcategory || entry.category}
                    </Text>
                    <Text style={styles.assignmentCardMeta}>{entry.category}</Text>
                    <Text style={styles.assignmentCardMeta}>{entry.pad || '-'}</Text>
                    {entry.lastActivityAt > 0 ? (
                      <Text style={{ fontSize: 10, color: isSelected ? '#fff' : theme.colors.text.disabled, marginTop: 2, fontWeight: '600' }}>
                        सक्रिय: {new Date(entry.lastActivityAt).toLocaleDateString()}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {selectedCategoryKey && selectedCategoryKey !== 'all' ? (
              <TouchableOpacity onPress={() => setSelectedCategoryKey('all')}>
                <Text style={styles.clearLink}>सभी श्रेणियों पर रीसेट करें</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.tabSwitchRow}>
          <TouchableOpacity style={[styles.tabSwitchBtn, activeTab === 'tasks' && styles.tabSwitchBtnActive]} onPress={() => setActiveTab('tasks')}>
            <Text style={[styles.tabSwitchText, activeTab === 'tasks' && styles.tabSwitchTextActive]}>
              कार्य ({filteredTasks.length}){'\n'}Karya
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabSwitchBtn, activeTab === 'myteams' && styles.tabSwitchBtnActive]} onPress={() => setActiveTab('myteams')}>
            <Text style={[styles.tabSwitchText, activeTab === 'myteams' && styles.tabSwitchTextActive]}>
              टीम प्रबंधन ({teams.length}){'\n'}Team
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabSwitchBtn, activeTab === 'activities' && styles.tabSwitchBtnActive]} onPress={() => setActiveTab('activities')}>
            <Text style={[styles.tabSwitchText, activeTab === 'activities' && styles.tabSwitchTextActive]}>
              कार्यक्रम ({filteredActivities.length}){'\n'}Karyakaram
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'myteams' ? (
          <View style={styles.listWrap}>
            {teams.length === 0 ? (
              <Text style={styles.helper}>कोई टीम असाइनमेंट नहीं मिला।</Text>
            ) : (
              teams.map((team) => (
                <View key={`team-${team.id}`} style={styles.card}>
                  <Text style={styles.cardTitle}>{team.hierarchy_path || team.node_name || '-'}</Text>
                  <Text style={styles.cardMeta}>पद: {team.pad || '-'} • अवधि: {team.period || '-'}</Text>
                  <Text style={styles.cardMeta}>
                    {toDateText(team.start_date)} to {toDateText(team.end_date)}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeTab === 'tasks' ? (
          <View style={styles.listWrap}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>Tasks</Text>
              {hasSelectedSubcategory ? (
                <TouchableOpacity style={styles.taskEditBtn} onPress={() => handleOpenTaskCreate()}>
                  <Text style={styles.taskEditBtnText}>Create Task</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {hasSelectedSubcategory ? (
              <Text style={styles.subHeading}>
                चुनी गई श्रेणी के अनुसार फ़िल्टर
              </Text>
            ) : null}
            {tasksByCategory.length === 0 ? (
              <Text style={styles.helper}>चुनी गई श्रेणी/स्थान के लिए कोई कार्य नहीं मिला।</Text>
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
                            👥 {task.assignees.length} असाइनी: {task.assignees.map((a) => a.name).join(', ')}
                          </Text>
                        ) : null}
                        <Text style={styles.cardMeta}>
                          कार्य: {toDateText(task.task_date)} • नियत तिथि: {toDateText(task.due_date)}
                        </Text>
                        <Text style={styles.cardMeta}>
                          जनसंख्या: पुरुष {Number(task.male_count || 0)} • महिला {Number(task.female_count || 0)} • बच्चे {Number(task.children_count || 0)}
                        </Text>
                        {Array.isArray(task.attachments) && task.attachments.length > 0 ? (
                          <View style={{ marginTop: 8, gap: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.text.secondary }}>संलग्नक ({task.attachments.length}):</Text>
                            {task.attachments.map((att, attIdx) => (
                              <View
                                key={`task-${task.id}-att-${attIdx}`}
                                style={styles.attachmentBadge}
                              >
                                <MaterialIcons
                                  name={att.type?.startsWith('image') ? 'image' : att.type?.startsWith('video') ? 'videocam' : 'insert-drive-file'}
                                  size={16}
                                  color={theme.colors.primary}
                                />
                                <Text style={styles.attachmentBadgeText} numberOfLines={1}>
                                  {att.name || att.url.split('/').pop() || 'Attachment'}
                                </Text>
                                <TouchableOpacity style={{ padding: 4 }} onPress={() => Linking.openURL(att.url)}>
                                  <MaterialIcons name="open-in-new" size={18} color={theme.colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity style={{ padding: 4 }} onPress={() => void handleDownloadAttachment(att.url, att.name)}>
                                  <MaterialIcons name="file-download" size={18} color={theme.colors.primary} />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.cardMeta}>संलग्नक: 0</Text>
                        )}
                        {Number(task.created_by) === Number(user?.id) ? (
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                            <TouchableOpacity style={[styles.taskEditBtn, { flex: 1, marginTop: 0 }]} onPress={() => handleOpenTaskEditor(task)}>
                              <Text style={styles.taskEditBtnText}>कार्य अपडेट करें</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.taskEditBtn, { flex: 1, marginTop: 0, borderColor: '#ff4d4f', backgroundColor: '#fff5f5' }]} 
                              onPress={() => handleDeleteTask(task.id)}
                            >
                              <Text style={[styles.taskEditBtnText, { color: '#ff4d4f' }]}>हटाएं</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeTab === 'activities' ? (
          <View style={styles.listWrap}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>गतिविधियाँ</Text>
              {hasSelectedSubcategory ? (
                <TouchableOpacity style={styles.taskEditBtn} onPress={() => handleOpenActivityCreate()}>
                  <Text style={styles.taskEditBtnText}>+ गतिविधि बनाएं</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {hasSelectedSubcategory ? (
              <Text style={styles.subHeading}>चुनी गई श्रेणी के अनुसार फ़िल्टर</Text>
            ) : null}
            {filteredActivities.length === 0 ? (
              <Text style={styles.helper}>अभी तक कोई गतिविधि नहीं मिली।</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {filteredActivities.map((entry) => (
                  <View key={`activity-${entry.id}`} style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitle}>{entry.title}</Text>
                      <Text style={[styles.statusBadge, { color: statusColor(entry.status) }]}>{String(entry.status || 'open')}</Text>
                    </View>
                    <Text style={styles.cardMeta}>{entry.hierarchy_path || entry.node_name || '-'}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
                      {entry.category ? (
                        <View style={{ backgroundColor: theme.colors.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                          <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '700' }}>{entry.category}</Text>
                        </View>
                      ) : null}
                      {entry.subcategory ? (
                        <View style={{ backgroundColor: '#EFEFEF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                          <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontWeight: '700' }}>{entry.subcategory}</Text>
                        </View>
                      ) : null}
                    </View>
                    {entry.description ? (
                      <Text style={styles.cardMeta}>{entry.description}</Text>
                    ) : null}
                    <Text style={styles.cardMeta}>
                      📅 से: {toDateText(entry.from_date)} • तक: {toDateText(entry.to_date)}
                    </Text>
                    <Text style={styles.cardMeta}>
                      जनसंख्या: पुरुष {Number(entry.male_count || 0)} • महिला {Number(entry.female_count || 0)} • बच्चे {Number(entry.children_count || 0)}
                    </Text>
                    {Array.isArray(entry.attachments) && entry.attachments.length > 0 ? (
                      <View style={{ marginTop: 6, gap: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.text.secondary }}>संलग्नक ({entry.attachments.length}):</Text>
                        {entry.attachments.map((att, attIdx) => (
                          <View key={`act-${entry.id}-att-${attIdx}`} style={styles.attachmentBadge}>
                            <MaterialIcons
                              name={att.type?.startsWith('image') ? 'image' : att.type?.startsWith('video') ? 'videocam' : 'insert-drive-file'}
                              size={15}
                              color={theme.colors.primary}
                            />
                            <Text style={styles.attachmentBadgeText} numberOfLines={1}>
                              {att.name || att.url.split('/').pop() || 'Attachment'}
                            </Text>
                            <TouchableOpacity style={{ padding: 4 }} onPress={() => Linking.openURL(att.url)}>
                              <MaterialIcons name="open-in-new" size={16} color={theme.colors.primary} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ fontSize: 10, color: theme.colors.text.disabled }}>
                        {toDateText(entry.created_at)}
                      </Text>
                      {Number(entry.submitted_by) === Number(user?.id) ? (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                          <TouchableOpacity style={[styles.taskEditBtn, { flex: 1, marginTop: 0 }]} onPress={() => handleOpenActivityEditor(entry)}>
                            <Text style={styles.taskEditBtnText}>गतिविधि अपडेट करें</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.taskEditBtn, { flex: 1, marginTop: 0, borderColor: '#ff4d4f', backgroundColor: '#fff5f5' }]} 
                            onPress={() => handleDeleteActivity(entry.id)}
                          >
                            <Text style={[styles.taskEditBtnText, { color: '#ff4d4f' }]}>हटाएं</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <StandardModal
        visible={showActivityModal}
        onClose={() => {
          setShowActivityModal(false);
          setActivityContext(null);
          setEditingActivity(null);
        }}
        title={editingActivity ? 'गतिविधि अपडेट करें' : 'गतिविधि बनाएं'}
        subtitle={activityContext?.subcategory || activityContext?.category || '-'}
        footer={
          <>
            <TouchableOpacity style={[styles.btn, styles.btnLight]} onPress={() => { setShowActivityModal(false); setActivityContext(null); setEditingActivity(null); }}>
              <Text style={styles.btnTextDark}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, savingActivity && styles.btnDisabled]} disabled={savingActivity} onPress={() => void handleSaveActivity()}>
              <Text style={styles.btnText}>{savingActivity ? 'सेव हो रहा है...' : editingActivity ? 'गतिविधि अपडेट करें' : 'गतिविधि सेव करें'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        {activityContext ? (
          <View style={{ backgroundColor: '#FFF9F7', borderRadius: 12, padding: 12, gap: 4, marginBottom: 12, borderWidth: 1, borderColor: '#FCEFE6' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>
              उप-श्रेणी: {activityContext.subcategory || '-'}
            </Text>
            <Text style={styles.cardMeta}>श्रेणी: {activityContext.category || '-'}</Text>
            <Text style={styles.cardMeta}>स्थान: {activityContext.nodeName || activityContext.path || `#${activityContext.nodeId}`}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>गतिविधि शीर्षक *</Text>
        <TextInput
          style={styles.input}
          value={activityForm.title}
          onChangeText={(value) => setActivityForm((prev) => ({ ...prev, title: value }))}
          placeholder="गतिविधि का शीर्षक दर्ज करें"
        />

        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>विवरण</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          value={activityForm.description}
          onChangeText={(value) => setActivityForm((prev) => ({ ...prev, description: value }))}
          placeholder="गतिविधि का विवरण लिखें"
        />

        <View style={[styles.inlineRow, { marginTop: 10 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>प्रारंभ तिथि</Text>
            <TextInput
              style={styles.input}
              value={activityForm.fromDate}
              onChangeText={(value) => setActivityForm((prev) => ({ ...prev, fromDate: value }))}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>समाप्ति तिथि</Text>
            <TextInput
              style={styles.input}
              value={activityForm.toDate}
              onChangeText={(value) => setActivityForm((prev) => ({ ...prev, toDate: value }))}
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>स्थिति</Text>
        <View style={styles.statusRow}>
          {(['open', 'in_progress', 'completed', 'cancelled'] as const).map((status) => {
            const active = activityForm.status === status;
            const labels: Record<string, string> = { open: 'खुला', in_progress: 'प्रगति में', completed: 'पूर्ण', cancelled: 'रद्द' };
            return (
              <TouchableOpacity
                key={`act-status-${status}`}
                style={[styles.statusChip, active && styles.statusChipActive, { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14 }]}
                onPress={() => setActivityForm((prev) => ({ ...prev, status }))}
              >
                <MaterialIcons
                  name={status === 'completed' ? 'check-circle' : status === 'in_progress' ? 'timelapse' : status === 'cancelled' ? 'cancel' : 'radio-button-unchecked'}
                  size={16}
                  color={active ? '#fff' : theme.colors.text.secondary}
                />
                <Text style={[styles.statusChipText, active && styles.statusChipTextActive, { fontSize: 13 }]}>{labels[status]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.inlineRow, { marginTop: 10 }]}
          onPress={() => setActivityForm((prev) => ({ ...prev, includePopulation: !prev.includePopulation }))}
        >
          <MaterialIcons
            name={activityForm.includePopulation ? 'check-box' : 'check-box-outline-blank'}
            size={20}
            color={theme.colors.primary}
          />
          <Text style={styles.sectionTitle}>जनसंख्या</Text>
        </TouchableOpacity>

        {activityForm.includePopulation ? (
          <View style={styles.populationSection}>
            <Text style={styles.populationHint}>यदि संख्या दर्ज नहीं की गई तो 0 माना जाएगा</Text>
            <View style={styles.counterGrid}>
              {[
                { key: 'maleCount', label: 'पुरुष' },
                { key: 'femaleCount', label: 'महिला' },
                { key: 'childrenCount', label: 'बच्चे' },
              ].map((entry) => (
                <View key={`activity-count-${entry.key}`} style={styles.counterCard}>
                  <Text style={styles.counterLabel}>{entry.label}</Text>
                  <View style={styles.counterControls}>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() =>
                        setActivityForm((prev) => {
                          const current = readCountValue((prev as any)[entry.key]);
                          return { ...prev, [entry.key]: String(Math.max(0, current - 1)) } as typeof prev;
                        })
                      }
                    >
                      <Text style={styles.counterBtnText}>−</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.counterInput}
                      keyboardType="number-pad"
                      placeholder="0"
                      value={(activityForm as any)[entry.key]}
                      onChangeText={(value) =>
                        setActivityForm((prev) => ({ ...prev, [entry.key]: sanitizeCountInput(value) }) as typeof prev)
                      }
                      onBlur={() =>
                        setActivityForm((prev) => ({
                          ...prev,
                          [entry.key]: String(readCountValue((prev as any)[entry.key])),
                        }) as typeof prev)
                      }
                    />
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() =>
                        setActivityForm((prev) => {
                          const current = readCountValue((prev as any)[entry.key]);
                          return { ...prev, [entry.key]: String(current + 1) } as typeof prev;
                        })
                      }
                    >
                      <Text style={styles.counterBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>दस्तावेज़ / फोटो अपलोड करें</Text>
        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, styles.inputFlex]}
            placeholder="संलग्नक URL पेस्ट करें"
            value={activityForm.attachmentInput}
            onChangeText={(value) => setActivityForm((prev) => ({ ...prev, attachmentInput: value }))}
          />
          <TouchableOpacity style={styles.inlineBtn} onPress={handleAddActivityAttachmentLink}>
            <Text style={styles.inlineBtnText}>जोड़ें</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.inlineBtn, styles.uploadBtn, activityUploadingAttachment && styles.btnDisabled, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }]}
          disabled={activityUploadingAttachment}
          onPress={() => void handleUploadActivityAttachment()}
        >
          <MaterialIcons name="cloud-upload" size={18} color="#fff" />
          <Text style={styles.inlineBtnText}>{activityUploadingAttachment ? 'अपलोड हो रहा है...' : 'डिवाइस से फाइल अपलोड करें'}</Text>
        </TouchableOpacity>

        <View style={styles.attachmentList}>
          {activityForm.attachments.length === 0 ? (
            <Text style={styles.attachmentEmpty}>कोई फाइल संलग्न नहीं</Text>
          ) : (
            activityForm.attachments.map((entry, idx) => (
              <View key={`activity-attachment-${idx}`} style={styles.attachmentRow}>
                <MaterialIcons
                  name={entry.type?.startsWith('image') ? 'image' : entry.type?.startsWith('video') ? 'videocam' : 'insert-drive-file'}
                  size={18}
                  color={theme.colors.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {entry.name || entry.url.split('/').pop() || 'attachment'}
                  </Text>
                  {entry.type ? (
                    <Text style={styles.attachmentType}>{entry.type}</Text>
                  ) : null}
                </View>
                <MaterialIcons name="check-circle" size={16} color="#16a34a" />
                <TouchableOpacity
                  onPress={() => setActivityForm((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}
                  style={{ padding: 4 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={18} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </StandardModal>

      <StandardModal
        visible={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskContext(null);
          setEditingTask(null);
        }}
        title={editingTask ? 'Edit Task' : 'Create Task'}
        subtitle={taskContext?.subcategory || taskContext?.category || editingTask?.title || '-'}
        footer={
          <>
            <TouchableOpacity
              style={[styles.btn, styles.btnLight]}
              onPress={() => {
                setShowTaskModal(false);
                setTaskContext(null);
                setEditingTask(null);
              }}
            >
              <Text style={styles.btnTextDark}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, savingTask && styles.btnDisabled]} disabled={savingTask} onPress={() => void handleSaveTask()}>
              <Text style={styles.btnText}>{savingTask ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        {taskContext ? (
          <View style={{ backgroundColor: '#FFF9F7', borderRadius: 16, padding: 12, gap: 4, marginBottom: 12, borderWidth: 1, borderColor: '#FCEFE6' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>
              Subcategory: {taskContext.subcategory || '-'}
            </Text>
            <Text style={styles.cardMeta}>Category: {taskContext.category || '-'}</Text>
            <Text style={styles.cardMeta}>Node Name: {taskContext.nodeName || taskContext.path || `#${taskContext.nodeId}`}</Text>
            <Text style={styles.cardMeta}>Level: {taskContext.nodeLevel || '-'}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Task Title</Text>
        <TextInput
          style={styles.input}
          value={taskForm.title}
          onChangeText={(value) => setTaskForm((prev) => ({ ...prev, title: value }))}
          placeholder="Enter task title"
        />

        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          value={taskForm.description}
          onChangeText={(value) => setTaskForm((prev) => ({ ...prev, description: value }))}
          placeholder="Enter task description"
        />

        <View style={[styles.inlineRow, { marginTop: 10 }]}>
          <TextInput
            style={[styles.input, styles.inputFlex]}
            value={taskForm.taskDate}
            onChangeText={(value) => setTaskForm((prev) => ({ ...prev, taskDate: value }))}
            placeholder="Task Date (YYYY-MM-DD)"
          />
          <TextInput
            style={[styles.input, styles.inputFlex]}
            value={taskForm.dueDate}
            onChangeText={(value) => setTaskForm((prev) => ({ ...prev, dueDate: value }))}
            placeholder="Due Date (YYYY-MM-DD)"
          />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Status</Text>
        <View style={styles.statusRow}>
          {TASK_STATUS_OPTIONS.map((status) => {
            const active = taskForm.status === status;
            return (
              <TouchableOpacity
                key={`status-${status}`}
                style={[styles.statusChip, active && styles.statusChipActive, { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14 }]}
                onPress={() => setTaskForm((prev) => ({ ...prev, status }))}
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

        <TouchableOpacity
          style={[styles.inlineRow, { marginTop: 10 }]}
          onPress={() => setTaskForm((prev) => ({ ...prev, includePopulation: !prev.includePopulation }))}
        >
          <MaterialIcons
            name={taskForm.includePopulation ? 'check-box' : 'check-box-outline-blank'}
            size={20}
            color={theme.colors.primary}
          />
          <Text style={styles.sectionTitle}>जनसंख्या (add-on)</Text>
        </TouchableOpacity>

        {taskForm.includePopulation ? (
          <View style={styles.populationSection}>
            <Text style={styles.populationHint}>यदि संख्या दर्ज नहीं की गई तो 0 माना जाएगा</Text>
            <View style={styles.counterGrid}>
              {[
                { key: 'maleCount', label: 'पुरुष' },
                { key: 'femaleCount', label: 'महिला' },
                { key: 'childrenCount', label: 'बच्चे' },
              ].map((entry) => (
                <View key={`task-count-${entry.key}`} style={styles.counterCard}>
                  <Text style={styles.counterLabel}>{entry.label}</Text>
                  <View style={styles.counterControls}>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() =>
                        setTaskForm((prev) => {
                          const current = readCountValue((prev as any)[entry.key]);
                          return { ...prev, [entry.key]: String(Math.max(0, current - 1)) };
                        })
                      }
                    >
                      <Text style={styles.counterBtnText}>−</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.counterInput}
                      keyboardType="number-pad"
                      placeholder="0"
                      value={(taskForm as any)[entry.key]}
                      onChangeText={(value) =>
                        setTaskForm((prev) => ({ ...prev, [entry.key]: sanitizeCountInput(value) }))
                      }
                      onBlur={() =>
                        setTaskForm((prev) => ({
                          ...prev,
                          [entry.key]: String(readCountValue((prev as any)[entry.key])),
                        }))
                      }
                    />
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() =>
                        setTaskForm((prev) => {
                          const current = readCountValue((prev as any)[entry.key]);
                          return { ...prev, [entry.key]: String(current + 1) };
                        })
                      }
                    >
                      <Text style={styles.counterBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Upload Documents</Text>
        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, styles.inputFlex]}
            placeholder="Paste attachment URL (https://...)"
            value={taskForm.attachmentInput}
            onChangeText={(value) => setTaskForm((prev) => ({ ...prev, attachmentInput: value }))}
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
          {taskForm.attachments.length === 0 ? (
            <Text style={styles.attachmentEmpty}>No files attached yet</Text>
          ) : (
            taskForm.attachments.map((entry, idx) => (
              <View key={`task-attachment-${idx}`} style={styles.attachmentRow}>
                <MaterialIcons
                  name={entry.type?.startsWith('image') ? 'image' : entry.type?.startsWith('video') ? 'videocam' : 'insert-drive-file'}
                  size={18}
                  color={theme.colors.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {entry.name || entry.url.split('/').pop() || 'attachment'}
                  </Text>
                  {entry.type ? (
                    <Text style={styles.attachmentType}>{entry.type}</Text>
                  ) : null}
                </View>
                <MaterialIcons name="check-circle" size={16} color="#16a34a" />
                <TouchableOpacity
                  onPress={() =>
                    setTaskForm((prev) => ({
                      ...prev,
                      attachments: prev.attachments.filter((_, i) => i !== idx),
                    }))
                  }
                  style={{ padding: 4 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={18} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
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
  colNode: {
    width: 240,
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
  populationSection: {
    marginTop: 4,
    gap: 6,
  },
  populationHint: {
    fontSize: 10,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  counterGrid: {
    gap: 6,
  },
  counterCard: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  counterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counterBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primary,
    lineHeight: 16,
  },
  counterInput: {
    flex: 1,
    height: 34,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
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
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
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
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  attachmentType: {
    fontSize: 10,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  attachmentEmpty: {
    fontSize: 12,
    color: theme.colors.text.disabled,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  attachmentBadgeText: {
    fontSize: 12,
    color: theme.colors.text.primary,
    fontWeight: '600',
    flex: 1,
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
