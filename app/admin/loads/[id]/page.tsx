'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import {
  freightApi,
  type FreightLoadEventRow,
  type FreightLoadRow,
  type MailboxMessageRow
} from '@/lib/api';

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

const STATUSES = [
  'open',
  'inquiry',
  'negotiating',
  'booked',
  'confirmed',
  'picked_up',
  'delivered',
  'lost',
  'cancelled'
];

export default function LoadDetailPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [load, setLoad] = useState<FreightLoadRow | null>(null);
  const [events, setEvents] = useState<FreightLoadEventRow[]>([]);
  const [messages, setMessages] = useState<MailboxMessageRow[]>([]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await freightApi.getLoad(id);
      setLoad(res.load);
      setStatus(res.load.status);
      setEvents(res.events || []);
      setMessages(res.messages || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveStatus = async () => {
    if (!load) return;
    setSaving(true);
    setError('');
    try {
      const res = await freightApi.updateLoad(load.id, { status });
      setLoad(res.load);
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell>
      <PageHeader
        title={load?.loadNumber ? `Load #${load.loadNumber}` : 'Load detail'}
        subtitle={load?.routeLabel || load?.subjectSample || 'Freight email intelligence'}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/loads" className="dd-btn-secondary">
              ← Loads
            </Link>
            <button type="button" className="dd-btn-primary" onClick={refresh}>
              Refresh
            </button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading && !load ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : load ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-2xl font-semibold text-brand-900">
                    {load.routeLabel || 'Route unknown'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>{fmtMoney(load.rate)}</span>
                    {load.equipment ? <span>· {load.equipment}</span> : null}
                    {load.miles ? <span>· {load.miles} mi</span> : null}
                    {load.weight ? <span>· {load.weight}</span> : null}
                    <span>· {load.emailCount || 0} emails</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="dd-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="dd-btn-primary"
                    disabled={saving || status === load.status}
                    onClick={saveStatus}
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                    Broker
                  </div>
                  <div className="font-medium text-slate-900">
                    {load.brokerName || load.brokerContact?.companyName || '—'}
                  </div>
                  <div className="text-sm text-slate-500">{load.brokerEmail || '—'}</div>
                  {load.brokerContact ? (
                    <div className="mt-1 text-[11px] text-emerald-700 capitalize">
                      {load.brokerContact.partyType} ·{' '}
                      {Math.round((load.brokerContact.confidence || 0) * 100)}% conf.
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                    Carrier
                  </div>
                  <div className="font-medium text-slate-900">
                    {load.carrierName || load.carrierContact?.companyName || '—'}
                  </div>
                  <div className="text-sm text-slate-500">{load.carrierEmail || '—'}</div>
                  {load.carrierContact ? (
                    <div className="mt-1 text-[11px] text-sky-700 capitalize">
                      {load.carrierContact.partyType} ·{' '}
                      {Math.round((load.carrierContact.confidence || 0) * 100)}% conf.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 text-sm text-slate-600">
                <span className="text-slate-400">Employees: </span>
                {(load.employees || [])
                  .filter(Boolean)
                  .map((e) => e?.name || e?.email)
                  .join(', ') || '—'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-brand-900">Timeline</h2>
              </div>
              <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                {events.map((ev) => (
                  <div key={ev.id} className="px-5 py-3 flex gap-3">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-brand-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        {ev.title || ev.status}
                        {ev.previousStatus ? (
                          <span className="text-slate-400 font-normal">
                            {' '}
                            ({ev.previousStatus} → {ev.status})
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{ev.note}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {fmtDate(ev.occurredAt)} · {ev.source} ·{' '}
                        {Math.round((ev.confidence || 0) * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
                {!events.length ? (
                  <div className="px-5 py-8 text-center text-slate-400 text-sm">No events yet</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden h-fit">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-brand-900">Linked emails</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[720px] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                        m.direction === 'outbound'
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-violet-50 text-violet-700'
                      }`}
                    >
                      {m.direction}
                    </span>
                    <span className="text-[11px] text-slate-400">{fmtDate(m.internalDate)}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-900 mt-1 truncate">
                    {m.subject || '(no subject)'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {m.from} → {m.to}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{m.snippet}</div>
                </div>
              ))}
              {!messages.length ? (
                <div className="px-5 py-8 text-center text-slate-400 text-sm">No linked emails</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
