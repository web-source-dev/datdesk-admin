'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import {
  adminEmailApi,
  type EmailAccountRow,
  type SentEmailRow
} from '@/lib/api';

function fmt(dt?: string | null) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt);
  }
}

type Tab = 'sent' | 'accounts';

export default function EmailsPage() {
  const [tab, setTab] = useState<Tab>('sent');
  const [sent, setSent] = useState<SentEmailRow[]>([]);
  const [accounts, setAccounts] = useState<EmailAccountRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewSent, setViewSent] = useState<SentEmailRow | null>(null);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'sent') {
        const res = await adminEmailApi.listAllSent({
          page,
          limit,
          search: search || undefined
        });
        setSent(res.emails || []);
        setTotal(res.total || 0);
      } else {
        const res = await adminEmailApi.listAllAccounts({
          page,
          limit,
          search: search || undefined
        });
        setAccounts(res.accounts || []);
        setTotal(res.total || 0);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tab, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <AdminShell>
      <PageHeader
        title="Emails"
        subtitle="All connected inboxes and every email sent through Dat Desk"
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
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-lg ${
                tab === 'sent' ? 'bg-white shadow font-medium text-brand-900' : 'text-slate-500'
              }`}
              onClick={() => {
                setTab('sent');
                setPage(1);
              }}
            >
              Sent emails
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-lg ${
                tab === 'accounts' ? 'bg-white shadow font-medium text-brand-900' : 'text-slate-500'
              }`}
              onClick={() => {
                setTab('accounts');
                setPage(1);
              }}
            >
              Connected accounts
            </button>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <input
              className="dd-input min-w-[220px]"
              placeholder={tab === 'sent' ? 'Search to, from, subject…' : 'Search email…'}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="dd-btn-secondary">
              Search
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          {tab === 'sent' ? (
            <table className="w-full text-sm dd-table">
              <thead className="bg-slate-50/80">
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th className="text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {sent.map((row) => (
                  <tr key={row.id}>
                    <td className="text-xs text-slate-500 whitespace-nowrap">{fmt(row.createdAt)}</td>
                    <td>
                      {row.user ? (
                        <Link
                          href={`/admin/users/${row.user._id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {row.user.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-xs max-w-[140px] truncate">{row.from}</td>
                    <td className="text-xs max-w-[140px] truncate">{row.to}</td>
                    <td className="max-w-[280px] truncate font-medium">{row.subject}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="dd-btn-secondary !py-1 !px-2"
                        onClick={async () => {
                          try {
                            const res = await adminEmailApi.getSentEmail(row.id);
                            setViewSent(res.email);
                          } catch {
                            setViewSent(row);
                          }
                        }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && !sent.length ? (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-400 py-10">
                      No sent emails found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm dd-table">
              <thead className="bg-slate-50/80">
                <tr>
                  <th>Inbox</th>
                  <th>User</th>
                  <th>Method</th>
                  <th>Connected</th>
                  <th className="text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id}>
                    <td>
                      <div className="font-medium">{acc.email}</div>
                      {acc.isDefault ? (
                        <span className="text-[10px] text-emerald-700">Default</span>
                      ) : null}
                    </td>
                    <td>
                      {acc.user ? (
                        <Link
                          href={`/admin/users/${acc.user._id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {acc.user.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="capitalize">{acc.method?.replace('_', ' ')}</td>
                    <td className="text-xs text-slate-500">{fmt(acc.connectedAt)}</td>
                    <td className="text-right">
                      {acc.user ? (
                        <Link
                          href={`/admin/users/${acc.user._id}/emails/${acc.id}`}
                          className="dd-btn-primary !py-1.5 !px-2.5 inline-block"
                        >
                          Open
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!loading && !accounts.length ? (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-400 py-10">
                      No connected accounts
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
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
        open={!!viewSent}
        title={viewSent?.subject || 'Email'}
        subtitle={viewSent ? `${viewSent.from} → ${viewSent.to}` : undefined}
        onClose={() => setViewSent(null)}
        wide
      >
        {viewSent ? (
          <pre className="whitespace-pre-wrap text-sm bg-slate-50 rounded-xl p-4 border border-slate-100 max-h-[55vh] overflow-auto">
            {viewSent.body}
          </pre>
        ) : null}
      </Modal>
    </AdminShell>
  );
}
