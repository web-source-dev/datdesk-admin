'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import { freightApi, type FreightContactRow } from '@/lib/api';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<FreightContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [partyType, setPartyType] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await freightApi.listContacts({
        page,
        limit,
        partyType: partyType || undefined,
        search: search || undefined
      });
      setContacts(res.contacts || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [page, partyType, search]);

  useEffect(() => {
    load();
  }, [load]);

  const setOverride = async (id: string, partyTypeOverride: string) => {
    setSavingId(id);
    try {
      await freightApi.updateContact(id, {
        partyTypeOverride: partyTypeOverride || null
      });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Update failed');
    } finally {
      setSavingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <AdminShell>
      <PageHeader
        title="Contacts"
        subtitle="Broker / carrier intelligence learned from employee emails — correct any mislabels"
        actions={
          <button type="button" className="dd-btn-primary" onClick={load}>
            Refresh
          </button>
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center">
          <select
            className="dd-select"
            value={partyType}
            onChange={(e) => {
              setPage(1);
              setPartyType(e.target.value);
            }}
          >
            <option value="">All types</option>
            <option value="broker">Broker</option>
            <option value="carrier">Carrier</option>
            <option value="shipper">Shipper</option>
            <option value="unknown">Unknown</option>
          </select>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <input
              className="dd-input min-w-[220px]"
              placeholder="Search email, company, domain…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="dd-btn-secondary">
              Search
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm dd-table">
            <thead className="bg-slate-50/80">
              <tr>
                <th>Contact</th>
                <th>Company</th>
                <th>Type</th>
                <th>Signals</th>
                <th>Emails</th>
                <th>Correct type</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="font-medium">{c.email}</div>
                    <div className="text-[11px] text-slate-400">{c.domain}</div>
                  </td>
                  <td>{c.companyName || '—'}</td>
                  <td>
                    <span className="capitalize text-xs px-1.5 py-0.5 rounded bg-slate-100">
                      {c.partyType}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-1">
                      auto {c.partyTypeAuto} · {Math.round((c.confidence || 0) * 100)}%
                    </div>
                  </td>
                  <td className="text-xs text-slate-500">
                    B:{c.brokerSignals || 0} / C:{c.carrierSignals || 0}
                  </td>
                  <td>{c.emailCount || 0}</td>
                  <td>
                    <select
                      className="dd-select min-w-[120px]"
                      disabled={savingId === c.id}
                      value={c.partyTypeOverride || ''}
                      onChange={(e) => setOverride(c.id, e.target.value)}
                    >
                      <option value="">Auto</option>
                      <option value="broker">Broker</option>
                      <option value="carrier">Carrier</option>
                      <option value="shipper">Shipper</option>
                      <option value="dispatcher">Dispatcher</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </td>
                </tr>
              ))}
              {!loading && !contacts.length ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400 py-10">
                    No contacts yet — process mailbox emails first
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <div>{loading ? 'Loading…' : `${total} contacts · page ${page}/${totalPages}`}</div>
          <div className="flex gap-2">
            <button
              type="button"
              className="dd-btn-secondary !py-1.5"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <button
              type="button"
              className="dd-btn-secondary !py-1.5"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
