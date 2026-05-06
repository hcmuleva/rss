import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { uploadFileToS3 } from '@/utils/s3Upload';

interface DocumentUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
}

const getNameFromUrl = (url: string) => {
  const parts = url.split('/');
  return decodeURIComponent(parts[parts.length - 1] ?? url);
};

export const DocumentUploader = ({ value, onChange, label = 'Upload Documents' }: DocumentUploaderProps): React.JSX.Element => {
  const [uploading, setUploading] = React.useState(false);

  const pickDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
      multiple: true,
      copyToCacheDirectory: true
    });
    if (result.canceled || !result.assets.length) {
      return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        const name = asset.name || `document-${Date.now()}.pdf`;
        const url = await uploadFileToS3(asset.uri, name, asset.mimeType ?? 'application/octet-stream');
        uploaded.push(url);
      }
      onChange([...value, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.pickBtn} onPress={() => void pickDocuments()} disabled={uploading}>
        {uploading ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.pickText}>+ Add Documents</Text>}
      </TouchableOpacity>
      {value.map((url) => (
        <View key={url} style={styles.docRow}>
          <Ionicons name="document-text-outline" size={16} color={Colors.secondary} />
          <Text style={styles.docName} numberOfLines={1}>{getNameFromUrl(url)}</Text>
          <TouchableOpacity onPress={() => onChange(value.filter((item) => item !== url))}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  pickBtn: { borderWidth: 1, borderColor: '#d7dce8', borderStyle: 'dashed', borderRadius: 10, backgroundColor: '#fff', paddingVertical: 10, alignItems: 'center' },
  pickText: { color: Colors.secondary, fontWeight: '700' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  docName: { flex: 1, color: Colors.textPrimary, fontSize: 12 }
});
