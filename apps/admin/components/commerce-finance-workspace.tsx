'use client';

import type {
  CommerceMetrics,
  CommerceMetricsQuery,
  SellerInventoryOperations,
} from '@thriftage/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AdminApi } from '../lib/admin-api';

const moneyFields: ReadonlySet<keyof CommerceMetrics> = new Set([
  'commissionAccruedMinor',
  'commissionEarnedMinor',
  'commissionReversedMinor',
  'completedGmvMinor',
  'contributionMarginMinor',
  'courierCostsMinor',
  'payoutsMinor',
  'placedGmvMinor',
  'providerCostsMinor',
  'refundsMinor',
  'sellerLiabilitiesMinor',
]);

const metricLabels: Readonly<Record<keyof CommerceMetrics, string>> = {
  activeSellers: 'Active sellers',
  activeUsers: 'Active users',
  commissionAccruedMinor: 'Commission accrued',
  commissionEarnedMinor: 'Commission earned',
  commissionReversedMinor: 'Commission reversed',
  completedGmvMinor: 'Completed GMV',
  contributionMarginMinor: 'Contribution margin',
  courierCostsMinor: 'Courier costs',
  disputes: 'Disputes',
  from: 'From',
  orders: 'Orders placed',
  payoutBatches: 'Payout batches',
  payoutsMinor: 'Payouts',
  placedGmvMinor: 'Placed GMV',
  providerCostsMinor: 'Provider costs',
  reconciliationExceptions: 'Reconciliation exceptions',
  refundsMinor: 'Refunds',
  registrations: 'Registrations',
  sellerLiabilitiesMinor: 'Seller liabilities',
  to: 'To',
  totalSellers: 'Total sellers',
  unitsSold: 'Units sold',
};

export function CommerceFinanceWorkspace({ api }: { readonly api: AdminApi }) {
  const [metrics, setMetrics] = useState<CommerceMetrics | null>(null);
  const [sellers, setSellers] = useState<SellerInventoryOperations>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const query = useMemo<CommerceMetricsQuery>(
    () => ({
      ...(from === '' ? {} : { from: new Date(`${from}T00:00:00`).toISOString() }),
      ...(to === '' ? {} : { to: new Date(`${to}T23:59:59.999`).toISOString() }),
    }),
    [from, to],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextMetrics, nextSellers] = await Promise.all([
        api.getCommerceMetrics(query),
        api.getSellerInventory(),
      ]);
      setMetrics(nextMetrics);
      setSellers(nextSellers);
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load commerce finance data.');
    } finally {
      setLoading(false);
    }
  }, [api, query]);

  useEffect(() => void load(), [load]);

  return (
    <div className="space-y-5 rounded-3xl border border-black/10 bg-[#fffdf8] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[#d66b45]">MARKETPLACE LEDGER</p>
          <h2 className="mt-2 text-2xl font-semibold">Commerce and contribution margin</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/55">
            Domain records are authoritative. Contribution margin excludes overhead and corporate
            tax, so this dashboard never labels it as profit.
          </p>
        </div>
        <button
          className="rounded-xl border border-[#123f33] px-4 py-2 text-xs font-bold text-[#123f33]"
          onClick={() =>
            void api
              .downloadCommerceMetricsCsv(query)
              .catch((caught: unknown) =>
                setError(caught instanceof Error ? caught.message : 'CSV export failed.'),
              )
          }
        >
          Export matching CSV
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-[#f8f5ee] p-4">
        <DateField label="From" onChange={setFrom} value={from} />
        <DateField label="To" onChange={setTo} value={to} />
        <button
          className="rounded-xl bg-[#123f33] px-4 py-3 text-xs font-bold text-white"
          onClick={() => void load()}
        >
          Apply range
        </button>
        <button
          className="rounded-xl px-4 py-3 text-xs font-bold text-black/55"
          onClick={() => {
            setFrom('');
            setTo('');
          }}
        >
          Lifetime
        </button>
      </div>

      {error === null ? null : (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>
      )}
      {loading ? <p className="text-sm text-black/50">Loading commerce ledger…</p> : null}
      {metrics === null ? null : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(metricLabels) as (keyof CommerceMetrics)[])
            .filter((key) => key !== 'from' && key !== 'to')
            .map((key) => (
              <Metric
                key={key}
                label={metricLabels[key]}
                value={formatMetric(key, metrics[key])}
                alert={key === 'reconciliationExceptions' || key === 'sellerLiabilitiesMinor'}
              />
            ))}
        </div>
      )}

      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Seller inventory</h3>
            <p className="mt-1 text-xs text-black/50">
              Generic accounts become sellers through listing activity; there is no vendor account
              class.
            </p>
          </div>
          <span className="rounded-full bg-[#e7eee9] px-3 py-1 text-xs font-bold text-[#123f33]">
            {sellers.length} sellers
          </span>
        </div>
        <div className="mt-4 divide-y divide-black/10">
          {sellers.length === 0 ? (
            <p className="py-4 text-sm text-black/45">No sellers in this environment.</p>
          ) : null}
          {sellers.map((seller) => (
            <details className="py-3" key={seller.sellerId}>
              <summary className="cursor-pointer list-none text-sm font-bold">
                @{seller.username} · {seller.listingCount} listings ·{' '}
                {seller.active ? 'active' : 'inactive'}
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="text-black/45">
                    <tr>
                      <th className="pb-2">Listing</th>
                      <th>Status</th>
                      <th>Available</th>
                      <th>Reserved</th>
                      <th>Sold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10">
                    {seller.listings.map((listing) => (
                      <tr key={listing.id}>
                        <td className="py-2 font-semibold">{listing.title}</td>
                        <td>{listing.status}</td>
                        <td>{listing.stockAvailable}</td>
                        <td>{listing.stockReserved}</td>
                        <td>{listing.stockSold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      </section>

      <p className="rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">
        Settlement matching, refund approval, shipment evidence, and payout batch approval are
        protected API operations. Weekly payouts require a creator and a different approver with
        separately granted permissions.
      </p>
    </div>
  );
}

function DateField({
  label,
  onChange,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <label className="text-xs font-bold text-black/55">
      {label}
      <input
        className="mt-1 block rounded-xl border border-black/15 bg-white px-3 py-2 font-normal text-black"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function Metric({
  alert,
  label,
  value,
}: {
  readonly alert: boolean;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${alert ? 'border-amber-200 bg-amber-50' : 'border-black/10 bg-white'}`}
    >
      <p className="text-xl font-bold text-[#123f33]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-black/50">{label}</p>
    </div>
  );
}

function formatMetric(key: keyof CommerceMetrics, value: string | number): string {
  if (typeof value === 'string') return new Date(value).toLocaleString();
  if (moneyFields.has(key))
    return `PKR ${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return value.toLocaleString();
}
