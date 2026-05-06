import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

interface StatusBadgeProps {
  status: string;
}

const bgByStatus: Record<string, string> = {
  Assigned: '#eef3ff',
  InProgress: '#fff4de',
  Delayed: '#fff0ec',
  Completed: '#eaf9f0',
  NotStarted: '#f2f2f2',
  NotReady: '#f8ebff',
  OnHold: '#fceeed'
};

const fgByStatus: Record<string, string> = {
  Assigned: Colors.secondary,
  InProgress: Colors.warning,
  Delayed: Colors.danger,
  Completed: Colors.success,
  NotStarted: Colors.textSecondary,
  NotReady: '#7a35b5',
  OnHold: Colors.danger
};

export const StatusBadge = ({ status }: StatusBadgeProps): React.JSX.Element => {
  const backgroundColor = bgByStatus[status] ?? '#f2f2f2';
  const color = fgByStatus[status] ?? Colors.textSecondary;

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.text, { color }]}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start'
  },
  text: {
    fontSize: 11,
    fontWeight: '700'
  }
});
