import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { appendImageUpload } from '../media/image-upload-form';

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export interface SelectedProfileImage {
  readonly form: FormData;
  readonly uri: string;
}

export async function selectProfileImage(): Promise<SelectedProfileImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 0.85,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (asset === undefined) return null;
  if (asset.fileSize !== undefined && asset.fileSize > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error('Profile images must be no larger than 5 MB.');
  }
  const form = new FormData();
  appendImageUpload(form, asset, 'profile-image.jpg', Platform.OS === 'web');
  return { form, uri: asset.uri };
}
