'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuditUser {
  name: string;
  email: string;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  module: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  user: AuditUser;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

const MODULE_OPTIONS = [
  'DASHBOARD',
  'BANK_POSITION',
  'RECEIPTS',
  'DISBURSEMENTS',
  'RECURRING_CHARGES',
  'SETTINGS',
  'NOTIFICATIONS',
] as const;

const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE', 'VALIDATE'] as const;

const MODULE_LABELS: Record<string, string> = {
  DASHBOARD: 'Dashboard',
  BANK_POSITION: 'Position Bancaire',
  RECEIPTS: 'Encaissements',
  DISBURSEMENTS: 'Décaissements',
  RECURRING_CHARGES: 'Charges Récurrentes',
  SETTINGS: 'Paramètres',
  NOTIFICATIONS: 'Notifications',
};

const MODULE_BADGE_CLASSES: Record<string, string> = {
  RECEIPTS: 'bg-green-100 text-green-800',
  DISBURSEMENTS: 'bg-red-100 text-red-800',
  BANK_POSITION: 'bg-blue-100 text-blue-800',
  RECURRING_CHARGES: 'bg-orange-100 text-orange-800',
  SETTINGS: 'bg-gray-100 text-gray-800',
  NOTIFICATIONS: 'bg-purple-100 text-purple-800',
  DASHBOARD: 'bg-slate-100 text-slate-800',
};

const ACTION_BADGE_CLASSES: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  VALIDATE: 'bg-orange-100 text-orange-800',
};

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return '-';
  const parts: string[] = [];
  if (details.supplier) parts.push(`Fournisseur: ${details.supplier}`);
  if (details.invoiceNumber) parts.push(`Facture: ${details.invoiceNumber}`);
  if (details.disbursementId) parts.push(`ID: ${String(details.disbursementId).substring(0, 8)}...`);
  if (details.receiptId) parts.push(`ID: ${String(details.receiptId).substring(0, 8)}...`);
  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(details).substring(0, 80);
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export default function HistoriquePage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterModule, setFilterModule] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 100 });

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((json) => setUsers(json.data || []))
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterModule) params.set('module', filterModule);
    if (filterAction) params.set('action', filterAction);
    if (filterUser) params.set('user_id', filterUser);
    params.set('page', String(page));
    params.set('limit', '100');
    try {
      const res = await fetch(`/api/audit-log?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
        setMeta(json.meta || { total: 0, page: 1, limit: 100 });
      }
    } catch {
      // silent
    }
  }, [filterModule, filterAction, filterUser, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterModule, filterAction, filterUser]);

  const totalPages = Math.ceil(meta.total / meta.limit) || 1;

  return (
    <>
      <div className="flex gap-2.5 mb-4">
        <select
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red"
        >
          <option value="">Tous les modules</option>
          {MODULE_OPTIONS.map((mod) => (
            <option key={mod} value={mod}>
              {MODULE_LABELS[mod] || mod}
            </option>
          ))}
        </select>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red"
        >
          <option value="">Toutes les actions</option>
          {ACTION_OPTIONS.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red"
        >
          <option value="">Tous les utilisateurs</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                Date/Heure
              </th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                Utilisateur
              </th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                Module
              </th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                Action
              </th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                Détails
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-text">
                  Aucune entrée trouvée
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-light transition-colors">
                  <td className="p-3 border-b border-gray-border whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="p-3 border-b border-gray-border">
                    {log.user?.name || '-'}
                  </td>
                  <td className="p-3 border-b border-gray-border">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${MODULE_BADGE_CLASSES[log.module] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {MODULE_LABELS[log.module] || log.module}
                    </span>
                  </td>
                  <td className="p-3 border-b border-gray-border">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ACTION_BADGE_CLASSES[log.action] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 border-b border-gray-border text-xs text-gray-text max-w-xs truncate">
                    {formatDetails(log.details)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-gray-text">
          Page {page} sur {totalPages} ({meta.total} entrée{meta.total > 1 ? 's' : ''})
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs border border-gray-border rounded-md bg-white hover:bg-gray-light disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Précédent
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs border border-gray-border rounded-md bg-white hover:bg-gray-light disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Suivant
          </button>
        </div>
      </div>
    </>
  );
}
