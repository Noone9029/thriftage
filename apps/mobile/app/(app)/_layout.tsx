import { Stack } from 'expo-router';

export default function ProtectedAppLayout() {
  return (
    <Stack initialRouteName="(tabs)" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="listings/[listingId]" />
      <Stack.Screen name="listing-editor/new" />
      <Stack.Screen name="listing-editor/[listingId]" />
      <Stack.Screen name="sellers/[username]" />
      <Stack.Screen name="edit-profile" />
    </Stack>
  );
}
