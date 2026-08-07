'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import Toggle from '@/components/Toggle';
import { updatesApi, type AppUpdateConfig } from '@/lib/api';

/** Shared backend serves multiple desktop apps — keep update channels separate. */
const APP_LABELS: Record<string, string> = {
  horizon: 'Horizon',
  datdesk: 'Dat Desk',
  swift: 'Swift Solutions'
};

const APP_FOLDERS: Record<string, string> = {
  horizon: 'backend/updates/horizon/win32-x64/',
  datdesk: 'backend/updates/datdesk/win32-x64/',
  swift: 'backend/updates/swift/win32-x64/'
};

export default function UpdatesPage() {
  const [configs, setConfigs] = useState<AppUpdateConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingApp, setSavingApp] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await updatesApi.getConfig();
      setConfigs(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (app: string, enabled: boolean) => {
    setSavingApp(app);
    setConfigs((prev) =>
      prev.map((c) => (c.app === app ? { ...c, updatesEnabled: enabled } : c))
    );
    try {
      await updatesApi.setConfig(app, enabled);
    } catch (err: any) {
      setConfigs((prev) =>
        prev.map((c) => (c.app === app ? { ...c, updatesEnabled: !enabled } : c))
      );
      setError(err.response?.data?.message || err.message || 'Failed to save');
    } finally {
      setSavingApp(null);
    }
  };

  return (
    <AdminShell>
      <div className="w-full">
        <PageHeader
          title="Updates"
          subtitle="Horizon, Dat Desk, and Swift Solutions share this backend — each app has its own update channel and toggle."
          actions={
            <button type="button" onClick={load} className="dd-btn-secondary">
              Refresh
            </button>
          }
        />

        {error ? (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        ) : null}

        <div className="dd-card p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : configs.length === 0 ? (
            <div className="text-sm text-slate-500 space-y-2">
              <p>No update channels found yet.</p>
              <p>
                Create folders under{' '}
                <code className="bg-slate-100 px-1 rounded text-xs">backend/updates/</code> for{' '}
                <code className="bg-slate-100 px-1 rounded text-xs">horizon</code> and{' '}
                <code className="bg-slate-100 px-1 rounded text-xs">datdesk</code>.
              </p>
            </div>
          ) : (
            configs.map((c) => (
              <div
                key={c.app}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
              >
                <div>
                  <div className="font-medium text-slate-900">
                    {APP_LABELS[c.app] || c.app}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded">{c.app}</code>
                    <span className="ml-2">
                      {c.updatesEnabled ? 'Updates ON' : 'Updates OFF'}
                    </span>
                    {APP_FOLDERS[c.app] ? (
                      <span className="ml-2 text-slate-400">
                        → <code className="bg-slate-50 px-1 py-0.5 rounded">{APP_FOLDERS[c.app]}</code>
                      </span>
                    ) : null}
                  </div>
                </div>
                <Toggle
                  checked={c.updatesEnabled}
                  disabled={savingApp === c.app}
                  onChange={(next) => handleToggle(c.app, next)}
                />
              </div>
            ))
          )}
        </div>

        <div className="dd-card p-5 mt-6 text-sm text-slate-600 space-y-3">
          <div className="font-medium text-brand-900">How to publish (keep channels separate)</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Feed query <code className="bg-white px-1 rounded">?app=horizon</code> → Horizon builds only.
            <br />
            Feed query <code className="bg-white px-1 rounded">?app=datdesk</code> → Dat Desk builds only.
            <br />
            Feed query <code className="bg-white px-1 rounded">?app=swift</code> → Swift Solutions builds only.
            Do not mix installer files between folders.
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-500">
            <li>
              Build Swift Solutions: <code className="bg-slate-100 px-1 rounded text-xs">cd swift && npm run build:win</code>
            </li>
            <li>
              Copy the Setup exe into{' '}
              <code className="bg-slate-100 px-1 rounded text-xs">backend/updates/swift/win32-x64/</code>
              {' '}(Horizon →{' '}
              <code className="bg-slate-100 px-1 rounded text-xs">updates/horizon/</code>
              , Dat Desk →{' '}
              <code className="bg-slate-100 px-1 rounded text-xs">updates/datdesk/</code>)
            </li>
            <li>
              Run{' '}
              <code className="bg-slate-100 px-1 rounded text-xs">
                node scripts/generate-update-hash.js &quot;…Setup.exe&quot; 1.4.5
              </code>
            </li>
            <li>Toggle Updates ON for that app above — clients check their own channel on startup.</li>
          </ol>
        </div>
      </div>
    </AdminShell>
  );
}
