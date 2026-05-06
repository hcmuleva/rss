import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { Colors } from '@/constants/colors';

interface QRCodeRef {
  toDataURL: (callback: (data: string) => void) => void;
}

interface QRCardProps {
  rssCardId: string;
  hierarchyPath: string[];
}

export const QRCard = ({ rssCardId, hierarchyPath }: QRCardProps): React.JSX.Element => {
  const qrRef = React.useRef<QRCodeRef | null>(null);

  const share = async () => {
    if (!qrRef.current) {
      Alert.alert('Unavailable', 'QR code is not ready yet.');
      return;
    }
    qrRef.current.toDataURL(async (base64) => {
      try {
        const uri = `${FileSystem.cacheDirectory}rss-card-${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share RSS Card QR' });
        } else {
          Alert.alert('Sharing not available', `QR saved at: ${uri}`);
        }
      } catch {
        Alert.alert('Share failed', 'Unable to share QR image right now.');
      }
    });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>RSS Card</Text>
      <Text style={styles.id}>{rssCardId}</Text>
      <Text style={styles.path} numberOfLines={2}>
        {hierarchyPath.join(' > ')}
      </Text>
      <View style={styles.qrWrap}>
        <QRCode value={rssCardId} size={132} getRef={(ref) => { qrRef.current = ref as QRCodeRef | null; }} />
      </View>
      <TouchableOpacity style={styles.shareBtn} onPress={() => void share()}>
        <Text style={styles.shareText}>Share QR</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e6e8ef', backgroundColor: '#fff', padding: 14 },
  title: { color: Colors.secondary, fontSize: 16, fontWeight: '800' },
  id: { marginTop: 6, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  path: { marginTop: 4, color: Colors.textSecondary, fontSize: 12 },
  qrWrap: { marginTop: 12, alignItems: 'center' },
  shareBtn: { marginTop: 12, borderRadius: 8, backgroundColor: Colors.secondary, paddingVertical: 10, alignItems: 'center' },
  shareText: { color: '#fff', fontWeight: '700' }
});
