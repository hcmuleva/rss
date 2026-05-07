import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '@/constants/colors';
import { uploadFileToS3 } from '@/utils/s3Upload';

interface UserPhotoPickerProps {
  value?: string;
  onChange: (url?: string) => void;
}

export const UserPhotoPicker = ({ value, onChange }: UserPhotoPickerProps): React.JSX.Element => {
  const [uploading, setUploading] = React.useState(false);

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    try {
      const name = asset.fileName ?? `user-${Date.now()}.jpg`;
      const url = await uploadFileToS3(asset.uri, name, asset.mimeType ?? 'image/jpeg');
      onChange(url);
    } finally {
      setUploading(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets.length) return;
    await uploadAsset(result.assets[0]);
  };

  const captureFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets.length) return;
    await uploadAsset(result.assets[0]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Photo</Text>
      <View style={styles.preview}>
        {value ? <Image source={{ uri: value }} style={styles.image} /> : <Text style={styles.placeholder}>No photo</Text>}
      </View>
      {uploading ? <ActivityIndicator color={Colors.primary} /> : null}
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void captureFromCamera()} disabled={uploading}>
          <Text style={styles.btnText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void pickFromGallery()} disabled={uploading}>
          <Text style={styles.btnText}>Upload Photo</Text>
        </TouchableOpacity>
      </View>
      {value ? (
        <TouchableOpacity style={styles.clearBtn} onPress={() => onChange(undefined)} disabled={uploading}>
          <Text style={styles.clearText}>Remove</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  preview: { width: 76, height: 76, borderRadius: 38, overflow: 'hidden', borderWidth: 1, borderColor: '#dfe3ef', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  image: { width: '100%', height: '100%' },
  placeholder: { fontSize: 11, color: Colors.textSecondary },
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, backgroundColor: '#edf3ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btnText: { color: Colors.secondary, fontWeight: '700', fontSize: 12 },
  clearBtn: { marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#f3f4f6' },
  clearText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 11 }
});
