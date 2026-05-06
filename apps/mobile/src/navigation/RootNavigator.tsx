import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';
import { useAuthStore } from '@/store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainTabs } from './MainTabs';
import { SensitiveDetailScreen } from '@/screens/sensitive/SensitiveDetailScreen';
import { ActivityFormScreen } from '@/screens/activities/ActivityFormScreen';
import { ProjectTaskScreen } from '@/screens/project/ProjectTaskScreen';
import { AyamDetailScreen } from '@/screens/ayam/AyamDetailScreen';
import { FullTimeWorkScreen } from '@/screens/fulltime/FullTimeWorkScreen';
import { DharmRakshaScreen } from '@/screens/dharm-raksha/DharmRakshaScreen';
import { MemberDetailScreen } from '@/screens/admin/MemberDetailScreen';
import { HierarchyBrowserScreen } from '@/screens/admin/HierarchyBrowserScreen';
import { QRScannerScreen } from '@/screens/profile/QRScannerScreen';
import { BootScreen } from '@/screens/auth/BootScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = (): React.JSX.Element => {
  useAuthBootstrap();

  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);

  if (!hydrated) {
    return <BootScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="SensitiveDetail" component={SensitiveDetailScreen} />
          <Stack.Screen name="ActivityForm" component={ActivityFormScreen} />
          <Stack.Screen name="ProjectTask" component={ProjectTaskScreen} />
          <Stack.Screen name="AyamDetail" component={AyamDetailScreen} />
          <Stack.Screen name="FullTimeWork" component={FullTimeWorkScreen} />
          <Stack.Screen name="DharmRaksha" component={DharmRakshaScreen} />
          <Stack.Screen name="MemberDetail" component={MemberDetailScreen} />
          <Stack.Screen name="HierarchyBrowser" component={HierarchyBrowserScreen} />
          <Stack.Screen name="QRScanner" component={QRScannerScreen} />
        </>
      ) : (
        <Stack.Screen name="AuthStack" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};
