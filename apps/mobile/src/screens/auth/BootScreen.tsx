import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/colors';

export const BootScreen = (): React.JSX.Element => {
  return (
    <View style={styles.container} accessibilityLabel="boot screen">
      <ActivityIndicator color={Colors.primary} size="large" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background
  }
});
