'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
          <h1 className="text-2xl font-semibold">The admin console hit an unexpected error.</h1>
          <p className="text-sm text-slate-600">
            The incident was recorded without attaching private marketplace content.
          </p>
          <button
            className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
