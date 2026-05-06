import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import hi from './locales/hi.json';
import en from './locales/en.json';

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  lng: Localization.getLocales()[0]?.languageCode === 'hi' ? 'hi' : 'en',
  fallbackLng: 'en',
  resources: {
    hi: { translation: hi },
    en: { translation: en }
  }
});

export default i18n;
