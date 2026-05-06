import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { uploadFileToS3 } from '@/utils/s3Upload';

interface MediaUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
}

export const MediaUploader = ({ value, onChange, label = 'Upload Media' }: MediaUploaderProps): React.JSX.Element => {
  const [uploading, setUploading] = React.useState(false);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true
    });
    if (result.canceled || !result.assets.length) {
      return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        const name = asset.fileName ?? `upload-${Date.now()}.jpg`;
        const url = await uploadFileToS3(asset.uri, name, asset.mimeType ?? 'image/jpeg');
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
      <TouchableOpacity style={styles.pickBtn} onPress={() => void pick()} disabled={uploading}>
        {uploading ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.pickText}>+ Add Media</Text>}
      </TouchableOpacity>
      {value.length ? (
        <ScrollView horizontal contentContainerStyle={styles.previewRow} showsHorizontalScrollIndicator={false}>
          {value.map((url) => (
            <View key={url} style={styles.previewCard}>
              <Image source={{ uri: url }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => onChange(value.filter((item) => item !== url))}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  pickBtn: { borderWidth: 1, borderColor: '#d7dce8', borderStyle: 'dashed', borderRadius: 10, backgroundColor: '#fff', paddingVertical: 10, alignItems: 'center' },
  pickText: { color: Colors.secondary, fontWeight: '700' },
  previewRow: { marginTop: 8, gap: 8 },
  previewCard: { width: 72, height: 72, borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff' },
  previewImage: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center' }
});
