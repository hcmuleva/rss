import { create } from 'zustand';

interface LanguageState {
  language: 'hi' | 'en';
  setLanguage: (language: 'hi' | 'en') => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'hi',
  setLanguage: (language) => set({ language })
}));
