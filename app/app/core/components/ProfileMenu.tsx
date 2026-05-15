import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../theme';
import type { User } from '../types';

interface ProfileMenuProps {
  user: User;
  onLogout: () => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({ user, onLogout }) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const menuMaxHeight = Math.min(Dimensions.get('window').height * 0.78, 560);
  
  console.log('ProfileMenu: Component rendered, onLogout is:', typeof onLogout);

  const openMenu = () => {
    console.log('ProfileMenu: Opening menu');
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
    console.log('ProfileMenu: Menu option clicked');
    console.log('ProfileMenu: Action type:', typeof action);
    console.log('ProfileMenu: Action is:', action);
    closeMenu();
    setTimeout(() => {
      console.log('ProfileMenu: Executing action');
      try {
        const result = action();
        console.log('ProfileMenu: Action result:', result);
      } catch (error) {
        console.error('ProfileMenu: Action error:', error);
      }
    }, 200);
  };

  const menuItems = [
    {
      icon: '👤',
      label: 'My Profile',
      description: 'Personal, Education, Business, Jobs',
      onPress: () => router.push('/user-profile'),
    },
    {
      icon: '👨‍👩‍👧',
      label: 'Family Profiles',
      description: 'Manage student profiles and grades',
      onPress: () => router.push('/els-profiles'),
    },
    {
      icon: '🧬',
      label: 'Family Members',
      description: 'View family tree members',
      onPress: () => router.push('/family-profile'),
    },
    {
      icon: '💳',
      label: 'Financials',
      description: 'Invoices, subscriptions, payments',
      onPress: () => router.push('/financials' as any),
    },
    {
      icon: '🪪',
      label: 'Seervi Card',
      description: 'Preview ID card',
      onPress: () => router.push('/seervi-card' as any),
    },
    {
      icon: '⬇️',
      label: 'Profile Downloads',
      description: 'Download printable card',
      onPress: () => router.push('/profile-downloads' as any),
    },
    {
      icon: '🧾',
      label: 'Subscriptions',
      description: 'Manage your subscriptions',
      onPress: () => router.push('/subscriptions-checkout'),
    },
    {
      icon: '⚙️',
      label: 'Settings',
      description: 'App preferences',
      onPress: () => router.push('/settings'),
    },
    {
      icon: '🚪',
      label: 'Logout',
      description: 'Sign out of your account',
      onPress: onLogout,
      destructive: true,
    },
  ];

  return (
    <>
      {/* Avatar Button */}
      <TouchableOpacity onPress={openMenu} style={styles.avatarButton} activeOpacity={0.7}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.firstName.substring(0, 1).toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>

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
              { maxHeight: menuMaxHeight },
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
              <View style={styles.menuAvatar}>
                <Text style={styles.menuAvatarText}>
                  {user.firstName.substring(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.menuUserInfo}>
                <Text style={styles.menuUserName}>{user.firstName}</Text>
                <Text style={styles.menuUserEmail}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            {/* Menu Items */}
            <ScrollView
              style={styles.menuItemsScroll}
              contentContainerStyle={styles.menuItemsContent}
              showsVerticalScrollIndicator
            >
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    item.destructive && styles.menuItemDestructive,
                  ]}
                  onPress={() => {
                    console.log('ProfileMenu: Item tapped:', item.label);
                    handleMenuOption(item.onPress);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemIcon}>
                    <Text style={styles.menuItemIconText}>{item.icon}</Text>
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text
                      style={[
                        styles.menuItemLabel,
                        item.destructive && styles.menuItemLabelDestructive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text style={styles.menuItemDescription}>{item.description}</Text>
                  </View>
                  <Text style={styles.menuItemArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    width: 320,
    maxWidth: '92%',
    ...theme.shadows.lg,
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primaryLight,
  },
  menuAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuAvatarText: {
    ...theme.typography.h3,
    color: '#FFF',
    fontWeight: '700',
  },
  menuUserInfo: {
    marginLeft: theme.spacing.md,
    flex: 1,
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
    paddingBottom: theme.spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  menuItemDestructive: {
    borderBottomWidth: 0,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  menuItemIconText: {
    fontSize: 20,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    ...theme.typography.button,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  menuItemLabelDestructive: {
    color: theme.colors.error,
  },
  menuItemDescription: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  menuItemArrow: {
    ...theme.typography.h3,
    color: theme.colors.text.disabled,
  },
});
