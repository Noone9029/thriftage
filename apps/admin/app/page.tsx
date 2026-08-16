'use client';

import type {
  AdminListingDetail,
  AdminListingQueueItem,
  Category,
  ListingStatus,
  ModerationReport,
  AdminConversationDetail,
  MessageFlag,
  OrderDetail,
  OrderSummary,
  RecommendationConfigurationInput,
  AiStylistAdminMetrics,
} from '@thriftage/shared';
import type { Session } from '@supabase/supabase-js';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { createAdminApi } from '../lib/admin-api';
import { getSupabaseBrowserClient } from '../lib/supabase';
import { TrustOperationsWorkspace } from '../components/trust-operations-workspace';
import { FeedbackOperationsWorkspace } from '../components/feedback-operations-workspace';
import { ClosedBetaOperationsWorkspace } from '../components/closed-beta-operations-workspace';

type Workspace =
  | 'BETA_STATUS'
  | 'CATEGORIES'
  | 'LISTINGS'
  | 'REPORTS'
  | 'MESSAGES'
  | 'ORDERS'
  | 'TRUST'
  | 'PERSONALIZATION'
  | 'AI_STYLIST'
  | 'FEEDBACK';
type AccessState = 'CHECKING' | 'DENIED' | 'SIGNED_OUT' | 'AUTHORIZED';

export default function AdminHome() {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<AccessState>('CHECKING');
  const [workspace, setWorkspace] = useState<Workspace>('BETA_STATUS');
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
          {(
            [
              'BETA_STATUS',
              'LISTINGS',
              'MESSAGES',
              'ORDERS',
              'REPORTS',
              'TRUST',
              'PERSONALIZATION',
              'AI_STYLIST',
              'FEEDBACK',
              'CATEGORIES',
            ] as const
          ).map((item) => (
            <button
              className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold ${workspace === item ? 'bg-[#123f33] text-white' : 'bg-white text-black/65 hover:bg-white/70'}`}
              key={item}
              onClick={() => setWorkspace(item)}
            >
              {item === 'AI_STYLIST'
                ? 'AI Stylist'
                : item === 'BETA_STATUS'
                  ? 'Beta status'
                  : item.charAt(0) + item.slice(1).toLowerCase()}
            </button>
          ))}
        </nav>
        <section>
          {workspace === 'BETA_STATUS' ? <ClosedBetaOperationsWorkspace api={api} /> : null}
          {workspace === 'LISTINGS' ? <ListingWorkspace api={api} /> : null}
          {workspace === 'REPORTS' ? <ReportWorkspace api={api} /> : null}
          {workspace === 'CATEGORIES' ? <CategoryWorkspace api={api} /> : null}
          {workspace === 'MESSAGES' ? <MessageModerationWorkspace api={api} /> : null}
          {workspace === 'ORDERS' ? <OrderWorkspace api={api} /> : null}
          {workspace === 'TRUST' ? <TrustOperationsWorkspace api={api} /> : null}
          {workspace === 'PERSONALIZATION' ? <PersonalizationWorkspace api={api} /> : null}
          {workspace === 'AI_STYLIST' ? <AiStylistWorkspace api={api} /> : null}
          {workspace === 'FEEDBACK' ? <FeedbackOperationsWorkspace api={api} /> : null}
        </section>
      </div>
    </main>
  );
}

function AiStylistWorkspace({ api }: { readonly api: ReturnType<typeof createAdminApi> }) {
  const [metrics, setMetrics] = useState<AiStylistAdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMetrics(await api.getAiStylistMetrics());
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load AI Stylist operations.');
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => void load(), [load]);

  return (
    <WorkspaceCard
      title="AI Stylist operations"
      subtitle="Aggregate usage, cost, reliability, conversion, and active configuration. Private conversation transcripts are intentionally unavailable."
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f8f5ee] p-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-black/45">LAST 24 HOURS</p>
          <p className="mt-1 text-sm text-black/60">
            Operational aggregates only; no prompt or message bodies.
          </p>
        </div>
        <button
          className="rounded-xl bg-[#123f33] px-4 py-2 text-xs font-bold text-white"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {error !== null ? <ErrorBanner message={error} /> : null}
      {loading ? <p className="text-sm text-black/50">Loading AI operations…</p> : null}
      {metrics !== null ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AiMetric label="Generations" value={metrics.generations.toLocaleString()} />
            <AiMetric label="Active users" value={metrics.activeUsers.toLocaleString()} />
            <AiMetric
              label="Average latency"
              value={
                metrics.averageLatencyMs === null
                  ? '—'
                  : `${Math.round(metrics.averageLatencyMs).toLocaleString()} ms`
              }
            />
            <AiMetric
              label="Latency p50 / p95"
              value={`${metrics.latencyP50Ms === null ? '—' : `${Math.round(metrics.latencyP50Ms)} ms`} / ${metrics.latencyP95Ms === null ? '—' : `${Math.round(metrics.latencyP95Ms)} ms`}`}
            />
            <AiMetric
              label="Estimated provider cost"
              value={`$${(metrics.estimatedCostMicroUsd / 1_000_000).toFixed(4)}`}
            />
            <AiMetric label="Input tokens" value={metrics.inputTokens.toLocaleString()} />
            <AiMetric
              label="Cached input tokens"
              value={metrics.cachedInputTokens.toLocaleString()}
            />
            <AiMetric label="Output tokens" value={metrics.outputTokens.toLocaleString()} />
            <AiMetric label="Fallback rate" value={`${(metrics.fallbackRate * 100).toFixed(1)}%`} />
            <AiMetric
              label="Outfit save rate"
              value={`${(metrics.outfitSaveRate * 100).toFixed(1)}%`}
            />
            <AiMetric
              label="AI-to-listing CTR"
              value={`${(metrics.listingClickThroughRate * 100).toFixed(1)}%`}
            />
            <AiMetric
              label="Provider error rate"
              value={`${(metrics.providerErrorRate * 100).toFixed(1)}%`}
            />
            <AiMetric label="Saved outfits" value={metrics.savedOutfits.toLocaleString()} />
            <AiMetric
              label="AI listing opens"
              value={metricCount(metrics.attribution, 'OPEN').toLocaleString()}
            />
            <AiMetric
              label="AI purchases"
              value={metricCount(metrics.attribution, 'PURCHASE').toLocaleString()}
            />
          </div>
          <section className="rounded-2xl border border-black/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-widest text-[#d66b45]">ACTIVE RUNTIME</p>
                <h3 className="mt-2 text-lg font-bold">{metrics.configuration.model}</h3>
                <p className="mt-1 text-sm text-black/55">
                  Reasoning: {metrics.configuration.reasoningEffort} · Prompt:{' '}
                  {metrics.configuration.promptVersion}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-2 text-xs font-bold ${metrics.configuration.enabled ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}
              >
                {metrics.configuration.enabled ? 'ENABLED' : 'KILL SWITCH ACTIVE'}
              </span>
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
              <AiConfig label="Eval version" value={metrics.configuration.evalVersion} />
              <AiConfig label="Tool schema" value={metrics.configuration.toolSchemaVersion} />
              <AiConfig
                label="Daily user limit"
                value={metrics.configuration.dailyUserLimit.toLocaleString()}
              />
              <AiConfig
                label="Requests / minute"
                value={metrics.configuration.maxRequestsPerMinute.toLocaleString()}
              />
              <AiConfig
                label="Session turn limit"
                value={metrics.configuration.sessionTurnLimit.toLocaleString()}
              />
              <AiConfig
                label="Global concurrent limit"
                value={metrics.configuration.maxConcurrentGenerations.toLocaleString()}
              />
              <AiConfig
                label="Max outfit options"
                value={metrics.configuration.maxOutfitOptions.toLocaleString()}
              />
              <AiConfig
                label="Timeout"
                value={`${metrics.configuration.timeoutMs.toLocaleString()} ms`}
              />
              <AiConfig
                label="Daily cost ceiling"
                value={
                  metrics.configuration.dailyBudgetMicroUsd === null
                    ? 'Not configured'
                    : `$${(metrics.configuration.dailyBudgetMicroUsd / 1_000_000).toFixed(2)}`
                }
              />
            </dl>
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <AggregateTable title="Generation status" items={metrics.generationsByStatus} />
            <AggregateTable title="Model distribution" items={metrics.generationsByModel} />
          </section>
          <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Runtime settings are environment-controlled for this release. Change the model, prompt,
            limits, or kill switch through the audited deployment configuration and run the eval
            suite before activation.
          </p>
        </div>
      ) : null}
    </WorkspaceCard>
  );
}

function metricCount(
  items: readonly { readonly count: number; readonly key: string }[],
  key: string,
): number {
  return items.find((item) => item.key === key)?.count ?? 0;
}

function AiMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="text-2xl font-bold text-[#123f33]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-black/50">{label}</p>
    </div>
  );
}

function AiConfig({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-xl bg-[#f8f5ee] p-3">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-black/40">{label}</dt>
      <dd className="mt-1 font-semibold text-black/70">{value}</dd>
    </div>
  );
}

function AggregateTable({
  items,
  title,
}: {
  readonly items: readonly { readonly count: number; readonly key: string }[];
  readonly title: string;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5">
      <h3 className="font-bold">{title}</h3>
      <div className="mt-3 divide-y divide-black/10">
        {items.length === 0 ? (
          <p className="py-3 text-sm text-black/45">No activity in this window.</p>
        ) : null}
        {items.map((item) => (
          <div className="flex justify-between py-3 text-sm" key={item.key}>
            <span className="text-black/60">{item.key.replaceAll('_', ' ')}</span>
            <strong>{item.count.toLocaleString()}</strong>
          </div>
        ))}
      </div>
    </div>
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

function MessageModerationWorkspace({ api }: { readonly api: ReturnType<typeof createAdminApi> }) {
  const [flags, setFlags] = useState<readonly MessageFlag[]>([]);
  const [detail, setDetail] = useState<AdminConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      api
        .listMessageFlags()
        .then(setFlags)
        .catch((caught: unknown) =>
          setError(caught instanceof Error ? caught.message : 'Could not load message flags.'),
        ),
    [api],
  );
  useEffect(() => void load(), [load]);
  const review = async (flag: MessageFlag, status: 'ACTIONED' | 'DISMISSED') => {
    const resolution = window.prompt('Document the moderation decision:')?.trim() ?? '';
    if (resolution === '') return;
    try {
      await api.reviewMessageFlag(flag.id, status, resolution);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Review failed.');
    }
  };
  return (
    <WorkspaceCard
      title="Flagged conversations"
      subtitle="Purpose-limited review of deterministic contact-sharing flags. Every conversation read is audited."
    >
      {error !== null ? <ErrorBanner message={error} /> : null}
      <div className="space-y-3">
        {flags.map((flag) => (
          <article className="rounded-2xl border border-black/10 bg-white p-5" key={flag.id}>
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-[#d66b45]">
                  {flag.category.replaceAll('_', ' ')} · {flag.blocked ? 'BLOCKED' : 'FLAGGED'} ·{' '}
                  {flag.confidence}%
                </p>
                <p className="mt-2 text-sm text-black/60">
                  Status: {flag.status} · Detector: {flag.detector}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  label="Inspect context"
                  onClick={() =>
                    void api
                      .getModeratedConversation(flag.conversationId)
                      .then(setDetail)
                      .catch((caught: unknown) =>
                        setError(caught instanceof Error ? caught.message : 'Inspection failed.'),
                      )
                  }
                />
                <ActionButton label="Actioned" onClick={() => void review(flag, 'ACTIONED')} />
                <ActionButton
                  danger
                  label="Dismiss"
                  onClick={() => void review(flag, 'DISMISSED')}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
      {detail !== null ? (
        <div className="mt-6 rounded-2xl bg-[#f8f5ee] p-5">
          <div className="flex justify-between">
            <h3 className="font-bold">
              Conversation context · {detail.conversation.listing.title}
            </h3>
            <button onClick={() => setDetail(null)}>Close</button>
          </div>
          <div className="mt-4 space-y-2">
            {detail.messages.map((message) => (
              <div className="rounded-xl bg-white p-3 text-sm" key={message.id}>
                <span className="font-bold">
                  {message.senderId === detail.conversation.buyer.id ? 'Buyer' : 'Seller'}:
                </span>{' '}
                {message.body}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </WorkspaceCard>
  );
}

function OrderWorkspace({ api }: { readonly api: ReturnType<typeof createAdminApi> }) {
  const [orders, setOrders] = useState<readonly OrderSummary[]>([]);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api
      .listOrders()
      .then(setOrders)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Could not load orders.'),
      );
  }, [api]);
  return (
    <WorkspaceCard
      title="Order operations"
      subtitle="Inspect transaction snapshots and immutable lifecycle history. State changes remain participant-owned domain actions."
    >
      {error !== null ? <ErrorBanner message={error} /> : null}
      <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-100 text-xs text-black/50">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Listing</th>
              <th className="p-3">Buyer / Seller</th>
              <th className="p-3">Status</th>
              <th className="p-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                className="cursor-pointer border-t border-black/10 hover:bg-stone-50"
                key={order.id}
                onClick={() => void api.getOrder(order.id).then(setDetail)}
              >
                <td className="p-3 font-bold">{order.orderNumber}</td>
                <td className="p-3">{order.listingTitle}</td>
                <td className="p-3">
                  @{order.buyer.username} / @{order.seller.username}
                </td>
                <td className="p-3 font-bold text-[#d66b45]">{order.status}</td>
                <td className="p-3">
                  {order.currency} {(order.totalMinor / 100).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail !== null ? (
        <div className="mt-6 rounded-2xl bg-[#f8f5ee] p-5">
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-bold text-[#d66b45]">
                {detail.status} · {detail.payment.status}
              </p>
              <h3 className="mt-2 text-xl font-bold">{detail.orderNumber}</h3>
            </div>
            <button onClick={() => setDetail(null)}>Close</button>
          </div>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <p>
              <b>Item:</b> {detail.listingTitle}
            </p>
            <p>
              <b>Shipment:</b> {detail.shipment?.providerDisplayName ?? 'Not shipped'}
            </p>
            <p>
              <b>Buyer:</b> @{detail.buyer.username}
            </p>
            <p>
              <b>Seller:</b> @{detail.seller.username}
            </p>
            <p>
              <b>Cancellation:</b> {detail.cancellationReason ?? 'None'}
            </p>
            <p>
              <b>Destination:</b> {detail.address.city}, {detail.address.countryCode}
            </p>
          </div>
          <h4 className="mt-5 font-bold">History</h4>
          <ul className="mt-2 space-y-1 text-xs text-black/60">
            {detail.events.map((event) => (
              <li key={event.id}>
                {new Date(event.createdAt).toLocaleString()} · {event.type} · {event.actorType}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </WorkspaceCard>
  );
}

function PersonalizationWorkspace({ api }: { readonly api: ReturnType<typeof createAdminApi> }) {
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof api.getPersonalizationSummary>
  > | null>(null);
  const [configurations, setConfigurations] = useState<
    Awaited<ReturnType<typeof api.getRecommendationConfigurations>>
  >([]);
  const [styles, setStyles] = useState<Awaited<ReturnType<typeof api.getStyleDefinitions>>>([]);
  const [draft, setDraft] = useState<RecommendationConfigurationInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [nextSummary, nextConfigurations, nextStyles] = await Promise.all([
        api.getPersonalizationSummary(),
        api.getRecommendationConfigurations(),
        api.getStyleDefinitions(),
      ]);
      setSummary(nextSummary);
      setConfigurations(nextConfigurations);
      setStyles(nextStyles);
      const active = nextConfigurations.find(({ isActive }) => isActive);
      if (active !== undefined) {
        setDraft(
          (current) =>
            current ?? {
              behaviorWeight: active.behaviorWeight,
              candidateLimit: active.candidateLimit,
              engagementWeight: active.engagementWeight,
              explorationPercent: active.explorationPercent,
              explorationWeight: active.explorationWeight,
              freshnessWeight: active.freshnessWeight,
              maxPerSeller: active.maxPerSeller,
              maxPerStyle: active.maxPerStyle,
              personalWeight: active.personalWeight,
              sellerWeight: active.sellerWeight,
              trustWeight: active.trustWeight,
              version: `${active.version}-next`,
            },
        );
      }
      setError(null);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Personalization operations could not be loaded.',
      );
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const eventTotal = summary?.events.reduce((total, event) => total + event._count._all, 0) ?? 0;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-[#a24c2f]">
          PRIVACY-SAFE OPERATIONS
        </p>
        <h2 className="mt-1 text-3xl font-semibold">Style intelligence</h2>
        <p className="mt-2 max-w-3xl text-sm text-black/60">
          Aggregate taxonomy, scoring versions, and funnel health. Individual preference profiles
          are deliberately unavailable here.
        </p>
      </div>
      {error !== null ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Profiles started" value={summary?.profiles ?? 0} />
        <Metric label="Profiles completed" value={summary?.completedProfiles ?? 0} />
        <Metric label="Ranking events" value={eventTotal} />
        <Metric label="Not interested" value={summary?.hiddenRecommendations ?? 0} />
      </div>
      <p className="text-sm text-black/55">
        {summary?.impressionMatchCount ?? 0} scored impressions · average match{' '}
        {summary?.impressionMatchAverage === null || summary?.impressionMatchAverage === undefined
          ? 'not available'
          : `${Math.round(summary.impressionMatchAverage)}%`}
      </p>
      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Ranking configuration</h3>
            <p className="text-sm text-black/55">
              Create an audited version. Active feed cursors refresh when the version changes.
            </p>
          </div>
          <span className="rounded-full bg-[#dce9e2] px-3 py-1 text-xs font-bold text-[#123f33]">
            {configurations.find(({ isActive }) => isActive)?.version ?? 'No active version'}
          </span>
        </div>
        {configurations.map((configuration) => (
          <div
            className="mt-4 grid gap-2 rounded-xl bg-[#f3f0e9] p-4 text-xs sm:grid-cols-4"
            key={configuration.id}
          >
            <span>Personal {configuration.personalWeight}%</span>
            <span>Behavior {configuration.behaviorWeight}%</span>
            <span>Freshness {configuration.freshnessWeight}%</span>
            <span>Diversity {configuration.maxPerSeller}/seller</span>
          </div>
        ))}
        {draft !== null ? (
          <form
            className="mt-5 space-y-4 border-t border-black/10 pt-5"
            onSubmit={(event) => {
              event.preventDefault();
              void api
                .activateRecommendationConfiguration(draft)
                .then(async () => {
                  setDraft(null);
                  await load();
                })
                .catch((caught: unknown) =>
                  setError(
                    caught instanceof Error ? caught.message : 'Configuration activation failed.',
                  ),
                );
            }}
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <ConfigField
                label="Version"
                value={draft.version}
                onChange={(value) => setDraft({ ...draft, version: value })}
              />
              <ConfigField
                label="Personal %"
                numeric
                value={draft.personalWeight}
                onChange={(value) => setDraft({ ...draft, personalWeight: Number(value) })}
              />
              <ConfigField
                label="Behavior %"
                numeric
                value={draft.behaviorWeight}
                onChange={(value) => setDraft({ ...draft, behaviorWeight: Number(value) })}
              />
              <ConfigField
                label="Seller %"
                numeric
                value={draft.sellerWeight}
                onChange={(value) => setDraft({ ...draft, sellerWeight: Number(value) })}
              />
              <ConfigField
                label="Freshness %"
                numeric
                value={draft.freshnessWeight}
                onChange={(value) => setDraft({ ...draft, freshnessWeight: Number(value) })}
              />
              <ConfigField
                label="Trust %"
                numeric
                value={draft.trustWeight}
                onChange={(value) => setDraft({ ...draft, trustWeight: Number(value) })}
              />
              <ConfigField
                label="Engagement %"
                numeric
                value={draft.engagementWeight}
                onChange={(value) => setDraft({ ...draft, engagementWeight: Number(value) })}
              />
              <ConfigField
                label="Exploration %"
                numeric
                value={draft.explorationWeight}
                onChange={(value) => setDraft({ ...draft, explorationWeight: Number(value) })}
              />
            </div>
            <p className="text-xs text-black/50">
              Weights must total 100. Candidate and diversity limits remain copied from the active
              version.
            </p>
            <button
              className="rounded-xl bg-[#123f33] px-4 py-2 text-sm font-bold text-white"
              type="submit"
            >
              Activate new version
            </button>
          </form>
        ) : null}
      </section>
      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h3 className="text-lg font-bold">Style taxonomy</h3>
        <p className="text-sm text-black/55">
          Deactivate styles to prevent new selection; existing historical references remain intact.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {styles.map((style) => (
            <div
              className="flex items-start justify-between rounded-xl border border-black/10 p-4"
              key={style.id}
            >
              <div>
                <p className="font-bold">{style.displayName}</p>
                <p className="mt-1 text-xs text-black/50">{style.description}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-black/35">
                  {summary?.styleSelectionCounts.find(
                    ({ styleDefinitionId }) => styleDefinitionId === style.id,
                  )?._count._all ?? 0}{' '}
                  selections
                </p>
              </div>
              <button
                className={`rounded-full px-3 py-1 text-xs font-bold ${style.isActive ? 'bg-[#dce9e2] text-[#123f33]' : 'bg-black/10 text-black/50'}`}
                onClick={() =>
                  void api.updateStyleDefinition(style.id, { isActive: !style.isActive }).then(load)
                }
              >
                {style.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="text-2xl font-bold text-[#123f33]">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs font-semibold text-black/50">{label}</p>
    </div>
  );
}

function ConfigField({
  label,
  numeric = false,
  onChange,
  value,
}: {
  readonly label: string;
  readonly numeric?: boolean;
  readonly onChange: (value: string) => void;
  readonly value: number | string;
}) {
  return (
    <label className="text-xs font-bold text-black/55">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black"
        min={numeric ? 0 : undefined}
        onChange={(event) => onChange(event.target.value)}
        type={numeric ? 'number' : 'text'}
        value={value}
      />
    </label>
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
