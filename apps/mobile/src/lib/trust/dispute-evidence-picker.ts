import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { appendImageUpload } from '../media/image-upload-form';

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

export async function selectDisputeEvidence(): Promise<FormData | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: false,
    mediaTypes: ['images'],
    quality: 0.9,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (asset.fileSize !== undefined && asset.fileSize > MAX_EVIDENCE_BYTES) {
    throw new Error('Evidence images must be no larger than 5 MB.');
  }
  const form = new FormData();
  appendImageUpload(form, asset, 'dispute-evidence.jpg', Platform.OS === 'web');
  return form;
}
