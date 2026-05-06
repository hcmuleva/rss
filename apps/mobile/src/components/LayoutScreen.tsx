import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '@/constants/colors';
import { ScreenTopBar } from './ScreenTopBar';

interface Props {
  title: string;
  subtitle?: string;
}

export const LayoutScreen = ({ title, subtitle }: Props): React.JSX.Element => {
  return (
    <View style={styles.container} accessibilityLabel={`${title} screen`}>
      <ScreenTopBar title={title} />
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16
  },
  subtitle: {
    marginTop: 2,
    color: Colors.textSecondary,
    fontSize: 14
  }
});
