import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { appendImageUpload } from '../media/image-upload-form';

const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;

export async function selectListingImages(remaining: number): Promise<readonly FormData[]> {
  if (remaining <= 0) throw new Error('A listing may contain at most 10 images.');
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: ['images'],
    quality: 0.9,
    selectionLimit: remaining,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => {
    if (asset.fileSize !== undefined && asset.fileSize > MAX_LISTING_IMAGE_BYTES) {
      throw new Error('Each listing image must be no larger than 5 MB.');
    }
    const form = new FormData();
    appendImageUpload(form, asset, 'listing-image.jpg', Platform.OS === 'web');
    return form;
  });
}
