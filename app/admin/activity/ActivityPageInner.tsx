'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import { adminEmailApi, type ActivityLogRow } from '@/lib/api';

function fmt(dt?: string | null) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt);
  }
}

export default function ActivityPageInner() {
  const searchParams = useSearchParams();
  const initialUserId = searchParams.get('userId') || '';

  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [userId, setUserId] = useState(initialUserId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ActivityLogRow | null>(null);
  const limit = 50;

  useEffect(() => {
    setUserId(initialUserId);
  }, [initialUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminEmailApi.listActivity({
        page,
        limit,
        search: search || undefined,
        category: category || undefined,
        status: status || undefined,
        userId: userId || undefined
      });
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [page, search, category, status, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <AdminShell>
      <PageHeader
        title="Activity log"
        subtitle="Logins, email connects, sends, and admin actions saved in the database"
        actions={
          <button type="button" className="dd-btn-primary" onClick={load}>
            Refresh
          </button>
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center">
          <form
            className="flex gap-2 flex-wrap"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <input
              className="dd-input min-w-[200px]"
              placeholder="Search email, action, message…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <select
              className="dd-select"
              value={category}
              onChange={(e) => {
                setPage(1);
                setCategory(e.target.value);
              }}
            >
              <option value="">All categories</option>
              <option value="auth">Auth</option>
              <option value="email">Email</option>
              <option value="admin">Admin</option>
              <option value="system">System</option>
            </select>
            <select
              className="dd-select"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">Any status</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="info">Info</option>
            </select>
            {userId ? (
              <button
                type="button"
                className="dd-btn-secondary"
                onClick={() => {
                  setUserId('');
                  setPage(1);
                }}
              >
                Clear user filter
              </button>
            ) : null}
            <button type="submit" className="dd-btn-secondary">
              Search
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm dd-table">
            <thead className="bg-slate-50/80">
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Status</th>
                <th>Message</th>
                <th className="text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-xs text-slate-500 whitespace-nowrap">{fmt(log.createdAt)}</td>
                  <td>
                    {log.user ? (
                      <Link
                        href={`/admin/users/${log.user._id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {log.user.name}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">{log.actorEmail || '—'}</span>
                    )}
                  </td>
                  <td>
                    <div className="font-medium text-slate-900">{log.action}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                      {log.category}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        log.status === 'failure'
                          ? 'bg-red-50 text-red-700'
                          : log.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="max-w-[320px] truncate text-slate-600">{log.message || '—'}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="dd-btn-secondary !py-1 !px-2"
                      onClick={() => setSelected(log)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !logs.length ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400 py-10">
                    No activity logs yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <div>{loading ? 'Loading…' : `${total} total · page ${page}/${totalPages}`}</div>
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

      <Modal
        open={!!selected}
        title={selected?.action || 'Activity'}
        subtitle={selected ? fmt(selected.createdAt) : undefined}
        onClose={() => setSelected(null)}
        wide
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] uppercase text-slate-400">Status</div>
                <div>{selected.status}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-slate-400">Category</div>
                <div>{selected.category}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-slate-400">Actor</div>
                <div>{selected.actorEmail || '—'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-slate-400">IP</div>
                <div className="font-mono text-xs">{selected.ip || '—'}</div>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-slate-400 mb-1">Message</div>
              <div>{selected.message || '—'}</div>
            </div>
            {selected.userAgent ? (
              <div>
                <div className="text-[11px] uppercase text-slate-400 mb-1">User agent</div>
                <div className="text-xs text-slate-500 break-all">{selected.userAgent}</div>
              </div>
            ) : null}
            {selected.meta ? (
              <div>
                <div className="text-[11px] uppercase text-slate-400 mb-1">Meta</div>
                <pre className="text-xs bg-slate-50 border border-slate-100 rounded-xl p-3 overflow-auto max-h-64">
                  {JSON.stringify(selected.meta, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </AdminShell>
  );
}
