'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import Toggle from '@/components/Toggle';
import { cookiesApi } from '@/lib/api';

const CHANNELS = [
  { id: 'single', label: 'Single', field: 'isActiveSingle' },
  { id: 'double', label: 'Double', field: 'isActiveDouble' },
  { id: 'multi', label: 'Multi', field: 'isActiveMulti' },
  { id: 'test', label: 'Test', field: 'isActiveTest' }
] as const;

type CookieRow = {
  _id: string;
  fileName: string;
  cookieCount: number;
  hasCookies: boolean;
  isActive?: boolean;
  isActiveSingle?: boolean;
  isActiveDouble?: boolean;
  isActiveMulti?: boolean;
  isActiveTest?: boolean;
  isWorking?: boolean;
  note?: string;
  createdAt?: string;
};

function isActiveOn(cookie: CookieRow, field: string) {
  return !!(cookie as any)[field];
}

export default function CookiesPage() {
  const [cookies, setCookies] = useState<CookieRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    const data = await cookiesApi.getAll();
    setCookies(data.cookies || []);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setFile(null);
    setNote('');
    setError('');
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a cookie JSON file');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await cookiesApi.upload(file, note);
      closeModal();
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleChannel = async (cookie: CookieRow, channel: string, field: string) => {
    const key = `${cookie._id}:${channel}`;
    setToggling(key);
    setError('');
    try {
      if (isActiveOn(cookie, field)) {
        await cookiesApi.deactivate(cookie._id, channel);
      } else {
        await cookiesApi.activate(cookie._id, channel);
      }
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setToggling(null);
    }
  };

  const toggleWorking = async (cookie: CookieRow, isWorking: boolean) => {
    const key = `${cookie._id}:working`;
    setToggling(key);
    setError('');
    setCookies((prev) =>
      prev.map((c) => (c._id === cookie._id ? { ...c, isWorking } : c))
    );
    try {
      await cookiesApi.setWorking(cookie._id, isWorking);
    } catch (err: any) {
      setCookies((prev) =>
        prev.map((c) => (c._id === cookie._id ? { ...c, isWorking: !isWorking } : c))
      );
      setError(err.response?.data?.message || err.message);
    } finally {
      setToggling(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this cookie file? Users assigned to it will fall back to channel cookie.')) {
      return;
    }
    await cookiesApi.remove(id);
    await load();
  };

  return (
    <AdminShell>
      <div className="w-full">
        <PageHeader
          title="Cookies"
          subtitle="Toggle Single / Double / Multi / Test right in the table. Mark sessions working or not."
          actions={
            <button type="button" onClick={() => setModalOpen(true)} className="dd-btn-primary">
              + Upload cookie
            </button>
          }
        />

        {error && !modalOpen ? (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        ) : null}

        <div className="dd-card overflow-x-auto">
          <table className="w-full text-sm dd-table">
            <thead className="bg-slate-50/80">
              <tr>
                <th>File</th>
                <th>Count</th>
                <th>Working</th>
                <th>Channels (click to toggle)</th>
                <th>Note</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cookies.map((cookie) => (
                <tr key={cookie._id}>
                  <td className="font-mono text-xs text-slate-700 max-w-[240px] truncate">
                    {cookie.fileName}
                  </td>
                  <td>{cookie.cookieCount}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Toggle
                        checked={Boolean(cookie.isWorking)}
                        disabled={toggling === `${cookie._id}:working`}
                        label={`Mark ${cookie.fileName} as working`}
                        onChange={(next) => toggleWorking(cookie, next)}
                      />
                      <span
                        className={`text-xs ${
                          cookie.isWorking ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {cookie.isWorking ? 'Working' : 'Not working'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      {CHANNELS.map((ch) => {
                        const active = isActiveOn(cookie, ch.field);
                        const key = `${cookie._id}:${ch.id}`;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            disabled={toggling === key}
                            onClick={() => toggleChannel(cookie, ch.id, ch.field)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium border transition ${
                              active
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            {ch.label}
                            {active ? ' ✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="text-slate-500 text-xs">{cookie.note || '—'}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="dd-btn-danger !py-1.5 !px-2.5"
                      onClick={() => remove(cookie._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!cookies.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    No cookie files uploaded yet
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
        title="Upload cookie"
        subtitle="JSON export from DAT / browser cookie tools"
      >
        <form onSubmit={upload} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Cookie JSON</label>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Note</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="dd-input"
              placeholder="optional"
            />
          </div>
          {error ? (
            <div className="rounded-lg border border-red-100 bg-red-50 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="dd-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={busy || !file} className="dd-btn-primary">
              {busy ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
}
