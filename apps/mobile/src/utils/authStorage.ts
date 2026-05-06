import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const memoryStore = new Map<string, string>()

const getWebStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      const storage = getWebStorage()
      if (storage) {
        return storage.getItem(key)
      }
      return memoryStore.get(key) ?? null
    }
    return SecureStore.getItemAsync(key)
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      const storage = getWebStorage()
      if (storage) {
        storage.setItem(key, value)
      } else {
        memoryStore.set(key, value)
      }
      return
    }
    await SecureStore.setItemAsync(key, value)
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      const storage = getWebStorage()
      if (storage) {
        storage.removeItem(key)
      } else {
        memoryStore.delete(key)
      }
      return
    }
    await SecureStore.deleteItemAsync(key)
  }
}
