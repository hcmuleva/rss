import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProfileProvider } from './core/context/ProfileContext';
import { CartProvider } from './core/context/CartContext';
import { LanguageProvider } from './core/context/LanguageContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ProfileProvider>
          <CartProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </CartProvider>
        </ProfileProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}