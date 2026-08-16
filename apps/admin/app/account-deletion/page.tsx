'use client';

import { accountDeletionStatusSchema, type AccountDeletionStatus } from '@thriftage/shared';
import { type FormEvent, useState } from 'react';

import { getSupabaseBrowserClient } from '../../lib/supabase';

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(
  /\/$/,
  '',
);

function failureMessage(code: unknown): string {
  switch (code) {
    case 'ACCOUNT_DELETION_ACTIVE_COMMERCE':
      return 'Complete or cancel active purchases and sales before deleting this account.';
    case 'ACCOUNT_DELETION_ACTIVE_DISPUTE':
      return 'Resolve active disputes before deleting this account.';
    case 'ACCOUNT_DELETION_REAUTH_REQUIRED':
      return 'Your confirmation session expired. Sign in and try again.';
    case 'ACCOUNT_DELETION_DISABLED':
      return 'Account deletion is temporarily unavailable. Use the support link below.';
    default:
      return 'The deletion request could not be completed safely. Please try again.';
  }
}

export default function AccountDeletionPage() {
  const [confirmation, setConfirmation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccountDeletionStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (confirmation !== 'DELETE') return;
    setSubmitting(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    try {
      const authentication = await supabase.auth.signInWithPassword({ email, password });
      if (authentication.error !== null || authentication.data.session === null) {
        throw new Error('The email or password was not accepted.');
      }
      const response = await fetch(`${apiUrl}/privacy/account-deletion`, {
        body: JSON.stringify({ confirmation: 'DELETE' }),
        headers: {
          Authorization: `Bearer ${authentication.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          readonly code?: unknown;
        } | null;
        throw new Error(failureMessage(body?.code));
      }
      setResult(accountDeletionStatusSchema.parse(await response.json()));
      setEmail('');
      setPassword('');
      setConfirmation('');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : failureMessage(null));
    } finally {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f0e9] px-6 py-12 text-[#17231e]">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-bold tracking-[0.24em] text-[#a24c2f]">THRIFTAGE PRIVACY</p>
        <h1 className="mt-3 text-4xl font-semibold">Delete your Thriftage account</h1>
        <p className="mt-5 text-base leading-7 text-black/65">
          You can use this page in any supported browser; the Thriftage mobile app is not required.
          A successful request disables access immediately and starts an asynchronous cleanup.
        </p>

        <section className="mt-8 rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold">What will happen</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-black/65">
            <li>
              Profile data, listing media, saved content, personalization, and AI chats are removed.
            </li>
            <li>Messages you sent and listing content are anonymized.</li>
            <li>Push devices and the Supabase authentication identity are removed.</li>
            <li>
              Minimum transaction, dispute, fraud, and safety records may remain in anonymized form
              when retention is justified.
            </li>
          </ul>
        </section>

        {result === null ? (
          <form
            className="mt-6 rounded-3xl border border-black/10 bg-white p-7"
            onSubmit={(event) => void submit(event)}
          >
            <p className="text-sm leading-6 text-black/60">
              Sign in to the account you want to delete. Credentials go directly to the configured
              Supabase Auth project and are never included in the deletion request.
            </p>
            <label className="mt-6 block text-sm font-bold" htmlFor="deletion-email">
              Email
            </label>
            <input
              autoComplete="email"
              className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:border-[#17664f]"
              id="deletion-email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            <label className="mt-5 block text-sm font-bold" htmlFor="deletion-password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:border-[#17664f]"
              id="deletion-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <label className="mt-5 block text-sm font-bold" htmlFor="deletion-confirmation">
              Type DELETE to confirm
            </label>
            <input
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:border-[#9f2f2f]"
              id="deletion-confirmation"
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="DELETE"
              required
              value={confirmation}
            />
            {error === null ? null : (
              <p aria-live="polite" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}
            <button
              className="mt-6 w-full rounded-xl bg-[#9f2f2f] px-4 py-3 font-bold text-white disabled:opacity-40"
              disabled={confirmation !== 'DELETE' || submitting}
              type="submit"
            >
              {submitting ? 'Requesting deletion…' : 'Permanently delete account'}
            </button>
          </form>
        ) : (
          <section aria-live="polite" className="mt-6 rounded-3xl bg-[#123f33] p-8 text-white">
            <p className="text-xs font-bold tracking-widest text-[#efae8f]">REQUEST ACCEPTED</p>
            <h2 className="mt-3 text-2xl font-semibold">Your account is disabled.</h2>
            <p className="mt-3 leading-7 text-white/75">
              Cleanup status: {result.status}. The request was created on{' '}
              {new Date(result.requestedAt).toLocaleString()}.
            </p>
          </section>
        )}

        <p className="mt-7 text-sm text-black/55">
          Need help?{' '}
          {process.env.NEXT_PUBLIC_SUPPORT_URL ? (
            <a className="font-bold underline" href={process.env.NEXT_PUBLIC_SUPPORT_URL}>
              Contact Thriftage support
            </a>
          ) : (
            'The official support URL must be configured before store submission.'
          )}
          {process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL ? (
            <>
              {' · '}
              <a className="font-bold underline" href={process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL}>
                Privacy policy
              </a>
            </>
          ) : null}
        </p>
      </div>
    </main>
  );
}
