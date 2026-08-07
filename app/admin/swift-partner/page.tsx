'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import Toggle from '@/components/Toggle';
import {
  cookiesApi,
  type PartnerSwiftCookieOption,
  type PartnerSwiftDashboardConfig
} from '@/lib/api';

export default function SwiftPartnerAccountsPage() {
  const [config, setConfig] = useState<PartnerSwiftDashboardConfig | null>(null);
  const [manualEnabled, setManualEnabled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [staleRemoved, setStaleRemoved] = useState<
    PartnerSwiftDashboardConfig['staleRemoved']
  >([]);

  const applyConfig = (data: PartnerSwiftDashboardConfig) => {
    setConfig(data);
    setManualEnabled(Boolean(data.manualSelectionEnabled));
    setSelectedIds(data.selectedCookieIds || []);
    setStaleRemoved(data.staleRemoved || []);
    if (data.message) setNotice(data.message);
  };

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await cookiesApi.getPartnerSwiftDashboardConfig();
      applyConfig(data);
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to load Swift partner config'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const slotLimit = config?.slotLimit ?? 6;
  const cookieById = new Map((config?.availableCookies || []).map((c) => [c._id, c]));
  const resolvedSelected = selectedIds
    .map((id) => cookieById.get(id))
    .filter((c): c is PartnerSwiftCookieOption => Boolean(c));
  const missingSelectedIds = selectedIds.filter((id) => !cookieById.has(id));
  const validSelectedCount = resolvedSelected.length;

  const toggleCookie = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (next.length === 0) setManualEnabled(false);
        return next;
      }
      if (prev.length >= slotLimit) {
        setError(`You can select at most ${slotLimit} accounts`);
        return prev;
      }
      setManualEnabled(true);
      setError('');
      return [...prev, id];
    });
  };

  const moveCookie = (index: number, direction: -1 | 1) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = await cookiesApi.updatePartnerSwiftDashboardConfig({
        manualSelectionEnabled: selectedIds.length > 0 ? true : manualEnabled,
        selectedCookieIds: selectedIds
      });
      applyConfig(data);
      setNotice(data.message || 'Saved');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const renderCookieRow = (cookie: PartnerSwiftCookieOption, selectedIndex?: number) => {
    const isSelected = selectedIndex !== undefined;
    const slot = isSelected ? selectedIndex + 1 : null;

    return (
      <div
        key={cookie._id}
        className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
          isSelected
            ? 'border-emerald-300 bg-emerald-50/60'
            : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
      >
        <button
          type="button"
          onClick={() => toggleCookie(cookie._id)}
          className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
            isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
          }`}
          aria-label={isSelected ? 'Remove from dashboard' : 'Add to dashboard'}
        >
          {isSelected ? <span className="text-white text-[10px] font-bold">✓</span> : null}
        </button>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900 truncate text-sm">
            {cookie.sessionName || cookie.fileName}
          </p>
          <p className="text-[11px] text-slate-400 truncate font-mono">
            {cookie.fileName}
            {cookie.label ? ` · ${cookie.label}` : ''}
          </p>
        </div>

        {isSelected && slot !== null ? (
          <span className="text-xs font-semibold text-emerald-700 shrink-0">Slot {slot}</span>
        ) : null}

        {!cookie.ready ? (
          <span className="text-[11px] text-amber-600 shrink-0">Not ready</span>
        ) : null}

        {cookie.isActiveSwiftSolutions ? (
          <span className="text-[11px] text-emerald-600 shrink-0 font-medium">Live</span>
        ) : null}

        {isSelected ? (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="dd-btn-secondary !py-1 !px-2 text-xs"
              disabled={selectedIndex === 0}
              onClick={() => moveCookie(selectedIndex!, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="dd-btn-secondary !py-1 !px-2 text-xs"
              disabled={selectedIndex === selectedIds.length - 1}
              onClick={() => moveCookie(selectedIndex!, 1)}
            >
              ↓
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <AdminShell>
      <div className="w-full">
        <PageHeader
          title="Swift Partner"
          subtitle="Choose which cookie sessions appear as Account 1…N on the Swift Solutions partner dashboard."
          actions={
            <div className="flex gap-2">
              <button
                type="button"
                className="dd-btn-secondary"
                onClick={loadConfig}
                disabled={loading || saving}
              >
                Refresh
              </button>
              <button
                type="button"
                className="dd-btn-primary"
                onClick={handleSave}
                disabled={loading || saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          }
        />

        {error ? (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        ) : null}

        {notice && !error ? (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-800 text-sm px-3 py-2">
            {notice}
          </div>
        ) : null}

        <div className="dd-card p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900">Manual account selection</p>
              <p className="text-sm text-slate-500 mt-1">
                {manualEnabled
                  ? 'Only the accounts you select below are shown on the partner dashboard.'
                  : 'Automatic mode uses name filters and shows up to 6 accounts. Prefer manual selection.'}
              </p>
            </div>
            <Toggle
              checked={manualEnabled}
              onChange={setManualEnabled}
              label="Manual account selection"
            />
          </div>

          {missingSelectedIds.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {missingSelectedIds.length} selected ID
              {missingSelectedIds.length === 1 ? '' : 's'} not found — click Refresh, then re-add
              accounts if needed.
            </div>
          ) : null}

          {staleRemoved && staleRemoved.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">
                {staleRemoved.length} saved account
                {staleRemoved.length === 1 ? '' : 's'} cleaned up automatically
              </p>
              <ul className="mt-2 text-xs space-y-1 font-mono">
                {staleRemoved.map((entry) => (
                  <li key={entry.id}>
                    {entry.id}
                    {entry.sessionName || entry.fileName
                      ? ` — ${entry.sessionName || entry.fileName}`
                      : ''}{' '}
                    ({entry.reason === 'deleted' ? 'deleted' : entry.reason})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {config ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-medium">Partner preview: </span>
              {manualEnabled
                ? `${validSelectedCount} of ${slotLimit} slots selected`
                : `${config.previewAccountCount} account(s) in automatic mode`}
              {config.previewAccounts.length > 0 ? (
                <span className="text-slate-500">
                  {' '}
                  — {config.previewAccounts.map((a) => a.displayName).join(', ')}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                Selected for dashboard ({validSelectedCount}/{slotLimit})
              </h2>
              {validSelectedCount === 0 ? (
                <p className="text-sm text-slate-400 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                  {manualEnabled
                    ? 'No accounts selected. The partner dashboard will be empty until you pick accounts.'
                    : 'Enable manual selection and pick cookies from the list on the right.'}
                </p>
              ) : (
                resolvedSelected.map((cookie, index) => renderCookieRow(cookie, index))
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                Available cookie files
              </h2>
              <p className="text-sm text-slate-500">
                Click a row to add or remove it. Order on the left = Account 1, 2, …
              </p>
              <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
                {(config?.availableCookies || []).map((cookie) =>
                  selectedIds.includes(cookie._id) ? null : renderCookieRow(cookie)
                )}
                {(config?.availableCookies || []).length === 0 ? (
                  <p className="text-sm text-slate-400 py-10 text-center border border-dashed border-slate-200 rounded-xl">
                    No cookie files with data found. Upload or import cookies first.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
