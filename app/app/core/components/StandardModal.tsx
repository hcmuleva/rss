import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { theme } from '../../theme';

interface StandardModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  topContent?: React.ReactNode;
  maxWidth?: number;
}

export function StandardModal({ visible, onClose, title, subtitle, children, footer, topContent, maxWidth }: StandardModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isLargeDesktop = width >= 1024;
  const computedMaxWidth = maxWidth || (isLargeDesktop ? 880 : isDesktop ? 760 : 640);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { maxWidth: computedMaxWidth }]}>
          <View style={[styles.header, isDesktop && styles.headerDesktop]}>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, isDesktop && styles.titleDesktop]}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {topContent && <View style={[styles.topContent, isDesktop && styles.topContentDesktop]}>{topContent}</View>}

          <ScrollView
            style={styles.content}
            contentContainerStyle={[styles.contentContainer, isDesktop && styles.contentContainerDesktop]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer && <View style={[styles.footer, isDesktop && styles.footerDesktop]}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    backgroundColor: '#FFF9F7',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECDDD3',
  },
  headerDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  titleDesktop: {
    fontSize: 22,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '700',
  },
  topContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ECDDD3',
    backgroundColor: '#FFF9F7',
  },
  topContentDesktop: {
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  content: {
    flexShrink: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 8,
  },
  contentContainerDesktop: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ECDDD3',
    backgroundColor: '#fff',
    flexDirection: 'row',
    gap: 12,
  },
  footerDesktop: {
    paddingHorizontal: 28,
    paddingVertical: 20,
    gap: 16,
  },
});
