import { describe, expect, it, vi } from 'vitest';

import { appendImageUpload } from './image-upload-form';

describe('appendImageUpload', () => {
  it('uses the React Native URI part on Android even when Expo supplies a file value', () => {
    const append = vi.fn();
    const file = {} as File;

    appendImageUpload(
      { append } as unknown as FormData,
      {
        file,
        fileName: 'selected.png',
        mimeType: 'image/png',
        uri: 'content://media/selected.png',
      },
      'fallback.jpg',
      false,
    );

    expect(append).toHaveBeenCalledWith('image', {
      name: 'selected.png',
      type: 'image/png',
      uri: 'content://media/selected.png',
    });
  });

  it('uses the browser File object on web', () => {
    const append = vi.fn();
    const file = {} as File;

    appendImageUpload(
      { append } as unknown as FormData,
      { file, uri: 'blob:preview' },
      'fallback.jpg',
      true,
    );

    expect(append).toHaveBeenCalledWith('image', file);
  });
});
