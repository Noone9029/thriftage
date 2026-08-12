import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { registerPushNotifications } from '../../src/lib/notifications/push-registration';

export default function ProtectedAppLayout() {
  useEffect(() => {
    void registerPushNotifications();
  }, []);
  return (
    <Stack initialRouteName="(tabs)" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="listings/[listingId]" />
      <Stack.Screen name="listing-editor/new" />
      <Stack.Screen name="listing-editor/[listingId]" />
      <Stack.Screen name="sellers/[username]" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="messages/index" />
      <Stack.Screen name="messages/[conversationId]" />
      <Stack.Screen name="checkout/[listingId]" />
      <Stack.Screen name="orders/index" />
      <Stack.Screen name="orders/[orderId]" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
