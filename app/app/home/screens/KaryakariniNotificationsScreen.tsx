import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { karyakariniClient } from '../../api/client';
import { AppBottomNav } from '../../core/components/AppBottomNav';
import { ScreenHeader } from '../../core/components/ScreenHeader';
import { useProfile } from '../../core/context/ProfileContext';
import { theme } from '../../theme';
import type { KaryakariniNotificationItem, KaryakariniVersion } from '../../services/karyakarini-module/types';

type NotificationCategory = 'all' | 'tasks' | 'invitations';

const toDateText = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString().slice(0, 10);
};

const statusColor = (status?: string | null) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed' || normalized === 'accepted') return '#15803d';
  if (normalized === 'rejected' || normalized === 'cancelled') return '#b91c1c';
  if (normalized === 'tentative' || normalized === 'blocked') return '#b45309';
  return '#1d4ed8';
};

export default function KaryakariniNotificationsScreen() {
  const { user, logout } = useProfile();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<KaryakariniNotificationItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadData = useCallback(async (category: NotificationCategory, unreadOnly: boolean) => {
    const versionsRes = await karyakariniClient.get('/karyakarini/versions');
    const versions = (versionsRes?.data?.data?.versions || []) as KaryakariniVersion[];
    const selectedVersion = versions.find((entry) => entry.is_current) || versions[0] || null;
    const selectedVersionId = selectedVersion?.id || null;
    setVersionId(selectedVersionId);
    if (!selectedVersionId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const [notificationRes, unreadRes] = await Promise.all([
      karyakariniClient.get('/karyakarini/my/notifications', {
        params: {
          versionId: selectedVersionId,
          category,
          onlyUnread: unreadOnly,
          limit: 100,
        },
      }),
      karyakariniClient.get('/karyakarini/my/notifications/unread-count', {
        params: {
          versionId: selectedVersionId,
        },
      }),
    ]);
    setNotifications((notificationRes?.data?.data?.notifications || []) as KaryakariniNotificationItem[]);
    setUnreadCount(Number(unreadRes?.data?.data?.total || 0));
  }, []);

  const boot = useCallback(async () => {
    try {
      setLoading(true);
      await loadData(activeCategory, onlyUnread);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, loadData, onlyUnread]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadData(activeCategory, onlyUnread);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to refresh notifications');
    } finally {
      setRefreshing(false);
    }
  }, [activeCategory, loadData, onlyUnread]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/auth/login' as any);
    } catch {
      Alert.alert('Error', 'Failed to logout');
    }
  }, [logout]);

  const handleMarkRead = useCallback(async (entry: KaryakariniNotificationItem) => {
    try {
      setUpdatingItemId(Number(entry.id));
      await karyakariniClient.post('/karyakarini/my/notifications/read', {
        notificationIds: entry.source === 'task_notification' ? [Number(entry.id)] : [],
        invitationIds: entry.source === 'invitation' ? [Number(entry.id)] : [],
      });
      await loadData(activeCategory, onlyUnread);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to mark notification as read');
    } finally {
      setUpdatingItemId(null);
    }
  }, [activeCategory, loadData, onlyUnread]);

  const handleMarkAllRead = useCallback(async () => {
    const taskNotificationIds = notifications
      .filter((entry) => entry.source === 'task_notification' && !entry.is_read)
      .map((entry) => Number(entry.id));
    const invitationIds = notifications
      .filter((entry) => entry.source === 'invitation' && !entry.is_read)
      .map((entry) => Number(entry.id));
    if (!taskNotificationIds.length && !invitationIds.length) return;

    try {
      await karyakariniClient.post('/karyakarini/my/notifications/read', {
        notificationIds: taskNotificationIds,
        invitationIds,
      });
      await loadData(activeCategory, onlyUnread);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to mark all notifications as read');
    }
  }, [activeCategory, loadData, notifications, onlyUnread]);

  const handleTaskStatusUpdate = useCallback(
    async (entry: KaryakariniNotificationItem, status: 'open' | 'in_progress' | 'completed') => {
      const taskId = Number(entry.entity_id || entry.metadata?.taskId || 0);
      if (!taskId || !versionId) return;
      try {
        setUpdatingItemId(Number(entry.id));
        await karyakariniClient.patch(`/karyakarini/my/tasks/${taskId}/status`, {
          versionId,
          status,
        });
        await karyakariniClient.post('/karyakarini/my/notifications/read', {
          notificationIds: [Number(entry.id)],
        });
        await loadData(activeCategory, onlyUnread);
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Failed to update task status');
      } finally {
        setUpdatingItemId(null);
      }
    },
    [activeCategory, loadData, onlyUnread, versionId]
  );

  const handleInvitationResponse = useCallback(
    async (entry: KaryakariniNotificationItem, status: 'accepted' | 'tentative' | 'rejected') => {
      const invitationId = Number(entry.id);
      if (!invitationId) return;
      try {
        setUpdatingItemId(invitationId);
        await karyakariniClient.patch(`/karyakarini/my/invitations/${invitationId}/respond`, {
          status,
        });
        await karyakariniClient.post('/karyakarini/my/notifications/read', {
          invitationIds: [invitationId],
        });
        await loadData(activeCategory, onlyUnread);
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Failed to update invitation status');
      } finally {
        setUpdatingItemId(null);
      }
    },
    [activeCategory, loadData, onlyUnread]
  );

  const categoryButtons: NotificationCategory[] = ['all', 'tasks', 'invitations'];
  const unreadRows = useMemo(() => notifications.filter((entry) => !entry.is_read).length, [notifications]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Notifications"
        showBack
        user={user}
        onLogout={handleLogout}
        notificationCount={unreadCount}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.helper}>Loading notifications...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Category</Text>
            <TouchableOpacity style={styles.markAllBtn} onPress={() => void handleMarkAllRead()} disabled={unreadRows === 0}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            {categoryButtons.map((entry) => (
              <TouchableOpacity
                key={entry}
                style={[styles.filterChip, activeCategory === entry && styles.filterChipActive]}
                onPress={() => setActiveCategory(entry)}
              >
                <Text style={[styles.filterChipText, activeCategory === entry && styles.filterChipTextActive]}>{entry}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.filterChip, onlyUnread && styles.filterChipActive]}
              onPress={() => setOnlyUnread((prev) => !prev)}
            >
              <Text style={[styles.filterChipText, onlyUnread && styles.filterChipTextActive]}>Unread only</Text>
            </TouchableOpacity>
          </View>

          {notifications.length === 0 ? (
            <Text style={styles.helper}>No notifications found.</Text>
          ) : (
            notifications.map((entry) => {
              const isPendingInvitation =
                entry.source === 'invitation' && String(entry.status || '').trim().toLowerCase() === 'pending';
              const isTaskEntry = entry.source === 'task_notification';
              const entryStatus = String(entry.status || '').trim().toLowerCase();
              return (
                <View key={`${entry.source}-${entry.id}`} style={[styles.card, !entry.is_read && styles.unreadCard]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{entry.title}</Text>
                    <Text style={[styles.statusText, { color: statusColor(entry.status) }]}>
                      {entryStatus || (entry.is_read ? 'read' : 'unread')}
                    </Text>
                  </View>
                  <Text style={styles.cardMeta}>{entry.message || '-'}</Text>
                  <Text style={styles.cardMeta}>{toDateText(entry.created_at)}</Text>

                  {!entry.is_read ? (
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      disabled={updatingItemId === Number(entry.id)}
                      onPress={() => void handleMarkRead(entry)}
                    >
                      <Text style={styles.secondaryBtnText}>{updatingItemId === Number(entry.id) ? 'Please wait...' : 'Mark read'}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {isTaskEntry ? (
                    <View style={styles.actionRow}>
                      {['open', 'in_progress', 'completed'].map((statusOption) => (
                        <TouchableOpacity
                          key={`${entry.id}-${statusOption}`}
                          style={[styles.actionBtn, entryStatus === statusOption && styles.actionBtnActive]}
                          disabled={updatingItemId === Number(entry.id)}
                          onPress={() => void handleTaskStatusUpdate(entry, statusOption as 'open' | 'in_progress' | 'completed')}
                        >
                          <Text style={[styles.actionText, entryStatus === statusOption && styles.actionTextActive]}>{statusOption}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  {isPendingInvitation ? (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnSuccess]}
                        disabled={updatingItemId === Number(entry.id)}
                        onPress={() => void handleInvitationResponse(entry, 'accepted')}
                      >
                        <Text style={styles.actionTextWhite}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnWarning]}
                        disabled={updatingItemId === Number(entry.id)}
                        onPress={() => void handleInvitationResponse(entry, 'tentative')}
                      >
                        <Text style={styles.actionTextWhite}>Tentative</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnDanger]}
                        disabled={updatingItemId === Number(entry.id)}
                        onPress={() => void handleInvitationResponse(entry, 'rejected')}
                      >
                        <Text style={styles.actionTextWhite}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <AppBottomNav activeKey="karyakarini" userRole={(user as any)?.role || null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  backBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  headerLogo: {
    width: 34,
    height: 34,
  },
  headerBrand: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
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
  content: {
    padding: 12,
    gap: 10,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  markAllBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  markAllText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  filterChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  filterChipText: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: theme.colors.primary,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    padding: 10,
    gap: 6,
  },
  unreadCard: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  cardHeader: {
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
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardMeta: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  actionText: {
    color: theme.colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  actionTextActive: {
    color: theme.colors.primary,
  },
  actionBtnSuccess: {
    backgroundColor: '#15803d',
    borderColor: '#15803d',
  },
  actionBtnWarning: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  actionBtnDanger: {
    backgroundColor: '#b91c1c',
    borderColor: '#b91c1c',
  },
  actionTextWhite: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
