'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type UserFilters = {
  search: string;
  plan: string;
  label: string;
  role: string;
  banned: string;
  proxy: string;
  cookie: string;
  openDat: string;
};

const emptyFilters: UserFilters = {
  search: '',
  plan: '',
  label: '',
  role: '',
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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [proxies, setProxies] = useState<ProxyOption[]>([]);
  const [cookies, setCookies] = useState<CookieOption[]>([]);
  const [filters, setFilters] = useState<UserFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  });
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) => key !== 'search' && Boolean(value))
        .length + (filters.search.trim() ? 1 : 0),
    [filters]
  );

  const load = useCallback(async (nextPage = page, nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const [usersData, proxiesData, cookiesData] = await Promise.all([
        usersApi.getAll({
          page: nextPage,
          limit: 50,
          search: nextFilters.search.trim() || undefined,
          plan: nextFilters.plan || undefined,
          label: nextFilters.label || undefined,
          role: nextFilters.role || undefined,
          banned: nextFilters.banned || undefined,
          proxy: nextFilters.proxy || undefined,
          cookie: nextFilters.cookie || undefined,
          openDat: nextFilters.openDat || undefined
        }),
        proxiesApi.getAll(),
        cookiesApi.getAll()
      ]);
      setUsers(usersData.users || []);
      setPagination(
        usersData.pagination || {
          page: nextPage,
          limit: 50,
          total: (usersData.users || []).length,
          pages: 1
        }
      );
      setProxies((proxiesData.proxies || []).filter((p: ProxyOption) => p.enabled !== false));
      setCookies(cookiesData.cookies || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load(1, filters).catch(() => {});
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    setPage(1);
    load(1, filters).catch(() => {});
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setPage(1);
    load(1, emptyFilters).catch(() => {});
  };

  const setFilter = <K extends keyof UserFilters>(key: K, value: UserFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
        role: form.role,
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
      await load(page, filters);
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
      await load(page, filters);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
      await load(page, filters);
    } finally {
      setSavingKey(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    await usersApi.remove(id);
    await load(page, filters);
  };

  const goToPage = (next: number) => {
    const safe = Math.max(1, Math.min(pagination.pages || 1, next));
    setPage(safe);
    load(safe, filters).catch(() => {});
  };

  return (
    <AdminShell>
      <div className="w-full">
        <PageHeader
          title="Users"
          subtitle="Create accounts in a popup. Set label to Swift Solutions so they use the Swift active cookie."
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
                onChange={(e) => setFilter('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                placeholder="Search name, email, or note…"
                className="dd-input flex-1"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={applyFilters} className="dd-btn-primary">
                  Apply filters
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
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-2">
              <select
                className="dd-select"
                value={filters.plan}
                onChange={(e) => setFilter('plan', e.target.value)}
                aria-label="Filter by plan"
              >
                <option value="">All plans</option>
                <option value="single">single</option>
                <option value="double">double</option>
                <option value="multi">multi</option>
              </select>

              <select
                className="dd-select"
                value={filters.label}
                onChange={(e) => setFilter('label', e.target.value)}
                aria-label="Filter by label"
              >
                <option value="">All labels</option>
                <option value="none">No label</option>
                <option value="test">Test</option>
                <option value="swiftSolutions">Swift Solutions</option>
              </select>

              <select
                className="dd-select"
                value={filters.role}
                onChange={(e) => setFilter('role', e.target.value)}
                aria-label="Filter by role"
              >
                <option value="">All roles</option>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>

              <select
                className="dd-select"
                value={filters.banned}
                onChange={(e) => setFilter('banned', e.target.value)}
                aria-label="Filter by banned status"
              >
                <option value="">All status</option>
                <option value="false">Active</option>
                <option value="true">Banned</option>
              </select>

              <select
                className="dd-select"
                value={filters.proxy}
                onChange={(e) => setFilter('proxy', e.target.value)}
                aria-label="Filter by proxy"
              >
                <option value="">Any proxy</option>
                <option value="assigned">Has proxy</option>
                <option value="none">No proxy</option>
              </select>

              <select
                className="dd-select"
                value={filters.cookie}
                onChange={(e) => setFilter('cookie', e.target.value)}
                aria-label="Filter by cookie"
              >
                <option value="">Any cookie</option>
                <option value="assigned">Specific cookie</option>
                <option value="none">Channel cookie</option>
              </select>

              <select
                className="dd-select"
                value={filters.openDat}
                onChange={(e) => setFilter('openDat', e.target.value)}
                aria-label="Filter by Open DAT"
              >
                <option value="">Open DAT: any</option>
                <option value="true">Open DAT on</option>
                <option value="false">Open DAT off</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div>
                {loading ? (
                  'Loading…'
                ) : (
                  <>
                    Showing <span className="font-medium text-slate-700">{users.length}</span> of{' '}
                    <span className="font-medium text-slate-700">{pagination.total}</span> users
                    {activeFilterCount ? (
                      <span className="ml-1 text-brand-700">
                        · {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active
                      </span>
                    ) : null}
                  </>
                )}
              </div>
              {pagination.pages > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="dd-btn-secondary !py-1 !px-2.5"
                    disabled={page <= 1 || loading}
                    onClick={() => goToPage(page - 1)}
                  >
                    Prev
                  </button>
                  <span>
                    Page {pagination.page} / {pagination.pages}
                  </span>
                  <button
                    type="button"
                    className="dd-btn-secondary !py-1 !px-2.5"
                    disabled={page >= pagination.pages || loading}
                    onClick={() => goToPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              ) : null}
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
                            user.label === 'swiftSolutions' || user.label === 'test'
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
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="dd-select !py-2"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
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
                  form.label === 'swiftSolutions' || form.label === 'test' ? form.label : ''
                }
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="dd-select !py-2"
              >
                {USER_LABEL_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Swift Solutions users get the Swift active cookie (overrides plan).
              </p>
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
