import { useQuery } from '@tanstack/react-query';

import { thriftageApiClient } from '../lib/auth/auth-composition';

export function useRuntimeConfig() {
  return useQuery({
    queryFn: () => thriftageApiClient.getRuntimeConfig(),
    queryKey: ['runtime-config'],
    retry: 2,
    staleTime: 60_000,
  });
}
