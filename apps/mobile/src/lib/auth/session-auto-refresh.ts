export interface AppStateSubscription {
  remove(): void;
}

export interface AppStateSource {
  readonly currentState: string;
  addEventListener(event: 'change', listener: (state: string) => void): AppStateSubscription;
}

export interface AutoRefreshController {
  startAutoRefresh(): void;
  stopAutoRefresh(): void;
}

export function registerSessionAutoRefresh(
  appState: AppStateSource,
  auth: AutoRefreshController,
): () => void {
  const reconcile = (state: string) => {
    if (state === 'active') {
      auth.startAutoRefresh();
    } else {
      auth.stopAutoRefresh();
    }
  };

  reconcile(appState.currentState);
  const subscription = appState.addEventListener('change', reconcile);
  return () => {
    subscription.remove();
    auth.stopAutoRefresh();
  };
}
