import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Slot, usePathname, Redirect } from 'expo-router';
import { AppBottomNav, AppNavKey } from '../core/components/AppBottomNav';
import { useProfile } from '../core/context/ProfileContext';

export default function MainLayout() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useProfile();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loading]}>
        <ActivityIndicator size="large" color="#E07A5F" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }
  
  // Determine active key based on pathname
  const getActiveKey = (): AppNavKey => {
    if (pathname.includes('/karyakarini-superadmin')) return 'superadmin';
    if (pathname.includes('/admin')) return 'admin';
    if (pathname.includes('/karyakarini-admin')) return 'admin';
    if (pathname.includes('/karyakarini-report')) return 'report';
    return 'karyakarini';
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
  loading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
