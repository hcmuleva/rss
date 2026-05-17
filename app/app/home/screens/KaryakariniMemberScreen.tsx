import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
  KaryakariniMember,
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

type TeamNodeGroup = {
  nodeId: number;
  nodeName: string;
  nodeLevel: string;
  path: string;
  assignments: KaryakariniMyTeam[];
  members: KaryakariniMember[];
};

const HINDI_NO_DATA = 'कोई डेटा नहीं';
const isEmptyData = (value?: string | number | null) => {
  if (value === null || value === undefined) return true;
  const normalized = String(value).trim().toLowerCase();
  return !normalized || normalized === 'null' || normalized === 'undefined' || normalized === 'nan';
};
const displayText = (value?: string | number | null, fallback = HINDI_NO_DATA) => {
  if (isEmptyData(value)) return fallback;
  return String(value).trim();
};

const toDateTimeInput = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = raw ? new Date(raw) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}-${pad(safe.getDate())}`;
};

const toDateTimeText = (value?: string | null) => {
  if (isEmptyData(value)) return HINDI_NO_DATA;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-');
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return displayText(value);
  return parsed.toLocaleDateString('hi-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const statusColor = (status?: string | null) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'accepted') return '#15803d';
  if (normalized === 'rejected') return '#b91c1c';
  if (normalized === 'tentative') return '#b45309';
  return '#1d4ed8';
};

const formatStatusLabel = (status?: string | null) => {
  const normalized = String(status || '').toLowerCase();
  const labels: Record<string, string> = {
    open: 'खुला',
    in_progress: 'प्रगति में',
    completed: 'पूर्ण',
    blocked: 'रुका हुआ',
    cancelled: 'रद्द',
    accepted: 'स्वीकृत',
    rejected: 'अस्वीकृत',
    tentative: 'विचाराधीन',
  };
  return labels[normalized] || normalized || HINDI_NO_DATA;
};

const formatDisplayLabel = (value?: string | null) => {
  const raw = displayText(value, '');
  const normalized = raw.toLowerCase();
  if (!raw) return HINDI_NO_DATA;
  if (normalized === 'general') return 'सामान्य';
  if (normalized === 'category') return 'श्रेणी';
  if (normalized === 'task assignee') return 'कार्य असाइनी';
  if (normalized === 'activity submitter') return 'गतिविधि प्रस्तुतकर्ता';
  if (normalized === 'member') return 'सदस्य';
  if (normalized === 'attachment') return 'संलग्नक';
  return raw;
};

const formatNodeLevelLabel = (value?: string | null) => {
  const raw = displayText(value, '');
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  const labels: Record<string, string> = {
    rashtriya: 'राष्ट्रीय',
    prant: 'प्रांत',
    sambhag: 'संभाग',
    vibhag: 'विभाग',
    jila: 'जिला',
    khand: 'खंड',
    mandal_basti: 'मंडल बस्ती',
    nagar_mohalla: 'नगर मोहल्ला',
  };
  if (!raw) return HINDI_NO_DATA;
  return labels[normalized] || raw;
};

const memberName = (member: KaryakariniMember) =>
  [member.first_name, member.father_name].filter(Boolean).join(' ').trim() || `सदस्य #${member.id}`;

const parseLabelList = (value?: string | string[] | null) => {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((entry) => displayText(entry as string, ''))
          .filter((entry) => !isEmptyData(entry))
      ),
    ];
  }
  const raw = displayText(value, '');
  if (!raw) return [] as string[];
  return [
    ...new Set(
      raw
        .split(',')
        .map((entry) => displayText(entry, ''))
        .filter((entry) => !isEmptyData(entry))
    ),
  ];
};

const normalizePath = (p?: string | null) => {
  return String(p || '').split('>').map((part) => part.trim().toLowerCase()).filter(Boolean).join(' > ');
};
const getInitials = (name?: string | null) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'NA';
  return `${words[0]?.[0] || ''}${words[1]?.[0] || ''}`.toUpperCase();
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
  const currentUserName = useMemo(() => {
    const fullName = String((user as any)?.name || '').trim();
    if (!isEmptyData(fullName)) return fullName;
    return [String((user as any)?.firstName || (user as any)?.first_name || '').trim(), String((user as any)?.fatherName || (user as any)?.father_name || '').trim()]
      .filter(Boolean)
      .join(' ')
      .trim();
  }, [user]);
  const currentUserAvatar = useMemo(() => {
    const candidates = [
      (user as any)?.profilePhotoUrl,
      (user as any)?.profile_photo_url,
      (user as any)?.profilePhoto,
      (user as any)?.avatar,
      (user as any)?.photo_url,
      (user as any)?.photo,
      (user as any)?.image,
    ];
    const found = candidates.map((value) => String(value || '').trim()).find((value) => !isEmptyData(value));
    return found || '';
  }, [user]);
  const isAdmin = useMemo(() => {
    return ['admin', 'superadmin', 'templeadmin'].includes(String(user?.role || '').toLowerCase());
  }, [user]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MemberTab>('tasks');
  const [versionId, setVersionId] = useState<number | null>(null);
  const [teams, setTeams] = useState<KaryakariniMyTeam[]>([]);
  const [invitations, setInvitations] = useState<KaryakariniInvitation[]>([]);
  const [teamMembersByNode, setTeamMembersByNode] = useState<Record<number, KaryakariniMember[]>>({});
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [teamLevelFilter, setTeamLevelFilter] = useState<'all' | string>('all');
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
    fromDate: toDateTimeInput(),
    toDate: toDateTimeInput(),
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
    taskDate: toDateTimeInput(),
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
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'task' | 'activity'; id: number; title: string } | null>(null);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [dateTimePickerVisible, setDateTimePickerVisible] = useState(false);
  const [dateTimePickerTarget, setDateTimePickerTarget] = useState<'taskDate' | 'dueDate' | 'fromDate' | 'toDate' | null>(null);
  const [dateTimePickerValue, setDateTimePickerValue] = useState<Date>(new Date());

  const loadAll = useCallback(async () => {
    const versionsRes = await karyakariniClient.get('/karyakarini/versions');
    const versions = (versionsRes?.data?.data?.versions || []) as KaryakariniVersion[];
    const selectedVersion = versions.find((v) => v.is_current) || versions[0] || null;
    const selectedVersionId = selectedVersion?.id || null;
    setVersionId(selectedVersionId);
    if (!selectedVersionId) {
      setTeams([]);
      setInvitations([]);
      setTeamMembersByNode({});
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
      setError(err?.response?.data?.message || 'कार्यकारिणी डेटा लोड करने में विफल');
    }
  }, [loadAll]);

  const loadTeamMembersByNodes = useCallback(
    async (targetVersionId: number | null, teamRows: KaryakariniMyTeam[]) => {
      if (!targetVersionId || teamRows.length === 0) {
        setTeamMembersByNode({});
        setTeamMembersLoading(false);
        return;
      }

      const nodeIds = [...new Set(teamRows.map((row) => Number(row.node_id || 0)).filter((id) => id > 0))];
      if (!nodeIds.length) {
        setTeamMembersByNode({});
        setTeamMembersLoading(false);
        return;
      }

      try {
        setTeamMembersLoading(true);
        const responses = await Promise.all(
          nodeIds.map(async (nodeId) => {
            try {
              const response = await karyakariniClient.get('/karyakarini/members', {
                params: {
                  nodeId,
                  versionId: targetVersionId,
                  page: 1,
                  limit: 300,
                },
              });
              return {
                nodeId,
                members: (response?.data?.data?.members || []) as KaryakariniMember[],
              };
            } catch {
              return {
                nodeId,
                members: [] as KaryakariniMember[],
              };
            }
          })
        );

        const nextMap: Record<number, KaryakariniMember[]> = {};
        responses.forEach(({ nodeId, members }) => {
          const memberMap = new Map<number, KaryakariniMember>();
          members.forEach((member) => {
            memberMap.set(Number(member.id), member);
          });
          nextMap[nodeId] = Array.from(memberMap.values());
        });
        setTeamMembersByNode(nextMap);
      } finally {
        setTeamMembersLoading(false);
      }
    },
    []
  );

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

  useEffect(() => {
    void loadTeamMembersByNodes(versionId, teams);
  }, [loadTeamMembersByNodes, teams, versionId]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const handleViewAttachment = useCallback((url?: string | null) => {
    const safeUrl = String(url || '').trim();
    if (!safeUrl) return;
    Linking.openURL(safeUrl).catch(() => {
      Alert.alert('त्रुटि', 'फाइल खोलने में समस्या हुई');
    });
  }, []);

  const handleDownloadAttachment = useCallback(async (url?: string | null, fileName?: string | null) => {
    const safeUrl = String(url || '').trim();
    if (!safeUrl) return;
    const safeFileName = String(fileName || safeUrl.split('/').pop() || 'attachment')
      .replace(/[^a-zA-Z0-9.\-_]/g, '_');
    try {
      if (Platform.OS === 'web') {
        const anchor = document.createElement('a');
        anchor.href = safeUrl;
        anchor.download = safeFileName;
        anchor.target = '_blank';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        return;
      }
      const targetPath = `${(FileSystem as any).documentDirectory}${safeFileName}`;
      const result = await (FileSystem as any).downloadAsync(safeUrl, targetPath);
      if (result?.status === 200) {
        Alert.alert('सफल', `फाइल डाउनलोड हुई: ${result.uri}`);
      } else {
        Alert.alert('त्रुटि', 'डाउनलोड नहीं हो पाया');
      }
    } catch {
      Alert.alert('त्रुटि', 'डाउनलोड नहीं हो पाया');
    }
  }, []);

  const applyPickedDateTime = useCallback((target: 'taskDate' | 'dueDate' | 'fromDate' | 'toDate', date: Date) => {
    const nextValue = toDateTimeInput(date.toISOString());
    if (target === 'taskDate' || target === 'dueDate') {
      setTaskForm((prev) => ({ ...prev, [target]: nextValue }));
      return;
    }
    if (target === 'fromDate' || target === 'toDate') {
      setActivityForm((prev) => ({ ...prev, [target]: nextValue }));
    }
  }, []);

  const openDateTimePicker = useCallback((target: 'taskDate' | 'dueDate' | 'fromDate' | 'toDate', currentValue?: string | null) => {
    const initialDate = currentValue ? new Date(currentValue) : new Date();
    setDateTimePickerTarget(target);
    setDateTimePickerValue(Number.isNaN(initialDate.getTime()) ? new Date() : initialDate);
    setDateTimePickerVisible(true);
  }, []);

  const handleDateTimePickerChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    const target = dateTimePickerTarget;
    if (!target) {
      setDateTimePickerVisible(false);
      return;
    }
    if (event.type === 'dismissed') {
      setDateTimePickerVisible(false);
      setDateTimePickerTarget(null);
      return;
    }
    if (!selectedDate) return;
    applyPickedDateTime(target, selectedDate);
    setDateTimePickerVisible(false);
    setDateTimePickerTarget(null);
  }, [applyPickedDateTime, dateTimePickerTarget]);

  const handleOpenTaskEditor = useCallback((task: KaryakariniTask) => {
    const nextContext: AssignmentCard = {
      key: `task-context-${task.id}`,
      nodeId: Number(task.node_id || 0),
      path: String(task.hierarchy_path || task.node_name || '').trim() || HINDI_NO_DATA,
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
      taskDate: task.task_date || toDateTimeInput(),
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
      Alert.alert('चयन आवश्यक', 'कार्य बनाने के लिए कृपया केवल एक उप-श्रेणी कार्ड चुनें।');
      return;
    }
    const [nodeIdPart, categoryPart, subcategoryPart] = String(selectedCategoryKey).split('###');
    const nodeId = Number(nodeIdPart || 0);
    const category = String(categoryPart || '').trim();
    const subcategory = String(subcategoryPart || '').trim();
    if (!nodeId || !subcategory) {
      Alert.alert('चयन आवश्यक', 'कार्य बनाने के लिए कृपया एक उप-श्रेणी कार्ड चुनें।');
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
      taskDate: toDateTimeInput(),
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
        Alert.alert('त्रुटि', 'संलग्नक अपलोड करने में विफल');
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
      Alert.alert('त्रुटि', err?.response?.data?.message || 'संलग्नक अपलोड करने में विफल');
    } finally {
      setTaskUploadingAttachment(false);
    }
  }, []);

  const handleSaveTask = useCallback(async () => {
    if (!versionId || !taskContext) return;
    if (!taskForm.title.trim()) {
      Alert.alert('आवश्यक', 'कार्य शीर्षक आवश्यक है');
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
        taskDate: toDateTimeInput(),
        dueDate: '',
        status: 'open',
        includePopulation: false,
        maleCount: '0',
        femaleCount: '0',
        childrenCount: '0',
        attachmentInput: '',
        attachments: [],
      });
      Alert.alert('सफल', editingTask?.id ? 'कार्य सफलतापूर्वक अपडेट हुआ' : 'कार्य सफलतापूर्वक बनाया गया');
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || `कार्य ${editingTask?.id ? 'अपडेट' : 'बनाने'} में विफल`);
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
      Alert.alert('त्रुटि', err?.response?.data?.message || 'संलग्नक अपलोड करने में विफल');
    } finally {
      setActivityUploadingAttachment(false);
    }
  }, []);

  const handleSaveActivity = useCallback(async () => {
    if (!versionId || !activityContext) return;
    if (!activityForm.title.trim()) {
      Alert.alert('आवश्यक', 'गतिविधि शीर्षक आवश्यक है');
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
        fromDate: toDateTimeInput(),
        toDate: toDateTimeInput(),
        status: 'open',
        includePopulation: false,
        maleCount: '0',
        femaleCount: '0',
        childrenCount: '0',
        attachmentInput: '',
        attachments: [],
      });
      await loadData();
      Alert.alert('सफल', editingActivity?.id ? 'गतिविधि सफलतापूर्वक अपडेट हुई' : 'गतिविधि सफलतापूर्वक जमा हुई');
    } catch (err: any) {
      Alert.alert('त्रुटि', err?.response?.data?.message || `गतिविधि ${editingActivity?.id ? 'अपडेट' : 'जमा'} करने में विफल`);
    } finally {
      setSavingActivity(false);
    }
  }, [activityForm, activityContext, loadData, versionId, editingActivity?.id]);

  const handleOpenDeleteTaskConfirm = useCallback((taskId: number, title?: string | null) => {
    setDeleteTarget({
      type: 'task',
      id: Number(taskId),
      title: String(title || '').trim() || 'कार्य',
    });
  }, []);

  const handleOpenDeleteActivityConfirm = useCallback((activityId: number, title?: string | null) => {
    setDeleteTarget({
      type: 'activity',
      id: Number(activityId),
      title: String(title || '').trim() || 'गतिविधि',
    });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget || deletingEntry) return;
    try {
      setDeletingEntry(true);
      if (deleteTarget.type === 'task') {
        await karyakariniClient.delete(`/karyakarini/tasks/${deleteTarget.id}`);
        Alert.alert('सफल', 'कार्य सफलता से हटा दिया गया है');
      } else {
        await karyakariniClient.delete(`/karyakarini/my/category-activities/${deleteTarget.id}`);
        Alert.alert('सफल', 'गतिविधि सफलता से हटा दी गई है');
      }
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      Alert.alert(
        'त्रुटि',
        err?.response?.data?.message || (deleteTarget.type === 'task' ? 'कार्य हटाने में विफल' : 'गतिविधि हटाने में विफल')
      );
    } finally {
      setDeletingEntry(false);
    }
  }, [deleteTarget, deletingEntry, loadData]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/auth/login' as any);
    } catch {
      Alert.alert('त्रुटि', 'लॉगआउट करने में विफल');
    }
  }, [logout]);

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
        path: existing?.path || path || `नोड #${nodeId}`,
        nodeName: existing?.nodeName || nodeName || undefined,
        nodeLevel: existing?.nodeLevel || nodeLevel || undefined,
        category,
        subcategory,
        pad: existing?.pad || pad || 'सदस्य',
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
          const cat = derivedCategories[0] || 'श्रेणी';
          addOrUpdate(nodeId, path, nodeName, nodeLevel, cat, sub, pad, ts, true, 'team');
        });
      }
    });

    return Array.from(map.values())
      .filter((c) => c.count > 0)
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [teams]);

  const teamNodeGroups = useMemo<TeamNodeGroup[]>(() => {
    const byNode = new Map<number, TeamNodeGroup>();
    teams.forEach((team) => {
      const nodeId = Number(team.node_id || 0);
      if (nodeId <= 0) return;
      const existing = byNode.get(nodeId);
      if (existing) {
        existing.assignments.push(team);
        return;
      }
      byNode.set(nodeId, {
        nodeId,
        nodeName: String(team.node_name || '').trim(),
        nodeLevel: String(team.node_level || '').trim(),
        path: String(team.hierarchy_path || team.node_name || '').trim(),
        assignments: [team],
        members: teamMembersByNode[nodeId] || [],
      });
    });

    return Array.from(byNode.values())
      .map((entry) => ({
        ...entry,
        members: teamMembersByNode[entry.nodeId] || [],
      }))
      .sort((a, b) => String(a.path || a.nodeName || '').localeCompare(String(b.path || b.nodeName || '')));
  }, [teamMembersByNode, teams]);

  const teamLevelOptions = useMemo(() => {
    const map = new Map<string, string>();
    teamNodeGroups.forEach((group) => {
      const value = String(group.nodeLevel || '').trim().toLowerCase();
      if (!value) return;
      if (!map.has(value)) {
        map.set(value, formatNodeLevelLabel(group.nodeLevel));
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [teamNodeGroups]);

  const filteredTeamNodeGroups = useMemo(() => {
    if (teamLevelFilter === 'all') return teamNodeGroups;
    return teamNodeGroups.filter((entry) => String(entry.nodeLevel || '').trim().toLowerCase() === teamLevelFilter);
  }, [teamLevelFilter, teamNodeGroups]);

  const subcategoryCards = useMemo(
    () =>
      assignmentCards.filter(
        (entry) => entry.source !== 'invitation' && String(entry.subcategory || '').trim().length > 0
      ),
    [assignmentCards]
  );

  useEffect(() => {
    if (teamLevelFilter === 'all') return;
    if (!teamLevelOptions.some((entry) => entry.value === teamLevelFilter)) {
      setTeamLevelFilter('all');
    }
  }, [teamLevelFilter, teamLevelOptions]);

  const hasSelectedSubcategory = useMemo(() => {
    if (selectedCategoryKey === 'all' || !selectedCategoryKey) return false;
    return subcategoryCards.some((entry) => entry.key === selectedCategoryKey);
  }, [selectedCategoryKey, subcategoryCards]);

  const handleOpenActivityCreate = useCallback(() => {
    if (!hasSelectedSubcategory) {
      Alert.alert('आवश्यक', 'कृपया पहले उप-श्रेणी चुनें');
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
      fromDate: toDateTimeInput(),
      toDate: toDateTimeInput(),
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
      path: String(activity.hierarchy_path || activity.node_name || '').trim() || HINDI_NO_DATA,
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
      fromDate: activity.from_date || toDateTimeInput(),
      toDate: activity.to_date || toDateTimeInput(),
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
        name: row.assigned_first_name || `उपयोगकर्ता #${row.assigned_user_id}`,
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
      const actRawPath = String(activity.hierarchy_path || '').trim().toLowerCase();
      const selRawPath = String(selectedAssignment.path || '').trim().toLowerCase();
      const pathMatch =
        (Boolean(selPath) && Boolean(actPath) && (actPath === selPath || actPath.startsWith(selPath + ' > '))) ||
        (Boolean(selRawPath) &&
          Boolean(actRawPath) &&
          (actRawPath === selRawPath ||
            actRawPath.startsWith(selRawPath + ' > ') ||
            actRawPath.startsWith(selRawPath + '/') ||
            actRawPath.startsWith(selRawPath + ' / ')));
      const nodeMatch =
        Number(activity.node_id || 0) === Number(selectedAssignment.nodeId || 0) ||
        pathMatch;

      const activitySubcategories = parseLabelList((activity as any)?.subcategories?.length ? (activity as any).subcategories : activity.subcategory || '')
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean);
      const activityCategories = parseLabelList((activity as any)?.categories?.length ? (activity as any).categories : activity.category || '')
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean);

      const selectedSub = String(selectedAssignment.subcategory || '').trim().toLowerCase();
      const selectedCat = String(selectedAssignment.category || '').trim().toLowerCase();
      if (!nodeMatch) return false;
      if (selectedSub) return activitySubcategories.includes(selectedSub);
      if (selectedCat && selectedCat !== 'general') return activityCategories.includes(selectedCat);
      return true;
    });
  }, [activities, assignmentCards, selectedCategoryKey]);

  const renderCreatedBy = (entry: any, fallback?: { name?: string; avatar?: string }) => {
    const nameCandidate = [entry?.created_by_name, entry?.submitted_by_name, fallback?.name]
      .map((value) => String(value || '').trim())
      .find((value) => !isEmptyData(value));
    const avatarCandidate = [
      entry?.created_by_avatar,
      entry?.submitted_by_avatar,
      entry?.createdByAvatar,
      entry?.submittedByAvatar,
      fallback?.avatar,
    ]
      .map((value) => String(value || '').trim())
      .find((value) => !isEmptyData(value));
    const createdByName = displayText(nameCandidate || '', 'अज्ञात');
    const createdByAvatar = avatarCandidate || '';

    return (
      <View style={styles.creatorRow}>
        {createdByAvatar ? (
          <Image source={{ uri: createdByAvatar }} style={styles.creatorAvatar} />
        ) : (
          <View style={[styles.creatorAvatar, styles.creatorAvatarFallback]}>
            <Text style={styles.creatorAvatarFallbackText}>{getInitials(createdByName)}</Text>
          </View>
        )}
        <Text style={styles.creatorName} numberOfLines={1}>
          बनाया: {createdByName}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.helper}>कार्यकारिणी लोड हो रही है...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="कार्यकारिणी सदस्य"
        user={user}
        onLogout={handleLogout}
        notificationCount={notificationUnreadCount}
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
                      {formatDisplayLabel(entry.subcategory || entry.category)}
                    </Text>
                    <Text style={styles.assignmentCardMeta}>{formatDisplayLabel(entry.category)}</Text>
                    <Text style={styles.assignmentCardMeta}>{formatDisplayLabel(entry.pad)}</Text>
                    {entry.lastActivityAt > 0 ? (
                      <Text style={{ fontSize: 10, color: isSelected ? '#fff' : theme.colors.text.disabled, marginTop: 2, fontWeight: '600' }}>
                        सक्रिय: {new Date(entry.lastActivityAt).toLocaleDateString()}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.tabSwitchRow}>
          <TouchableOpacity style={[styles.tabSwitchBtn, activeTab === 'tasks' && styles.tabSwitchBtnActive]} onPress={() => setActiveTab('tasks')}>
            <Text style={[styles.tabSwitchText, activeTab === 'tasks' && styles.tabSwitchTextActive]}>
              कार्य ({filteredTasks.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabSwitchBtn, activeTab === 'myteams' && styles.tabSwitchBtnActive]} onPress={() => setActiveTab('myteams')}>
            <Text style={[styles.tabSwitchText, activeTab === 'myteams' && styles.tabSwitchTextActive]}>
              टीम प्रबंधन ({teams.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabSwitchBtn, activeTab === 'activities' && styles.tabSwitchBtnActive]} onPress={() => setActiveTab('activities')}>
            <Text style={[styles.tabSwitchText, activeTab === 'activities' && styles.tabSwitchTextActive]}>
              कार्यक्रम ({filteredActivities.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'myteams' ? (
          <View style={styles.listWrap}>
            {teamLevelOptions.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelFilterRow}>
                <TouchableOpacity
                  style={[styles.levelFilterChip, teamLevelFilter === 'all' && styles.levelFilterChipActive]}
                  onPress={() => setTeamLevelFilter('all')}
                >
                  <Text style={[styles.levelFilterChipText, teamLevelFilter === 'all' && styles.levelFilterChipTextActive]}>
                    सभी स्तर
                  </Text>
                </TouchableOpacity>
                {teamLevelOptions.map((entry) => (
                  <TouchableOpacity
                    key={`team-level-filter-${entry.value}`}
                    style={[styles.levelFilterChip, teamLevelFilter === entry.value && styles.levelFilterChipActive]}
                    onPress={() => setTeamLevelFilter(entry.value)}
                  >
                    <Text style={[styles.levelFilterChipText, teamLevelFilter === entry.value && styles.levelFilterChipTextActive]}>
                      {entry.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            {teams.length === 0 ? (
              <Text style={styles.helper}>कोई टीम असाइनमेंट नहीं मिला।</Text>
            ) : filteredTeamNodeGroups.length === 0 ? (
              <Text style={styles.helper}>चुने गए स्तर पर कोई टीम असाइनमेंट नहीं मिला।</Text>
            ) : (
              filteredTeamNodeGroups.map((group) => {
                const assignedCategories = Array.from(
                  new Set(
                    group.assignments.flatMap((entry) =>
                      parseLabelList(entry.categories && entry.categories.length ? entry.categories : entry.category || '')
                    )
                  )
                )
                  .map((entry) => formatDisplayLabel(entry))
                  .join(', ') || HINDI_NO_DATA;

                const assignedSubcategories = Array.from(
                  new Set(
                    group.assignments.flatMap((entry) =>
                      parseLabelList(entry.subcategories && entry.subcategories.length ? entry.subcategories : entry.subcategory || '')
                    )
                  )
                )
                  .map((entry) => formatDisplayLabel(entry))
                  .join(', ') || HINDI_NO_DATA;

                return (
                  <View key={`team-group-${group.nodeId}`} style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{displayText(group.path || group.nodeName || `नोड #${group.nodeId}`)}</Text>
                        <Text style={styles.cardMeta}>स्तर: {formatNodeLevelLabel(group.nodeLevel)}</Text>
                        <Text style={styles.cardMeta}>असाइनमेंट: {group.assignments.length}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.taskEditBtn}
                        onPress={() => void loadTeamMembersByNodes(versionId, group.assignments)}
                      >
                        <Text style={styles.taskEditBtnText}>सदस्य रीफ्रेश करें</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.cardMeta}>असाइन श्रेणियाँ: {assignedCategories}</Text>
                    <Text style={styles.cardMeta}>असाइन उप-श्रेणियाँ: {assignedSubcategories}</Text>

                    {teamMembersLoading && group.members.length === 0 ? (
                      <Text style={styles.helper}>सदस्य सूची लोड हो रही है...</Text>
                    ) : group.members.length === 0 ? (
                      <Text style={styles.helper}>इस स्तर पर कोई सदस्य नहीं मिला।</Text>
                    ) : (
                      <View style={styles.tableWrap}>
                        <ScrollView horizontal showsHorizontalScrollIndicator>
                          <View>
                            <View style={styles.tableHeader}>
                              <Text style={[styles.tableHeaderCell, styles.teamColName]}>नाम</Text>
                              <Text style={[styles.tableHeaderCell, styles.teamColLevel]}>स्तर</Text>
                              <Text style={[styles.tableHeaderCell, styles.teamColPad]}>पद</Text>
                              <Text style={[styles.tableHeaderCell, styles.teamColCategory]}>श्रेणी</Text>
                              <Text style={[styles.tableHeaderCell, styles.teamColSubcategory]}>उप-श्रेणी</Text>
                              <Text style={[styles.tableHeaderCell, styles.teamColMobile]}>मोबाइल</Text>
                              <Text style={[styles.tableHeaderCell, styles.teamColGotra]}>गोत्र</Text>
                              <Text style={[styles.tableHeaderCell, styles.teamColVillage]}>गांव</Text>
                              <Text style={[styles.tableHeaderCell, styles.teamColPath]}>पाथ</Text>
                            </View>
                            {group.members.map((member, index) => {
                              const memberCategories = parseLabelList(
                                member.categories && member.categories.length ? member.categories : member.category || ''
                              )
                                .map((entry) => formatDisplayLabel(entry))
                                .join(', ') || HINDI_NO_DATA;
                              const memberSubcategories = parseLabelList(
                                member.subcategories && member.subcategories.length ? member.subcategories : member.subcategory || ''
                              )
                                .map((entry) => formatDisplayLabel(entry))
                                .join(', ') || HINDI_NO_DATA;
                              return (
                                <View key={`team-member-${group.nodeId}-${member.id}-${index}`} style={styles.tableRow}>
                                  <Text style={[styles.tableCell, styles.teamColName]} numberOfLines={2}>
                                    {memberName(member)}
                                  </Text>
                                  <Text style={[styles.tableCell, styles.teamColLevel]} numberOfLines={2}>
                                    {formatNodeLevelLabel(member.node_level)}
                                  </Text>
                                  <Text style={[styles.tableCell, styles.teamColPad]} numberOfLines={2}>
                                    {formatDisplayLabel(member.pad)}
                                  </Text>
                                  <Text style={[styles.tableCell, styles.teamColCategory]} numberOfLines={2}>
                                    {memberCategories}
                                  </Text>
                                  <Text style={[styles.tableCell, styles.teamColSubcategory]} numberOfLines={2}>
                                    {memberSubcategories}
                                  </Text>
                                  <Text style={[styles.tableCell, styles.teamColMobile]} numberOfLines={2}>
                                    {displayText(member.mobile_number)}
                                  </Text>
                                  <Text style={[styles.tableCell, styles.teamColGotra]} numberOfLines={2}>
                                    {displayText(member.gotra)}
                                  </Text>
                                  <Text style={[styles.tableCell, styles.teamColVillage]} numberOfLines={2}>
                                    {displayText(member.village || member.address_village)}
                                  </Text>
                                  <Text style={[styles.tableCell, styles.teamColPath]} numberOfLines={2}>
                                    {displayText(member.hierarchy_path || member.node_name)}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        {activeTab === 'tasks' ? (
          <View style={styles.listWrap}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>कार्य</Text>
              {hasSelectedSubcategory ? (
                <TouchableOpacity style={styles.taskEditBtn} onPress={() => handleOpenTaskCreate()}>
                  <Text style={styles.taskEditBtnText}>कार्य बनाएं</Text>
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
                      {formatDisplayLabel(catName)}
                    </Text>
                    <View style={{ backgroundColor: theme.colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>{catTasks.length}</Text>
                    </View>
                  </View>
                  <View style={{ gap: 12 }}>
                    {catTasks.map((task) => (
                      <View key={`task-${task.id}`} style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                          <Text style={styles.cardTitle}>शीर्षक: {displayText(task.title)}</Text>
                          <Text style={[styles.statusBadge, { color: statusColor(task.status) }]}>{formatStatusLabel(task.status)}</Text>
                        </View>
                        <Text style={styles.cardMeta}>{displayText(task.hierarchy_path || task.node_name)}</Text>
                        {renderCreatedBy(
                          task,
                          Number((task as any).created_by) === Number(user?.id)
                            ? { name: currentUserName, avatar: currentUserAvatar }
                            : undefined
                        )}
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
                        <Text style={styles.cardMeta}>विवरण: {displayText(task.description)}</Text>
                        {task.assignees && task.assignees.length > 0 ? (
                          <Text style={[styles.cardMeta, { color: theme.colors.primary, fontWeight: '600', marginBottom: 4 }]}>
                            👥 {task.assignees.length} असाइनी: {task.assignees.map((a) => a.name).join(', ')}
                          </Text>
                        ) : null}
                        <Text style={styles.cardMeta}>
                          कार्य: {toDateTimeText(task.task_date)} • नियत तिथि: {toDateTimeText(task.due_date)}
                        </Text>
                        <Text style={styles.cardMeta}>
                          जनसंख्या: पुरुष {Number(task.male_count || 0)} • महिला {Number(task.female_count || 0)} • बच्चे {Number(task.children_count || 0)}
                        </Text>
                        {Array.isArray(task.attachments) && task.attachments.length > 0 ? (
                          <View style={{ marginTop: 6, gap: 4 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.text.secondary }}>संलग्नक ({task.attachments.length}):</Text>
                            {task.attachments.map((att, attIdx) => (
                              <View key={`task-${task.id}-att-${attIdx}`} style={styles.attachmentBadge}>
                                <MaterialIcons
                                  name={att.type?.startsWith('image') ? 'image' : att.type?.startsWith('video') ? 'videocam' : 'insert-drive-file'}
                                  size={15}
                                  color={theme.colors.primary}
                                />
                                <Text style={styles.attachmentBadgeText} numberOfLines={1}>
                                  {att.name || att.url.split('/').pop() || 'संलग्नक'}
                                </Text>
                                <TouchableOpacity style={{ padding: 4 }} onPress={() => handleViewAttachment(att.url)}>
                                  <MaterialIcons name="open-in-new" size={16} color={theme.colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity style={{ padding: 4 }} onPress={() => void handleDownloadAttachment(att.url, att.name)}>
                                  <MaterialIcons name="download" size={16} color={theme.colors.primary} />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        ) : null}
                        {Number((task as any).created_by) === Number(user?.id) ? (
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                            <TouchableOpacity style={[styles.taskEditBtn, { flex: 1, marginTop: 0 }]} onPress={() => handleOpenTaskEditor(task)}>
                              <Text style={styles.taskEditBtnText}>कार्य अपडेट करें</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.taskEditBtn, { flex: 1, marginTop: 0, borderColor: '#ff4d4f', backgroundColor: '#fff5f5' }]} 
                            onPress={() => handleOpenDeleteTaskConfirm(task.id, task.title)}
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
                      <Text style={styles.cardTitle}>शीर्षक: {displayText(entry.title)}</Text>
                      <Text style={[styles.statusBadge, { color: statusColor(entry.status) }]}>{formatStatusLabel(entry.status)}</Text>
                    </View>
                    <Text style={styles.cardMeta}>{displayText(entry.hierarchy_path || entry.node_name)}</Text>
                    {renderCreatedBy(
                      entry,
                      Number(entry.submitted_by) === Number(user?.id)
                        ? { name: currentUserName, avatar: currentUserAvatar }
                        : undefined
                    )}
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
                    <Text style={styles.cardMeta}>विवरण: {displayText(entry.description)}</Text>
                    <Text style={styles.cardMeta}>
                      📅 से: {toDateTimeText(entry.from_date)} • तक: {toDateTimeText(entry.to_date)}
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
                              {att.name || att.url.split('/').pop() || 'संलग्नक'}
                            </Text>
                            <TouchableOpacity style={{ padding: 4 }} onPress={() => handleViewAttachment(att.url)}>
                              <MaterialIcons name="open-in-new" size={16} color={theme.colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={{ padding: 4 }} onPress={() => void handleDownloadAttachment(att.url, att.name)}>
                              <MaterialIcons name="download" size={16} color={theme.colors.primary} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {Number(entry.submitted_by) === Number(user?.id) ? (
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                        <TouchableOpacity style={[styles.taskEditBtn, { flex: 1, marginTop: 0 }]} onPress={() => handleOpenActivityEditor(entry)}>
                          <Text style={styles.taskEditBtnText}>गतिविधि अपडेट करें</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.taskEditBtn, { flex: 1, marginTop: 0, borderColor: '#ff4d4f', backgroundColor: '#fff5f5' }]}
                          onPress={() => handleOpenDeleteActivityConfirm(entry.id, entry.title)}
                        >
                          <Text style={[styles.taskEditBtnText, { color: '#ff4d4f' }]}>हटाएं</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {dateTimePickerVisible && dateTimePickerTarget ? (
        <DateTimePicker
          value={dateTimePickerValue}
          mode="date"
          is24Hour
          display="default"
          onChange={handleDateTimePickerChange}
        />
      ) : null}

      <StandardModal
        visible={showActivityModal}
        onClose={() => {
          setShowActivityModal(false);
          setActivityContext(null);
          setEditingActivity(null);
        }}
        title={editingActivity ? 'गतिविधि अपडेट करें' : 'गतिविधि बनाएं'}
        subtitle={activityContext?.subcategory || activityContext?.category || HINDI_NO_DATA}
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
              उप-श्रेणी: {displayText(activityContext.subcategory)}
            </Text>
            <Text style={styles.cardMeta}>श्रेणी: {displayText(activityContext.category)}</Text>
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
            {Platform.OS === 'web' ? (
              <TextInput
                style={styles.input}
                value={activityForm.fromDate}
                onChangeText={(value) => setActivityForm((prev) => ({ ...prev, fromDate: value }))}
                placeholder="वर्ष-माह-दिन"
                {...({ type: 'date' } as any)}
              />
            ) : (
              <TouchableOpacity
                style={styles.input}
                onPress={() => openDateTimePicker('fromDate', activityForm.fromDate)}
                activeOpacity={0.8}
              >
                <Text style={styles.inputText}>{toDateTimeText(activityForm.fromDate)}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>समाप्ति तिथि</Text>
            {Platform.OS === 'web' ? (
              <TextInput
                style={styles.input}
                value={activityForm.toDate}
                onChangeText={(value) => setActivityForm((prev) => ({ ...prev, toDate: value }))}
                placeholder="वर्ष-माह-दिन"
                {...({ type: 'date' } as any)}
              />
            ) : (
              <TouchableOpacity
                style={styles.input}
                onPress={() => openDateTimePicker('toDate', activityForm.toDate)}
                activeOpacity={0.8}
              >
                <Text style={styles.inputText}>{toDateTimeText(activityForm.toDate)}</Text>
              </TouchableOpacity>
            )}
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
                    {entry.name || entry.url.split('/').pop() || 'संलग्नक'}
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
        title={editingTask ? 'कार्य संपादित करें' : 'कार्य बनाएं'}
        subtitle={taskContext?.subcategory || taskContext?.category || editingTask?.title || HINDI_NO_DATA}
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
              <Text style={styles.btnTextDark}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, savingTask && styles.btnDisabled]} disabled={savingTask} onPress={() => void handleSaveTask()}>
              <Text style={styles.btnText}>{savingTask ? 'सेव हो रहा है...' : editingTask ? 'कार्य अपडेट करें' : 'कार्य बनाएं'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        {taskContext ? (
          <View style={{ backgroundColor: '#FFF9F7', borderRadius: 16, padding: 12, gap: 4, marginBottom: 12, borderWidth: 1, borderColor: '#FCEFE6' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>
              उप-श्रेणी: {formatDisplayLabel(taskContext.subcategory)}
            </Text>
            <Text style={styles.cardMeta}>श्रेणी: {formatDisplayLabel(taskContext.category)}</Text>
            <Text style={styles.cardMeta}>नोड नाम: {taskContext.nodeName || taskContext.path || `#${taskContext.nodeId}`}</Text>
            <Text style={styles.cardMeta}>स्तर: {formatNodeLevelLabel(taskContext.nodeLevel)}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>कार्य शीर्षक</Text>
        <TextInput
          style={styles.input}
          value={taskForm.title}
          onChangeText={(value) => setTaskForm((prev) => ({ ...prev, title: value }))}
          placeholder="कार्य शीर्षक दर्ज करें"
        />

        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>विवरण</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          value={taskForm.description}
          onChangeText={(value) => setTaskForm((prev) => ({ ...prev, description: value }))}
          placeholder="कार्य विवरण दर्ज करें"
        />

        <View style={[styles.inlineRow, { marginTop: 10 }]}>
          {Platform.OS === 'web' ? (
            <>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={taskForm.taskDate}
                onChangeText={(value) => setTaskForm((prev) => ({ ...prev, taskDate: value }))}
                placeholder="कार्य तिथि"
                {...({ type: 'date' } as any)}
              />
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={taskForm.dueDate}
                onChangeText={(value) => setTaskForm((prev) => ({ ...prev, dueDate: value }))}
                placeholder="नियत तिथि"
                {...({ type: 'date' } as any)}
              />
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.input, styles.inputFlex]}
                onPress={() => openDateTimePicker('taskDate', taskForm.taskDate)}
                activeOpacity={0.8}
              >
                <Text style={styles.inputText}>{toDateTimeText(taskForm.taskDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, styles.inputFlex]}
                onPress={() => openDateTimePicker('dueDate', taskForm.dueDate)}
                activeOpacity={0.8}
              >
                <Text style={styles.inputText}>{toDateTimeText(taskForm.dueDate)}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>स्थिति</Text>
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
                <Text style={[styles.statusChipText, active && styles.statusChipTextActive, { fontSize: 13 }]}>{formatStatusLabel(status)}</Text>
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
          <Text style={styles.sectionTitle}>जनसंख्या</Text>
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

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>दस्तावेज़ अपलोड करें</Text>
        <TouchableOpacity
          style={[styles.inlineBtn, styles.uploadBtn, taskUploadingAttachment && styles.btnDisabled, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }]}
          disabled={taskUploadingAttachment}
          onPress={() => void handleUploadTaskAttachment()}
        >
          <MaterialIcons name="cloud-upload" size={18} color="#fff" />
          <Text style={styles.inlineBtnText}>{taskUploadingAttachment ? 'अपलोड हो रहा है...' : 'डिवाइस से फाइल अपलोड करें'}</Text>
        </TouchableOpacity>

        <View style={styles.attachmentList}>
          {taskForm.attachments.length === 0 ? (
            <Text style={styles.attachmentEmpty}>अभी तक कोई फाइल संलग्न नहीं है</Text>
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
                    {entry.name || entry.url.split('/').pop() || 'संलग्नक'}
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

      <StandardModal
        visible={Boolean(deleteTarget)}
        onClose={() => {
          if (!deletingEntry) setDeleteTarget(null);
        }}
        title={deleteTarget?.type === 'task' ? 'कार्य हटाएं' : 'गतिविधि हटाएं'}
        subtitle={deleteTarget?.title || HINDI_NO_DATA}
        footer={
          <>
            <TouchableOpacity
              style={[styles.btn, styles.btnLight, deletingEntry && styles.btnDisabled]}
              disabled={deletingEntry}
              onPress={() => setDeleteTarget(null)}
            >
              <Text style={styles.btnTextDark}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, deletingEntry && styles.btnDisabled, { backgroundColor: '#ef4444' }]}
              disabled={deletingEntry}
              onPress={() => void handleConfirmDelete()}
            >
              <Text style={styles.btnText}>{deletingEntry ? 'हटा रहे हैं...' : 'हटाएं'}</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
          <Text style={styles.cardMeta}>
            क्या आप वाकई इस {deleteTarget?.type === 'task' ? 'कार्य' : 'गतिविधि'} को हटाना चाहते हैं?
          </Text>
          <Text style={[styles.cardMeta, { marginTop: 6, color: theme.colors.error }]}>
            यह क्रिया वापस नहीं की जा सकती।
          </Text>
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
  assignmentRow: {
    gap: 8,
  },
  levelFilterRow: {
    gap: 8,
    paddingBottom: 2,
  },
  levelFilterChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  levelFilterChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  levelFilterChipText: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  levelFilterChipTextActive: {
    color: theme.colors.primary,
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
  teamColName: {
    width: 180,
  },
  teamColLevel: {
    width: 120,
  },
  teamColPad: {
    width: 130,
  },
  teamColCategory: {
    width: 170,
  },
  teamColSubcategory: {
    width: 180,
  },
  teamColMobile: {
    width: 130,
  },
  teamColGotra: {
    width: 120,
  },
  teamColVillage: {
    width: 140,
  },
  teamColPath: {
    width: 260,
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
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  creatorAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primarySoft,
  },
  creatorAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarFallbackText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  creatorName: {
    flex: 1,
    color: theme.colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
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
  inputText: {
    color: theme.colors.text.primary,
    fontSize: 13,
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
