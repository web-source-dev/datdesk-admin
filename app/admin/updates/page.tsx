'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import Toggle from '@/components/Toggle';
import { updatesApi, type AppUpdateConfig } from '@/lib/api';

const APP_LABELS: Record<string, string> = {
  datdesk: 'Dat Desk'
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
          subtitle="Turn Dat Desk auto-updates on or off. When off, installed apps stay on their current version."
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
              <p>No update packages found yet.</p>
              <p>
                Place a built installer in{' '}
                <code className="bg-slate-100 px-1 rounded text-xs">
                  backend/updates/datdesk/win32-x64/
                </code>{' '}
                and generate <code className="bg-slate-100 px-1 rounded text-xs">latest.yml</code>.
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

        <div className="dd-card p-5 mt-6 text-sm text-slate-600 space-y-2">
          <div className="font-medium text-brand-900">How to publish an update</div>
          <ol className="list-decimal list-inside space-y-1 text-slate-500">
            <li>
              Build the desktop app: <code className="bg-slate-100 px-1 rounded text-xs">cd frontend && npm run build:win</code>
            </li>
            <li>
              Copy the Setup exe into{' '}
              <code className="bg-slate-100 px-1 rounded text-xs">backend/updates/datdesk/win32-x64/</code>
            </li>
            <li>
              Run{' '}
              <code className="bg-slate-100 px-1 rounded text-xs">
                node scripts/generate-update-hash.js &quot;…Setup.exe&quot; 1.0.1
              </code>
            </li>
            <li>Keep Updates ON above — packaged apps check on startup and install automatically.</li>
          </ol>
        </div>
      </div>
    </AdminShell>
  );
}
