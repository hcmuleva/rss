import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../theme';

export interface SavedSuccessPopupProps {
  visible: boolean;
  title?: string;
  message: string;
  subDetail?: string;
  onClose: () => void;
  autoCloseMs?: number;
}

export function SavedSuccessPopup({
  visible,
  title = 'सफलतापूर्वक सहेजा गया!',
  message,
  subDetail,
  onClose,
  autoCloseMs = 3500,
}: SavedSuccessPopupProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  useEffect(() => {
    if (!visible || !autoCloseMs) return;
    const timer = setTimeout(() => {
      onClose();
    }, autoCloseMs);
    return () => clearTimeout(timer);
  }, [visible, autoCloseMs, onClose]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          {/* Success Icon */}
          <View style={styles.iconCircle}>
            <MaterialIcons name="check" size={36} color="#FFFFFF" />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Optional Sub-detail (e.g. password, ID) */}
          {subDetail ? (
            <View style={styles.subDetailBox}>
              <Text style={styles.subDetailText}>{subDetail}</Text>
            </View>
          ) : null}

          {/* OK / Confirm Button */}
          <TouchableOpacity style={styles.confirmBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.confirmBtnText}>ठीक है</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 14,
      },
      web: {
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
      } as any,
    }),
  },
  cardDesktop: {
    maxWidth: 440,
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 26,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 16px rgba(22, 163, 74, 0.35)',
      } as any,
    }),
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#15803d',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 14,
  },
  subDetailBox: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  subDetailText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: theme.colors.primary || '#D97706',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
