'use client';

import { useEffect, useRef, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import Toggle from '@/components/Toggle';
import { extensionsApi, type ManagedExtension } from '@/lib/api';

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState<ManagedExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    version: '',
    description: '',
    enabled: true
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await extensionsApi.list();
      setExtensions(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setFile(null);
    setForm({ name: '', slug: '', version: '', description: '', enabled: true });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
    setError('');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Select a .zip file first');
      return;
    }
    setUploading(true);
    setError('');
    try {
      await extensionsApi.upload(file, {
        name: form.name || undefined,
        slug: form.slug || undefined,
        version: form.version || undefined,
        description: form.description || undefined,
        enabled: form.enabled
      });
      closeModal();
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleToggle = async (ext: ManagedExtension, enabled: boolean) => {
    setSavingId(ext._id);
    setExtensions((prev) => prev.map((e) => (e._id === ext._id ? { ...e, enabled } : e)));
    try {
      await extensionsApi.update(ext._id, { enabled });
    } catch (err: any) {
      setExtensions((prev) =>
        prev.map((e) => (e._id === ext._id ? { ...e, enabled: !enabled } : e))
      );
      setError(err.response?.data?.message || 'Failed to update');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (ext: ManagedExtension) => {
    if (!confirm(`Delete extension "${ext.name}"? Desktop clients will stop loading it.`)) return;
    try {
      await extensionsApi.remove(ext._id);
      setExtensions((prev) => prev.filter((e) => e._id !== ext._id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <AdminShell>
      <div className="w-full">
        <PageHeader
          title="Extensions"
          subtitle="Enable or disable packs instantly in the table. Upload Chromium ZIP packages via popup. Turn extensions off for a specific user under Users."
          actions={
            <>
              <button type="button" onClick={load} className="dd-btn-secondary">
                Refresh
              </button>
              <button type="button" onClick={() => setModalOpen(true)} className="dd-btn-primary">
                + Upload ZIP
              </button>
            </>
          }
        />

        {error && !modalOpen ? (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        ) : null}

        <div className="dd-card overflow-x-auto">
          {loading ? (
            <p className="p-8 text-sm text-slate-500">Loading…</p>
          ) : (
            <table className="w-full text-sm dd-table">
              <thead className="bg-slate-50/80">
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Version</th>
                  <th>Size</th>
                  <th>Enabled</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {extensions.map((ext) => (
                  <tr key={ext._id}>
                    <td>
                      <div className="font-medium text-slate-900">{ext.name}</div>
                      {ext.description ? (
                        <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {ext.description}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{ext.slug}</code>
                    </td>
                    <td>{ext.version}</td>
                    <td className="text-slate-500">{formatBytes(ext.fileSize)}</td>
                    <td>
                      <Toggle
                        checked={ext.enabled}
                        disabled={savingId === ext._id}
                        onChange={(next) => handleToggle(ext, next)}
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="dd-btn-danger !py-1.5 !px-2.5"
                        onClick={() => handleDelete(ext)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!extensions.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      No extensions yet — upload a Chromium extension ZIP
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Upload extension"
        subtitle="ZIP must include manifest.json — same slug replaces the package"
      >
        <form onSubmit={handleUpload} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">ZIP file</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (f && !form.name) {
                  setForm((prev) => ({
                    ...prev,
                    name: prev.name || f.name.replace(/\.zip$/i, '')
                  }));
                }
              }}
              className="block w-full text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="dd-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                className="dd-input"
                placeholder="auto"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Version</label>
              <input
                value={form.version}
                onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))}
                className="dd-input"
                placeholder="1.0.0"
              />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <Toggle
                checked={form.enabled}
                onChange={(next) => setForm((p) => ({ ...p, enabled: next }))}
              />
              <span className="text-sm text-slate-600">Enable after upload</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="dd-input"
            />
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
            <button type="submit" disabled={uploading || !file} className="dd-btn-primary">
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
}
