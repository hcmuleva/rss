import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { authClient, karyakariniClient } from '../../api/client';
import { useProfile } from '../../core/context/ProfileContext';
import { theme } from '../../theme';
import { ScreenHeader } from '../../core/components/ScreenHeader';
import { PageHeaderCard } from '../../core/components/PageHeaderCard';
import { MaterialIcons } from '@expo/vector-icons';

type Announcement = { id: number; title: string; message: string; category: string };
type CategoryCard = { key: string; category: string; subcategory: string; count: number; lastActivityAt: number };
type MyTask = { id: number; title: string; task_date?: string; due_date?: string; status?: string };
const parseLabelList = (value?: string | string[] | null) => {
  if (Array.isArray(value)) return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
  const raw = String(value || '').trim();
  if (!raw) return [] as string[];
  return [...new Set(raw.split(',').map((entry) => entry.trim()).filter(Boolean))];
};

export default function RssHomeScreen() {
  const { user, isLoading } = useProfile();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [karyakariniCount, setKaryakariniCount] = useState(0);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [totalCategoryCount, setTotalCategoryCount] = useState(0);
  const [assignedTasks, setAssignedTasks] = useState<MyTask[]>([]);

  const load = useCallback(async () => {
    if (!user) {
      setAnnouncements([]);
      setKaryakariniCount(0);
      setCategoryCards([]);
      setAssignedTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [announcementResult, teamResult, taskResult, invitationResult] = await Promise.allSettled([
        authClient.get('/announcements', { params: { page: 1, limit: 10 } }),
        karyakariniClient.get('/karyakarini/my/teams'),
        karyakariniClient.get('/karyakarini/my/tasks', { params: { limit: 100 } }),
        karyakariniClient.get('/karyakarini/my/invitations', { params: { limit: 100 } }),
      ]);

      const announcementStatus = announcementResult.status === 'rejected' ? announcementResult.reason?.response?.status : null;
      const teamStatus = teamResult.status === 'rejected' ? teamResult.reason?.response?.status : null;
      if (announcementStatus === 401 || teamStatus === 401) {
        router.replace('/auth/login' as any);
        return;
      }

      const announcementRes = announcementResult.status === 'fulfilled' ? announcementResult.value : null;
      const teamRes = teamResult.status === 'fulfilled' ? teamResult.value : null;
      const taskRes = taskResult.status === 'fulfilled' ? taskResult.value : null;
      const invitationRes = invitationResult.status === 'fulfilled' ? invitationResult.value : null;

      setAnnouncements((announcementRes?.data?.data?.announcements || []) as Announcement[]);

      const teams = ((teamRes as any)?.data?.data?.teams || []) as any[];
      const tasks = ((taskRes as any)?.data?.data?.tasks || []) as any[];
      const invitations = ((invitationRes as any)?.data?.data?.invitations || []) as any[];

      setKaryakariniCount(Number(teams.length || 0));
      setAssignedTasks(tasks.slice(0, 5).map((task) => ({
        id: Number(task.id),
        title: String(task.title || 'Task'),
        task_date: task.task_date,
        due_date: task.due_date,
        status: task.status,
      })));

      const categoryMap = new Map<string, CategoryCard>();
      const addOrUpdate = (cat: string, sub: string, timestamp: number, isDirectItem: boolean) => {
        const category = cat.trim() || 'General';
        const subcategory = sub.trim();
        const key = `${category}__${subcategory}`;
        const existing = categoryMap.get(key);
        categoryMap.set(key, {
          key,
          category,
          subcategory,
          count: Number(existing?.count || 0) + (isDirectItem ? 1 : 0),
          lastActivityAt: Math.max(existing?.lastActivityAt || 0, timestamp),
        });
      };

      teams.forEach((team) => {
        const ts = new Date(team.updated_at || team.created_at || team.start_date || 0).getTime();
        const categories = parseLabelList(team.categories && team.categories.length ? team.categories : team.category || '');
        const subcategories = parseLabelList(team.subcategories && team.subcategories.length ? team.subcategories : team.subcategory || '');
        if (subcategories.length > 0) {
          subcategories.forEach((sub) => {
            const cat = categories.find((c) => sub.toLowerCase().includes(c.toLowerCase())) || categories[0] || 'General';
            addOrUpdate(cat, sub, ts, true);
          });
        } else if (categories.length > 0) {
          categories.forEach((cat) => addOrUpdate(cat, '', ts, true));
        }
      });

      tasks.forEach((task) => {
        const ts = new Date(task.updated_at || task.created_at || task.task_date || 0).getTime();
        const cats = parseLabelList(task.task_categories);
        const subs = parseLabelList(task.task_subcategories);
        if (subs.length > 0) {
          subs.forEach((sub) => {
            const cat = cats.find((c) => sub.toLowerCase().includes(c.toLowerCase())) || cats[0] || 'General';
            addOrUpdate(cat, sub, ts, true);
          });
        } else if (cats.length > 0) {
          cats.forEach((cat) => addOrUpdate(cat, '', ts, true));
        } else {
          addOrUpdate('General', '', ts, true);
        }
      });

      invitations.forEach((inv) => {
        const ts = new Date(inv.invited_at || inv.meeting_date || 0).getTime();
        const cat = String(inv.invited_node_level || inv.meeting_node_level || 'Meetings').trim();
        addOrUpdate(cat, '', ts, true);
      });

      const sortedCards = Array.from(categoryMap.values())
        .filter((c) => c.count > 0 || c.lastActivityAt > 0)
        .sort((a, b) => b.lastActivityAt - a.lastActivityAt);

      setTotalCategoryCount(sortedCards.length);
      setCategoryCards(sortedCards.slice(0, 4));
    } catch {
      setAnnouncements([]);
      setKaryakariniCount(0);
      setCategoryCards([]);
      setTotalCategoryCount(0);
      setAssignedTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && user) {
      void load();
    }
  }, [isLoading, load, user]);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, user]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        user={user}
        onLogout={() => {
          void (async () => {
            try {
              await authClient.post('/logout');
            } catch {}
            router.replace('/auth/login' as any);
          })();
        }}
      />
      <PageHeaderCard
        title="Welcome, RSS"
        subtitle={(user as any)?.firstName || (user as any)?.first_name ? `Namaste, ${(user as any)?.firstName || (user as any)?.first_name}` : 'Jai Shri Krishna'}
        icon={<MaterialIcons name="home" size={24} color={theme.colors.primary} />}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.shortcutGrid}>
          <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/karyakarini-member')}>
            <View style={[styles.shortcutIconWrap, { backgroundColor: '#FFF1E8' }]}>
              <MaterialIcons name="people" size={24} color={theme.colors.primary} />
            </View>
            <Text style={styles.shortcutTitle}>Karyakarini</Text>
            <Text style={styles.shortcutMeta}>{karyakariniCount} Assignments</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/karyakarini-notifications' as any)}>
            <View style={[styles.shortcutIconWrap, { backgroundColor: '#E8F5E9' }]}>
              <MaterialIcons name="notifications" size={24} color="#2E7D32" />
            </View>
            <Text style={styles.shortcutTitle}>Notifications</Text>
            <Text style={styles.shortcutMeta}>Stay Updated</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Tasks</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: '/karyakarini-member' as any, params: { tab: 'tasks' } } as any)}>
              <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>View All</Text>
            </TouchableOpacity>
          </View>
          {assignedTasks.length === 0 ? (
            <Text style={styles.emptyText}>No assigned tasks</Text>
          ) : (
            assignedTasks.map((task) => (
              <TouchableOpacity
                key={`home-task-${task.id}`}
                style={styles.announcementCard}
                onPress={() => router.push({ pathname: '/karyakarini-member' as any, params: { tab: 'tasks' } } as any)}
              >
                <Text style={styles.announcementTitle} numberOfLines={1}>{task.title}</Text>
                <Text style={styles.announcementText}>
                  Task: {String(task.task_date || '-').slice(0, 10)} • Due: {String(task.due_date || '-').slice(0, 10)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {categoryCards.length > 0 ? (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Activity Categories</Text>
              <MaterialIcons name="category" size={20} color={theme.colors.text.secondary} />
            </View>
            <View style={styles.categoryGrid}>
              {categoryCards.map((entry) => (
                <TouchableOpacity
                  key={entry.key}
                  style={styles.categoryCard}
                  onPress={() =>
                    router.push({
                      pathname: '/karyakarini-category-activity' as any,
                      params: {
                        category: entry.category,
                        subcategory: entry.subcategory || undefined,
                      },
                    } as any)
                  }
                >
                  <View style={styles.categoryIconCircle}>
                    <MaterialIcons name="assignment" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryLabel}>{entry.category}</Text>
                    <Text style={styles.categoryValue} numberOfLines={1}>{entry.subcategory || 'General'}</Text>
                    {entry.lastActivityAt > 0 ? (
                      <Text style={{ fontSize: 10, color: theme.colors.text.disabled, marginTop: 2 }}>
                        Active: {new Date(entry.lastActivityAt).toLocaleDateString()}
                      </Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={theme.colors.border} />
                </TouchableOpacity>
              ))}
              {totalCategoryCount > 4 ? (
                <TouchableOpacity
                  style={{ backgroundColor: '#FFF1E8', borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 4, borderWidth: 1, borderColor: '#FCEFE6', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                  onPress={() => router.push('/karyakarini-member')}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.primary }}>
                    Show More Categories ({totalCategoryCount - 4})
                  </Text>
                  <MaterialIcons name="arrow-forward" size={16} color={theme.colors.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest Announcements</Text>
            <MaterialIcons name="campaign" size={20} color={theme.colors.text.secondary} />
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} />
          ) : announcements.length === 0 ? (
            <Text style={styles.emptyText}>No recent announcements</Text>
          ) : (
            announcements.map((item) => (
              <View key={item.id} style={styles.announcementCard}>
                <View style={styles.announcementBadge}>
                  <Text style={styles.announcementBadgeText}>{item.category}</Text>
                </View>
                <Text style={styles.announcementTitle}>{item.title}</Text>
                <Text style={styles.announcementText} numberOfLines={3}>{item.message}</Text>
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
  content: { padding: 16, gap: 20, paddingBottom: 32 },
  shortcutGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  shortcutCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECDDD3',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  shortcutIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  shortcutMeta: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 2,
    fontWeight: '600',
  },
  sectionWrap: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: -0.5,
  },
  categoryGrid: {
    gap: 10,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDDED5',
    gap: 12,
  },
  categoryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF9F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCEFE6',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  categoryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginTop: 1,
  },
  announcementCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDDED5',
    padding: 16,
    gap: 8,
    ...theme.shadows.sm,
  },
  announcementBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FCEFE6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  announcementBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primaryDark,
    textTransform: 'uppercase',
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  announcementText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.text.disabled,
    fontSize: 14,
    marginTop: 10,
  },
});
