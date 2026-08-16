import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

import { thriftageApiClient } from '../auth/auth-composition';

let registeredDeviceId: string | null = null;
let notificationsPromise: Promise<typeof ExpoNotifications> | null = null;

async function loadNotifications(): Promise<typeof ExpoNotifications> {
  notificationsPromise ??= import('expo-notifications').then((notifications) => {
    notifications.setNotificationHandler({
      handleNotification: () =>
        Promise.resolve({
          shouldPlaySound: false,
          shouldSetBadge: true,
          shouldShowBanner: false,
          shouldShowList: true,
        }),
    });
    return notifications;
  });
  return notificationsPromise;
}

export async function registerPushNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const Notifications = await loadNotifications();
  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectId !== 'string' || projectId === '') return;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const device = await thriftageApiClient.registerPushDevice({
    expoPushToken: token.data,
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
  });
  registeredDeviceId = device.id;
}

export async function deactivateCurrentPushDevice(): Promise<void> {
  if (registeredDeviceId === null) return;
  const deviceId = registeredDeviceId;
  registeredDeviceId = null;
  await thriftageApiClient.deactivatePushDevice(deviceId);
}
