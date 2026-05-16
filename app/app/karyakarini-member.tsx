import React from 'react';
import { StyleSheet, View } from 'react-native';
import KaryakariniMemberScreen from './home/screens/KaryakariniMemberScreen';
import { AppBottomNav } from './core/components/AppBottomNav';
import { useProfile } from './core/context/ProfileContext';

export default function KaryakariniMemberRouteScreen() {
  const { user } = useProfile();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <KaryakariniMemberScreen />
      </View>
      <AppBottomNav activeKey="karyakarini" userRole={user?.role} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
