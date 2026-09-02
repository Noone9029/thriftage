import { useQuery } from '@tanstack/react-query';
import { router, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';

import { registerPushNotifications } from '../../src/lib/notifications/push-registration';
import { thriftageApiClient } from '../../src/lib/auth/auth-composition';
import { useRuntimeConfig } from '../../src/hooks/use-runtime-config';

export default function ProtectedAppLayout() {
  const pathname = usePathname();
  const runtime = useRuntimeConfig();
  const policies = useQuery({
    queryFn: () => thriftageApiClient.getCurrentPolicies(),
    queryKey: ['policies'],
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (runtime.data?.features.pushNotifications === true) {
      void registerPushNotifications();
    }
  }, [runtime.data?.features.pushNotifications]);
  useEffect(() => {
    if (
      policies.data !== undefined &&
      policies.data.items.length > 0 &&
      !policies.data.acceptedForUgc &&
      pathname !== '/policies'
    )
      router.replace('/policies');
  }, [pathname, policies.data]);
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
      <Stack.Screen name="reviews/[orderId]" />
      <Stack.Screen name="reviews/users/[username]" />
      <Stack.Screen name="disputes/index" />
      <Stack.Screen name="disputes/new/[orderId]" />
      <Stack.Screen name="disputes/[id]" />
      <Stack.Screen name="policies" />
      <Stack.Screen name="blocked-users" />
      <Stack.Screen name="seller-verification" />
      <Stack.Screen name="safety" />
      <Stack.Screen name="style-profile" />
      <Stack.Screen name="personalization-settings" />
      <Stack.Screen name="payout-settings" />
      <Stack.Screen name="account-deletion" />
      <Stack.Screen name="beta-feedback" />
      <Stack.Screen name="about" />
      <Stack.Screen name="stylist/index" />
      <Stack.Screen name="stylist/[conversationId]" />
      <Stack.Screen name="stylist/saved-outfits" />
    </Stack>
  );
}
