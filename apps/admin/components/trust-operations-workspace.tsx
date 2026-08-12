'use client';

import type {
  AdminReviewReportItem,
  AdminUserDetail,
  AdminUserSummary,
  DisputeDetail,
  DisputePage,
  PolicyPublishInput,
  SellerVerification,
  TrustMetrics,
} from '@thriftage/shared';
import { useCallback, useEffect, useState } from 'react';

import type { AdminApi } from '../lib/admin-api';

type View = 'OVERVIEW' | 'USERS' | 'REVIEWS' | 'DISPUTES' | 'VERIFICATIONS' | 'POLICIES';

export function TrustOperationsWorkspace({ api }: { readonly api: AdminApi }) {
  const [view, setView] = useState<View>('OVERVIEW');
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold tracking-[0.22em] text-[#d66b45]">TRUST OPERATIONS</p>
        <h2 className="mt-2 text-3xl font-semibold">Reputation & marketplace safety</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-black/55">
          Review queues, disputes, account-review badges, and scoped restrictions. Every material
          decision requires a reason and is recorded by the API.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(['OVERVIEW', 'USERS', 'REVIEWS', 'DISPUTES', 'VERIFICATIONS', 'POLICIES'] as const).map(
          (item) => (
            <button
              className={`rounded-full px-4 py-2 text-xs font-bold ${view === item ? 'bg-[#123f33] text-white' : 'bg-white text-black/60'}`}
              key={item}
              onClick={() => setView(item)}
            >
              {item.charAt(0) + item.slice(1).toLowerCase()}
            </button>
          ),
        )}
      </div>
      {view === 'OVERVIEW' ? <Overview api={api} /> : null}
      {view === 'USERS' ? <Users api={api} /> : null}
      {view === 'REVIEWS' ? <Reviews api={api} /> : null}
      {view === 'DISPUTES' ? <Disputes api={api} /> : null}
      {view === 'VERIFICATIONS' ? <Verifications api={api} /> : null}
      {view === 'POLICIES' ? <Policies api={api} /> : null}
    </div>
  );
}

function Overview({ api }: { readonly api: AdminApi }) {
  const [metrics, setMetrics] = useState<TrustMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api
      .getTrustMetrics()
      .then(setMetrics)
      .catch((caught: unknown) => setError(message(caught)));
  }, [api]);
  if (error) return <ErrorCopy copy={error} />;
  if (!metrics) return <Loading />;
  const cards = [
    ['Open review reports', metrics.openReviewReports],
    ['Open disputes', metrics.openDisputes],
    ['Pending verification', metrics.pendingVerifications],
    ['Active restrictions', metrics.activeRestrictions],
    ['Suspended accounts', metrics.suspendedAccounts],
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(([label, value]) => (
        <div className="rounded-2xl border border-black/10 bg-white p-5" key={label}>
          <p className="text-3xl font-semibold text-[#123f33]">{value}</p>
          <p className="mt-2 text-xs font-bold text-black/50">{label}</p>
        </div>
      ))}
    </div>
  );
}

function Users({ api }: { readonly api: AdminApi }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<readonly AdminUserSummary[]>([]);
  const [selected, setSelected] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setItems(await api.listTrustUsers(query.trim() || undefined));
      setError(null);
    } catch (caught) {
      setError(message(caught));
    }
  }, [api, query]);
  useEffect(() => {
    void load();
  }, [load]);
  const open = async (id: string) => {
    try {
      setSelected(await api.getTrustUser(id));
    } catch (caught) {
      setError(message(caught));
    }
  };
  const restrict = async (scope: 'MESSAGING' | 'SELLING' | 'BUYING' | 'SOCIAL') => {
    if (!selected) return;
    const reason = window.prompt(`Reason for ${scope.toLowerCase()} restriction`);
    if (!reason || reason.trim().length < 3) return;
    await api.restrictUser(selected.id, { scope, reason: reason.trim() });
    await open(selected.id);
  };
  const suspend = async () => {
    if (!selected) return;
    const reason = window.prompt('Document the suspension reason');
    if (!reason || reason.trim().length < 3 || !window.confirm('Suspend this account?')) return;
    await api.takeSafetyAction(selected.id, {
      action: 'ACCOUNT_SUSPENSION',
      reason: reason.trim(),
    });
    await open(selected.id);
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <section className="rounded-2xl bg-white p-5">
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Username or internal user ID"
            value={query}
          />
          <button
            className="rounded-xl bg-[#123f33] px-4 text-sm font-bold text-white"
            onClick={() => void load()}
          >
            Search
          </button>
        </div>
        {error ? <ErrorCopy copy={error} /> : null}
        <div className="mt-4 space-y-2">
          {items.map((user) => (
            <button
              className="w-full rounded-xl border border-black/10 p-3 text-left hover:bg-[#f3f0e9]"
              key={user.id}
              onClick={() => void open(user.id)}
            >
              <span className="font-bold">@{user.username ?? 'no-profile'}</span>
              <span className="float-right text-xs text-black/45">{user.accountStatus}</span>
              <p className="mt-1 text-xs text-black/50">
                Seller {rating(user.sellerRating.average)} · Buyer{' '}
                {rating(user.buyerRating.average)} · {user.activeRestrictions.length} restrictions
              </p>
            </button>
          ))}
        </div>
      </section>
      {selected ? (
        <section className="rounded-2xl bg-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold">@{selected.username ?? 'no-profile'}</h3>
              <p className="mt-1 text-xs text-black/45">{selected.id}</p>
            </div>
            <span className="rounded-full bg-[#f3f0e9] px-3 py-1 text-xs font-bold">
              {selected.accountStatus}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Fact label="Completed sales" value={selected.completedSales} />
            <Fact label="Completed purchases" value={selected.completedPurchases} />
            <Fact label="Reports received" value={selected.reportsReceived} />
            <Fact label="Disputes" value={selected.disputeCount} />
            <Fact label="Seller rating" value={rating(selected.sellerRating.average)} />
            <Fact label="Buyer rating" value={rating(selected.buyerRating.average)} />
          </div>
          <p className="mt-5 text-sm font-bold">
            Verification: {selected.verificationStatus ?? 'NONE'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {(['MESSAGING', 'SELLING', 'BUYING', 'SOCIAL'] as const).map((scope) => (
              <button
                className="rounded-lg border border-black/15 px-3 py-2 text-xs font-bold"
                key={scope}
                onClick={() => void restrict(scope)}
              >
                Restrict {scope.toLowerCase()}
              </button>
            ))}
            <button
              className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white"
              onClick={() => void suspend()}
            >
              Suspend account
            </button>
          </div>
          <h4 className="mt-6 font-bold">Safety history</h4>
          <div className="mt-2 space-y-2">
            {selected.safetyActions.map((action) => (
              <div className="rounded-xl bg-[#f7f5ef] p-3 text-xs" key={action.id}>
                <b>{action.type.replaceAll('_', ' ')}</b>
                <p className="mt-1 text-black/60">{action.reason}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-black/20 p-8 text-sm text-black/45">
          Select a user to inspect authorized operational context.
        </section>
      )}
    </div>
  );
}

function Reviews({ api }: { readonly api: AdminApi }) {
  const [items, setItems] = useState<readonly AdminReviewReportItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      api
        .listReviewReports()
        .then(setItems)
        .catch((caught: unknown) => setError(message(caught))),
    [api],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const moderate = async (
    item: AdminReviewReportItem,
    action: 'HIDE_TEXT' | 'INVALIDATE' | 'DISMISS_REPORT',
  ) => {
    const reason = window.prompt(`Reason for ${action.toLowerCase().replaceAll('_', ' ')}`);
    if (!reason || reason.trim().length < 3) return;
    await api.moderateReview(item.review.id, {
      action,
      reason: reason.trim(),
      reportId: item.report.id,
    });
    await load();
  };
  if (error) return <ErrorCopy copy={error} />;
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <Empty copy="No review reports require attention." />
      ) : (
        items.map((item) => (
          <article className="rounded-2xl bg-white p-5" key={item.report.id}>
            <div className="flex justify-between">
              <div>
                <p className="font-bold">
                  {item.review.rating} ★ · {item.report.reason.replaceAll('_', ' ')}
                </p>
                <p className="mt-1 text-xs text-black/45">
                  Reported by @{item.reporterUsername ?? 'unavailable'}
                </p>
              </div>
              <span className="text-xs font-bold text-[#d66b45]">{item.report.status}</span>
            </div>
            <p className="mt-4 rounded-xl bg-[#f7f5ef] p-4 text-sm">
              {item.review.text ?? 'Review text is hidden.'}
            </p>
            <div className="mt-4 flex gap-2">
              <Action label="Hide text" onClick={() => void moderate(item, 'HIDE_TEXT')} />
              <Action label="Invalidate rating" onClick={() => void moderate(item, 'INVALIDATE')} />
              <Action
                label="Dismiss report"
                onClick={() => void moderate(item, 'DISMISS_REPORT')}
              />
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function Disputes({ api }: { readonly api: AdminApi }) {
  const [page, setPage] = useState<DisputePage | null>(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DisputeDetail | null>(null);
  const load = useCallback(
    () =>
      api
        .listDisputes(status || undefined, query.trim() || undefined)
        .then(setPage)
        .catch((caught: unknown) => setError(message(caught))),
    [api, query, status],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const open = async (id: string) => {
    try {
      setSelected(await api.getDispute(id));
    } catch (caught) {
      setError(message(caught));
    }
  };
  const act = async (
    id: string,
    action: 'START_REVIEW' | 'REQUEST_INFORMATION' | 'RESOLVE' | 'REJECT' | 'CLOSE' | 'REOPEN',
  ) => {
    const note = window.prompt(`Required note for ${action.toLowerCase().replaceAll('_', ' ')}`);
    if (!note || note.trim().length < 3) return;
    const resolution =
      action === 'RESOLVE' || action === 'REJECT'
        ? window.prompt('Resolution shown to participants')
        : null;
    if (
      (action === 'RESOLVE' || action === 'REJECT') &&
      (!resolution || resolution.trim().length < 3)
    )
      return;
    await api.actOnDispute(id, {
      action,
      note: note.trim(),
      ...(resolution ? { resolution: resolution.trim() } : {}),
    });
    await load();
    if (selected?.id === id) await open(id);
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="rounded-xl border border-black/15 px-3 py-2"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Order or case UUID"
          value={query}
        />
        <select
          className="rounded-xl border border-black/15 bg-white px-3 py-2"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          <option value="">All states</option>
          {['OPEN', 'UNDER_REVIEW', 'AWAITING_INFORMATION', 'RESOLVED', 'REJECTED', 'CLOSED'].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>
      </div>
      {error ? <ErrorCopy copy={error} /> : null}
      <div className="space-y-3">
        {page?.items.map((item) => (
          <article className="rounded-2xl bg-white p-5" key={item.id}>
            <div className="flex justify-between">
              <div>
                <p className="font-bold">{item.orderNumber}</p>
                <p className="mt-1 text-xs text-black/50">
                  {item.reason.replaceAll('_', ' ')} · {item.id}
                </p>
              </div>
              <span className="text-xs font-bold text-[#d66b45]">{item.status}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Action label="Inspect case" onClick={() => void open(item.id)} />
              {item.status === 'OPEN' ? (
                <Action label="Start review" onClick={() => void act(item.id, 'START_REVIEW')} />
              ) : null}
              <Action
                label="Request info"
                onClick={() => void act(item.id, 'REQUEST_INFORMATION')}
              />
              <Action label="Resolve" onClick={() => void act(item.id, 'RESOLVE')} />
              <Action label="Reject" onClick={() => void act(item.id, 'REJECT')} />
            </div>
          </article>
        ))}
      </div>
      {selected ? (
        <section className="mt-5 rounded-2xl border border-[#123f33]/20 bg-white p-5">
          <div className="flex justify-between">
            <div>
              <h3 className="text-xl font-semibold">{selected.orderNumber}</h3>
              <p className="mt-1 text-xs text-black/45">{selected.id}</p>
            </div>
            <button className="text-sm font-bold text-black/50" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <p className="mt-4 text-sm leading-6">{selected.description}</p>
          <h4 className="mt-6 font-bold">Private evidence</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {selected.evidence.length === 0 ? (
              <p className="text-sm text-black/45">No evidence uploaded.</p>
            ) : (
              selected.evidence.map((evidence) => (
                <a
                  className="rounded-xl border border-black/15 bg-[#f7f5ef] p-4 text-sm font-bold text-[#123f33]"
                  href={evidence.url}
                  key={evidence.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open evidence ({evidence.width}×{evidence.height})
                </a>
              ))
            )}
          </div>
          <h4 className="mt-6 font-bold">Case timeline</h4>
          <div className="mt-3 space-y-2">
            {selected.timeline.map((event) => (
              <div className="rounded-xl bg-[#f7f5ef] p-3 text-xs" key={event.id}>
                <b>{event.type.replaceAll('_', ' ')}</b>
                <p className="mt-1 text-black/60">{event.message ?? 'No participant note.'}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Verifications({ api }: { readonly api: AdminApi }) {
  const [items, setItems] = useState<readonly SellerVerification[]>([]);
  const [status, setStatus] = useState('PENDING');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      api
        .listSellerVerifications(status || undefined, query.trim() || undefined)
        .then(setItems)
        .catch((caught: unknown) => setError(message(caught))),
    [api, query, status],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const decide = async (item: SellerVerification, action: 'APPROVE' | 'REJECT' | 'SUSPEND') => {
    const reason = window.prompt(`Document the ${action.toLowerCase()} decision`);
    if (!reason || reason.trim().length < 3) return;
    await api.decideSellerVerification(item.id, { action, reason: reason.trim() });
    await load();
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="rounded-xl border border-black/15 px-3 py-2"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Username or case UUID"
          value={query}
        />
        <select
          className="rounded-xl border border-black/15 bg-white px-3 py-2"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          <option value="">All states</option>
          {['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      {error ? <ErrorCopy copy={error} /> : null}
      <div className="space-y-3">
        {items.map((item) => (
          <article className="rounded-2xl bg-white p-5" key={item.id}>
            <div className="flex justify-between">
              <p className="font-bold">@{item.username}</p>
              <span className="text-xs font-bold text-[#d66b45]">{item.status}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-black/65">{item.statement}</p>
            <p className="mt-3 text-xs text-black/45">
              Account review only; no identity or item-authenticity guarantee.
            </p>
            <div className="mt-4 flex gap-2">
              <Action label="Approve" onClick={() => void decide(item, 'APPROVE')} />
              <Action label="Reject" onClick={() => void decide(item, 'REJECT')} />
              {item.status === 'VERIFIED' ? (
                <Action label="Suspend badge" onClick={() => void decide(item, 'SUSPEND')} />
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Policies({ api }: { readonly api: AdminApi }) {
  const [policyType, setPolicyType] =
    useState<PolicyPublishInput['policyType']>('COMMUNITY_GUIDELINES');
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [effectiveAt, setEffectiveAt] = useState('');
  const [messageText, setMessageText] = useState<string | null>(null);
  const submit = async () => {
    if (
      !window.confirm(
        'Publish this as the current policy version? Existing UGC acceptance will no longer satisfy this policy type.',
      )
    )
      return;
    try {
      const policy = await api.publishPolicy({
        policyType,
        version,
        title,
        url,
        effectiveAt: new Date(effectiveAt).toISOString(),
        requiredForUgc: true,
      });
      setMessageText(`Published ${policy.title} ${policy.version}.`);
      setVersion('');
      setTitle('');
      setUrl('');
      setEffectiveAt('');
    } catch (caught) {
      setMessageText(message(caught));
    }
  };
  return (
    <section className="max-w-2xl rounded-2xl bg-white p-6">
      <h3 className="text-xl font-semibold">Publish policy version</h3>
      <p className="mt-2 text-sm leading-6 text-black/55">
        Only publish legal/business-approved content at its final public URL. Publishing replaces
        the current version for this policy type and requires fresh user acceptance.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-black/60">
          Type
          <select
            className="mt-2 w-full rounded-xl border border-black/15 bg-white px-3 py-3"
            onChange={(event) =>
              setPolicyType(event.target.value as PolicyPublishInput['policyType'])
            }
            value={policyType}
          >
            {['TERMS_OF_USE', 'PRIVACY_POLICY', 'COMMUNITY_GUIDELINES'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <Field label="Version" onChange={setVersion} value={version} />
        <Field label="Title" onChange={setTitle} value={title} />
        <Field label="Public HTTPS URL" onChange={setUrl} value={url} />
        <Field
          label="Effective date/time"
          onChange={setEffectiveAt}
          type="datetime-local"
          value={effectiveAt}
        />
      </div>
      <button
        className="mt-6 rounded-xl bg-[#123f33] px-5 py-3 text-sm font-bold text-white"
        disabled={!version || !title || !url || !effectiveAt}
        onClick={() => void submit()}
      >
        Publish current version
      </button>
      {messageText ? <p className="mt-4 text-sm text-black/65">{messageText}</p> : null}
    </section>
  );
}

function Action({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return (
    <button
      className="rounded-lg border border-black/15 px-3 py-2 text-xs font-bold hover:bg-[#f3f0e9]"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
function Field({
  label,
  onChange,
  type = 'text',
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly type?: string;
  readonly value: string;
}) {
  return (
    <label className="text-xs font-bold text-black/60">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-black/15 px-3 py-3"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}
function Fact({ label, value }: { readonly label: string; readonly value: number | string }) {
  return (
    <div className="rounded-xl bg-[#f7f5ef] p-3">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-black/45">{label}</p>
    </div>
  );
}
function Loading() {
  return (
    <p className="rounded-2xl bg-white p-6 text-sm text-black/50">Loading operational data…</p>
  );
}
function Empty({ copy }: { readonly copy: string }) {
  return <p className="rounded-2xl bg-white p-6 text-sm text-black/50">{copy}</p>;
}
function ErrorCopy({ copy }: { readonly copy: string }) {
  return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{copy}</p>;
}
function message(caught: unknown) {
  return caught instanceof Error ? caught.message : 'The operation failed.';
}
function rating(value: number | null) {
  return value === null ? '—' : `${value.toFixed(1)} ★`;
}
