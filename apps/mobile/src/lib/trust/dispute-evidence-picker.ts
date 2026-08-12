import * as ImagePicker from 'expo-image-picker';

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
  if (asset.file !== undefined) form.append('image', asset.file);
  else
    form.append('image', {
      name: asset.fileName ?? 'dispute-evidence.jpg',
      type: asset.mimeType ?? 'image/jpeg',
      uri: asset.uri,
    } as unknown as Blob);
  return form;
}
