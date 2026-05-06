import React, { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { Colors } from '@/constants/colors'
import { useLogout } from '@/hooks/useAuth'
import { useLanguageStore } from '@/store/languageStore'

export const HeaderProfileMenu = (): React.JSX.Element => {
  const navigation = useNavigation()
  const { i18n } = useTranslation()
  const logout = useLogout()
  const [visible, setVisible] = useState(false)
  const language = useLanguageStore((state) => state.language)
  const setLanguage = useLanguageStore((state) => state.setLanguage)

  const closeMenu = () => setVisible(false)

  const onSettings = () => {
    closeMenu()
    navigation.navigate('Profile' as never)
  }

  const onLanguageToggle = async () => {
    const nextLanguage = language === 'hi' ? 'en' : 'hi'
    setLanguage(nextLanguage)
    await i18n.changeLanguage(nextLanguage)
    closeMenu()
  }

  const onLogout = async () => {
    closeMenu()
    await logout()
  }

  return (
    <View>
      <TouchableOpacity onPress={() => setVisible(true)} accessibilityLabel="profile menu button" style={styles.iconButton}>
        <Ionicons name="person-circle-outline" size={28} color={Colors.secondary} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.backdrop} onPress={closeMenu} accessibilityLabel="close profile menu">
          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={onSettings} accessibilityLabel="settings menu item">
              <Ionicons name="settings-outline" size={16} color={Colors.secondary} />
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={onLanguageToggle} accessibilityLabel="language menu item">
              <Ionicons name="language-outline" size={16} color={Colors.secondary} />
              <Text style={styles.menuText}>{language === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={onLogout} accessibilityLabel="logout menu item">
              <Ionicons name="log-out-outline" size={16} color={Colors.danger} />
              <Text style={[styles.menuText, styles.dangerText]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  iconButton: {
    padding: 4
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  menu: {
    position: 'absolute',
    top: 58,
    right: 14,
    width: 210,
    borderRadius: 12,
    backgroundColor: Colors.card,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  menuText: {
    marginLeft: 10,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600'
  },
  dangerText: {
    color: Colors.danger
  }
})
