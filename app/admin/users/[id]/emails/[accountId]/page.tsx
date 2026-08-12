'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import {
  adminEmailApi,
  type EmailAccountRow,
  type MailboxMessageRow,
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

type Tab = 'sent' | 'mailbox';

export default function AccountEmailsPage() {
  const params = useParams();
  const userId = String(params?.id || '');
  const accountId = String(params?.accountId || '');

  const [tab, setTab] = useState<Tab>('sent');
  const [account, setAccount] = useState<EmailAccountRow | null>(null);
  const [sent, setSent] = useState<SentEmailRow[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [mailbox, setMailbox] = useState<MailboxMessageRow[]>([]);
  const [mailboxTotal, setMailboxTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchNote, setFetchNote] = useState('');
  const [error, setError] = useState('');
  const [nextPageToken, setNextPageToken] = useState('');
  const [viewSent, setViewSent] = useState<SentEmailRow | null>(null);
  const [viewMail, setViewMail] = useState<MailboxMessageRow | null>(null);

  const limit = 40;

  const load = useCallback(async () => {
    if (!userId || !accountId) return;
    setLoading(true);
    setError('');
    try {
      if (tab === 'sent') {
        const res = await adminEmailApi.listAccountSent(userId, accountId, {
          page,
          limit,
          search: search || undefined
        });
        setAccount(res.account);
        setSent(res.emails || []);
        setSentTotal(res.total || 0);
      } else {
        const res = await adminEmailApi.listMailbox(userId, accountId, {
          page,
          limit,
          search: search || undefined
        });
        setAccount(res.account);
        setMailbox(res.messages || []);
        setMailboxTotal(res.total || 0);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId, accountId, tab, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openSent = async (row: SentEmailRow) => {
    try {
      const res = await adminEmailApi.getSentEmail(row.id);
      setViewSent(res.email);
    } catch {
      setViewSent(row);
    }
  };

  const openMailbox = async (row: MailboxMessageRow) => {
    try {
      const res = await adminEmailApi.getMailboxMessage(row.id);
      setViewMail(res.message);
    } catch {
      setViewMail(row);
    }
  };

  const runLifetimeFetch = async (continueToken = false) => {
    setFetching(true);
    setFetchNote('');
    setError('');
    try {
      const res = await adminEmailApi.fetchLifetime(userId, accountId, {
        maxMessages: 100,
        pageToken: continueToken ? nextPageToken : undefined
      });
      setNextPageToken(res.nextPageToken || '');
      setFetchNote(
        `${res.message}. Stored total: ${res.totalStored}${
          res.hasMore ? ' — more available, click “Fetch more”.' : ''
        }`
      );
      setTab('mailbox');
      setPage(1);
      const mailboxRes = await adminEmailApi.listMailbox(userId, accountId, {
        page: 1,
        limit
      });
      setAccount(mailboxRes.account);
      setMailbox(mailboxRes.messages || []);
      setMailboxTotal(mailboxRes.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Lifetime fetch failed');
    } finally {
      setFetching(false);
    }
  };

  const total = tab === 'sent' ? sentTotal : mailboxTotal;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <AdminShell>
      <PageHeader
        title={account?.email || 'Inbox'}
        subtitle="Sent via Dat Desk, plus lifetime mailbox history (Gmail API for OAuth, IMAP for app password / SMTP)"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/users/${userId}`} className="dd-btn-secondary">
              ← User
            </Link>
            {account?.canFetchLifetime !== false ? (
              <>
                <button
                  type="button"
                  className="dd-btn-primary"
                  disabled={fetching}
                  onClick={() => runLifetimeFetch(false)}
                >
                  {fetching ? 'Fetching…' : 'Fetch lifetime emails'}
                </button>
                {nextPageToken ? (
                  <button
                    type="button"
                    className="dd-btn-secondary"
                    disabled={fetching}
                    onClick={() => runLifetimeFetch(true)}
                  >
                    Fetch more
                  </button>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Lifetime sync unavailable for this account type
              </span>
            )}
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {fetchNote ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {fetchNote}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                tab === 'sent' ? 'bg-white shadow text-brand-900 font-medium' : 'text-slate-500'
              }`}
              onClick={() => {
                setTab('sent');
                setPage(1);
              }}
            >
              Sent via app ({sentTotal})
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                tab === 'mailbox' ? 'bg-white shadow text-brand-900 font-medium' : 'text-slate-500'
              }`}
              onClick={() => {
                setTab('mailbox');
                setPage(1);
              }}
            >
              Lifetime mailbox ({mailboxTotal})
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
              className="dd-input min-w-[200px]"
              placeholder="Search subject, to, from…"
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
                  <th>To</th>
                  <th>Subject</th>
                  <th>Method</th>
                  <th className="text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {sent.map((row) => (
                  <tr key={row.id}>
                    <td className="text-xs text-slate-500 whitespace-nowrap">{fmt(row.createdAt)}</td>
                    <td className="font-medium">{row.to}</td>
                    <td className="max-w-[320px] truncate">{row.subject}</td>
                    <td className="capitalize text-xs">{row.method?.replace('_', ' ')}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="dd-btn-secondary !py-1 !px-2"
                        onClick={() => openSent(row)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && !sent.length ? (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-400 py-10">
                      No sent emails for this inbox
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm dd-table">
              <thead className="bg-slate-50/80">
                <tr>
                  <th>When</th>
                  <th>Dir</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th className="text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {mailbox.map((row) => (
                  <tr key={row.id}>
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {fmt(row.internalDate || row.createdAt)}
                    </td>
                    <td>
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          row.direction === 'outbound'
                            ? 'bg-sky-50 text-sky-700'
                            : row.direction === 'inbound'
                              ? 'bg-violet-50 text-violet-700'
                              : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.direction}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate text-xs">{row.from}</td>
                    <td className="max-w-[140px] truncate text-xs">{row.to}</td>
                    <td className="max-w-[280px]">
                      <div className="truncate font-medium">{row.subject || '(no subject)'}</div>
                      <div className="truncate text-[11px] text-slate-400">{row.snippet}</div>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="dd-btn-secondary !py-1 !px-2"
                        onClick={() => openMailbox(row)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && !mailbox.length ? (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-400 py-10">
                      No mailbox messages yet — use “Fetch lifetime emails”
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <div>
            {loading ? 'Loading…' : `${total} total · page ${page} of ${totalPages}`}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="dd-btn-secondary !py-1.5"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="dd-btn-secondary !py-1.5"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={!!viewSent}
        title={viewSent?.subject || 'Sent email'}
        subtitle={viewSent ? `${viewSent.from} → ${viewSent.to}` : undefined}
        onClose={() => setViewSent(null)}
        wide
      >
        {viewSent ? (
          <div className="space-y-3">
            <div className="text-xs text-slate-500">{fmt(viewSent.createdAt)}</div>
            <pre className="whitespace-pre-wrap text-sm text-slate-800 bg-slate-50 rounded-xl p-4 border border-slate-100 max-h-[55vh] overflow-auto">
              {viewSent.body}
            </pre>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!viewMail}
        title={viewMail?.subject || 'Mailbox message'}
        subtitle={viewMail ? `${viewMail.from} → ${viewMail.to}` : undefined}
        onClose={() => setViewMail(null)}
        wide
      >
        {viewMail ? (
          <div className="space-y-3">
            <div className="text-xs text-slate-500">
              {fmt(viewMail.internalDate)} · {viewMail.direction}
            </div>
            {viewMail.bodyHtml ? (
              <div
                className="prose prose-sm max-w-none border border-slate-100 rounded-xl p-4 max-h-[55vh] overflow-auto bg-white"
                dangerouslySetInnerHTML={{ __html: viewMail.bodyHtml }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-slate-800 bg-slate-50 rounded-xl p-4 border border-slate-100 max-h-[55vh] overflow-auto">
                {viewMail.body || viewMail.snippet || '(empty)'}
              </pre>
            )}
          </div>
        ) : null}
      </Modal>
    </AdminShell>
  );
}
