import { loadMobileConfig } from '@thriftage/config/mobile';

export const mobileConfig = loadMobileConfig({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
});
