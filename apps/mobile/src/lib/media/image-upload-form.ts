import type { ImagePickerAsset } from 'expo-image-picker';
import { File } from 'expo-file-system';

type ImageUploadAsset = Pick<ImagePickerAsset, 'file' | 'fileName' | 'uri'>;

export function appendImageUpload(
  form: FormData,
  asset: ImageUploadAsset,
  fallbackName: string,
  isWeb: boolean,
): void {
  if (isWeb) {
    if (asset.file === undefined) {
      throw new Error('The browser did not provide a readable image file.');
    }
    form.append('image', asset.file, asset.fileName ?? fallbackName);
    return;
  }

  form.append('image', new File(asset.uri), asset.fileName ?? fallbackName);
}
