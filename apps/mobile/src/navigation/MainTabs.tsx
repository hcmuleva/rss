import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { HeaderProfileMenu } from '@/components/HeaderProfileMenu';
import { useAuthStore } from '@/store/authStore';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { TeamScreen } from '@/screens/admin/TeamScreen';
import { TasksScreen } from '@/screens/project/TasksScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabs = (): React.JSX.Element => {
  const role = useAuthStore((state) => state.role);
  const initialRouteName = 'Home';
  const isAdminRole = role === 'ADMIN' || role === 'SUPER_ADMIN';

  return (
    <Tab.Navigator
      initialRouteName={initialRouteName}
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitle: '',
        headerStyle: styles.header,
        headerLeft: () => <Image source={require('../../logo.png')} style={styles.logo} resizeMode="contain" />,
        headerLeftContainerStyle: styles.headerLeft,
        headerRight: () => <HeaderProfileMenu />,
        headerRightContainerStyle: styles.headerRight,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          const iconName: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
            Home: 'home-outline',
            Team: 'location-outline',
            Admin: 'settings-outline',
            Tasks: 'checkbox-outline',
            Profile: 'person-outline'
          };
          return <Ionicons name={iconName[route.name]} size={size} color={color} />;
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Team" component={TeamScreen} options={{ tabBarLabel: 'Locations' }} />
      {isAdminRole ? <Tab.Screen name="Admin" component={TeamScreen} options={{ tabBarLabel: 'Admin' }} /> : null}
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4
  },
  headerLeft: {
    paddingLeft: 12
  },
  headerRight: {
    paddingRight: 12
  },
  logo: {
    width: 120,
    height: 42
  },
  tabBar: {
    height: 66,
    paddingBottom: 8,
    paddingTop: 8,
    backgroundColor: Colors.card,
    borderTopColor: '#e8e8e8',
    borderTopWidth: 1
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600'
  }
});
