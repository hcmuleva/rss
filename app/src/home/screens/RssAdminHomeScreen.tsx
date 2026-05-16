import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '@/theme';

export default function RssAdminHomeScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
        <Text style={styles.title}>RSS Admin</Text>
      </View>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/karyakarini-admin')}>
        <Text style={styles.cardTitle}>Karyakarini</Text>
        <Text style={styles.cardSub}>Team + Task management</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/announcements-admin')}>
        <Text style={styles.cardTitle}>Announcements</Text>
        <Text style={styles.cardSub}>Create and manage latest updates</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF9F7' },
  content: { padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  logo: { width: 36, height: 36 },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.primaryDark },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECDDD3',
    padding: 16,
    gap: 6,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text.primary },
  cardSub: { fontSize: 13, color: theme.colors.text.secondary },
});
