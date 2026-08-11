import type { QueryClient } from '@tanstack/react-query';
import type { PrivateUserAccount } from '@thriftage/shared';

import type { ThriftageApiClient } from '../api/thriftage-api-client';

export const currentAccountQueryKey = ['auth', 'me'] as const;

export interface CurrentAccountRepositoryContract {
  clear(): void;
  get(): Promise<PrivateUserAccount>;
  refresh(): Promise<PrivateUserAccount>;
}

export class CurrentAccountRepository implements CurrentAccountRepositoryContract {
  public constructor(
    private readonly queryClient: QueryClient,
    private readonly apiClient: ThriftageApiClient,
  ) {}

  public get(): Promise<PrivateUserAccount> {
    return this.queryClient.fetchQuery({
      queryFn: () => this.apiClient.getCurrentAccount(),
      queryKey: currentAccountQueryKey,
      retry: false,
    });
  }

  public async refresh(): Promise<PrivateUserAccount> {
    await this.queryClient.invalidateQueries({ queryKey: currentAccountQueryKey });
    return this.queryClient.fetchQuery({
      queryFn: () => this.apiClient.getCurrentAccount(),
      queryKey: currentAccountQueryKey,
      retry: false,
      staleTime: 0,
    });
  }

  public clear(): void {
    this.queryClient.removeQueries({ queryKey: ['auth'] });
  }
}
