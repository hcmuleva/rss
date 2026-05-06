import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getHierarchyNodes } from '@/api/hierarchy.api';
import { getUsers } from '@/api/users.api';
import { QRCard } from '@/components/QRCard';
import { Colors } from '@/constants/colors';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';

export const ProfileScreen = (): React.JSX.Element => {
  const { i18n, t } = useTranslation();
  const logout = useLogout();
  const userId = useAuthStore((state) => state.userId);
  const assignedNodeId = useAuthStore((state) => state.assignedNodeId);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers });
  const { data: nodes = [] } = useQuery({ queryKey: ['hierarchy-nodes'], queryFn: getHierarchyNodes });

  const currentUser = users.find((user) => user.id === userId);
  const nodeMap = React.useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const pathNodes = React.useMemo(() => {
    const result: typeof nodes = [];
    let cursor = assignedNodeId ? nodeMap.get(assignedNodeId) ?? null : null;
    while (cursor) {
      result.unshift(cursor);
      cursor = cursor.parentId ? nodeMap.get(cursor.parentId) ?? null : null;
    }
    return result;
  }, [assignedNodeId, nodeMap, nodes]);

  const code = (name?: string) => (name ?? 'XX').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2).padEnd(2, 'X');
  const byLevel = React.useMemo(() => new Map(pathNodes.map((node) => [node.level, node])), [pathNodes]);
  const prant = code(byLevel.get('PRANT')?.name_en);
  const sambhag = code(byLevel.get('SAMBHAG')?.name_en);
  const vibhag = code(byLevel.get('VIBHAG')?.name_en);
  const district = code(byLevel.get('DISTRICT')?.name_en);
  const khandOrNagar = code(byLevel.get('KHAND')?.name_en ?? byLevel.get('NAGAR')?.name_en ?? pathNodes[pathNodes.length - 1]?.name_en);
  const sequence = String(Number((userId ?? '').replace(/\D/g, '').slice(-4) || '0')).padStart(4, '0');
  const rssCardId = `${prant}${sambhag}${vibhag}${district}${khandOrNagar}${sequence}`;
  const hierarchyPath = pathNodes.map((node) => `${node.name_hi}/${node.name_en}`);

  const switchLanguage = async () => {
    const nextLanguage = language === 'hi' ? 'en' : 'hi';
    setLanguage(nextLanguage);
    await i18n.changeLanguage(nextLanguage);
  };

  return (
    <View style={styles.container} accessibilityLabel="profile screen">
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>{currentUser?.name ?? 'User'} • {assignedNodeId ?? '-'}</Text>
      <Text style={styles.subtitle}>{t('profile.language')}</Text>

      <TouchableOpacity style={styles.secondaryButton} onPress={switchLanguage} accessibilityLabel="language toggle button">
        <Text style={styles.secondaryText}>{language === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'}</Text>
      </TouchableOpacity>

      <QRCard rssCardId={rssCardId} hierarchyPath={hierarchyPath} />

      <TouchableOpacity style={styles.dangerButton} onPress={logout} accessibilityLabel="logout button">
        <Text style={styles.buttonText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors.background
  },
  title: {
    color: Colors.secondary,
    fontSize: 24,
    fontWeight: '700'
  },
  subtitle: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 14
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.secondary,
    padding: 12,
    alignItems: 'center',
    backgroundColor: Colors.card
  },
  secondaryText: {
    color: Colors.secondary,
    fontWeight: '600'
  },
  dangerButton: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: Colors.danger,
    padding: 12,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700'
  }
});
