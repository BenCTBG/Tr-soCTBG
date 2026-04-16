'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import SummaryCard from '@/components/ui/SummaryCard';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import { formatCurrency } from '@/utils/formatters';
import { exportToExcel } from '@/utils/exportExcel';
import {
  CHARGE_FREQUENCY_LABELS,
  CHARGE_CATEGORY_LABELS,
} from '@/utils/constants';

interface EntityData {
  id: string;
  name: string;
}

interface RecurringCharge {
  id: string;
  entityId: string;
  entity: { id: string; name: string };
  label: string;
  category: string;
  frequency: string;
  amountTtc: string | number;
  variableAmount: boolean;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  observations: string | null;
}

// Matrix view configuration
const MATRIX_ENTITIES = [
  'CTBG PREMIUM',
  'CTBG GROUPE',
  'CTBG EP',
  "CTBG HOME RENOV'",
  'CVH',
  'DOMOS ENERGIE',
];

interface MatrixRow {
  label: string;
  category: string;
}

interface MatrixCategory {
  name: string;
  categoryKey: string;
  rows: MatrixRow[];
}

const MATRIX_CATEGORIES: MatrixCategory[] = [
  {
    name: 'Salaires & charges',
    categoryKey: 'SALAIRES',
    rows: [
      { label: 'Salaires nets', category: 'SALAIRES' },
      { label: 'Charges sociales', category: 'SALAIRES' },
      { label: 'Primes/variables', category: 'SALAIRES' },
    ],
  },
  {
    name: 'Loyers & charges locatives',
    categoryKey: 'LOYER',
    rows: [
      { label: 'Loyer bureaux', category: 'LOYER' },
      { label: 'Loyer entrepôt/stockage', category: 'LOYER' },
      { label: 'Charges copropriété', category: 'LOYER' },
    ],
  },
  {
    name: 'Assurances',
    categoryKey: 'ASSURANCE',
    rows: [
      { label: 'RC Pro / décennale', category: 'ASSURANCE' },
      { label: 'Véhicules', category: 'ASSURANCE' },
      { label: 'Locaux', category: 'ASSURANCE' },
    ],
  },
  {
    name: 'Abonnements & services',
    categoryKey: 'ABONNEMENT',
    rows: [
      { label: 'Téléphonie/internet', category: 'ABONNEMENT' },
      { label: 'Logiciels', category: 'ABONNEMENT' },
      { label: 'Comptabilité/juridique', category: 'ABONNEMENT' },
    ],
  },
  {
    name: 'Emprunts & leasing',
    categoryKey: 'CREDIT',
    rows: [
      { label: 'Échéances emprunts', category: 'CREDIT' },
      { label: 'Leasing véhicules', category: 'CREDIT' },
      { label: 'Leasing matériel', category: 'CREDIT' },
    ],
  },
  {
    name: 'Impôts & taxes',
    categoryKey: 'IMPOT',
    rows: [
      { label: 'CFE', category: 'IMPOT' },
      { label: 'TVA (acomptes)', category: 'IMPOT' },
      { label: 'Autres taxes', category: 'IMPOT' },
    ],
  },
];

type ViewMode = 'liste' | 'matrice';

const emptyForm = {
  entityId: '',
  label: '',
  category: 'LOYER',
  frequency: 'MENSUEL',
  amountTtc: '',
  variableAmount: 'false',
  dayOfMonth: '',
  startDate: '',
  endDate: '',
  observations: '',
  active: 'true',
};

function toDateInput(val: string | null | undefined): string {
  if (!val) return '';
  return val.substring(0, 10);
}

function getMonthlyAmount(charge: RecurringCharge): number {
  const amount = Number(charge.amountTtc) || 0;
  switch (charge.frequency) {
    case 'MENSUEL':
      return amount;
    case 'TRIMESTRIEL':
      return amount / 3;
    case 'SEMESTRIEL':
      return amount / 6;
    case 'ANNUEL':
      return amount / 12;
    default:
      return amount;
  }
}

export default function ChargesPage() {
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [entities, setEntities] = useState<EntityData[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('liste');

  // Form
  const [form, setForm] = useState({ ...emptyForm });

  // Filters
  const [filterEntity, setFilterEntity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrequency, setFilterFrequency] = useState('');

  // Fetch entities
  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then((json) => {
        const list = json.data || json || [];
        setEntities(list);
        if (list.length > 0 && !form.entityId) {
          setForm((prev) => ({ ...prev, entityId: list[0].id }));
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCharges = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterEntity) params.set('entity_id', filterEntity);
    if (filterCategory) params.set('category', filterCategory);
    if (filterFrequency) params.set('frequency', filterFrequency);
    try {
      const res = await fetch(`/api/recurring-charges?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCharges(json.data || []);
      }
    } catch {
      // silent
    }
  }, [filterEntity, filterCategory, filterFrequency]);

  useEffect(() => {
    fetchCharges();
  }, [fetchCharges]);

  const resetForm = useCallback(() => {
    setForm({ ...emptyForm, entityId: entities[0]?.id || '' });
    setEditingId(null);
  }, [entities]);

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (c: RecurringCharge) => {
    setEditingId(c.id);
    setForm({
      entityId: c.entityId,
      label: c.label,
      category: c.category,
      frequency: c.frequency,
      amountTtc: String(c.amountTtc),
      variableAmount: c.variableAmount ? 'true' : 'false',
      dayOfMonth: c.dayOfMonth != null ? String(c.dayOfMonth) : '',
      startDate: toDateInput(c.startDate),
      endDate: toDateInput(c.endDate),
      observations: c.observations || '',
      active: c.active ? 'true' : 'false',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        entityId: form.entityId,
        label: form.label,
        category: form.category,
        frequency: form.frequency,
        amountTtc: Number(form.amountTtc),
        variableAmount: form.variableAmount === 'true',
        dayOfMonth: form.dayOfMonth ? Number(form.dayOfMonth) : undefined,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        observations: form.observations || undefined,
        active: form.active === 'true',
      };

      const url = editingId ? `/api/recurring-charges/${editingId}` : '/api/recurring-charges';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        closeModal();
        fetchCharges();
      }
    } catch {
      // silent
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!confirm('Supprimer cette charge récurrente ?')) return;
    try {
      const res = await fetch(`/api/recurring-charges/${editingId}`, { method: 'DELETE' });
      if (res.ok) {
        closeModal();
        fetchCharges();
      }
    } catch {
      // silent
    }
  };

  const setField = (key: string) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Summary calculations
  const activeCharges = charges.filter((c) => c.active);
  const totalMensuel = activeCharges.reduce((sum, c) => sum + getMonthlyAmount(c), 0);
  const chargesActives = activeCharges.length;

  const today = new Date();
  const currentDay = today.getDate();
  const prochainEcheance = activeCharges
    .filter((c) => c.dayOfMonth != null)
    .map((c) => c.dayOfMonth as number)
    .sort((a, b) => a - b);
  const nextDay = prochainEcheance.find((d) => d >= currentDay) || prochainEcheance[0] || null;
  const prochainEcheanceLabel = nextDay != null ? `Le ${nextDay} du mois` : '-';

  const handleExport = () => {
    exportToExcel(
      charges as unknown as Record<string, unknown>[],
      [
        { header: 'Libellé', key: 'label' },
        { header: 'Entité', key: 'entity', transform: (v) => (v as any)?.name || '' },
        { header: 'Catégorie', key: 'category' },
        { header: 'Fréquence', key: 'frequency' },
        { header: 'Montant TTC', key: 'amountTtc', transform: (v) => Number(v) || 0 },
        { header: 'Prix variable', key: 'variableAmount', transform: (v) => v ? 'Oui' : 'Non' },
        { header: 'Jour du mois', key: 'dayOfMonth', transform: (v) => v != null ? Number(v) : '' },
        { header: 'Statut', key: 'active', transform: (v) => v ? 'Actif' : 'Inactif' },
      ],
      'charges_recurrentes'
    );
  };

  const isEditing = !!editingId;

  // For the matrix: compute amounts per entity per category row
  const getMatrixCategoryCellAmount = (rowLabel: string, rowCategory: string, entityName: string): number => {
    // Try exact label match first
    const exactMatches = activeCharges.filter((c) => {
      const eName = (c.entity?.name || '').toUpperCase();
      return eName === entityName.toUpperCase() && c.category === rowCategory && c.label.toLowerCase() === rowLabel.toLowerCase();
    });
    if (exactMatches.length > 0) {
      return exactMatches.reduce((sum, c) => sum + getMonthlyAmount(c), 0);
    }
    // Try partial match
    const partialMatches = activeCharges.filter((c) => {
      const eName = (c.entity?.name || '').toUpperCase();
      const searchTerms = rowLabel.toLowerCase().split('/').map(s => s.trim());
      return (
        eName === entityName.toUpperCase() &&
        c.category === rowCategory &&
        searchTerms.some(term => c.label.toLowerCase().includes(term))
      );
    });
    return partialMatches.reduce((sum, c) => sum + getMonthlyAmount(c), 0);
  };

  // Compute category subtotals per entity
  const getCategoryEntityTotal = (categoryKey: string, entityName: string): number => {
    return activeCharges
      .filter((c) => {
        const eName = (c.entity?.name || '').toUpperCase();
        return eName === entityName.toUpperCase() && c.category === categoryKey;
      })
      .reduce((sum, c) => sum + getMonthlyAmount(c), 0);
  };

  // Compute entity grand total
  const getEntityGrandTotal = (entityName: string): number => {
    return activeCharges
      .filter((c) => (c.entity?.name || '').toUpperCase() === entityName.toUpperCase())
      .reduce((sum, c) => sum + getMonthlyAmount(c), 0);
  };

  return (
    <>
      <div className="flex gap-2 mb-4">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-ctbg-red-hover hover:-translate-y-0.5 hover:shadow-lg transition-all"
        >
          + Nouvelle charge récurrente
        </button>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-gray-dark border border-gray-border rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-light transition-all">
          Export Excel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SummaryCard label="Total Mensuel" value={formatCurrency(totalMensuel)} borderColor="border-t-ctbg-red" />
        <SummaryCard label="Charges Actives" value={String(chargesActives)} borderColor="border-t-ctbg-red" />
        <SummaryCard label="Prochaine Échéance" value={prochainEcheanceLabel} borderColor="border-t-warning" />
      </div>

      {/* View mode tabs */}
      <div className="flex gap-0 mb-4">
        <button
          onClick={() => setViewMode('liste')}
          className={`px-5 py-2.5 text-sm font-semibold border border-gray-border rounded-l-md transition-all ${
            viewMode === 'liste'
              ? 'bg-ctbg-red text-white border-ctbg-red'
              : 'bg-white text-gray-dark hover:bg-gray-light'
          }`}
        >
          Liste
        </button>
        <button
          onClick={() => setViewMode('matrice')}
          className={`px-5 py-2.5 text-sm font-semibold border border-gray-border border-l-0 rounded-r-md transition-all ${
            viewMode === 'matrice'
              ? 'bg-ctbg-red text-white border-ctbg-red'
              : 'bg-white text-gray-dark hover:bg-gray-light'
          }`}
        >
          Matrice par entité
        </button>
      </div>

      {viewMode === 'liste' && (
      <div className="flex gap-2.5 mb-4">
        <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red">
          <option value="">Toutes les entités</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>{ent.name}</option>
          ))}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red">
          <option value="">Toutes les catégories</option>
          {Object.entries(CHARGE_CATEGORY_LABELS).map(([val, lab]) => (
            <option key={val} value={val}>{lab}</option>
          ))}
        </select>
        <select value={filterFrequency} onChange={(e) => setFilterFrequency(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red">
          <option value="">Toutes les fréquences</option>
          {Object.entries(CHARGE_FREQUENCY_LABELS).map(([val, lab]) => (
            <option key={val} value={val}>{lab}</option>
          ))}
        </select>
      </div>
      )}

      {viewMode === 'liste' ? (
      <div className="bg-white p-6 rounded-lg shadow-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Libellé</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Entité</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Catégorie</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Fréquence</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Montant TTC</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Jour du mois</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Statut</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-text">Aucune charge récurrente trouvée</td>
              </tr>
            ) : (
              charges.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openEdit(c)}
                  className="hover:bg-gray-light transition-colors cursor-pointer"
                >
                  <td className="p-3 border-b border-gray-border">{c.label}</td>
                  <td className="p-3 border-b border-gray-border">{c.entity?.name || '-'}</td>
                  <td className="p-3 border-b border-gray-border">{CHARGE_CATEGORY_LABELS[c.category] || c.category}</td>
                  <td className="p-3 border-b border-gray-border">{CHARGE_FREQUENCY_LABELS[c.frequency] || c.frequency}</td>
                  <td className="p-3 border-b border-gray-border">{c.variableAmount ? '~ ' : ''}{formatCurrency(Number(c.amountTtc))}</td>
                  <td className="p-3 border-b border-gray-border">{c.dayOfMonth ?? '-'}</td>
                  <td className="p-3 border-b border-gray-border">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${c.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                      {c.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      ) : (
      /* MATRICE PAR ENTITÉ view */
      <div className="bg-white p-6 rounded-lg shadow-card overflow-x-auto">
        <h3 className="text-base font-bold text-gray-dark mb-4 uppercase tracking-wide">Matrice des charges récurrentes par entité</h3>
        <table className="w-full border-collapse text-sm min-w-[900px]">
          <thead>
            <tr>
              <th className="bg-gray-800 text-white p-2.5 text-left text-xs uppercase tracking-wide font-semibold border border-gray-600 w-28">Catégorie</th>
              <th className="bg-gray-800 text-white p-2.5 text-left text-xs uppercase tracking-wide font-semibold border border-gray-600 w-40">Libellé</th>
              {MATRIX_ENTITIES.map((ent) => (
                <th key={ent} className="bg-gray-800 text-white p-2.5 text-center text-xs uppercase tracking-wide font-semibold border border-gray-600">{ent}</th>
              ))}
              <th className="bg-gray-800 text-white p-2.5 text-center text-xs uppercase tracking-wide font-semibold border border-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX_CATEGORIES.map((cat) => {
              const categoryRowTotal = MATRIX_ENTITIES.reduce(
                (sum, ent) => sum + getCategoryEntityTotal(cat.categoryKey, ent),
                0
              );
              return (
                <Fragment key={cat.categoryKey}>
                  {cat.rows.map((row, rowIdx) => {
                    const rowTotal = MATRIX_ENTITIES.reduce(
                      (sum, ent) => sum + getMatrixCategoryCellAmount(row.label, row.category, ent),
                      0
                    );
                    return (
                      <tr key={`${cat.categoryKey}-${rowIdx}`} className="hover:bg-gray-50">
                        {rowIdx === 0 && (
                          <td
                            rowSpan={cat.rows.length}
                            className="p-2.5 border border-gray-200 bg-gray-100 font-bold text-xs text-gray-700 align-top"
                          >
                            {cat.name}
                          </td>
                        )}
                        <td className="p-2.5 border border-gray-200 text-xs text-gray-700">
                          {row.label}
                        </td>
                        {MATRIX_ENTITIES.map((ent) => {
                          const amount = getMatrixCategoryCellAmount(row.label, row.category, ent);
                          return (
                            <td
                              key={ent}
                              className={`p-2.5 border border-gray-200 text-center text-xs font-medium ${
                                amount > 0 ? 'text-blue-700 bg-blue-50' : 'text-gray-400'
                              }`}
                            >
                              {amount > 0 ? formatCurrency(amount) : '-'}
                            </td>
                          );
                        })}
                        <td className={`p-2.5 border border-gray-200 text-center text-xs font-bold ${rowTotal > 0 ? 'text-blue-800' : 'text-gray-400'}`}>
                          {rowTotal > 0 ? formatCurrency(rowTotal) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Category subtotal row */}
                  <tr className="bg-gray-100">
                    <td colSpan={2} className="p-2.5 border border-gray-200 text-xs font-bold text-gray-700 text-right">
                      Sous-total {cat.name}
                    </td>
                    {MATRIX_ENTITIES.map((ent) => {
                      const catTotal = getCategoryEntityTotal(cat.categoryKey, ent);
                      return (
                        <td
                          key={ent}
                          className={`p-2.5 border border-gray-200 text-center text-xs font-bold ${
                            catTotal > 0 ? 'text-blue-800' : 'text-gray-400'
                          }`}
                        >
                          {catTotal > 0 ? formatCurrency(catTotal) : '-'}
                        </td>
                      );
                    })}
                    <td className={`p-2.5 border border-gray-200 text-center text-xs font-bold ${categoryRowTotal > 0 ? 'text-blue-900 bg-blue-100' : 'text-gray-400'}`}>
                      {categoryRowTotal > 0 ? formatCurrency(categoryRowTotal) : '-'}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {/* TOTAL MENSUEL row */}
            <tr className="bg-gray-800">
              <td colSpan={2} className="p-3 border border-gray-600 text-sm font-bold text-white uppercase tracking-wide text-right">
                Total Mensuel
              </td>
              {MATRIX_ENTITIES.map((ent) => {
                const entTotal = getEntityGrandTotal(ent);
                return (
                  <td
                    key={ent}
                    className={`p-3 border border-gray-600 text-center text-sm font-bold ${
                      entTotal > 0 ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    {entTotal > 0 ? formatCurrency(entTotal) : '-'}
                  </td>
                );
              })}
              <td className="p-3 border border-gray-600 text-center text-sm font-bold text-yellow-300 bg-gray-900">
                {formatCurrency(totalMensuel)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={isEditing ? 'Modifier Charge Récurrente' : 'Nouvelle Charge Récurrente'}>
        <form onSubmit={handleSubmit}>
          <FormField label="Entité" value={form.entityId} onChange={setField('entityId')} required
            options={entities.map((e) => ({ value: e.id, label: e.name }))} />
          <FormField label="Libellé" value={form.label} onChange={setField('label')} placeholder="Ex: Loyer bureau Paris" required />
          <FormField label="Catégorie" value={form.category} onChange={setField('category')} required
            options={Object.entries(CHARGE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          <FormField label="Fréquence" value={form.frequency} onChange={setField('frequency')} required
            options={Object.entries(CHARGE_FREQUENCY_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          <FormField label="Montant TTC" type="number" value={form.amountTtc} onChange={setField('amountTtc')} placeholder="0" required />
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.variableAmount === 'true'}
                onChange={(e) => setForm((prev) => ({ ...prev, variableAmount: e.target.checked ? 'true' : 'false' }))}
                className="w-4 h-4 accent-ctbg-red cursor-pointer"
              />
              Prix variable
            </label>
            {form.variableAmount === 'true' && (
              <p className="text-xs text-gray-text mt-1 ml-6">Le montant est indicatif. Ex : factures téléphoniques</p>
            )}
          </div>
          <FormField label="Jour du mois" type="number" value={form.dayOfMonth} onChange={setField('dayOfMonth')} placeholder="1-31" />
          <FormField label="Date de début" type="date" value={form.startDate} onChange={setField('startDate')} required />
          <FormField label="Date de fin" type="date" value={form.endDate} onChange={setField('endDate')} />
          <FormField label="Statut" value={form.active} onChange={setField('active')} required
            options={[{ value: 'true', label: 'Actif' }, { value: 'false', label: 'Inactif' }]} />
          <FormField label="Observations" type="textarea" value={form.observations} onChange={setField('observations')} placeholder="Notes..." />
          <div className="flex gap-2.5 mt-5">
            <button type="submit" className="px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold uppercase tracking-wide hover:bg-ctbg-red-hover">
              {isEditing ? 'Mettre à jour' : 'Enregistrer'}
            </button>
            {isEditing && (
              <button type="button" onClick={handleDelete} className="px-4 py-2.5 bg-error text-white border-none rounded-md text-sm font-semibold uppercase tracking-wide hover:opacity-90">
                Supprimer
              </button>
            )}
            <button type="button" onClick={closeModal} className="px-4 py-2.5 bg-gray-light text-gray-dark border border-gray-border rounded-md text-sm font-semibold">
              Annuler
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
