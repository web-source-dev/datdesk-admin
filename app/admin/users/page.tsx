'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import Toggle from '@/components/Toggle';
import PermissionsEditor, {
  defaultPermissions,
  type Permissions
} from '@/components/PermissionsEditor';
import { usersApi, proxiesApi, cookiesApi, USER_LABEL_OPTIONS } from '@/lib/api';

type ProxyOption = {
  _id: string;
  name: string;
  host: string;
  port: string;
  username?: string;
  enabled: boolean;
};

type CookieOption = {
  _id: string;
  fileName: string;
  cookieCount: number;
};

type User = {
  _id: string;
  name: string;
  email: string;
  role: string;
  isBanned: boolean;
  domain?: string;
  plan?: string;
  label?: string;
  proxyId?: string | { _id: string; name: string } | null;
  assignedCookieId?: string | null;
  note?: string;
  permissions?: Permissions;
  resolvedProxy?: { proxy: string; source: string; name?: string | null } | null;
  resolvedCookie?: {
    source: string;
    channel: string;
    fileName?: string | null;
    cookieCount?: number;
  } | null;
};

type UserFilters = {
  search: string;
  plan: string;
  label: string;
  banned: string;
  proxy: string;
  cookie: string;
  openDat: string;
};

const emptyFilters: UserFilters = {
  search: '',
  plan: '',
  label: '',
  banned: '',
  proxy: '',
  cookie: '',
  openDat: ''
};

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'user',
  domain: 'https://one.dat.com/search-loads',
  note: '',
  proxyId: '',
  plan: 'single',
  label: '',
  assignedCookieId: '',
  permissions: defaultPermissions()
};

const PAGE_LIMIT = 200;

function proxyIdOf(user: User) {
  if (!user.proxyId) return '';
  if (typeof user.proxyId === 'string') return user.proxyId;
  return user.proxyId._id || '';
}

function cookieIdOf(user: User) {
  if (!user.assignedCookieId) return '';
  if (typeof user.assignedCookieId === 'string') return user.assignedCookieId;
  return '';
}

function maskProxy(proxy?: string) {
  if (!proxy) return '—';
  const parts = proxy.split(':');
  if (parts.length >= 3) return `${parts[0]}:${parts[1]}:${parts[2]}:***`;
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return proxy;
}

function maskProxy(proxy?: string) {
  if (!proxy) return '—';
  const parts = proxy.split(':');
  if (parts.length >= 3) return `${parts[0]}:${parts[1]}:${parts[2]}:***`;
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return proxy;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [proxies, setProxies] = useState<ProxyOption[]>([]);
  const [cookies, setCookies] = useState<CookieOption[]>([]);
  const [filters, setFilters] = useState<UserFilters>(emptyFilters);
  const [serverTotal, setServerTotal] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const metaLoadedRef = useRef(false);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) => key !== 'search' && Boolean(value)).length +
      (filters.search.trim() ? 1 : 0),
    [filters]
  );

  const loadFromBackend = useCallback(async (nextFilters: UserFilters) => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const usersData = await usersApi.getAll({
        page: 1,
        limit: PAGE_LIMIT,
        search: nextFilters.search.trim() || undefined,
        plan: nextFilters.plan || undefined,
        label: nextFilters.label || undefined,
        banned: nextFilters.banned || undefined,
        proxy: nextFilters.proxy || undefined,
        cookie: nextFilters.cookie || undefined,
        openDat: nextFilters.openDat || undefined
      });

      if (reqId !== requestIdRef.current) return;

      // Trust backend results — do not re-filter on the client (that was hiding Swift users)
      const list: User[] = Array.isArray(usersData.users) ? usersData.users : [];
      setUsers(list);
      setServerTotal(
        typeof usersData.pagination?.total === 'number'
          ? usersData.pagination.total
          : list.length
      );

      if (!metaLoadedRef.current) {
        const [proxiesData, cookiesData] = await Promise.all([
          proxiesApi.getAll(),
          cookiesApi.getAll()
        ]);
        if (reqId !== requestIdRef.current) return;
        setProxies((proxiesData.proxies || []).filter((p: ProxyOption) => p.enabled !== false));
        setCookies(cookiesData.cookies || []);
        metaLoadedRef.current = true;
      }
    } catch (err: any) {
      if (reqId !== requestIdRef.current) return;
      setError(err.response?.data?.message || err.message || 'Failed to load users');
      setUsers([]);
      setServerTotal(0);
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // Initial + every filter change → backend fetch (debounced)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadFromBackend(filtersRef.current).catch(() => {});
    }, 200);
    return () => window.clearTimeout(timer);
  }, [
    filters.search,
    filters.plan,
    filters.label,
    filters.banned,
    filters.proxy,
    filters.cookie,
    filters.openDat,
    loadFromBackend
  ]);

  const updateFilter = <K extends keyof UserFilters>(key: K, value: UserFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingId(user._id);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      domain: user.domain || 'https://one.dat.com/search-loads',
      note: user.note || '',
      proxyId: proxyIdOf(user),
      plan: user.plan || 'single',
      label: user.label || '',
      assignedCookieId: cookieIdOf(user),
      permissions: {
        ...defaultPermissions(),
        ...(user.permissions || {}),
        customTabs: user.permissions?.customTabs || []
      }
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
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        domain: form.domain,
        note: form.note,
        proxyId: form.proxyId || null,
        plan: form.plan,
        label: form.label,
        assignedCookieId: form.assignedCookieId || null,
        permissions: form.permissions
      };
      if (form.password) payload.password = form.password;

      if (editingId) {
        if (!form.password) delete payload.password;
        await usersApi.update(editingId, payload);
      } else {
        if (!form.password) {
          setError('Password is required');
          setBusy(false);
          return;
        }
        await usersApi.create(payload);
      }
      closeModal();
      await loadFromBackend(filtersRef.current);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const patchInline = async (userId: string, key: string, payload: Record<string, unknown>) => {
    const saveKey = `${userId}:${key}`;
    setSavingKey(saveKey);
    setError('');
    try {
      await usersApi.update(userId, payload);
      await loadFromBackend(filtersRef.current);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
      await loadFromBackend(filtersRef.current);
    } finally {
      setSavingKey(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    await usersApi.remove(id);
    await loadFromBackend(filtersRef.current);
  };

  return (
    <AdminShell>
      <div className="w-full">
        <PageHeader
          title="Users"
          subtitle="Filters call the backend. Admin accounts are hidden. Swift Solutions users are included."
          actions={
            <button type="button" onClick={openCreate} className="dd-btn-primary">
              + New user
            </button>
          }
        />

        {error && !modalOpen ? (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        ) : null}

        <div className="dd-card">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex flex-col lg:flex-row gap-2">
              <input
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder="Search name, email, or note…"
                className="dd-input flex-1"
              />
              <button
                type="button"
                className="dd-btn-primary"
                disabled={loading}
                onClick={() => loadFromBackend(filters)}
              >
                {loading ? 'Loading…' : 'Apply filters'}
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="dd-btn-secondary"
                disabled={!activeFilterCount}
              >
                Clear
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
              <select
                className="dd-select"
                value={filters.plan}
                onChange={(e) => updateFilter('plan', e.target.value)}
              >
                <option value="">All plans</option>
                <option value="single">single</option>
                <option value="double">double</option>
                <option value="multi">multi</option>
              </select>

              <select
                className="dd-select"
                value={filters.label}
                onChange={(e) => updateFilter('label', e.target.value)}
              >
                <option value="">All labels</option>
                <option value="none">No label</option>
                <option value="horizon">Horizon</option>
                <option value="test">Test</option>
                <option value="swiftSolutions">Swift Solutions</option>
              </select>

              <select
                className="dd-select"
                value={filters.banned}
                onChange={(e) => updateFilter('banned', e.target.value)}
              >
                <option value="">All status</option>
                <option value="false">Active</option>
                <option value="true">Banned</option>
              </select>

              <select
                className="dd-select"
                value={filters.proxy}
                onChange={(e) => updateFilter('proxy', e.target.value)}
              >
                <option value="">Any proxy</option>
                <option value="assigned">Has proxy</option>
                <option value="none">No proxy</option>
              </select>

              <select
                className="dd-select"
                value={filters.cookie}
                onChange={(e) => updateFilter('cookie', e.target.value)}
              >
                <option value="">Any cookie</option>
                <option value="assigned">Specific cookie</option>
                <option value="none">Channel cookie</option>
              </select>

              <select
                className="dd-select"
                value={filters.openDat}
                onChange={(e) => updateFilter('openDat', e.target.value)}
              >
                <option value="">Open DAT: any</option>
                <option value="true">Open DAT on</option>
                <option value="false">Open DAT off</option>
              </select>
            </div>

            <div className="text-xs text-slate-500">
              {loading ? (
                'Loading from backend…'
              ) : (
                <>
                  Showing <span className="font-medium text-slate-700">{users.length}</span> of{' '}
                  <span className="font-medium text-slate-700">{serverTotal}</span> users
                  {activeFilterCount ? (
                    <span className="text-brand-700">
                      {' '}
                      · {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm dd-table">
              <thead className="bg-slate-50/80">
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Label</th>
                  <th>Proxy</th>
                  <th>Cookie</th>
                  <th>Open DAT</th>
                  <th>Banned</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const busyRow = savingKey?.startsWith(`${user._id}:`);
                  return (
                    <tr key={user._id}>
                      <td>
                        <div className="font-medium text-slate-900">{user.name}</div>
                        <div className="text-xs text-slate-400">{user.email}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 capitalize">
                          {user.role}
                          {user.label === 'swiftSolutions' ? (
                            <span className="text-sky-600"> · Swift Solutions</span>
                          ) : null}
                          {user.resolvedCookie ? (
                            <span className="text-emerald-600">
                              {' '}
                              · cookie via {user.resolvedCookie.source}
                            </span>
                          ) : (
                            <span className="text-red-500"> · no cookie</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <select
                          className="dd-select min-w-[100px]"
                          value={user.plan || 'single'}
                          disabled={!!busyRow}
                          onChange={(e) =>
                            patchInline(user._id, 'plan', { plan: e.target.value })
                          }
                        >
                          <option value="single">single</option>
                          <option value="double">double</option>
                          <option value="multi">multi</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="dd-select min-w-[130px]"
                          value={
                            user.label === 'swiftSolutions' ||
                            user.label === 'test' ||
                            user.label === 'horizon'
                              ? user.label
                              : ''
                          }
                          disabled={!!busyRow}
                          onChange={(e) =>
                            patchInline(user._id, 'label', { label: e.target.value })
                          }
                        >
                          {USER_LABEL_OPTIONS.map((opt) => (
                            <option key={opt.value || 'none'} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                          <option value="horizon">Horizon</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="dd-select min-w-[150px] max-w-[200px]"
                          value={proxyIdOf(user)}
                          disabled={!!busyRow}
                          onChange={(e) =>
                            patchInline(user._id, 'proxy', {
                              proxyId: e.target.value || null
                            })
                          }
                        >
                          <option value="">Global / none</option>
                          {proxies.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] font-mono text-slate-400 mt-1 truncate max-w-[180px]">
                          {maskProxy(user.resolvedProxy?.proxy)}
                        </div>
                      </td>
                      <td>
                        <select
                          className="dd-select min-w-[150px] max-w-[200px]"
                          value={cookieIdOf(user)}
                          disabled={!!busyRow}
                          onChange={(e) =>
                            patchInline(user._id, 'cookie', {
                              assignedCookieId: e.target.value || null
                            })
                          }
                        >
                          <option value="">Channel cookie</option>
                          {cookies.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.fileName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <Toggle
                          checked={user.permissions?.openDat !== false}
                          disabled={!!busyRow}
                          label="Open DAT"
                          onChange={(next) =>
                            patchInline(user._id, 'openDat', {
                              permissions: {
                                ...defaultPermissions(),
                                ...(user.permissions || {}),
                                openDat: next
                              }
                            })
                          }
                        />
                      </td>
                      <td>
                        <Toggle
                          checked={!!user.isBanned}
                          disabled={!!busyRow}
                          label="Banned"
                          onChange={(next) =>
                            patchInline(user._id, 'ban', { isBanned: next })
                          }
                        />
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="dd-btn-secondary !py-1.5 !px-2.5 mr-1"
                          onClick={() => openEdit(user)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="dd-btn-danger !py-1.5 !px-2.5"
                          onClick={() => remove(user._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !users.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      {activeFilterCount
                        ? 'No users match these filters'
                        : 'No users yet — create one to get started'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit user' : 'Create user'}
        subtitle="Full profile, cookie routing, proxy, and permissions"
        wide
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {(['name', 'email', 'password', 'domain'] as const).map((field) => (
              <div key={field} className={field === 'domain' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-500 mb-1 capitalize">
                  {field}
                  {field === 'password' && editingId ? ' (leave blank to keep)' : ''}
                </label>
                <input
                  required={
                    field === 'name' || field === 'email' || (!editingId && field === 'password')
                  }
                  type={field === 'password' ? 'password' : 'text'}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="dd-input"
                />
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
              <div className="dd-input bg-slate-50 text-slate-600 capitalize">user</div>
              <p className="mt-1 text-[11px] text-slate-400">
                Admin accounts can only be created in the database.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Plan</label>
              <select
                value={form.plan}
                onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                className="dd-select !py-2"
              >
                <option value="single">single</option>
                <option value="double">double</option>
                <option value="multi">multi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
              <select
                value={
                  form.label === 'swiftSolutions' ||
                  form.label === 'test' ||
                  form.label === 'horizon'
                    ? form.label
                    : ''
                }
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="dd-select !py-2"
              >
                {USER_LABEL_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
                <option value="horizon">Horizon</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Proxy</label>
              <select
                value={form.proxyId}
                onChange={(e) => setForm((f) => ({ ...f, proxyId: e.target.value }))}
                className="dd-select !py-2"
              >
                <option value="">Use global proxy (if enabled)</option>
                {proxies.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.host}:{p.port})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Specific cookie override
              </label>
              <select
                value={form.assignedCookieId}
                onChange={(e) => setForm((f) => ({ ...f, assignedCookieId: e.target.value }))}
                className="dd-select !py-2"
              >
                <option value="">Use channel cookie</option>
                {cookies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.fileName} ({c.cookieCount})
                  </option>
                ))}
              </select>
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

          <PermissionsEditor
            value={form.permissions}
            onChange={(permissions) => setForm((f) => ({ ...f, permissions }))}
          />

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
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
}
