import { Redirect, Slot } from 'expo-router';

import { MarketplaceState } from '../../../src/components/marketplace/marketplace-state';
import { useRuntimeConfig } from '../../../src/hooks/use-runtime-config';

export default function StylistLayout() {
  const runtime = useRuntimeConfig();

  if (runtime.isLoading) {
    return <MarketplaceState loading message="Checking feature availability." title="Opening" />;
  }

  if (runtime.data?.features.aiStylist !== true) {
    return <Redirect href="/" />;
  }

  return <Slot />;
}
