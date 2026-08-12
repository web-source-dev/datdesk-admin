'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import {
  freightApi,
  type FreightLoadRow,
  type FreightOverview
} from '@/lib/api';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open,inquiry', label: 'Open' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'booked,confirmed', label: 'Booked' },
  { value: 'picked_up,in_transit', label: 'Picked up' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'lost,cancelled', label: 'Lost' }
];

function fmtMoney(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  return `$${Number(n).toLocaleString()}`;
}

function fmtDate(dt?: string | null) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt);
  }
}

function statusClass(status: string) {
  switch (status) {
    case 'booked':
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-800';
    case 'negotiating':
    case 'inquiry':
      return 'bg-amber-50 text-amber-800';
    case 'open':
      return 'bg-sky-50 text-sky-800';
    case 'picked_up':
    case 'in_transit':
      return 'bg-violet-50 text-violet-800';
    case 'delivered':
      return 'bg-slate-800 text-white';
    case 'lost':
    case 'cancelled':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export default function LoadsPage() {
  const [overview, setOverview] = useState<FreightOverview | null>(null);
  const [loads, setLoads] = useState<FreightLoadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [employeeUserId, setEmployeeUserId] = useState('');
  const [employees, setEmployees] = useState<Array<{ _id: string; name: string; email: string }>>(
    []
  );
  const [syncInfo, setSyncInfo] = useState<{
    enabled?: boolean;
    cronExpr?: string;
    running?: boolean;
    lastRunAt?: string | null;
    accounts?: Array<{ accountEmail?: string; lastSyncAt?: string | null; lastError?: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const limit = 40;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ov, list, emp, sync] = await Promise.all([
        freightApi.overview(),
        freightApi.listLoads({
          page,
          limit,
          status: status || undefined,
          search: search || undefined,
          employeeUserId: employeeUserId || undefined
        }),
        freightApi.listEmployees(),
        freightApi.syncStatus().catch(() => null)
      ]);
      setOverview(ov);
      setLoads(list.loads || []);
      setTotal(list.total || 0);
      setEmployees(emp.employees || []);
      setSyncInfo(sync);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [page, status, search, employeeUserId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const runProcess = async (force = false) => {
    setProcessing(true);
    setNote('');
    setError('');
    try {
      const res = await freightApi.processEmails({ limit: 300, force });
      setNote(
        `${force ? 'Reclassified' : 'Processed'} ${res.processed} freight emails · ${res.skippedNoise ?? res.skipped} noise skipped · ${res.loadsTouched} loads touched.`
      );
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Process failed');
    } finally {
      setProcessing(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setNote('');
    setError('');
    try {
      const res = await freightApi.runSync();
      const r = res?.result || {};
      setNote(
        `Continuous sync tick: ${r.synced || 0} accounts, ${r.upserted || 0} emails upserted, ${r.processed || 0} processed.`
      );
      await loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <AdminShell>
      <PageHeader
        title="Loads"
        subtitle="Email intelligence across all connected employee inboxes — broker vs carrier, booked vs open"
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="dd-btn-secondary" onClick={loadAll}>
              Refresh
            </button>
            <button
              type="button"
              className="dd-btn-secondary"
              disabled={syncing}
              onClick={runSync}
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <button
              type="button"
              className="dd-btn-secondary"
              disabled={processing}
              onClick={() => runProcess(true)}
              title="Re-run deeper filters on recent emails"
            >
              {processing ? 'Working…' : 'Reclassify'}
            </button>
            <button
              type="button"
              className="dd-btn-primary"
              disabled={processing}
              onClick={() => runProcess(false)}
            >
              {processing ? 'Processing…' : 'Process emails'}
            </button>
          </div>
        }
      />

      {syncInfo ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 flex flex-wrap gap-x-6 gap-y-1">
          <span>
            Continuous sync:{' '}
            <strong className={syncInfo.enabled ? 'text-emerald-700' : 'text-amber-700'}>
              {syncInfo.enabled ? 'ON' : 'OFF'}
            </strong>
            {syncInfo.cronExpr ? ` (${syncInfo.cronExpr})` : ''}
          </span>
          <span>
            Last run:{' '}
            {syncInfo.lastRunAt ? new Date(syncInfo.lastRunAt).toLocaleString() : 'not yet'}
          </span>
          <span>{syncInfo.running ? 'Running now…' : 'Idle'}</span>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {note ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {note}
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Emails today', value: overview?.emailsToday ?? '—' },
          { label: 'Loads today', value: overview?.loadsToday ?? '—' },
          { label: 'Open / active', value: overview?.openCount ?? '—' },
          { label: 'Booked', value: overview?.bookedCount ?? '—' },
          { label: 'Freight linked', value: overview?.freightLinkedEmails ?? '—' },
          {
            label: 'Noise filtered',
            value: overview?.noiseFiltered ?? '—',
            warn: false
          }
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border bg-white px-4 py-3 shadow-sm ${
              c.warn ? 'border-amber-300' : 'border-slate-200/80'
            }`}
          >
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold text-brand-900">{c.value}</div>
          </div>
        ))}
      </div>

      {(overview?.unprocessedEmails || 0) > 0 ? (
        <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {overview?.unprocessedEmails} emails waiting to process — sync runs every few minutes, or click
          Process / Reclassify.
        </div>
      ) : null}

      {overview ? (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              By status
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(overview.byStatus || {}).map(([k, v]) => (
                <span
                  key={k}
                  className={`text-xs px-2 py-1 rounded-lg capitalize ${statusClass(k)}`}
                >
                  {k.replace('_', ' ')}: {v}
                </span>
              ))}
              {!Object.keys(overview.byStatus || {}).length ? (
                <span className="text-sm text-slate-400">No loads yet — fetch + process emails</span>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Contacts by type
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(overview.byParty || {}).map(([k, v]) => (
                <span key={k} className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-700 capitalize">
                  {k}: {v}
                </span>
              ))}
              {!Object.keys(overview.byParty || {}).length ? (
                <span className="text-sm text-slate-400">No contacts yet</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.label}
                type="button"
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  status === f.value
                    ? 'bg-brand-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                onClick={() => {
                  setPage(1);
                  setStatus(f.value);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="dd-select"
              value={employeeUserId}
              onChange={(e) => {
                setPage(1);
                setEmployeeUserId(e.target.value);
              }}
            >
              <option value="">All employees</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name}
                </option>
              ))}
            </select>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearch(searchInput.trim());
              }}
            >
              <input
                className="dd-input min-w-[180px]"
                placeholder="Search load #, city, broker…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button type="submit" className="dd-btn-secondary">
                Search
              </button>
            </form>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm dd-table">
            <thead className="bg-slate-50/80">
              <tr>
                <th>Load</th>
                <th>Route</th>
                <th>Broker</th>
                <th>Carrier</th>
                <th>Rate</th>
                <th>Status</th>
                <th>Team</th>
                <th>Last email</th>
                <th className="text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((load) => (
                <tr key={load.id}>
                  <td>
                    <div className="font-medium text-slate-900">
                      {load.loadNumber || '—'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                      {load.subjectSample || load.matchKey}
                    </div>
                  </td>
                  <td className="max-w-[180px]">
                    <div className="font-medium truncate">{load.routeLabel || '—'}</div>
                    {load.equipment ? (
                      <div className="text-[11px] text-slate-400">{load.equipment}</div>
                    ) : null}
                  </td>
                  <td className="max-w-[140px]">
                    <div className="truncate">{load.brokerName || '—'}</div>
                    <div className="text-[11px] text-slate-400 truncate">{load.brokerEmail}</div>
                  </td>
                  <td className="max-w-[140px]">
                    <div className="truncate">{load.carrierName || '—'}</div>
                    <div className="text-[11px] text-slate-400 truncate">{load.carrierEmail}</div>
                  </td>
                  <td className="font-medium whitespace-nowrap">{fmtMoney(load.rate)}</td>
                  <td>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${statusClass(
                        load.status
                      )}`}
                    >
                      {load.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-xs text-slate-600">
                    {(load.employees || [])
                      .filter(Boolean)
                      .map((e) => e?.name)
                      .filter(Boolean)
                      .slice(0, 3)
                      .join(', ') || '—'}
                    <div className="text-[11px] text-slate-400">{load.emailCount || 0} emails</div>
                  </td>
                  <td className="text-xs text-slate-500 whitespace-nowrap">
                    {fmtDate(load.lastEmailAt)}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/admin/loads/${load.id}`}
                      className="dd-btn-primary !py-1.5 !px-2.5 inline-block"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && !loads.length ? (
                <tr>
                  <td colSpan={9} className="text-center text-slate-400 py-12">
                    No loads yet. Fetch mailbox emails, then click <strong>Process emails</strong>.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <div>{loading ? 'Loading…' : `${total} loads · page ${page}/${totalPages}`}</div>
          <div className="flex gap-2">
            <button
              type="button"
              className="dd-btn-secondary !py-1.5"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <button
              type="button"
              className="dd-btn-secondary !py-1.5"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
