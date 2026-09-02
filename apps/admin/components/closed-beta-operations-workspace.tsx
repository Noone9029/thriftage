'use client';

import type { ClosedBetaOperations } from '@thriftage/shared';
import { useCallback, useEffect, useState } from 'react';

import type { AdminApi } from '../lib/admin-api';

export function ClosedBetaOperationsWorkspace({ api }: { readonly api: AdminApi }) {
  const [snapshot, setSnapshot] = useState<ClosedBetaOperations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await api.getClosedBetaOperations());
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load beta operations.');
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => void load(), [load]);

  return (
    <div className="space-y-5 rounded-3xl border border-black/10 bg-[#fffdf8] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[#d66b45]">CLOSED BETA</p>
          <h2 className="mt-2 text-2xl font-semibold">Operational snapshot</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">
            Privacy-safe marketplace, safety, and worker aggregates for the last 24 hours.
          </p>
        </div>
        <button
          className="rounded-xl bg-[#123f33] px-4 py-2 text-xs font-bold text-white"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {error === null ? null : (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>
      )}
      {loading ? <p className="text-sm text-black/50">Loading operational data…</p> : null}
      {snapshot === null ? null : <Snapshot snapshot={snapshot} />}
    </div>
  );
}

function Snapshot({ snapshot }: { readonly snapshot: ClosedBetaOperations }) {
  return (
    <>
      <div className="rounded-2xl bg-[#123f33] p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#efae8f]">
              {snapshot.runtime.environment} · {snapshot.runtime.releaseVersion}
            </p>
            <p className="mt-2 text-sm text-white/70">
              Generated {new Date(snapshot.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Flag label="Registration" on={snapshot.runtime.registration} />
            <Flag label="Phone" on={snapshot.runtime.phoneAuth} />
            <Flag label="Push" on={snapshot.runtime.pushNotifications} />
            <Flag label="Deletion" on={snapshot.runtime.accountDeletion} />
            <Flag label="Seller verification" on={snapshot.runtime.sellerVerification} />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="New registrations" value={snapshot.users.registered} />
        <Metric label="Active accounts" value={snapshot.users.active} />
        <Metric label="Listings created" value={snapshot.listings.created} />
        <Metric label="Listings pending review" value={snapshot.listings.pendingReview} />
        <Metric label="Messages sent" value={snapshot.messages.sent} />
        <Metric label="Orders created" value={snapshot.orders.created} />
        <Metric label="Orders completed" value={snapshot.orders.completed} />
        <Metric label="Orders cancelled" value={snapshot.orders.cancelled} />
        <Metric label="Open disputes" value={snapshot.safety.openDisputes} alert />
        <Metric label="Open reports" value={snapshot.safety.openReports} alert />
        <Metric label="Open message flags" value={snapshot.safety.openMessageFlags} alert />
        <Metric label="Notification backlog" value={snapshot.workers.notificationPending} alert />
        <Metric label="Notification failures" value={snapshot.workers.notificationFailed} alert />
        <Metric
          label="Delivered awaiting finalization"
          value={snapshot.orders.deliveredAwaitingFinalization}
          alert
        />
        <Metric label="Deletion failures" value={snapshot.workers.accountDeletionFailed} alert />
        <Metric
          label="Oldest notification"
          value={
            snapshot.workers.notificationOldestPendingAgeSeconds === null
              ? '—'
              : `${snapshot.workers.notificationOldestPendingAgeSeconds}s`
          }
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ExternalSignal
          copy="Crash and crash-free-session rates remain authoritative in the configured Sentry project."
          title="Crash reporting"
        />
        <ExternalSignal
          copy="SMS sends, fraud signals, and spend remain authoritative in the configured Twilio project."
          title="SMS cost and abuse"
        />
      </div>
    </>
  );
}

function Flag({ label, on }: { readonly label: string; readonly on: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-bold ${on ? 'bg-emerald-200 text-emerald-950' : 'bg-red-200 text-red-950'}`}
    >
      {label}: {on ? 'ON' : 'OFF'}
    </span>
  );
}

function Metric({
  alert = false,
  label,
  value,
}: {
  readonly alert?: boolean;
  readonly label: string;
  readonly value: number | string;
}) {
  const activeAlert = alert && typeof value === 'number' && value > 0;
  return (
    <div
      className={`rounded-2xl border p-4 ${activeAlert ? 'border-red-200 bg-red-50' : 'border-black/10 bg-white'}`}
    >
      <p className={`text-2xl font-bold ${activeAlert ? 'text-red-800' : 'text-[#123f33]'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="mt-1 text-xs font-semibold text-black/50">{label}</p>
    </div>
  );
}

function ExternalSignal({ copy, title }: { readonly copy: string; readonly title: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-sm font-bold text-amber-950">{title}: external console required</p>
      <p className="mt-2 text-xs leading-5 text-amber-900">{copy}</p>
    </div>
  );
}
