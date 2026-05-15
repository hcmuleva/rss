import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { authClient, karyakariniClient } from '../../api/client';
import { useProfile } from '../../core/context/ProfileContext';
import { theme } from '../../theme';

type Announcement = { id: number; title: string; message: string; category: string };

export default function RssHomeScreen() {
  const { user, isLoading } = useProfile();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [karyakariniCount, setKaryakariniCount] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [announcementRes, teamRes] = await Promise.all([
        authClient.get('/announcements', { params: { page: 1, limit: 10 } }),
        karyakariniClient.get('/karyakarini/my/teams').catch(() => ({ data: { data: { teams: [] } } })),
      ]);
      setAnnouncements((announcementRes?.data?.data?.announcements || []) as Announcement[]);
      setKaryakariniCount(Number((teamRes as any)?.data?.data?.teams?.length || 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
  announcementCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EDDED5', padding: 12, gap: 5 },
  announcementCategory: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryDark, textTransform: 'uppercase' },
  announcementTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text.primary },
  announcementText: { fontSize: 13, color: theme.colors.text.secondary },
});
