import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import type { User } from '../types';
import {
  buildAttendanceQrPayload,
  buildRoleCategoryLabel,
  buildSeerviCardId,
  buildUserDisplayName,
} from '../utils/seerviCard';

type SeerviIdCardProps = {
  user: User;
  profilePhotoUrl?: string | null;
  maritalStatus?: string | null;
  husbandName?: string | null;
  roleCategory?: string | null;
  districtCode?: string | number | null;
  compact?: boolean;
};

export const SeerviIdCard: React.FC<SeerviIdCardProps> = ({
  user,
  profilePhotoUrl,
  maritalStatus,
  husbandName,
  roleCategory,
  districtCode,
  compact = false,
}) => {
  const cardId = buildSeerviCardId(user, { districtCode });
  const roleLabel = buildRoleCategoryLabel(user, {
    role: user.role,
    category: roleCategory || undefined,
  });
  const displayName = buildUserDisplayName(user, { maritalStatus, husbandName });
  const qrPayload = buildAttendanceQrPayload(user, cardId);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${compact ? 70 : 100}x${compact ? 70 : 100}&data=${encodeURIComponent(qrPayload)}`;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.headerLogo} />
          <Text style={[styles.headerText, compact && styles.headerTextCompact]}>SEERVI CARD</Text>
        </View>
      </View>

      <View style={styles.body}>
        {profilePhotoUrl ? (
          <Image source={{ uri: profilePhotoUrl }} style={[styles.photo, compact && styles.photoCompact]} />
        ) : (
          <View style={[styles.photoPlaceholder, compact && styles.photoCompact]}>
            <Text style={styles.photoPlaceholderText}>
              {user.firstName?.slice(0, 1)?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}

        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>
          {displayName}
        </Text>
        <Text style={[styles.role, compact && styles.roleCompact]} numberOfLines={1}>
          {roleLabel}
        </Text>

        <View style={styles.footerRow}>
          <View style={styles.idWrap}>
            <Text style={styles.idLabel}>ID</Text>
            <Text style={[styles.idValue, compact && styles.idValueCompact]}>{cardId}</Text>
          </View>
          <Image source={{ uri: qrUrl }} style={[styles.qr, compact && styles.qrCompact]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7E3F2',
    overflow: 'hidden',
    width: 280,
    ...theme.shadows.md,
  },
  cardCompact: {
    width: '100%',
  },
  header: {
    backgroundColor: '#4A90E2',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  headerText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.6,
  },
  headerTextCompact: {
    fontSize: 15,
  },
  body: {
    alignItems: 'center',
    padding: 12,
  },
  photo: {
    width: 110,
    height: 130,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: theme.colors.surface,
  },
  photoCompact: {
    width: 88,
    height: 102,
  },
  photoPlaceholder: {
    width: 110,
    height: 130,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: theme.colors.primary,
    fontSize: 36,
    fontWeight: '700',
  },
  name: {
    ...theme.typography.button,
    color: theme.colors.text.primary,
    textAlign: 'center',
    fontSize: 15,
    marginBottom: 4,
  },
  nameCompact: {
    fontSize: 13,
  },
  role: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginBottom: 10,
  },
  roleCompact: {
    marginBottom: 8,
  },
  footerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  idWrap: {
    flex: 1,
  },
  idLabel: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginBottom: 2,
  },
  idValue: {
    ...theme.typography.button,
    color: theme.colors.text.primary,
    fontSize: 13,
  },
  idValueCompact: {
    fontSize: 12,
  },
  qr: {
    width: 78,
    height: 78,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  qrCompact: {
    width: 60,
    height: 60,
  },
});
