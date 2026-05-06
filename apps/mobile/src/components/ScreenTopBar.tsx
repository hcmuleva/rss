import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '@/constants/colors';

interface ScreenTopBarProps {
  title: string;
}

export const ScreenTopBar = ({ title }: ScreenTopBarProps): React.JSX.Element => {
  const navigation = useNavigation();

  return (
    <View style={styles.topBar}>
      <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={18} color={Colors.secondary} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('MainTabs' as never)}>
        <Ionicons name="home-outline" size={18} color={Colors.secondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#dde3ee',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: Colors.secondary
  }
});
