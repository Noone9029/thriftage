import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { ChunkedSecureStorage } from './chunked-secure-storage';
import type { AsyncKeyValueStorage } from './storage.types';
import { WebAuthStorage } from './web-auth-storage';

const nativeStorage = new ChunkedSecureStorage({
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
});

const webStorage = new WebAuthStorage(() => globalThis.localStorage);

export const authStorage: AsyncKeyValueStorage = Platform.OS === 'web' ? webStorage : nativeStorage;
