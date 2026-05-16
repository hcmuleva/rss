import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../theme';
import { ScreenHeader } from '../../core/components/ScreenHeader';
import { PageHeaderCard } from '../../core/components/PageHeaderCard';
import { useProfile } from '../../core/context/ProfileContext';
import { MaterialIcons } from '@expo/vector-icons';

export default function RssAdminHomeScreen() {
  const { user, logout } = useProfile();
  return (
    <View style={styles.root}>
      <PageHeaderCard
        title="Admin Control"
        subtitle="Manage Portal Modules"
        icon={<MaterialIcons name="admin-panel-settings" size={24} color={theme.colors.primary} />}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.card} onPress={() => router.push('/karyakarini-admin')}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="corporate-fare" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Karyakarini Management</Text>
            <Text style={styles.cardSub}>Organize teams, hierarchies, and track tasks</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={theme.colors.border} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/announcements-admin')}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="campaign" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Announcements</Text>
            <Text style={styles.cardSub}>Publish news and important updates to all users</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={theme.colors.border} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF9F7' },
  content: { padding: 16, gap: 16, paddingTop: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECDDD3',
    padding: 16,
    gap: 14,
    ...theme.shadows.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 2,
    lineHeight: 18,
  },
});
