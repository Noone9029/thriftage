'use client';

import type {
  AdminListingDetail,
  AdminListingQueueItem,
  Category,
  ListingStatus,
  ModerationReport,
} from '@thriftage/shared';
import type { Session } from '@supabase/supabase-js';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { createAdminApi } from '../lib/admin-api';
import { getSupabaseBrowserClient } from '../lib/supabase';

type Workspace = 'CATEGORIES' | 'LISTINGS' | 'REPORTS';
type AccessState = 'CHECKING' | 'DENIED' | 'SIGNED_OUT' | 'AUTHORIZED';

export default function AdminHome() {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<AccessState>('CHECKING');
  const [workspace, setWorkspace] = useState<Workspace>('LISTINGS');
  const [error, setError] = useState<string | null>(null);
  const api = useMemo(
    () => (session === null ? null : createAdminApi(session.access_token)),
    [session],
  );

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth.getSession().then(({ data }) => setSession(data.session));
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setAccess(nextSession === null ? 'SIGNED_OUT' : 'CHECKING');
      });
      return () => data.subscription.unsubscribe();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Admin authentication is unavailable.');
      setAccess('SIGNED_OUT');
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (api === null) {
      setAccess('SIGNED_OUT');
      return;
    }
    let active = true;
    setAccess('CHECKING');
    void api
      .verifyAccess()
      .then(() => {
        if (active) setAccess('AUTHORIZED');
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Admin access was denied.');
          setAccess('DENIED');
        }
      });
    return () => {
      active = false;
    };
  }, [api]);

  if (access === 'CHECKING')
    return (
      <CenteredStatus title="Verifying role" copy="Checking authoritative admin permissions…" />
    );
  if (access === 'SIGNED_OUT') return <AdminSignIn error={error} />;
  if (access === 'DENIED') {
    return (
      <CenteredStatus
        title="Access denied"
        copy={error ?? 'This account does not have an active PostgreSQL ADMIN role.'}
        action="Sign out"
        onAction={() => void getSupabaseBrowserClient().auth.signOut()}
      />
    );
  }
  if (api === null) return null;

  return (
    <main className="min-h-screen bg-[#f3f0e9] text-[#17231e]">
      <header className="border-b border-black/10 bg-[#123f33] px-6 py-5 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.24em] text-[#efae8f]">THRIFTAGE</p>
            <h1 className="mt-1 text-2xl font-semibold">Marketplace operations</h1>
          </div>
          <button
            className="rounded-full border border-white/25 px-4 py-2 text-sm font-semibold"
            onClick={() => void getSupabaseBrowserClient().auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-2">
          {(['LISTINGS', 'REPORTS', 'CATEGORIES'] as const).map((item) => (
            <button
              className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold ${workspace === item ? 'bg-[#123f33] text-white' : 'bg-white text-black/65 hover:bg-white/70'}`}
              key={item}
              onClick={() => setWorkspace(item)}
            >
              {item.charAt(0) + item.slice(1).toLowerCase()}
            </button>
          ))}
        </nav>
        <section>
          {workspace === 'LISTINGS' ? <ListingWorkspace api={api} /> : null}
          {workspace === 'REPORTS' ? <ReportWorkspace api={api} /> : null}
          {workspace === 'CATEGORIES' ? <CategoryWorkspace api={api} /> : null}
        </section>
      </div>
    </main>
  );
}

function AdminSignIn({ error }: { readonly error: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(error);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    try {
      const result = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (result.error !== null) throw result.error;
    } catch (caught: unknown) {
      setLocalError(caught instanceof Error ? caught.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#123f33] px-6 py-12">
      <form
        className="w-full max-w-md rounded-3xl bg-[#fffdf8] p-8 shadow-2xl"
        onSubmit={(event) => void submit(event)}
      >
        <p className="text-xs font-bold tracking-[0.25em] text-[#d66b45]">THRIFTAGE OPERATIONS</p>
        <h1 className="mt-4 text-3xl font-semibold">Admin sign in</h1>
        <p className="mt-3 text-sm leading-6 text-black/55">
          Authentication identifies you; the API separately verifies an active ADMIN role before
          exposing any operation.
        </p>
        <label className="mt-7 block text-xs font-bold text-black/65">Email</label>
        <input
          className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:border-[#17664f]"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <label className="mt-5 block text-xs font-bold text-black/65">Password</label>
        <input
          className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:border-[#17664f]"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        {localError !== null ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{localError}</p>
        ) : null}
        <button
          className="mt-6 w-full rounded-xl bg-[#d66b45] px-4 py-3 font-bold text-white disabled:opacity-50"
          disabled={submitting}
          type="submit"
        >
          {submitting ? 'Signing in…' : 'Continue securely'}
        </button>
      </form>
    </main>
  );
}

function ListingWorkspace({ api }: { readonly api: ReturnType<typeof createAdminApi> }) {
  const [status, setStatus] = useState<ListingStatus>('PENDING_REVIEW');
  const [items, setItems] = useState<readonly AdminListingQueueItem[]>([]);
  const [selected, setSelected] = useState<AdminListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.listListings(status));
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load listing queue.');
    } finally {
      setLoading(false);
    }
  }, [api, status]);
  useEffect(() => void load(), [load]);

  const moderate = async (action: 'approve' | 'reject' | 'remove'): Promise<void> => {
    if (selected === null) return;
    if (!window.confirm(`Confirm ${action} for this listing?`)) return;
    const reason =
      action === 'approve'
        ? undefined
        : (window.prompt('Document the moderation reason:')?.trim() ?? '');
    if (action !== 'approve' && reason === '') return;
    try {
      setSelected(await api.moderateListing(selected.listing.id, action, reason));
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Moderation failed.');
    }
  };

  return (
    <WorkspaceCard
      title="Listing moderation"
      subtitle="Review private submitted media and record an auditable decision."
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {(['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'REMOVED'] as const).map((item) => (
          <button
            className={`rounded-full px-4 py-2 text-xs font-bold ${status === item ? 'bg-[#123f33] text-white' : 'bg-stone-100 text-black/55'}`}
            key={item}
            onClick={() => setStatus(item)}
          >
            {item.replaceAll('_', ' ')}
          </button>
        ))}
      </div>
      {error !== null ? <ErrorBanner message={error} /> : null}
      {loading ? <p className="text-sm text-black/50">Loading queue…</p> : null}
      <div className="grid gap-3 xl:grid-cols-2">
        {items.map((item) => (
          <button
            className="flex gap-4 rounded-2xl border border-black/10 bg-white p-3 text-left hover:border-[#17664f]"
            key={item.id}
            onClick={() =>
              void api
                .getListing(item.id)
                .then(setSelected)
                .catch((caught: unknown) =>
                  setError(caught instanceof Error ? caught.message : 'Could not inspect listing.'),
                )
            }
          >
            <div
              className="h-28 w-20 shrink-0 rounded-xl bg-stone-200 bg-cover bg-center"
              style={
                item.images[0] === undefined
                  ? undefined
                  : { backgroundImage: `url(${JSON.stringify(item.images[0].url)})` }
              }
            />
            <div className="min-w-0">
              <p className="truncate font-bold">{item.title}</p>
              <p className="mt-1 text-sm text-[#17664f]">
                {item.currency} {(item.priceMinor / 100).toLocaleString()}
              </p>
              <p className="mt-3 text-xs text-black/50">
                @{item.seller.username} · {item.images.length} photos · {item.openReportCount} open
                reports
              </p>
            </div>
          </button>
        ))}
      </div>
      {selected !== null ? (
        <div className="mt-7 rounded-2xl border border-black/10 bg-[#f8f5ee] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-wider text-[#d66b45]">
                {selected.listing.status}
              </p>
              <h3 className="mt-2 text-xl font-bold">{selected.listing.title}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-black/65">
                {selected.listing.description}
              </p>
            </div>
            <button className="text-sm font-bold text-black/50" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <div className="mt-5 flex gap-3 overflow-x-auto">
            {selected.listing.images.map((image) => (
              <div
                className="h-52 w-36 shrink-0 rounded-xl bg-cover bg-center"
                key={image.id}
                style={{ backgroundImage: `url(${JSON.stringify(image.url)})` }}
              />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {selected.listing.status === 'PENDING_REVIEW' ? (
              <>
                <ActionButton label="Approve" onClick={() => void moderate('approve')} />
                <ActionButton danger label="Reject" onClick={() => void moderate('reject')} />
              </>
            ) : null}
            {['ACTIVE', 'PENDING_REVIEW', 'REJECTED'].includes(selected.listing.status) ? (
              <ActionButton danger label="Remove" onClick={() => void moderate('remove')} />
            ) : null}
          </div>
          <h4 className="mt-6 text-sm font-bold">Audit trail</h4>
          <ul className="mt-2 space-y-2 text-xs text-black/55">
            {selected.audits.map((audit) => (
              <li key={audit.id}>
                {new Date(audit.createdAt).toLocaleString()} · {audit.action} ·{' '}
                {audit.reason ?? 'No reason supplied'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </WorkspaceCard>
  );
}

function ReportWorkspace({ api }: { readonly api: ReturnType<typeof createAdminApi> }) {
  const [reports, setReports] = useState<readonly ModerationReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      api
        .listReports()
        .then(setReports)
        .catch((caught: unknown) =>
          setError(caught instanceof Error ? caught.message : 'Could not load reports.'),
        ),
    [api],
  );
  useEffect(() => void load(), [load]);
  const resolve = async (
    report: ModerationReport,
    status: 'ACTIONED' | 'DISMISSED' | 'UNDER_REVIEW',
  ) => {
    const resolution =
      status === 'UNDER_REVIEW'
        ? undefined
        : (window.prompt('Document the resolution:')?.trim() ?? '');
    if (status !== 'UNDER_REVIEW' && resolution === '') return;
    try {
      await api.updateReport(report.id, status, resolution);
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not update report.');
    }
  };
  return (
    <WorkspaceCard
      title="Safety reports"
      subtitle="Triage user and listing reports without automatic enforcement."
    >
      {error !== null ? <ErrorBanner message={error} /> : null}
      <div className="space-y-3">
        {reports.map((report) => (
          <article className="rounded-2xl border border-black/10 bg-white p-5" key={report.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#d66b45]">
                  {report.targetType} · {report.reason.replaceAll('_', ' ')}
                </p>
                <p className="mt-2 text-sm text-black/65">
                  {report.detail ?? 'No additional detail supplied.'}
                </p>
                <p className="mt-2 text-xs text-black/40">
                  Status: {report.status} · {new Date(report.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <ActionButton label="Review" onClick={() => void resolve(report, 'UNDER_REVIEW')} />
                <ActionButton label="Actioned" onClick={() => void resolve(report, 'ACTIONED')} />
                <ActionButton
                  danger
                  label="Dismiss"
                  onClick={() => void resolve(report, 'DISMISSED')}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </WorkspaceCard>
  );
}

function CategoryWorkspace({ api }: { readonly api: ReturnType<typeof createAdminApi> }) {
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      api
        .listCategories()
        .then(setCategories)
        .catch((caught: unknown) =>
          setError(caught instanceof Error ? caught.message : 'Could not load categories.'),
        ),
    [api],
  );
  useEffect(() => void load(), [load]);
  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.createCategory({ name, slug, sortOrder: categories.length * 10 });
      setName('');
      setSlug('');
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not create category.');
    }
  };
  return (
    <WorkspaceCard
      title="Category management"
      subtitle="Maintain data-driven marketplace taxonomy without deleting in-use categories."
    >
      {error !== null ? <ErrorBanner message={error} /> : null}
      <form
        className="mb-6 flex flex-wrap gap-3 rounded-2xl bg-[#f8f5ee] p-4"
        onSubmit={(event) => void create(event)}
      >
        <input
          className="min-w-48 flex-1 rounded-xl border border-black/10 bg-white px-4 py-3"
          onChange={(event) => setName(event.target.value)}
          placeholder="Category name"
          required
          value={name}
        />
        <input
          className="min-w-48 flex-1 rounded-xl border border-black/10 bg-white px-4 py-3"
          onChange={(event) => setSlug(event.target.value.toLowerCase())}
          placeholder="category-slug"
          required
          value={slug}
        />
        <button
          className="rounded-xl bg-[#123f33] px-5 py-3 text-sm font-bold text-white"
          type="submit"
        >
          Add category
        </button>
      </form>
      <div className="divide-y divide-black/10 rounded-2xl border border-black/10 bg-white">
        {categories.map((category) => (
          <div className="flex items-center justify-between gap-4 p-4" key={category.id}>
            <div>
              <p className="font-bold">{category.name}</p>
              <p className="mt-1 text-xs text-black/45">
                /{category.slug}
                {category.parentId === null ? '' : ' · subcategory'}
              </p>
            </div>
            <button
              className={`rounded-full px-4 py-2 text-xs font-bold ${category.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-black/45'}`}
              onClick={() =>
                void api
                  .updateCategory(category.id, { isActive: !category.isActive })
                  .then(load)
                  .catch((caught: unknown) =>
                    setError(
                      caught instanceof Error ? caught.message : 'Could not update category.',
                    ),
                  )
              }
            >
              {category.isActive ? 'Active' : 'Inactive'}
            </button>
          </div>
        ))}
      </div>
    </WorkspaceCard>
  );
}

function WorkspaceCard({
  children,
  subtitle,
  title,
}: {
  readonly children: React.ReactNode;
  readonly subtitle: string;
  readonly title: string;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-[#fffdf8] p-6 shadow-sm">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mb-6 mt-2 text-sm text-black/55">{subtitle}</p>
      {children}
    </div>
  );
}
function ActionButton({
  danger = false,
  label,
  onClick,
}: {
  readonly danger?: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      className={`rounded-xl px-4 py-2 text-xs font-bold ${danger ? 'bg-red-50 text-red-800' : 'bg-[#123f33] text-white'}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
function ErrorBanner({ message }: { readonly message: string }) {
  return <p className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{message}</p>;
}
function CenteredStatus({
  action,
  copy,
  onAction,
  title,
}: {
  readonly action?: string;
  readonly copy: string;
  readonly onAction?: () => void;
  readonly title: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f0e9] px-6">
      <div className="max-w-lg rounded-3xl bg-white p-9 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-black/55">{copy}</p>
        {action !== undefined && onAction !== undefined ? (
          <button
            className="mt-6 rounded-xl bg-[#123f33] px-5 py-3 text-sm font-bold text-white"
            onClick={onAction}
          >
            {action}
          </button>
        ) : null}
      </div>
    </main>
  );
}
