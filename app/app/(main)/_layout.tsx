import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, usePathname } from 'expo-router';
import { AppBottomNav, AppNavKey } from '../core/components/AppBottomNav';
import { useProfile } from '../core/context/ProfileContext';

export default function MainLayout() {
  const pathname = usePathname();
  const { user } = useProfile();

  // Determine active key based on pathname
  const getActiveKey = (): AppNavKey => {
    if (pathname.includes('/admin')) return 'admin';
    if (pathname.includes('/karyakarini-admin')) return 'admin';
    if (pathname.includes('/karyakarini-report')) return 'report';
    if (pathname.includes('/karyakarini-member')) return 'karyakarini';
    return 'home';
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Slot />
      </View>
      <AppBottomNav activeKey={getActiveKey()} userRole={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
