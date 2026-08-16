'use client';

import type {
  AdminAiResponseFeedback,
  AdminBetaFeedback,
  FeedbackModerationInput,
  FeedbackReviewStatus,
} from '@thriftage/shared';
import { useCallback, useEffect, useState } from 'react';

import type { AdminApi } from '../lib/admin-api';

type QueueKind = 'AI' | 'BETA';
const statuses: readonly FeedbackReviewStatus[] = ['OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED'];

export function FeedbackOperationsWorkspace({ api }: { readonly api: AdminApi }) {
  const [kind, setKind] = useState<QueueKind>('BETA');
  const [status, setStatus] = useState<FeedbackReviewStatus>('OPEN');
  const [beta, setBeta] = useState<readonly AdminBetaFeedback[]>([]);
  const [ai, setAi] = useState<readonly AdminAiResponseFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (kind === 'BETA') setBeta(await api.listBetaFeedback(status));
      else setAi(await api.listAiResponseFeedback(status));
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load the feedback queue.');
    } finally {
      setLoading(false);
    }
  }, [api, kind, status]);
  useEffect(() => void load(), [load]);

  const moderate = async (
    id: string,
    nextStatus: FeedbackModerationInput['status'],
  ): Promise<void> => {
    const resolution =
      nextStatus === 'UNDER_REVIEW'
        ? undefined
        : window.prompt('Document the review outcome. This is retained with the decision.')?.trim();
    if (nextStatus !== 'UNDER_REVIEW' && (!resolution || resolution.length < 3)) return;
    if (!window.confirm(`Move this ${kind.toLowerCase()} feedback to ${nextStatus}?`)) return;
    try {
      const input =
        resolution === undefined ? { status: nextStatus } : { resolution, status: nextStatus };
      if (kind === 'BETA') await api.moderateBetaFeedback(id, input);
      else await api.moderateAiResponseFeedback(id, input);
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Feedback review failed.');
    }
  };

  const items = kind === 'BETA' ? beta : ai;
  return (
    <div className="rounded-3xl border border-black/10 bg-[#fffdf8] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[#d66b45]">CLOSED BETA</p>
          <h2 className="mt-2 text-2xl font-semibold">Feedback operations</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">
            Review tester reports and AI response concerns. AI transcripts, prompts, and response
            payloads are intentionally excluded; only safe generation metadata is available.
          </p>
        </div>
        <button
          className="rounded-xl bg-[#123f33] px-4 py-2 text-xs font-bold text-white"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {(['BETA', 'AI'] as const).map((value) => (
          <button
            className={`rounded-full px-4 py-2 text-xs font-bold ${kind === value ? 'bg-[#123f33] text-white' : 'bg-stone-100 text-black/55'}`}
            key={value}
            onClick={() => setKind(value)}
          >
            {value === 'AI' ? 'AI responses' : 'General beta'}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {statuses.map((value) => (
          <button
            className={`rounded-full px-3 py-2 text-[11px] font-bold ${status === value ? 'bg-[#d66b45] text-white' : 'bg-stone-100 text-black/50'}`}
            key={value}
            onClick={() => setStatus(value)}
          >
            {value.replaceAll('_', ' ')}
          </button>
        ))}
      </div>
      {error === null ? null : (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>
      )}
      {loading ? <p className="mt-5 text-sm text-black/50">Loading feedback…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-white p-5 text-sm text-black/45">
          No {status.toLowerCase().replaceAll('_', ' ')} feedback in this queue.
        </p>
      ) : null}
      <div className="mt-5 space-y-3">
        {kind === 'BETA'
          ? beta.map((item) => (
              <FeedbackCard
                id={item.id}
                key={item.id}
                metadata={`${item.platform} · app ${item.appVersion} · build ${item.buildNumber}${item.route === undefined ? '' : ` · ${item.route}`}`}
                onModerate={moderate}
                status={item.status}
                text={item.description}
                title={item.category.replaceAll('_', ' ')}
              />
            ))
          : ai.map((item) => (
              <FeedbackCard
                id={item.id}
                key={item.id}
                metadata={`${item.generation.provider} · ${item.generation.requestedModel} · ${item.generation.promptVersion} · ${item.generation.status}`}
                onModerate={moderate}
                status={item.status}
                text={item.reason ?? 'No written reason supplied.'}
                title={item.kind.replaceAll('_', ' ')}
              />
            ))}
      </div>
    </div>
  );
}

function FeedbackCard({
  id,
  metadata,
  onModerate,
  status,
  text,
  title,
}: {
  readonly id: string;
  readonly metadata: string;
  readonly onModerate: (id: string, status: FeedbackModerationInput['status']) => Promise<void>;
  readonly status: FeedbackReviewStatus;
  readonly text: string;
  readonly title: string;
}) {
  const open = status === 'OPEN' || status === 'UNDER_REVIEW';
  return (
    <article className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#123f33]">{title}</p>
          <p className="mt-1 text-xs text-black/40">{metadata}</p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold text-black/55">
          {status.replaceAll('_', ' ')}
        </span>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-black/70">{text}</p>
      {open ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {status === 'OPEN' ? (
            <ReviewButton
              label="Start review"
              onClick={() => void onModerate(id, 'UNDER_REVIEW')}
            />
          ) : null}
          <ReviewButton label="Actioned" onClick={() => void onModerate(id, 'ACTIONED')} />
          <ReviewButton label="Dismiss" onClick={() => void onModerate(id, 'DISMISSED')} />
        </div>
      ) : null}
    </article>
  );
}

function ReviewButton({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      className="rounded-lg border border-black/15 px-3 py-2 text-xs font-bold hover:bg-[#f3f0e9]"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
