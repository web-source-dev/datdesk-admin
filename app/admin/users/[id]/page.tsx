'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import {
  adminEmailApi,
  type AdminUserDetail,
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

export default function UserDetailPage() {
  const params = useParams();
  const userId = String(params?.id || '');
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [accounts, setAccounts] = useState<EmailAccountRow[]>([]);
  const [recentSent, setRecentSent] = useState<SentEmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const [d, a, s] = await Promise.all([
        adminEmailApi.getUserDetail(userId),
        adminEmailApi.listUserAccounts(userId),
        adminEmailApi.listUserSent(userId, { page: 1, limit: 15 })
      ]);
      setDetail(d);
      setAccounts(a.accounts || []);
      setRecentSent(s.emails || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const user = detail?.user;

  return (
    <AdminShell>
      <PageHeader
        title={user ? user.name : 'User'}
        subtitle={user ? user.email : 'Connected inboxes, sent mail, and activity'}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/users" className="dd-btn-secondary">
              ← Users
            </Link>
            <Link href={`/admin/activity?userId=${userId}`} className="dd-btn-secondary">
              Full activity
            </Link>
            <button type="button" className="dd-btn-primary" onClick={load}>
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

      {loading && !detail ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Connected emails', value: detail?.stats.connectedAccounts ?? 0 },
              { label: 'Sent via Dat Desk', value: detail?.stats.sentEmails ?? 0 },
              { label: 'Mailbox synced', value: detail?.stats.mailboxMessages ?? 0 },
              { label: 'Templates', value: detail?.stats.templates ?? 0 }
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
              >
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{card.label}</div>
                <div className="mt-1 text-2xl font-semibold text-brand-900">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm mb-6 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-brand-900">Connected emails</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an inbox to view sent emails and fetch lifetime Gmail history
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm dd-table">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th>Email</th>
                    <th>Method</th>
                    <th>Sent</th>
                    <th>Mailbox</th>
                    <th>Connected</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td>
                        <div className="font-medium text-slate-900">{acc.email}</div>
                        {acc.displayName ? (
                          <div className="text-xs text-slate-400">{acc.displayName}</div>
                        ) : null}
                        {acc.isDefault ? (
                          <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        ) : null}
                      </td>
                      <td className="capitalize">{acc.method?.replace('_', ' ')}</td>
                      <td>{acc.sentCount ?? 0}</td>
                      <td>{acc.mailboxCount ?? 0}</td>
                      <td className="text-xs text-slate-500">{fmt(acc.connectedAt)}</td>
                      <td className="text-right">
                        <Link
                          href={`/admin/users/${userId}/emails/${acc.id}`}
                          className="dd-btn-primary !py-1.5 !px-2.5 inline-block"
                        >
                          Open inbox
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!accounts.length ? (
                    <tr>
                      <td colSpan={6} className="text-center text-slate-400 py-8">
                        No connected email accounts
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-brand-900">Recent sent (Dat Desk)</h2>
              </div>
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {recentSent.map((e) => (
                  <div key={e.id} className="px-5 py-3">
                    <div className="text-sm font-medium text-slate-900 truncate">{e.subject}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      To {e.to} · from {e.from}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">{fmt(e.createdAt)}</div>
                  </div>
                ))}
                {!recentSent.length ? (
                  <div className="px-5 py-8 text-center text-slate-400 text-sm">No sent emails yet</div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-brand-900">Recent activity</h2>
              </div>
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {(detail?.recentActivity || []).map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          log.status === 'failure'
                            ? 'bg-red-500'
                            : log.status === 'success'
                              ? 'bg-emerald-500'
                              : 'bg-slate-400'
                        }`}
                      />
                      <span className="text-sm font-medium text-slate-900">{log.action}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{log.message || '—'}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{fmt(log.createdAt)}</div>
                  </div>
                ))}
                {!detail?.recentActivity?.length ? (
                  <div className="px-5 py-8 text-center text-slate-400 text-sm">No activity yet</div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
