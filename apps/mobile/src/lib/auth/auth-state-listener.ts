import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export interface AuthStateSource {
  subscribe(listener: (event: AuthChangeEvent, session: Session | null) => void): () => void;
}

export function registerAuthStateListener(
  source: AuthStateSource,
  listener: (event: AuthChangeEvent, session: Session | null) => Promise<void>,
  onError: (error: unknown) => void,
): () => void {
  return source.subscribe((event, session) => {
    void listener(event, session).catch(onError);
  });
}
