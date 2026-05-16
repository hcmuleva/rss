import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { theme } from '@/theme';

export const LanguageToggle: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.option, language === 'en' && styles.optionActive]}
        onPress={() => setLanguage('en')}
      >
        <Text style={[styles.optionText, language === 'en' && styles.optionTextActive]}>
          {t('language.toggleEn', 'EN')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.option, language === 'hi' && styles.optionActive]}
        onPress={() => setLanguage('hi')}
      >
        <Text style={[styles.optionText, language === 'hi' && styles.optionTextActive]}>
          {t('language.toggleHi', 'HI')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginRight: 10,
  },
  option: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  optionActive: {
    backgroundColor: theme.colors.primary,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  optionTextActive: {
    color: '#fff',
  },
});
