'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import Toggle from '@/components/Toggle';
import {
  freightdeskApi,
  COOKIE_LABEL_OPTIONS,
  type FreightdeskContainerSession,
  type FreightdeskStatus,
  type CookieChannel,
  type AssignableCookieLabel
} from '@/lib/api';

function isActiveForChannel(session: FreightdeskContainerSession, channel: CookieChannel) {
  switch (channel) {
    case 'double':
      return !!session.isActiveDouble;
    case 'multi':
      return !!session.isActiveMulti;
    case 'swiftSolutions':
      return !!session.isActiveSwiftSolutions;
    case 'test':
      return !!session.isActiveTest;
    case 'single':
    default:
      return !!session.isActiveSingle;
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function FreightdeskContainersPage() {
  const [sessions, setSessions] = useState<FreightdeskContainerSession[]>([]);
  const [status, setStatus] = useState<FreightdeskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<CookieChannel>('single');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [statusData, sessionData] = await Promise.all([
        freightdeskApi.getStatus(),
        freightdeskApi.getSessions()
      ]);
      setStatus(statusData);
      setSessions(sessionData.sessions || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load FreightDesk containers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleImport = async (container: string, activate = false) => {
    setWorking(`${container}-${activate ? 'activate' : 'import'}`);
    setError('');
    setMessage('');
    try {
      const res = await freightdeskApi.importContainer(container, {
        activate,
        channel,
        forceReimport: true
      });
      setMessage(res.message || `Imported ${container}`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to import ${container}`);
    } finally {
      setWorking(null);
    }
  };

  const handleImportAll = async (activate = false) => {
    setWorking(activate ? 'import-all-activate' : 'import-all');
    setError('');
    setMessage(activate ? 'Import all & activate started…' : 'Import all started…');
    try {
      const res = await freightdeskApi.importAll({ activate, channel, forceReimport: true });
      setMessage(res.message || 'Import complete');
      await load();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to import all containers';
      // Axios often surfaces proxy timeouts as a Network/CORS error
      if (/cors|network error|err_failed|failed to fetch/i.test(String(msg))) {
        setError(
          'Import request failed before completion (often a proxy timeout). The server may still be importing — wait a minute and refresh.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setWorking(null);
    }
  };

  const handleLabelChange = async (container: string, label: string) => {
    if (!COOKIE_LABEL_OPTIONS.some((o) => o.value === label)) return;
    setWorking(`${container}-label`);
    setError('');
    try {
      await freightdeskApi.updateLabel(container, label as AssignableCookieLabel);
      setSessions((prev) =>
        prev.map((s) => (s.container === container ? { ...s, label } : s))
      );
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Failed to update label for ${container}`);
    } finally {
      setWorking(null);
    }
  };

  const handleWorkingChange = async (session: FreightdeskContainerSession, isWorking: boolean) => {
    if (!session.imported && !session.cookieId) {
      setError(`Import ${session.container} before marking working status.`);
      return;
    }
    setWorking(`${session.container}-working`);
    setError('');
    setSessions((prev) =>
      prev.map((s) => (s.container === session.container ? { ...s, isWorking } : s))
    );
    try {
      await freightdeskApi.setWorking(session.container, isWorking);
    } catch (err: any) {
      setSessions((prev) =>
        prev.map((s) =>
          s.container === session.container ? { ...s, isWorking: !isWorking } : s
        )
      );
      setError(
        err.response?.data?.message || err.message || `Failed to update working status for ${session.container}`
      );
    } finally {
      setWorking(null);
    }
  };

  return (
    <AdminShell>
      <div className="w-full">
        <PageHeader
          title="FD Containers"
          subtitle="Import FreightDesk container cookies into the database. Activate per plan / Swift / Test channel."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="dd-input !w-auto min-w-[160px]"
                value={channel}
                onChange={(e) => setChannel(e.target.value as CookieChannel)}
                disabled={working !== null}
              >
                <option value="single">Single plan</option>
                <option value="double">Double plan</option>
                <option value="multi">Multi plan</option>
                <option value="swiftSolutions">Swift Solutions</option>
                <option value="test">Test users</option>
              </select>
              <button
                type="button"
                className="dd-btn-secondary"
                onClick={load}
                disabled={working !== null}
              >
                Refresh
              </button>
              <button
                type="button"
                className="dd-btn-secondary"
                onClick={() => handleImportAll(false)}
                disabled={working !== null}
              >
                {working === 'import-all' ? 'Importing…' : 'Import All'}
              </button>
              <button
                type="button"
                className="dd-btn-primary"
                onClick={() => handleImportAll(true)}
                disabled={working !== null}
              >
                {working === 'import-all-activate' ? 'Importing…' : 'Import All & Activate Last'}
              </button>
            </div>
          }
        />

        {status ? (
          <p className="mb-4 text-xs text-slate-500">
            API: {status.apiUrl} · Partner key{' '}
            <span className={status.configured ? 'text-emerald-600' : 'text-amber-600'}>
              {status.configured ? 'configured' : 'missing'}
            </span>
          </p>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-800 text-sm px-3 py-2">
            {message}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">Loading FreightDesk containers…</p>
        ) : sessions.length === 0 ? (
          <div className="dd-card p-10 text-center text-sm text-slate-500">
            No FreightDesk containers found. Check partner API key and FreightDesk connectivity.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {sessions.map((session) => {
              const active = isActiveForChannel(session, channel);
              const busy = working?.startsWith(session.container);
              const currentLabel = session.label || 'new';

              return (
                <div key={session.container} className="dd-card p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-3xl font-bold text-brand-900 tracking-tight">
                        {session.container}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        {session.remoteCookieCount ?? session.cookieCount ?? 0} remote
                        {session.localCookieCount !== undefined
                          ? ` · ${session.localCookieCount} in DB`
                          : ''}
                      </p>
                    </div>
                    <span
                      className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${
                        active ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      title={active ? 'Active for channel' : 'Inactive'}
                    />
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Working</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium ${
                            session.isWorking ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        >
                          {session.isWorking ? 'Working' : 'Not working'}
                        </span>
                        <Toggle
                          checked={Boolean(session.isWorking)}
                          disabled={busy || working !== null || (!session.imported && !session.cookieId)}
                          label={`Mark ${session.container} as working`}
                          onChange={(next) => handleWorkingChange(session, next)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Label</span>
                      <select
                        className="dd-input !py-1.5 !text-sm !w-auto min-w-[160px]"
                        value={currentLabel}
                        disabled={busy || working !== null}
                        onChange={(e) => handleLabelChange(session.container, e.target.value)}
                      >
                        {COOKIE_LABEL_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                        {!COOKIE_LABEL_OPTIONS.some((o) => o.value === currentLabel) ? (
                          <option value={currentLabel}>{currentLabel}</option>
                        ) : null}
                      </select>
                    </div>
                    <div className="text-slate-500">
                      Updated:{' '}
                      <span className="text-slate-800">{formatDate(session.lastUpdated)}</span>
                    </div>
                    <div className="text-slate-500">
                      Imported:{' '}
                      <span
                        className={
                          session.ready
                            ? 'text-emerald-600'
                            : session.imported
                              ? 'text-amber-600'
                              : 'text-slate-800'
                        }
                      >
                        {session.ready ? 'Ready' : session.imported ? 'Stale' : 'No'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-5 flex flex-col gap-2">
                    <button
                      type="button"
                      className="dd-btn-secondary w-full justify-center"
                      disabled={busy || working !== null}
                      onClick={() => handleImport(session.container, false)}
                    >
                      {working === `${session.container}-import` ? 'Importing…' : 'Import'}
                    </button>
                    <button
                      type="button"
                      className="dd-btn-primary w-full justify-center"
                      disabled={busy || working !== null}
                      onClick={() => handleImport(session.container, true)}
                    >
                      {working === `${session.container}-activate`
                        ? 'Activating…'
                        : 'Import & Activate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
