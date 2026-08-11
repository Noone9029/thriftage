import * as ImagePicker from 'expo-image-picker';

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
  if (asset.file !== undefined) {
    form.append('image', asset.file);
  } else {
    form.append('image', {
      name: asset.fileName ?? 'profile-image.jpg',
      type: asset.mimeType ?? 'image/jpeg',
      uri: asset.uri,
    } as unknown as Blob);
  }
  return { form, uri: asset.uri };
}
