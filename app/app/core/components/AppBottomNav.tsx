import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';

export type AppNavKey = 'home' | 'karyakarini' | 'admin';

interface AppBottomNavProps {
  activeKey: AppNavKey;
  userRole?: string | null;
}

const BASE_NAV_ITEMS: { key: AppNavKey; icon: string; label: string; labelHi: string }[] = [
  { key: 'home', icon: '🏠', label: 'Home', labelHi: 'होम' },
  { key: 'karyakarini', icon: '🏛️', label: 'Karyakarini', labelHi: 'कार्यकारिणी' },
];

const isAdminRole = (role?: string | null) => {
  const value = String(role || '').toLowerCase();
  return value === 'admin' || value === 'superadmin';
};

export function AppBottomNav({ activeKey, userRole }: AppBottomNavProps) {
  const insets = useSafeAreaInsets();
  const navItems: { key: AppNavKey; icon: string; label: string; labelHi: string }[] = isAdminRole(userRole)
    ? [...BASE_NAV_ITEMS, { key: 'admin', icon: '🛠️', label: 'Admin', labelHi: 'एडमिन' }]
    : BASE_NAV_ITEMS;
  
  const handlePress = (key: AppNavKey) => {
    if (key === activeKey) return; 
    if (key === 'home') return router.replace('/');
    if (key === 'karyakarini') return router.push('/karyakarini-member');
    if (key === 'admin') return router.push('/admin');
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {navItems.map(({ key, icon, label }) => {
        const isActive = activeKey === key;
        return (
          <TouchableOpacity
            key={key}
            style={styles.item}
            onPress={() => handlePress(key)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
              <Text style={[styles.icon, isActive && styles.iconActive]}>{icon}</Text>
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
    paddingHorizontal: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 48,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconBoxActive: {
    backgroundColor: theme.colors.primarySoft,
  },
  icon: {
    fontSize: 22,
    opacity: 0.6,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.text.disabled,
  },
  labelActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
