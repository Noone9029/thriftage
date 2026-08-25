import type { ConfigContext, ExpoConfig } from 'expo/config';

type AppVariant = 'development' | 'preview' | 'production';

function appVariant(): AppVariant {
  const configured = process.env.THRIFTAGE_APP_VARIANT;
  if (configured === 'development' || configured === 'preview' || configured === 'production') {
    return configured;
  }
  return 'development';
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = appVariant();
  const production = variant === 'production';
  const preview = variant === 'preview';
  const appScheme = process.env.EXPO_PUBLIC_APP_SCHEME?.trim() || 'thriftage';
  const projectId = process.env.EXPO_PROJECT_ID?.trim() || '8b3c5e61-0f52-4646-a29a-bf5b3dd86d91';
  const version = process.env.THRIFTAGE_APP_VERSION?.trim() || '0.1.0';
  const bundleIdentifier =
    process.env.IOS_BUNDLE_IDENTIFIER?.trim() ||
    (production
      ? 'com.thriftage.marketplace'
      : preview
        ? 'com.thriftage.marketplace.preview'
        : 'com.thriftage.marketplace.development');
  const androidPackage =
    process.env.ANDROID_APPLICATION_ID?.trim() ||
    (production
      ? 'com.thriftage.marketplace'
      : preview
        ? 'com.thriftage.marketplace.preview'
        : 'com.thriftage.marketplace.development');

  return {
    ...config,
    android: {
      adaptiveIcon: {
        backgroundColor: '#163D32',
        foregroundImage: './assets/thriftage-adaptive-icon.png',
      },
      package: androidPackage,
      permissions: ['android.permission.POST_NOTIFICATIONS'],
      versionCode: positiveInteger(process.env.ANDROID_VERSION_CODE, 1),
    },
    experiments: { typedRoutes: true },
    extra: {
      appVariant: variant,
      brandingStatus: 'thriftage-tag-loop-v1',
      eas: { projectId },
    },
    icon: './assets/thriftage-app-icon.png',
    ios: {
      buildNumber: process.env.IOS_BUILD_NUMBER?.trim() || '1',
      bundleIdentifier,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSPhotoLibraryUsageDescription:
          'Thriftage uses selected photos only when you add profile, listing, or evidence images.',
      },
      supportsTablet: false,
    },
    name: production ? 'Thriftage' : preview ? 'Thriftage Preview' : 'Thriftage Dev',
    orientation: 'portrait',
    plugins: [
      'expo-router',
      'expo-dev-client',
      'expo-secure-store',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#163D32',
          image: './assets/thriftage-adaptive-icon.png',
          imageWidth: 220,
          resizeMode: 'contain',
        },
      ],
      [
        'expo-image-picker',
        {
          cameraPermission: false,
          microphonePermission: false,
          photosPermission:
            'Allow Thriftage to select profile, listing, or evidence images from your photo library.',
        },
      ],
      'expo-font',
      'expo-image',
      'expo-notifications',
      'expo-updates',
      '@sentry/react-native',
    ],
    runtimeVersion: { policy: 'appVersion' },
    scheme: appScheme,
    slug: 'thriftage',
    updates: {
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
      url: `https://u.expo.dev/${projectId}`,
    },
    userInterfaceStyle: 'light',
    version,
    web: { bundler: 'metro', output: 'static' },
  };
};
