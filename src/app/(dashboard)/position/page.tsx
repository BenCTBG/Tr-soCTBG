'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import { formatCurrency, formatDate, formatVariation } from '@/utils/formatters';

interface EntityData {
  id: string;
  name: string;
  code: string;
}

interface BankAccountData {
  id: string;
  entityId: string;
  bankName: string;
  accountNumber: string | null;
  iban: string | null;
  label: string | null;
  active: boolean;
  entity?: { name: string };
}

interface AccountRow {
  bankAccountId: string;
  bankName: string;
  label: string | null;
  entityId: string;
  entityName: string;
  soldeVeille: number;
  soldeConstate: number;
}

interface EntityGroup {
  entityId: string;
  entityName: string;
  accounts: AccountRow[];
  subtotalVeille: number;
  subtotalConstate: number;
}

interface HistoryEntry {
  id: string;
  date: string;
  balance: string;
  previousBalance: string;
  variation: string;
  alertLevel: string;
  entity: { name: string };
  bankAccount?: { id: string; bankName: string; label: string | null } | null;
  user?: { name: string };
}

function getAlertInfo(solde: number): { color: string; label: string } {
  if (solde < 0) return { color: 'bg-error', label: '!' };
  if (solde < 30000) return { color: 'bg-error', label: '!' };
  if (solde < 50000) return { color: 'bg-warning', label: '!' };
  return { color: 'bg-success', label: '✓' };
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

const emptyAccountForm = {
  entityId: '',
  bankName: '',
  accountNumber: '',
  iban: '',
  label: '',
};

export default function PositionBancairePage() {
  const [date, setDate] = useState(todayISO);
  const [accountRows, setAccountRows] = useState<AccountRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [entities, setEntities] = useState<EntityData[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountData[]>([]);
  const [filterEntityId, setFilterEntityId] = useState('');

  // Modal ajout compte
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ ...emptyAccountForm });

  // ── Fetch ──

  const fetchEntities = useCallback(async (): Promise<EntityData[]> => {
    try {
      const res = await fetch('/api/entities');
      if (res.ok) {
        const json = await res.json();
        return json.data || json || [];
      }
    } catch { /* silent */ }
    return [];
  }, []);

  const fetchBankAccounts = useCallback(async (): Promise<BankAccountData[]> => {
    try {
      const res = await fetch('/api/bank-accounts?active=true');
      if (res.ok) {
        const json = await res.json();
        return json.data || [];
      }
    } catch { /* silent */ }
    return [];
  }, []);

  const fetchLatestBalances = useCallback(async (): Promise<Record<string, number>> => {
    try {
      const res = await fetch('/api/bank-positions?limit=500');
      if (res.ok) {
        const json = await res.json();
        const data: HistoryEntry[] = json.data || [];
        // Dernier solde par bankAccountId
        const latest: Record<string, number> = {};
        for (const entry of data) {
          const baId = entry.bankAccount?.id;
          if (baId && !(baId in latest)) {
            latest[baId] = parseFloat(entry.balance);
          }
        }
        return latest;
      }
    } catch { /* silent */ }
    return {};
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (filterEntityId) params.set('entity_id', filterEntityId);
      const res = await fetch(`/api/bank-positions?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data || []);
      }
    } catch { /* silent */ }
  }, [filterEntityId]);

  // ── Build rows ──

  const buildRows = useCallback((accounts: BankAccountData[], latestBalances: Record<string, number>) => {
    const sorted = [...accounts].sort((a, b) => {
      const eA = a.entity?.name || '';
      const eB = b.entity?.name || '';
      if (eA !== eB) return eA.localeCompare(eB);
      return a.bankName.localeCompare(b.bankName);
    });

    const rows: AccountRow[] = sorted.map((acc) => ({
      bankAccountId: acc.id,
      bankName: acc.bankName,
      label: acc.label,
      entityId: acc.entityId,
      entityName: acc.entity?.name || '',
      soldeVeille: latestBalances[acc.id] ?? 0,
      soldeConstate: 0,
    }));

    setAccountRows(rows);
  }, []);

  // ── Init ──

  useEffect(() => {
    (async () => {
      const [entList, accounts, balances] = await Promise.all([
        fetchEntities(),
        fetchBankAccounts(),
        fetchLatestBalances(),
      ]);
      setEntities(entList);
      setBankAccounts(accounts);
      buildRows(accounts, balances);
      await fetchHistory();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Handlers ──

  function handleSoldeChange(bankAccountId: string, value: string) {
    setAccountRows((prev) =>
      prev.map((r) =>
        r.bankAccountId === bankAccountId
          ? { ...r, soldeConstate: value === '' ? 0 : parseFloat(value) }
          : r
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const toSubmit = accountRows.filter((r) => r.soldeConstate !== 0);
    if (toSubmit.length === 0) {
      setFeedback({ type: 'error', message: 'Veuillez saisir au moins un solde.' });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/bank-positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          positions: toSubmit.map((r) => ({
            entityId: r.entityId,
            balance: r.soldeConstate,
            bankAccountId: r.bankAccountId,
          })),
        }),
      });

      if (res.ok) {
        setFeedback({ type: 'success', message: 'Position bancaire validée et archivée avec succès !' });
        await fetchHistory();
        const balances = await fetchLatestBalances();
        setAccountRows((prev) =>
          prev.map((r) => ({
            ...r,
            soldeVeille: balances[r.bankAccountId] ?? r.soldeVeille,
            soldeConstate: 0,
          }))
        );
      } else {
        const err = await res.json().catch(() => null);
        setFeedback({ type: 'error', message: err?.error?.message || 'Erreur lors de l\'enregistrement.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erreur réseau.' });
    } finally {
      setLoading(false);
    }
  }

  // ── Ajout compte ──

  const openAddAccount = (preselectedEntityId?: string) => {
    setAccountForm({
      ...emptyAccountForm,
      entityId: preselectedEntityId || entities[0]?.id || '',
    });
    setAccountModalOpen(true);
  };

  const handleAccountSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!accountForm.entityId || !accountForm.bankName) {
      setFeedback({ type: 'error', message: 'Veuillez sélectionner une entité et saisir le nom de la banque.' });
      return;
    }

    try {
      const payload: Record<string, string> = {
        entityId: accountForm.entityId,
        bankName: accountForm.bankName,
      };
      if (accountForm.accountNumber) payload.accountNumber = accountForm.accountNumber;
      if (accountForm.iban) payload.iban = accountForm.iban;
      if (accountForm.label) payload.label = accountForm.label;

      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setAccountModalOpen(false);
        setFeedback({ type: 'success', message: 'Compte bancaire ajouté !' });
        // Refresh tout
        const [accounts, balances] = await Promise.all([
          fetchBankAccounts(),
          fetchLatestBalances(),
        ]);
        setBankAccounts(accounts);
        buildRows(accounts, balances);
      } else {
        const err = await res.json().catch(() => null);
        setFeedback({ type: 'error', message: err?.error?.message || 'Erreur lors de l\'ajout.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erreur réseau.' });
    }
  };

  const setAccountField = (key: string) => (value: string) =>
    setAccountForm((prev) => ({ ...prev, [key]: value }));

  // ── Grouper par entité ──

  const entityGroups: EntityGroup[] = [];
  const entityOrder: string[] = [];

  for (const row of accountRows) {
    if (!entityOrder.includes(row.entityId)) {
      entityOrder.push(row.entityId);
    }
  }

  for (const eid of entityOrder) {
    const accounts = accountRows.filter((r) => r.entityId === eid);
    entityGroups.push({
      entityId: eid,
      entityName: accounts[0]?.entityName || '',
      accounts,
      subtotalVeille: accounts.reduce((s, a) => s + a.soldeVeille, 0),
      subtotalConstate: accounts.reduce((s, a) => s + a.soldeConstate, 0),
    });
  }

  // Entités sans compte
  const entitiesWithoutAccounts = entities.filter(
    (e) => !bankAccounts.some((ba) => ba.entityId === e.id)
  );

  // Variables de totaux retirées (pas de ligne total consolidé)

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="bg-white p-6 rounded-lg shadow-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-dark uppercase tracking-wide">
              Position Bancaire du Jour
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => openAddAccount()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-ctbg-red text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-ctbg-red-hover transition-all"
              >
                + Ajouter un compte
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="p-2 border border-gray-border rounded text-sm focus:outline-none focus:border-ctbg-red focus:ring-2 focus:ring-ctbg-red/[0.08]"
              />
            </div>
          </div>

          {accountRows.length === 0 && (
            <div className="text-center py-8 text-gray-text">
              <p className="text-lg mb-2">🏦</p>
              <p className="text-sm font-medium mb-1">Aucun compte bancaire configuré</p>
              <p className="text-xs mb-4">Ajoutez des comptes bancaires à vos entités pour commencer</p>
              <button
                type="button"
                onClick={() => openAddAccount()}
                className="px-4 py-2 bg-ctbg-red text-white rounded-md text-sm font-semibold hover:bg-ctbg-red-hover transition-all"
              >
                + Ajouter un compte bancaire
              </button>
            </div>
          )}

          {accountRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                      Entité / Compte
                    </th>
                    <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                      Solde Veille
                    </th>
                    <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide w-48">
                      Solde Constaté
                    </th>
                    <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                      Variation
                    </th>
                    <th className="bg-gray-light p-3 text-center font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide w-16">
                      Alerte
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entityGroups.map((group) => {
                    const hasMultiple = group.accounts.length > 1;
                    const subtotalVariation = group.subtotalConstate - group.subtotalVeille;
                    const subtotalAlert = getAlertInfo(group.subtotalConstate || group.subtotalVeille);
                    const hasGroupConstate = group.accounts.some((a) => a.soldeConstate !== 0);

                    return (
                      <Fragment key={group.entityId}>
                        {/* En-tête entité */}
                        <tr className="bg-gray-light/60">
                          <td className="p-2.5 px-3 border-b border-gray-border" colSpan={hasMultiple ? 1 : undefined}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-dark text-xs uppercase tracking-wide">
                                {group.entityName}
                              </span>
                              <button
                                type="button"
                                onClick={() => openAddAccount(group.entityId)}
                                className="text-[11px] text-ctbg-red hover:underline cursor-pointer bg-transparent border-none"
                              >
                                + compte
                              </button>
                            </div>
                          </td>
                          {hasMultiple && (
                            <>
                              <td className="p-2.5 border-b border-gray-border text-xs text-gray-text font-semibold">
                                {formatCurrency(group.subtotalVeille)}
                              </td>
                              <td className="p-2.5 border-b border-gray-border text-xs text-gray-text font-semibold">
                                {hasGroupConstate ? formatCurrency(group.subtotalConstate) : ''}
                              </td>
                              <td className={`p-2.5 border-b border-gray-border text-xs font-semibold ${subtotalVariation >= 0 ? 'text-success' : 'text-error'}`}>
                                {hasGroupConstate ? formatVariation(subtotalVariation) : ''}
                              </td>
                              <td className="p-2.5 border-b border-gray-border text-center">
                                {hasGroupConstate && (
                                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold ${subtotalAlert.color}`}>
                                    {subtotalAlert.label}
                                  </span>
                                )}
                              </td>
                            </>
                          )}
                          {!hasMultiple && (
                            <>
                              <td className="p-2.5 border-b border-gray-border" />
                              <td className="p-2.5 border-b border-gray-border" />
                              <td className="p-2.5 border-b border-gray-border" />
                              <td className="p-2.5 border-b border-gray-border" />
                            </>
                          )}
                        </tr>

                        {/* Lignes comptes */}
                        {group.accounts.map((acc) => {
                          const variation = acc.soldeConstate - acc.soldeVeille;
                          const alert = getAlertInfo(acc.soldeConstate || acc.soldeVeille);

                          return (
                            <tr key={acc.bankAccountId} className="hover:bg-gray-light/30 transition-colors">
                              <td className="p-3 pl-6 border-b border-gray-border">
                                <span className="font-medium">{acc.bankName}</span>
                                {acc.label && (
                                  <span className="text-gray-text text-xs ml-1.5">({acc.label})</span>
                                )}
                              </td>
                              <td className="p-3 border-b border-gray-border text-gray-text">
                                {formatCurrency(acc.soldeVeille)}
                              </td>
                              <td className="p-3 border-b border-gray-border">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={acc.soldeConstate || ''}
                                  onChange={(e) => handleSoldeChange(acc.bankAccountId, e.target.value)}
                                  placeholder="0,00"
                                  className="w-full p-2 border border-gray-border rounded text-sm focus:outline-none focus:border-ctbg-red focus:ring-2 focus:ring-ctbg-red/[0.08]"
                                />
                              </td>
                              <td className={`p-3 border-b border-gray-border font-semibold ${variation >= 0 ? 'text-success' : 'text-error'}`}>
                                {acc.soldeConstate !== 0 ? formatVariation(variation) : '-'}
                              </td>
                              <td className="p-3 border-b border-gray-border text-center">
                                {acc.soldeConstate !== 0 ? (
                                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold ${alert.color}`}>
                                    {alert.label}
                                  </span>
                                ) : (
                                  <span className="text-gray-text text-xs">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}

                  {/* Entités sans comptes */}
                  {entitiesWithoutAccounts.map((ent) => (
                    <tr key={`no-${ent.id}`} className="bg-orange-50/50">
                      <td colSpan={5} className="p-3 border-b border-gray-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">⚠️</span>
                            <span className="text-sm font-medium text-gray-dark">{ent.name}</span>
                            <span className="text-xs text-gray-text">— Aucun compte</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openAddAccount(ent.id)}
                            className="text-xs px-3 py-1.5 bg-ctbg-red text-white rounded-md font-semibold hover:bg-ctbg-red-hover transition-all cursor-pointer border-none"
                          >
                            + Ajouter
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Total consolidé supprimé */}
                </tbody>
              </table>
            </div>
          )}

          {feedback && (
            <div className={`mt-4 p-3 rounded text-sm font-medium ${feedback.type === 'success' ? 'bg-success/15 text-emerald-800' : 'bg-error/15 text-red-800'}`}>
              {feedback.message}
            </div>
          )}

          {accountRows.length > 0 && (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-success text-white border-none rounded-md text-sm font-semibold uppercase tracking-wide mt-5 hover:bg-emerald-600 hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enregistrement...' : 'VALIDER ET ARCHIVER'}
            </button>
          )}
        </div>
      </form>

      {/* Historique */}
      <div className="bg-white p-6 rounded-lg shadow-card mb-6">
        <h2 className="text-sm font-semibold text-gray-dark mb-4 uppercase tracking-wide">
          Historique des Saisies
        </h2>

        <div className="flex gap-3 mb-4">
          <select
            value={filterEntityId}
            onChange={(e) => setFilterEntityId(e.target.value)}
            className="p-2 border border-gray-border rounded text-sm focus:outline-none focus:border-ctbg-red focus:ring-2 focus:ring-ctbg-red/[0.08]"
          >
            <option value="">Toutes les entités</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Date</th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Entité</th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Compte</th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Solde</th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Variation</th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Saisi par</th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Statut</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-text">Aucun historique disponible.</td>
                </tr>
              ) : (
                history.map((entry) => {
                  const variation = parseFloat(entry.variation || '0');
                  return (
                    <tr key={entry.id} className="hover:bg-gray-light transition-colors">
                      <td className="p-3 border-b border-gray-border">{formatDate(entry.date)}</td>
                      <td className="p-3 border-b border-gray-border font-semibold">{entry.entity?.name || '-'}</td>
                      <td className="p-3 border-b border-gray-border">
                        {entry.bankAccount ? (
                          <span>
                            {entry.bankAccount.bankName}
                            {entry.bankAccount.label && <span className="text-gray-text text-xs ml-1">({entry.bankAccount.label})</span>}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-3 border-b border-gray-border">{formatCurrency(parseFloat(entry.balance))}</td>
                      <td className={`p-3 border-b border-gray-border font-semibold ${variation >= 0 ? 'text-success' : 'text-error'}`}>
                        {formatVariation(variation)}
                      </td>
                      <td className="p-3 border-b border-gray-border">{entry.user?.name || '-'}</td>
                      <td className="p-3 border-b border-gray-border">
                        <StatusBadge status="VALIDE_DG" label="Validé" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal ajout compte — rendu via createPortal dans Modal */}
      <Modal isOpen={accountModalOpen} onClose={() => setAccountModalOpen(false)} title="Ajouter un Compte Bancaire">
        <form onSubmit={handleAccountSubmit}>
          <FormField
            label="Entité"
            value={accountForm.entityId}
            onChange={setAccountField('entityId')}
            required
            options={entities.map((e) => ({ value: e.id, label: e.name }))}
          />
          <FormField
            label="Nom de la banque"
            value={accountForm.bankName}
            onChange={setAccountField('bankName')}
            placeholder="Ex: BNP Paribas, Qonto, Crédit Agricole..."
            required
          />
          <FormField
            label="Numéro de compte"
            value={accountForm.accountNumber}
            onChange={setAccountField('accountNumber')}
            placeholder="Ex: 00012345678"
          />
          <FormField
            label="IBAN"
            value={accountForm.iban}
            onChange={setAccountField('iban')}
            placeholder="Ex: FR76 3000 1007 ..."
          />
          <FormField
            label="Label / Description"
            value={accountForm.label}
            onChange={setAccountField('label')}
            placeholder="Ex: Compte courant, Compte dédié CEE..."
          />
          <div className="flex gap-2.5 mt-5">
            <button type="submit" className="px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold uppercase tracking-wide hover:bg-ctbg-red-hover">
              Enregistrer
            </button>
            <button type="button" onClick={() => setAccountModalOpen(false)} className="px-4 py-2.5 bg-gray-light text-gray-dark border border-gray-border rounded-md text-sm font-semibold">
              Annuler
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
