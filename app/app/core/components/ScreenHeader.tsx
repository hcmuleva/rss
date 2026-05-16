import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { ProfileMenu } from './ProfileMenu';

interface ScreenHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  user?: any;
  notificationCount?: number;
  onLogout?: () => void;
  onPressNotifications?: () => void;
  logoOnly?: boolean;
}

export function ScreenHeader({
  title,
  showBack,
  onBack,
  rightElement,
  user,
  notificationCount,
  onLogout,
  onPressNotifications,
  logoOnly = false,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.content}>
        <View style={styles.left}>
          {showBack ? (
            <View style={styles.logoRow}>
              <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
                <Text style={styles.backIcon}>←</Text>
              </TouchableOpacity>
              <Image source={require('../../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
              {!logoOnly && <Text style={styles.brand}>RSS</Text>}
            </View>
          ) : (
            <View style={styles.logoRow}>
              <Image source={require('../../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
              {!logoOnly && <Text style={styles.brand}>RSS</Text>}
            </View>
          )}
        </View>

        <View style={styles.center}>
          {/* Title moved to PageHeaderCard below header */}
        </View>

        <View style={styles.right}>
          {rightElement ? (
            rightElement
          ) : user ? (
            <ProfileMenu
              user={user}
              onLogout={onLogout || (() => {})}
              notificationCount={notificationCount}
              onPressNotifications={onPressNotifications}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    flex: 2,
    alignItems: 'center',
  },
  right: {
    flex: 1,
    alignItems: 'flex-end',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: -2,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 32,
    height: 32,
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
});
