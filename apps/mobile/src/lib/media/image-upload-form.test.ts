import { describe, expect, it, vi } from 'vitest';

import { appendImageUpload } from './image-upload-form';

vi.mock('expo-file-system', () => ({
  File: class MockFile {
    public readonly uri: string;

    public constructor(uri: string) {
      this.uri = uri;
    }
  },
}));

describe('appendImageUpload', () => {
  it('wraps the selected Android URI in an Expo file-backed blob', () => {
    const append = vi.fn();
    const file = {} as File;

    appendImageUpload(
      { append } as unknown as FormData,
      {
        file,
        fileName: 'selected.png',
        uri: 'content://media/selected.png',
      },
      'fallback.jpg',
      false,
    );

    expect(append).toHaveBeenCalledWith(
      'image',
      expect.objectContaining({ uri: 'content://media/selected.png' }),
      'selected.png',
    );
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

    expect(append).toHaveBeenCalledWith('image', file, 'fallback.jpg');
  });
});
