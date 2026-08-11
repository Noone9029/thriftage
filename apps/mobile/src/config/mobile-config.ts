import { loadMobileConfig } from '@thriftage/config/mobile';

export const mobileConfig = loadMobileConfig({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
});
