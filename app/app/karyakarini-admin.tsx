import React from 'react';
import { StyleSheet, View } from 'react-native';
import KaryakariniModuleScreen from './home/screens/KaryakariniModuleScreen';
import { AppBottomNav } from './core/components/AppBottomNav';
import { useProfile } from './core/context/ProfileContext';

export default function KaryakariniAdminRouteScreen() {
  const { user } = useProfile();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <KaryakariniModuleScreen />
      </View>
      <AppBottomNav activeKey="admin" userRole={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
