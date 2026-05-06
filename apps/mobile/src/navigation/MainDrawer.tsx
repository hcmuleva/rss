import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';

import { MainTabs } from './MainTabs';
import { HierarchyBrowserScreen } from '@/screens/admin/HierarchyBrowserScreen';

const Drawer = createDrawerNavigator();

export const MainDrawer = (): React.JSX.Element => (
  <Drawer.Navigator screenOptions={{ headerShown: false }}>
    <Drawer.Screen name="MainTabs" component={MainTabs} options={{ title: 'Dashboard' }} />
    <Drawer.Screen name="HierarchyBrowser" component={HierarchyBrowserScreen} options={{ title: 'Hierarchy' }} />
  </Drawer.Navigator>
);
