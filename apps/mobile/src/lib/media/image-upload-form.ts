import type { ImagePickerAsset } from 'expo-image-picker';

type ImageUploadAsset = Pick<ImagePickerAsset, 'file' | 'fileName' | 'mimeType' | 'uri'>;

export function appendImageUpload(
  form: FormData,
  asset: ImageUploadAsset,
  fallbackName: string,
  isWeb: boolean,
): void {
  if (isWeb && asset.file !== undefined) {
    form.append('image', asset.file);
    return;
  }

  form.append('image', {
    name: asset.fileName ?? fallbackName,
    type: asset.mimeType ?? 'image/jpeg',
    uri: asset.uri,
  } as unknown as Blob);
}
