import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { authClient, karyakariniClient } from '../../api/client';
import { useProfile } from '../../core/context/ProfileContext';
import { theme } from '../../theme';

type Announcement = { id: number; title: string; message: string; category: string };
type CategoryCard = { key: string; category: string; subcategory: string; count: number };
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

  const load = useCallback(async () => {
    if (!user) {
      setAnnouncements([]);
      setKaryakariniCount(0);
      setCategoryCards([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [announcementResult, teamResult] = await Promise.allSettled([
        authClient.get('/announcements', { params: { page: 1, limit: 10 } }),
        karyakariniClient.get('/karyakarini/my/teams'),
      ]);

      const announcementStatus = announcementResult.status === 'rejected' ? announcementResult.reason?.response?.status : null;
      const teamStatus = teamResult.status === 'rejected' ? teamResult.reason?.response?.status : null;
      if (announcementStatus === 401 || teamStatus === 401) {
        router.replace('/auth/login' as any);
        return;
      }

      const announcementRes = announcementResult.status === 'fulfilled' ? announcementResult.value : null;
      const teamRes = teamResult.status === 'fulfilled' ? teamResult.value : null;
      setAnnouncements((announcementRes?.data?.data?.announcements || []) as Announcement[]);

      const teams = ((teamRes as any)?.data?.data?.teams || []) as {
        category?: string | null;
        subcategory?: string | null;
        categories?: string[] | null;
        subcategories?: string[] | null;
      }[];
      setKaryakariniCount(Number(teams.length || 0));
      const categoryMap = new Map<string, CategoryCard>();
      teams.forEach((team) => {
        const categories = parseLabelList(team?.categories && team.categories.length ? team.categories : team?.category || '');
        const subcategories = parseLabelList(team?.subcategories && team.subcategories.length ? team.subcategories : team?.subcategory || '');
        if (subcategories.length > 0) {
          subcategories.forEach((subcategory) => {
            const category =
              categories.find((entry) => subcategory.toLowerCase().includes(entry.toLowerCase())) || categories[0] || 'General';
            const key = `${category}__${subcategory}`;
            const existing = categoryMap.get(key);
            categoryMap.set(key, {
              key,
              category,
              subcategory,
              count: Number(existing?.count || 0) + 1,
            });
          });
          return;
        }

        categories.forEach((category) => {
          const key = `${category}__`;
          const existing = categoryMap.get(key);
          categoryMap.set(key, {
            key,
            category,
            subcategory: '',
            count: Number(existing?.count || 0) + 1,
          });
        });
      });
      setCategoryCards(Array.from(categoryMap.values()).sort((a, b) => a.category.localeCompare(b.category)));
    } catch {
      setAnnouncements([]);
      setKaryakariniCount(0);
      setCategoryCards([]);
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
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
        <Text style={styles.title}>RSS Home</Text>
      </View>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/karyakarini-member')}>
        <Text style={styles.cardTitle}>Karyakarini</Text>
        <Text style={styles.cardSub}>Read-only team structure access</Text>
        <Text style={styles.meta}>My assigned nodes: {karyakariniCount}</Text>
      </TouchableOpacity>

      {categoryCards.length > 0 ? (
        <>
          <Text style={styles.section}>My Assigned Categories</Text>
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
                <Text style={styles.categoryTitle}>{entry.category}</Text>
                <Text style={styles.categorySub}>{entry.subcategory || 'General'}</Text>
                <Text style={styles.categoryMeta}>Assignments: {entry.count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.section}>Latest Announcements</Text>
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        announcements.map((item) => (
          <View key={item.id} style={styles.announcementCard}>
            <Text style={styles.announcementCategory}>{item.category}</Text>
            <Text style={styles.announcementTitle}>{item.title}</Text>
            <Text style={styles.announcementText}>{item.message}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF9F7' },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  logo: { width: 34, height: 34 },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.primaryDark },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAD7CB', borderRadius: 14, padding: 14, gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text.primary },
  cardSub: { color: theme.colors.text.secondary, fontSize: 13 },
  meta: { color: theme.colors.primaryDark, fontWeight: '600', fontSize: 12, marginTop: 4 },
  section: { marginTop: 4, fontSize: 16, fontWeight: '700', color: theme.colors.text.primary },
  categoryGrid: { gap: 8 },
  categoryCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EDDED5', padding: 12, gap: 4 },
  categoryTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text.primary },
  categorySub: { fontSize: 12, color: theme.colors.text.secondary, fontWeight: '600' },
  categoryMeta: { fontSize: 11, color: theme.colors.primaryDark, fontWeight: '700' },
  announcementCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EDDED5', padding: 12, gap: 5 },
  announcementCategory: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryDark, textTransform: 'uppercase' },
  announcementTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text.primary },
  announcementText: { fontSize: 13, color: theme.colors.text.secondary },
});
