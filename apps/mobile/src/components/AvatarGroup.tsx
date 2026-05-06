import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/colors';

interface AvatarGroupProps {
  users: string[];
  maxVisible?: number;
  onPress?: () => void;
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';

export const AvatarGroup = ({ users, maxVisible = 4, onPress }: AvatarGroupProps): React.JSX.Element => {
  const visible = users.slice(0, maxVisible);
  const remaining = users.length - visible.length;
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={styles.wrap} onPress={onPress}>
      {visible.map((user, idx) => (
        <View key={`${user}-${idx}`} style={[styles.avatar, { marginLeft: idx === 0 ? 0 : -8 }]}>
          <Text style={styles.avatarText}>{initials(user)}</Text>
        </View>
      ))}
      {remaining > 0 ? (
        <View style={[styles.avatar, styles.moreAvatar, { marginLeft: visible.length === 0 ? 0 : -8 }]}>
          <Text style={styles.moreText}>+{remaining}</Text>
        </View>
      ) : null}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#dbe2f5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { color: Colors.secondary, fontWeight: '700', fontSize: 10 },
  moreAvatar: { backgroundColor: '#f3f4f6' },
  moreText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 10 }
});
