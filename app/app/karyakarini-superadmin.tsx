import React from 'react';
import { StyleSheet, View } from 'react-native';
import SuperAdminScreen from './home/screens/SuperAdminScreen';
import { AppBottomNav } from './core/components/AppBottomNav';
import { useProfile } from './core/context/ProfileContext';

export default function KaryakariniSuperAdminRouteScreen() {
  const { user } = useProfile();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <SuperAdminScreen />
      </View>
      <AppBottomNav activeKey="superadmin" userRole={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
