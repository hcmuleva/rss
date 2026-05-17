/**
 * ================================================================
 * Login Screen – Seervi EMeelan
 * Design System: Digital Civic Humanism
 * Minimal, accessible, bilingual (English + Hindi)
 * ================================================================
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useProfile } from '../core/context/ProfileContext';
import { theme, appBranding } from '../theme';

export default function LoginScreen() {
  const { login } = useProfile();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('जानकारी अधूरी है', 'कृपया सभी फ़ील्ड भरें');
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password);
      router.replace('/');
    } catch (error: any) {
      Alert.alert(
        'लॉगिन विफल',
        error.message || 'कृपया अपनी जानकारी जाँचकर पुनः प्रयास करें।'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Brand Header ───────────────────────────────────── */}
        <View style={styles.brandHeader}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>{appBranding.name}</Text>
          <Text style={styles.appNameHindi}>{appBranding.nameHindi}</Text>
          <Text style={styles.tagline}>{appBranding.tagline}</Text>
        </View>

        {/* ── Login Card ─────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>पुनः स्वागत है 🙏</Text>
          <Text style={styles.cardTitleHindi}>नमस्ते, वापस स्वागत है</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ईमेल / मोबाइल / सीरवी आईडी</Text>
            <TextInput
              style={[styles.input, emailFocused && styles.inputFocused]}
              placeholder="ईमेल, मोबाइल या सीरवी आईडी दर्ज करें"
              placeholderTextColor={theme.colors.text.disabled}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>पासवर्ड</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  passwordFocused && styles.inputFocused,
                ]}
                placeholder="अपना पासवर्ड दर्ज करें"
                placeholderTextColor={theme.colors.text.disabled}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                autoComplete="password"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>प्रवेश करें</Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.containerMargin,
    paddingBottom: theme.spacing.xl,
  },

  // ── Brand Header ────────────────────────────────────────────────
  brandHeader: {
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: theme.spacing.xl,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: theme.spacing.md,
  },
  appName: {
    ...theme.typography.h1,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: 2,
  },
  appNameHindi: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: theme.colors.primaryDark,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  tagline: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    maxWidth: 260,
  },

  // ── Login Card ──────────────────────────────────────────────────
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    // subtle lift
    shadowColor: '#231A15',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    ...theme.typography.h2,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  cardTitleHindi: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.lg,
  },

  // ── Form Fields ─────────────────────────────────────────────────
  fieldGroup: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    ...theme.typography.labelLg,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.text.primary,
    minHeight: 52,
  },
  inputFocused: {
    borderColor: theme.colors.borderFocus,
    borderWidth: 2,
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 52,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },

  // ── Forgot Password ─────────────────────────────────────────────
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.lg,
    marginTop: 4,
  },
  forgotText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600' as const,
  },

  // ── Primary Button ──────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    shadowColor: theme.colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    ...theme.typography.button,
    color: theme.colors.text.inverse,
    fontSize: 17,
  },

  // ── Footer ──────────────────────────────────────────────────────
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
  },
  footerLink: {
    ...theme.typography.body,
    color: theme.colors.secondary,
    fontWeight: '600' as const,
  },
});
