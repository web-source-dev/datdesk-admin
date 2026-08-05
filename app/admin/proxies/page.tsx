'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import Toggle from '@/components/Toggle';
import { proxiesApi } from '@/lib/api';

type ProxyRow = {
  _id: string;
  name: string;
  host: string;
  port: string;
  username?: string;
  password?: string;
  note?: string;
  enabled: boolean;
};

type Settings = {
  globalProxyEnabled: boolean;
  globalProxyId: string | null;
};

const emptyForm = {
  name: '',
  host: '',
  port: '',
  username: '',
  password: '',
  note: '',
  enabled: true
};

function mask(proxy: ProxyRow) {
  if (proxy.username) return `${proxy.host}:${proxy.port}:${proxy.username}:***`;
  return `${proxy.host}:${proxy.port}`;
}

export default function ProxiesPage() {
  const [proxies, setProxies] = useState<ProxyRow[]>([]);
  const [settings, setSettings] = useState<Settings>({
    globalProxyEnabled: false,
    globalProxyId: null
  });
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const load = async () => {
    const data = await proxiesApi.getAll();
    setProxies(data.proxies || []);
    setSettings({
      globalProxyEnabled: !!data.settings?.globalProxyEnabled,
      globalProxyId: data.settings?.globalProxyId || null
    });
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (proxy: ProxyRow) => {
    setEditingId(proxy._id);
    setForm({
      name: proxy.name,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username || '',
      password: '',
      note: proxy.note || '',
      enabled: proxy.enabled !== false
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { ...form };
      if (editingId) {
        if (!payload.password) delete (payload as any).password;
        await proxiesApi.update(editingId, payload);
      } else {
        await proxiesApi.create(payload);
      }
      closeModal();
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this proxy? Users using it will fall back to global (if enabled).')) {
      return;
    }
    await proxiesApi.remove(id);
    await load();
  };

  const saveSettings = async (next: Partial<Settings>) => {
    setRowBusy('settings');
    setError('');
    try {
      const payload = { ...settings, ...next };
      const data = await proxiesApi.updateSettings(payload);
      setSettings({
        globalProxyEnabled: !!data.settings?.globalProxyEnabled,
        globalProxyId: data.settings?.globalProxyId || null
      });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
      await load();
    } finally {
      setRowBusy(null);
    }
  };

  const toggleEnabled = async (proxy: ProxyRow, enabled: boolean) => {
    setRowBusy(proxy._id);
    try {
      await proxiesApi.update(proxy._id, {
        name: proxy.name,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || '',
        note: proxy.note || '',
        enabled
      });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
      await load();
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <AdminShell>
      <div className="w-full">
        <PageHeader
          title="Proxies"
          subtitle="Toggle enable and global assignment in the table. Add or edit details in a popup."
          actions={
            <button type="button" onClick={openCreate} className="dd-btn-primary">
              + Add proxy
            </button>
          }
        />

        {error && !modalOpen ? (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        ) : null}

        <div className="dd-card p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-medium text-brand-900">App-wide proxy</h2>
              <p className="text-sm text-slate-500 mt-1">
                Users without a personal proxy use the global selection when enabled.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Enable global</span>
              <Toggle
                checked={settings.globalProxyEnabled}
                disabled={rowBusy === 'settings' || !settings.globalProxyId}
                onChange={(next) => saveSettings({ globalProxyEnabled: next })}
              />
            </div>
          </div>
          <div className="mt-4 max-w-md">
            <label className="block text-xs font-medium text-slate-500 mb-1">Global proxy</label>
            <select
              className="dd-select !py-2"
              value={settings.globalProxyId || ''}
              disabled={rowBusy === 'settings'}
              onChange={(e) =>
                saveSettings({
                  globalProxyId: e.target.value || null,
                  globalProxyEnabled: e.target.value ? settings.globalProxyEnabled : false
                })
              }
            >
              <option value="">— None —</option>
              {proxies
                .filter((p) => p.enabled !== false)
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({mask(p)})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="dd-card overflow-x-auto">
          <table className="w-full text-sm dd-table">
            <thead className="bg-slate-50/80">
              <tr>
                <th>Name</th>
                <th>Connection</th>
                <th>Enabled</th>
                <th>Global</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proxies.map((proxy) => {
                const isGlobal = settings.globalProxyId === proxy._id;
                const busy = rowBusy === proxy._id;
                return (
                  <tr key={proxy._id}>
                    <td>
                      <div className="font-medium text-slate-900">{proxy.name}</div>
                      {proxy.note ? (
                        <div className="text-xs text-slate-400">{proxy.note}</div>
                      ) : null}
                    </td>
                    <td className="font-mono text-xs text-slate-600">{mask(proxy)}</td>
                    <td>
                      <Toggle
                        checked={proxy.enabled !== false}
                        disabled={busy}
                        onChange={(next) => toggleEnabled(proxy, next)}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Toggle
                          checked={isGlobal && settings.globalProxyEnabled}
                          disabled={busy || rowBusy === 'settings' || proxy.enabled === false}
                          onChange={(next) => {
                            if (next) {
                              saveSettings({
                                globalProxyId: proxy._id,
                                globalProxyEnabled: true
                              });
                            } else if (isGlobal) {
                              saveSettings({ globalProxyEnabled: false });
                            }
                          }}
                        />
                        {isGlobal ? (
                          <span className="text-[11px] rounded-full bg-brand-50 text-brand-700 px-2 py-0.5">
                            Selected
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="dd-btn-secondary !py-1.5 !px-2.5 mr-1"
                        onClick={() => openEdit(proxy)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="dd-btn-danger !py-1.5 !px-2.5"
                        onClick={() => remove(proxy._id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!proxies.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    No proxies yet — add one to get started
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit proxy' : 'Add proxy'}
        subtitle="Host, port, and optional auth"
      >
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="dd-input"
              placeholder="US East 1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Host</label>
              <input
                required
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                className="dd-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Port</label>
              <input
                required
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                className="dd-input font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="dd-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Password {editingId ? '(blank = keep)' : ''}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="dd-input font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Note</label>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="dd-input"
            />
          </div>
          <div className="flex items-center gap-3 py-1">
            <Toggle
              checked={form.enabled}
              onChange={(next) => setForm((f) => ({ ...f, enabled: next }))}
            />
            <span className="text-sm text-slate-600">Enabled</span>
          </div>
          {error ? (
            <div className="rounded-lg border border-red-100 bg-red-50 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={closeModal} className="dd-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="dd-btn-primary">
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add proxy'}
            </button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
}
