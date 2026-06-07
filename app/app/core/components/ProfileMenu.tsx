import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  Animated,
  Image,
} from 'react-native';
import { theme } from '../../theme';
import { AUTH_BASE_URL, KARYAKARINI_BASE_URL } from '../../api/client';
import type { User } from '../types';

interface ProfileMenuProps {
  user: User;
  onLogout: () => void;
  notificationCount?: number;
  onPressNotifications?: () => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({ user, onLogout, notificationCount = 0, onPressNotifications }) => {
  const normalizeProfileUri = (value?: string | null) => {
    const raw = String(value || '').trim();
    if (!raw || raw === 'null' || raw === 'undefined') return '';
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;
    const baseCandidates = [AUTH_BASE_URL, KARYAKARINI_BASE_URL]
      .map((entry) => String(entry || '').trim().replace(/\/api\/?$/, ''))
      .filter(Boolean);
    const base = baseCandidates[0] || '';
    if (!base) return raw;
    return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`;
  };
  const [menuVisible, setMenuVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const showBell = Boolean(onPressNotifications);
  const resolvedName = String((user as any)?.firstName || (user as any)?.first_name || (user as any)?.name || '').trim();
  const userInitial = (resolvedName.substring(0, 1) || 'U').toUpperCase();
  const profilePhoto = [
    (user as any)?.profilePhotoUrl,
    (user as any)?.profile_photo_url,
    (user as any)?.profilePhoto,
    (user as any)?.profile_image,
    (user as any)?.avatar,
    (user as any)?.image,
    (user as any)?.photo_url,
    (user as any)?.photo,
  ]
    .map((entry) => String(entry || '').trim())
    .map((entry) => normalizeProfileUri(entry))
    .find((entry) => entry && entry !== 'null' && entry !== 'undefined') || '';

  const openMenu = () => {
    setMenuVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setMenuVisible(false));
  };

  const handleMenuOption = (action: () => void) => {
    closeMenu();
    setTimeout(() => {
      action();
    }, 200);
  };

  const menuItems = [
    {
      label: 'लॉगआउट',
      onPress: onLogout,
      destructive: true,
    },
  ];

  return (
    <>
      <View style={styles.headerActions}>
        {showBell ? (
          <TouchableOpacity
            onPress={onPressNotifications}
            style={styles.bellButton}
            activeOpacity={0.7}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {notificationCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : String(notificationCount)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={openMenu} style={styles.avatarButton} activeOpacity={0.7}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userInitial}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.overlay} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menuContainer,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* User Info Header */}
            <View style={styles.menuHeader}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.menuAvatarImage} />
              ) : (
                <View style={styles.menuAvatar}>
                  <Text style={styles.menuAvatarText}>
                    {userInitial}
                  </Text>
                </View>
              )}
              <View style={styles.menuUserInfo}>
                <Text style={styles.menuUserName}>{resolvedName || 'उपयोगकर्ता'}</Text>
                <Text style={styles.menuUserEmail}>{String(user.email || '') || 'उपलब्ध नहीं'}</Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            {/* Menu Items */}
            <View style={styles.menuItemsContent}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    item.destructive && styles.menuItemDestructive,
                  ]}
                  onPress={() => handleMenuOption(item.onPress)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemContent}>
                    <Text
                      style={[
                        styles.menuItemLabel,
                        item.destructive && styles.menuItemLabelDestructive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  bellIcon: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    paddingHorizontal: 4,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  avatarButton: {
    padding: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    ...theme.shadows.sm,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: theme.colors.surfaceContainerHigh,
    ...theme.shadows.sm,
  },
  avatarText: {
    ...theme.typography.button,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 70,
    paddingRight: 20,
    alignItems: 'flex-end',
  },
  menuContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    width: 240,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.md,
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  menuAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  menuAvatarText: {
    ...theme.typography.h3,
    color: '#FFF',
    fontWeight: '700',
  },
  menuUserInfo: {
    marginLeft: theme.spacing.sm,
  },
  menuUserName: {
    ...theme.typography.h3,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  menuUserEmail: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },
  menuItemsScroll: {
    flexGrow: 0,
  },
  menuItemsContent: {
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  menuItemDestructive: {
    borderBottomWidth: 0,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    ...theme.typography.labelLg,
    color: theme.colors.text.primary,
  },
  menuItemLabelDestructive: {
    color: theme.colors.error,
  },
});
