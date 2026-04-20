'use client';

import { useState, useEffect, useCallback } from 'react';
import SummaryCard from '@/components/ui/SummaryCard';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import InvoiceUploadZone from '@/components/ui/InvoiceUploadZone';
import type { ExtractedFields } from '@/components/ui/InvoiceUploadZone';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { exportToExcel } from '@/utils/exportExcel';
import {
  STATUS_LABELS_RECEIPT,
  RECEIPT_TYPE_LABELS,
  CEE_DELEGATAIRES,
} from '@/utils/constants';

interface EntityData {
  id: string;
  name: string;
}

interface Receipt {
  id: string;
  expectedDate: string;
  invoiceNumber: string;
  clientName: string;
  entity: { id: string; name: string };
  entityId: string;
  siteAddress: string | null;
  department: string | null;
  type: string;
  ceeDelegataire: string | null;
  amountTtc: string | number;
  amountCee: string | number | null;
  filingDate: string | null;
  receivedDate: string | null;
  delayDays: number | null;
  status: string;
  observations: string | null;
  payments: Array<{ id: string; amount: string | number; date: string; source: string; payer: string | null }>;
  invoice?: { id: string; invoiceNumber: string; status: string; amountTtc: string | number } | null;
}

interface InvoicePayment {
  id: string;
  amount: string | number;
  date: string;
  source: string;
  payer: string | null;
  reference: string | null;
  observations: string | null;
}

const emptyForm = {
  expectedDate: '',
  entityId: '',
  invoiceNumber: '',
  clientName: '',
  siteAddress: '',
  department: '',
  amountTtc: '',
  amountCee: '',
  type: 'CLIENT_DIRECT',
  ceeDelegataire: '',
  filingDate: '',
  receivedDate: '',
  status: 'ATTENDU',
  observations: '',
};

const PAYMENT_SOURCES = [
  { value: 'CLIENT', label: 'Client' },
  { value: 'CEE', label: 'CEE (Délégataire)' },
  { value: 'ANAH', label: 'ANAH' },
  { value: 'MPR', label: "Ma Prime Rénov'" },
  { value: 'AUTRE', label: 'Autre' },
];

function getISOWeekNumber(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `S${weekNo}`;
}

function toDateInput(val: string | null | undefined): string {
  if (!val) return '';
  return val.substring(0, 10);
}

export default function EncaissementsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [entities, setEntities] = useState<EntityData[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<Receipt | null>(null);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().substring(0, 10),
    source: 'CLIENT',
    payer: '',
    reference: '',
    observations: '',
  });

  // Form
  const [form, setForm] = useState({ ...emptyForm });

  // Filters
  const [filterEntity, setFilterEntity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

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

  const fetchReceipts = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterEntity) params.set('entity_id', filterEntity);
    if (filterType) params.set('type', filterType);
    if (filterStatus) params.set('status', filterStatus);
    try {
      const res = await fetch(`/api/receipts?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setReceipts(json.data || []);
      }
    } catch {
      // silent
    }
  }, [filterEntity, filterType, filterStatus]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const resetForm = useCallback(() => {
    setForm({ ...emptyForm, entityId: entities[0]?.id || '' });
    setEditingId(null);
  }, [entities]);

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (r: Receipt) => {
    setEditingId(r.id);
    setForm({
      expectedDate: toDateInput(r.expectedDate),
      entityId: r.entityId,
      invoiceNumber: r.invoiceNumber,
      clientName: r.clientName,
      siteAddress: r.siteAddress || '',
      department: r.department || '',
      amountTtc: String(r.amountTtc),
      amountCee: r.amountCee != null ? String(r.amountCee) : '',
      type: r.type,
      ceeDelegataire: r.ceeDelegataire || '',
      filingDate: toDateInput(r.filingDate),
      receivedDate: toDateInput(r.receivedDate),
      status: r.status,
      observations: r.observations || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  // ========== PAYMENT PARTIAL (SOLDE) ==========
  const openPaymentModal = async (r: Receipt) => {
    setPaymentReceipt(r);
    setPaymentForm({
      amount: '',
      date: new Date().toISOString().substring(0, 10),
      source: 'CLIENT',
      payer: '',
      reference: '',
      observations: '',
    });
    // Fetch existing payments for this receipt (via invoice linked to receipt)
    try {
      // We use the receipt ID to find linked invoice payments
      const res = await fetch(`/api/invoice-payments?receipt_id=${r.id}`);
      if (res.ok) {
        const json = await res.json();
        setPayments(json.data || []);
      } else {
        setPayments([]);
      }
    } catch {
      setPayments([]);
    }
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!paymentReceipt || !paymentForm.amount || !paymentForm.date) return;

    try {
      const res = await fetch('/api/invoice-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId: paymentReceipt.id,
          amount: Number(paymentForm.amount),
          date: paymentForm.date,
          source: paymentForm.source,
          payer: paymentForm.payer || undefined,
          reference: paymentForm.reference || undefined,
          observations: paymentForm.observations || undefined,
        }),
      });
      if (res.ok) {
        // Refresh payments list
        const paymentsRes = await fetch(`/api/invoice-payments?receipt_id=${paymentReceipt.id}`);
        if (paymentsRes.ok) {
          const json = await paymentsRes.json();
          setPayments(json.data || []);
        }
        setPaymentForm({
          amount: '',
          date: new Date().toISOString().substring(0, 10),
          source: 'CLIENT',
          payer: '',
          reference: '',
          observations: '',
        });
        fetchReceipts();
      }
    } catch {
      // silent
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        expectedDate: form.expectedDate,
        entityId: form.entityId,
        invoiceNumber: form.invoiceNumber,
        clientName: form.clientName,
        siteAddress: form.siteAddress || undefined,
        department: form.department || undefined,
        amountTtc: Number(form.amountTtc),
        amountCee: form.amountCee ? Number(form.amountCee) : undefined,
        type: form.type,
        ceeDelegataire: form.ceeDelegataire || undefined,
        filingDate: form.filingDate || undefined,
        receivedDate: form.receivedDate || undefined,
        status: form.status,
        observations: form.observations || undefined,
      };

      const url = editingId ? `/api/receipts/${editingId}` : '/api/receipts';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        closeModal();
        fetchReceipts();
      }
    } catch {
      // silent
    }
  };

  const setField = (key: string) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleOCRExtracted = useCallback((fields: ExtractedFields) => {
    setForm((prev) => ({
      ...prev,
      clientName: fields.client || fields.fournisseur || prev.clientName,
      entityId: fields.entityId || prev.entityId,
      expectedDate: fields.dateFacture || prev.expectedDate,
      amountTtc: fields.montantTTC || prev.amountTtc,
      invoiceNumber: fields.invoiceNumber || prev.invoiceNumber,
      siteAddress: fields.siteAddress || prev.siteAddress,
      department: fields.department || prev.department,
    }));
  }, []);

  // Summary calculations
  const getAmount = (r: Receipt) => Number(r.amountTtc) || 0;
  const totalAttendu = receipts
    .filter((r) => r.status === 'ATTENDU')
    .reduce((sum, r) => sum + getAmount(r), 0);
  const totalEncaisse = receipts
    .filter((r) => r.status === 'ENCAISSE')
    .reduce((sum, r) => sum + getAmount(r), 0);
  const totalEnRetard = receipts
    .filter((r) => r.status === 'EN_RETARD')
    .reduce((sum, r) => sum + getAmount(r), 0);

  const handleExport = () => {
    exportToExcel(
      receipts as unknown as Record<string, unknown>[],
      [
        { header: 'Date Prévue', key: 'expectedDate', transform: (v) => v ? String(v).substring(0, 10) : '' },
        { header: 'N° Facture', key: 'invoiceNumber' },
        { header: 'Client', key: 'clientName' },
        { header: 'Entité', key: 'entity', transform: (v) => (v as any)?.name || '' },
        { header: 'Type', key: 'type' },
        { header: 'Montant TTC', key: 'amountTtc', transform: (v) => Number(v) || 0 },
        { header: 'Statut', key: 'status' },
      ],
      'facturation'
    );
  };

  const downloadTemplate = () => {
    window.open('/api/import-template?type=encaissements', '_blank');
  };

  const showFilingDate = form.type === 'CEE' || form.type === 'MPR';
  const isEditing = !!editingId;

  // Calculate total payments for a receipt in payment modal
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const invoiceTotal = paymentReceipt ? Number(paymentReceipt.amountTtc) || 0 : 0;
  const remaining = invoiceTotal - totalPaid;

  return (
    <>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-ctbg-red-hover hover:-translate-y-0.5 hover:shadow-lg transition-all"
        >
          + Nouvelle facture
        </button>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-gray-dark border border-gray-border rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-light transition-all">
          📊 Export Excel
        </button>
        <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-gray-dark border border-gray-border rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-light transition-all">
          📥 Modèle d&apos;import
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SummaryCard label="Total Attendu" value={formatCurrency(totalAttendu)} borderColor="border-t-ctbg-red" />
        <SummaryCard label="Total Encaissé" value={formatCurrency(totalEncaisse)} borderColor="border-t-ctbg-red" />
        <SummaryCard label="En Retard" value={formatCurrency(totalEnRetard)} borderColor="border-t-error" />
      </div>

      <div className="flex gap-2.5 mb-4">
        <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red">
          <option value="">Toutes les entités</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>{ent.name}</option>
          ))}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red">
          <option value="">Tous les types</option>
          {Object.entries(RECEIPT_TYPE_LABELS).map(([val, lab]) => (
            <option key={val} value={val}>{lab}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS_RECEIPT).map(([val, lab]) => (
            <option key={val} value={val}>{lab}</option>
          ))}
        </select>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Date Prévue</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">N° Facture</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Client</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Entité</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Type</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Montant TTC</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Payé</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Restant</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Statut</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Observations</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Semaine</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-6 text-center text-gray-text">Aucune facture trouvée</td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-gray-light transition-colors"
                >
                  <td className="p-3 border-b border-gray-border cursor-pointer" onClick={() => openEdit(r)}>{formatDate(r.expectedDate)}</td>
                  <td className="p-3 border-b border-gray-border cursor-pointer" onClick={() => openEdit(r)}>{r.invoiceNumber}</td>
                  <td className="p-3 border-b border-gray-border cursor-pointer" onClick={() => openEdit(r)}>{r.clientName}</td>
                  <td className="p-3 border-b border-gray-border cursor-pointer" onClick={() => openEdit(r)}>{r.entity?.name || '-'}</td>
                  <td className="p-3 border-b border-gray-border cursor-pointer" onClick={() => openEdit(r)}>{RECEIPT_TYPE_LABELS[r.type] || r.type}</td>
                  <td className="p-3 border-b border-gray-border cursor-pointer" onClick={() => openEdit(r)}>
                    {formatCurrency(Number(r.amountTtc))}
                    {Number(r.amountCee || 0) > 0 && (
                      <div className="text-xs text-blue-600 mt-0.5">dont CEE : {formatCurrency(Number(r.amountCee))}</div>
                    )}
                  </td>
                  {(() => {
                    const paid = (r.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                    const cee = Number(r.amountCee || 0);
                    const hasCeeCall = !!r.invoice; // appel à facturation CEE créé
                    // Si la part CEE existe mais aucun appel créé, on l'exclut du "à encaisser"
                    const base = (cee > 0 && !hasCeeCall) ? Number(r.amountTtc) - cee : Number(r.amountTtc);
                    const rest = base - paid;
                    return (
                      <>
                        <td className="p-3 border-b border-gray-border cursor-pointer" onClick={() => openEdit(r)}>
                          {paid > 0 ? (
                            <span className="text-green-600 font-semibold">{formatCurrency(paid)}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-3 border-b border-gray-border cursor-pointer" onClick={() => openEdit(r)}>
                          {rest <= 0 ? (
                            <span className="text-green-600 font-semibold">0 €</span>
                          ) : (
                            <>
                              <span className={`font-semibold ${paid > 0 ? 'text-orange-500' : ''}`}>{formatCurrency(rest)}</span>
                              {cee > 0 && !hasCeeCall && (
                                <div className="text-xs text-gray-500 italic mt-0.5" title="La part CEE apparaîtra ici quand un appel à facturation CEE sera créé">
                                  + {formatCurrency(cee)} CEE en attente
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      </>
                    );
                  })()}
                  <td className="p-3 border-b border-gray-border cursor-pointer" onClick={() => openEdit(r)}>
                    <StatusBadge status={r.status} label={STATUS_LABELS_RECEIPT[r.status] || r.status} />
                  </td>
                  <td className="p-3 border-b border-gray-border cursor-pointer text-xs text-gray-600" onClick={() => openEdit(r)}>
                    {r.observations || '-'}
                  </td>
                  <td className="p-3 border-b border-gray-border cursor-pointer" onClick={() => openEdit(r)}>
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">
                      {getISOWeekNumber(r.expectedDate)}
                    </span>
                  </td>
                  <td className="p-3 border-b border-gray-border">
                    <button
                      onClick={(e) => { e.stopPropagation(); openPaymentModal(r); }}
                      className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                      title="Enregistrer un paiement"
                    >
                      💰 Solde
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Synthèse par entité */}
      {receipts.length > 0 && (() => {
        const entityMap = new Map<string, { name: string; count: number; totalAttendu: number; totalEncaisse: number; totalEnRetard: number; totalEnAttente: number }>();
        receipts.forEach((r) => {
          const entityName = r.entity?.name || 'Inconnue';
          const entityId = r.entityId || 'unknown';
          if (!entityMap.has(entityId)) {
            entityMap.set(entityId, { name: entityName, count: 0, totalAttendu: 0, totalEncaisse: 0, totalEnRetard: 0, totalEnAttente: 0 });
          }
          const entry = entityMap.get(entityId)!;
          entry.count += 1;
          const amount = Number(r.amountTtc) || 0;
          entry.totalAttendu += amount;
          if (r.status === 'ENCAISSE') {
            entry.totalEncaisse += amount;
          } else if (r.status === 'EN_RETARD') {
            entry.totalEnRetard += amount;
          } else if (r.status === 'ATTENDU') {
            entry.totalEnAttente += amount;
          }
        });
        const rows = Array.from(entityMap.values());
        const totals = rows.reduce(
          (acc, row) => ({
            count: acc.count + row.count,
            totalAttendu: acc.totalAttendu + row.totalAttendu,
            totalEncaisse: acc.totalEncaisse + row.totalEncaisse,
            totalEnRetard: acc.totalEnRetard + row.totalEnRetard,
            totalEnAttente: acc.totalEnAttente + row.totalEnAttente,
          }),
          { count: 0, totalAttendu: 0, totalEncaisse: 0, totalEnRetard: 0, totalEnAttente: 0 }
        );

        return (
          <div className="bg-white p-6 rounded-lg shadow-card mt-6">
            <h3 className="text-lg font-bold text-gray-dark mb-4">📊 Synthèse par entité</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Entité</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Nb Factures</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Total Attendu</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Total Encaissé</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">En Retard</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">En Attente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name} className="hover:bg-gray-light transition-colors">
                    <td className="p-3 border-b border-gray-border font-medium">{row.name}</td>
                    <td className="p-3 border-b border-gray-border">{row.count}</td>
                    <td className="p-3 border-b border-gray-border">{formatCurrency(row.totalAttendu)}</td>
                    <td className="p-3 border-b border-gray-border text-green-600 font-semibold">{formatCurrency(row.totalEncaisse)}</td>
                    <td className="p-3 border-b border-gray-border text-red-600 font-semibold">{formatCurrency(row.totalEnRetard)}</td>
                    <td className="p-3 border-b border-gray-border text-orange-500 font-semibold">{formatCurrency(row.totalEnAttente)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-light font-bold">
                  <td className="p-3 border-t-2 border-gray-dark">TOTAL</td>
                  <td className="p-3 border-t-2 border-gray-dark">{totals.count}</td>
                  <td className="p-3 border-t-2 border-gray-dark">{formatCurrency(totals.totalAttendu)}</td>
                  <td className="p-3 border-t-2 border-gray-dark text-green-600">{formatCurrency(totals.totalEncaisse)}</td>
                  <td className="p-3 border-t-2 border-gray-dark text-red-600">{formatCurrency(totals.totalEnRetard)}</td>
                  <td className="p-3 border-t-2 border-gray-dark text-orange-500">{formatCurrency(totals.totalEnAttente)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Modal Formulaire */}
      <Modal isOpen={modalOpen} onClose={closeModal} title={isEditing ? 'Modifier Facture' : 'Nouvelle Facture'}>
        <form onSubmit={handleSubmit}>
          {!isEditing && (
            <InvoiceUploadZone entities={entities} onExtracted={handleOCRExtracted} mode="encaissement" />
          )}
          <FormField label="Date Prévue" type="date" value={form.expectedDate} onChange={setField('expectedDate')} required />
          <FormField label="Entité" value={form.entityId} onChange={setField('entityId')} required
            options={entities.map((e) => ({ value: e.id, label: e.name }))} />
          <FormField label="N° Facture" value={form.invoiceNumber} onChange={setField('invoiceNumber')} placeholder="FAC-2026-001" required />
          <FormField label="Client / Nom" value={form.clientName} onChange={setField('clientName')} placeholder="Nom du client" required />
          <FormField label="Adresse Chantier" value={form.siteAddress} onChange={setField('siteAddress')} placeholder="Adresse du chantier" />
          <FormField label="Département" value={form.department} onChange={setField('department')} placeholder="Ex: 75" />
          <FormField label="Montant TTC (global, CEE inclus)" type="number" value={form.amountTtc} onChange={setField('amountTtc')} placeholder="0" required />
          <FormField label="Dont part CEE (€)" type="number" value={form.amountCee} onChange={setField('amountCee')} placeholder="0 si pas de CEE" />
          {form.amountCee && Number(form.amountCee) > 0 && (
            <>
              <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2 text-blue-700">
                💡 Reste à charge client : <strong>{(Number(form.amountTtc || 0) - Number(form.amountCee || 0)).toLocaleString('fr-FR')} €</strong>
                <br/>
                La part CEE ({Number(form.amountCee).toLocaleString('fr-FR')} €) sera dans &quot;à encaisser&quot; uniquement quand un appel à facturation CEE sera créé.
              </div>
              <FormField label="Délégataire CEE" value={form.ceeDelegataire} onChange={setField('ceeDelegataire')}
                options={[{ value: '', label: '-- Sélectionner --' }, ...CEE_DELEGATAIRES.map((d) => ({ value: d, label: d }))]} />
            </>
          )}
          <FormField label="Type" value={form.type} onChange={setField('type')} required
            options={Object.entries(RECEIPT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          {form.type === 'CEE' && !form.amountCee && (
            <FormField label="Délégataire CEE" value={form.ceeDelegataire} onChange={setField('ceeDelegataire')}
              options={[{ value: '', label: '-- Sélectionner --' }, ...CEE_DELEGATAIRES.map((d) => ({ value: d, label: d }))]} />
          )}
          {showFilingDate && (
            <FormField label="Date Dépôt Dossier" type="date" value={form.filingDate} onChange={setField('filingDate')} />
          )}
          {isEditing && (
            <FormField label="Date Réception" type="date" value={form.receivedDate} onChange={setField('receivedDate')} />
          )}
          <FormField label="Statut" value={form.status} onChange={setField('status')} required
            options={Object.entries(STATUS_LABELS_RECEIPT).map(([v, l]) => ({ value: v, label: l }))} />
          <FormField label="Observations" type="textarea" value={form.observations} onChange={setField('observations')} placeholder="Notes..." />
          <div className="flex gap-2.5 mt-5">
            <button type="submit" className="px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold uppercase tracking-wide hover:bg-ctbg-red-hover">
              {isEditing ? 'Mettre à jour' : 'Enregistrer'}
            </button>
            <button type="button" onClick={closeModal} className="px-4 py-2.5 bg-gray-light text-gray-dark border border-gray-border rounded-md text-sm font-semibold">
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Paiement / Solde */}
      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title={`Paiements — ${paymentReceipt?.invoiceNumber || ''}`}>
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-gray-50 p-3 rounded text-center">
              <div className="text-xs text-gray-500 uppercase">Total Facture</div>
              <div className="text-lg font-bold">{formatCurrency(invoiceTotal)}</div>
            </div>
            <div className="bg-green-50 p-3 rounded text-center">
              <div className="text-xs text-gray-500 uppercase">Déjà payé</div>
              <div className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</div>
            </div>
            <div className={`p-3 rounded text-center ${remaining <= 0 ? 'bg-green-50' : 'bg-orange-50'}`}>
              <div className="text-xs text-gray-500 uppercase">Reste à payer</div>
              <div className={`text-lg font-bold ${remaining <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                {formatCurrency(Math.max(0, remaining))}
              </div>
            </div>
          </div>

          {/* Historique des paiements */}
          {payments.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2 text-gray-700">Historique des paiements</h4>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Montant</th>
                    <th className="p-2 text-left">Payé par</th>
                    <th className="p-2 text-left">Référence</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="p-2">{formatDate(p.date)}</td>
                      <td className="p-2 font-semibold">{formatCurrency(Number(p.amount))}</td>
                      <td className="p-2">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {PAYMENT_SOURCES.find(s => s.value === p.source)?.label || p.source}
                        </span>
                        {p.payer && <span className="ml-1 text-gray-500">{p.payer}</span>}
                      </td>
                      <td className="p-2 text-gray-500">{p.reference || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Formulaire nouveau paiement */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3 text-gray-700">Nouveau paiement</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Montant *</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder={String(Math.max(0, remaining))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payé par</label>
                <select
                  value={paymentForm.source}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, source: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  {PAYMENT_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom du payeur</label>
                <input
                  type="text"
                  value={paymentForm.payer}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, payer: e.target.value }))}
                  placeholder="Ex: VERTIGO, M. Dupont..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Référence</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                  placeholder="N° virement, chèque..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observations</label>
                <input
                  type="text"
                  value={paymentForm.observations}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Notes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handlePaymentSubmit}
              disabled={!paymentForm.amount || !paymentForm.date}
              className="mt-3 w-full px-4 py-3 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              💰 Enregistrer le paiement
            </button>
          </div>

          {remaining <= 0 && totalPaid > 0 && (
            <div className="text-center py-3 bg-green-50 rounded text-green-700 font-semibold text-sm mt-3">
              ✅ Facture entièrement payée
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
