import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBottomNav } from '../../core/components/AppBottomNav';
import { ProfileMenu } from '../../core/components/ProfileMenu';
import { useProfile } from '../../core/context/ProfileContext';
import { karyakariniClient } from '../../api/client';
import { theme } from '../../theme';
import type {
  KaryakariniInvitation,
  KaryakariniMyTeam,
  KaryakariniSentInvitationSummary,
  KaryakariniTask,
  KaryakariniVersion,
} from '../../services/karyakarini-module/types';

type MemberTab = 'myteams' | 'messages' | 'tasks';
type MessageTab = 'received' | 'sent';

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

    const [teamsRes, invitationRes, sentRes, taskRes] = await Promise.all([
      karyakariniClient.get('/karyakarini/my/teams', { params: { versionId: selectedVersionId } }),
      karyakariniClient.get('/karyakarini/my/invitations', { params: { versionId: selectedVersionId, limit: 100 } }),
      karyakariniClient.get('/karyakarini/my/invitations/sent-summary', { params: { versionId: selectedVersionId, limit: 100 } }),
      karyakariniClient.get('/karyakarini/my/tasks', { params: { versionId: selectedVersionId, limit: 100 } }),
    ]);

    setTeams((teamsRes?.data?.data?.teams || []) as KaryakariniMyTeam[]);
    setInvitations((invitationRes?.data?.data?.invitations || []) as KaryakariniInvitation[]);
    setSentSummaries((sentRes?.data?.data?.sent || []) as KaryakariniSentInvitationSummary[]);
    setTasks((taskRes?.data?.data?.tasks || []) as KaryakariniTask[]);
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
    void karyakariniClient.post('/karyakarini/my/invitations/read', {
      invitationIds: unreadIds,
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

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/auth/login' as any);
    } catch {
      Alert.alert('Error', 'Failed to logout');
    }
  }, [logout]);

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => String(invitation.invitation_status || '').toLowerCase() === 'pending').length,
    [invitations]
  );

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
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.headerLogo} resizeMode="contain" />
          <Text style={styles.headerBrand}>Emeelan</Text>
        </View>
        {user ? <ProfileMenu user={user as any} onLogout={handleLogout} /> : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
      >
        <Text style={styles.heading}>Karyakarini Member</Text>
        <Text style={styles.subHeading}>Version #{versionId || '-'}</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
            <Text style={[styles.tabSwitchText, activeTab === 'tasks' && styles.tabSwitchTextActive]}>Tasks</Text>
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
            {tasks.length === 0 ? (
              <Text style={styles.helper}>No tasks assigned in your team scope.</Text>
            ) : (
              tasks.map((task) => (
                <View key={`task-${task.id}`} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{task.title}</Text>
                    <Text style={[styles.statusBadge, { color: statusColor(task.status) }]}>{String(task.status || 'open')}</Text>
                  </View>
                  <Text style={styles.cardMeta}>{task.hierarchy_path || task.node_name || '-'}</Text>
                  <Text style={styles.cardMeta}>
                    Task: {toDateText(task.task_date)} • Due: {toDateText(task.due_date)}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      <AppBottomNav activeKey="home" userRole={(user as any)?.role || null} />
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
});
