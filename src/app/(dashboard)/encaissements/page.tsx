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
  amountTtc: string | number;
  filingDate: string | null;
  receivedDate: string | null;
  delayDays: number | null;
  status: string;
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
  type: 'CLIENT_DIRECT',
  filingDate: '',
  receivedDate: '',
  status: 'ATTENDU',
  observations: '',
};

function toDateInput(val: string | null | undefined): string {
  if (!val) return '';
  return val.substring(0, 10);
}

export default function EncaissementsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [entities, setEntities] = useState<EntityData[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      type: r.type,
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
        type: form.type,
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
      'encaissements'
    );
  };

  const showFilingDate = form.type === 'CEE' || form.type === 'MPR';
  const isEditing = !!editingId;

  return (
    <>
      <div className="flex gap-2 mb-4">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-ctbg-red-hover hover:-translate-y-0.5 hover:shadow-lg transition-all"
        >
          + Nouvel encaissement
        </button>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-gray-dark border border-gray-border rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-light transition-all">
          Export Excel
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
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Statut</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-text">Aucun encaissement trouvé</td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openEdit(r)}
                  className="hover:bg-gray-light transition-colors cursor-pointer"
                >
                  <td className="p-3 border-b border-gray-border">{formatDate(r.expectedDate)}</td>
                  <td className="p-3 border-b border-gray-border">{r.invoiceNumber}</td>
                  <td className="p-3 border-b border-gray-border">{r.clientName}</td>
                  <td className="p-3 border-b border-gray-border">{r.entity?.name || '-'}</td>
                  <td className="p-3 border-b border-gray-border">{RECEIPT_TYPE_LABELS[r.type] || r.type}</td>
                  <td className="p-3 border-b border-gray-border">{formatCurrency(Number(r.amountTtc))}</td>
                  <td className="p-3 border-b border-gray-border">
                    <StatusBadge status={r.status} label={STATUS_LABELS_RECEIPT[r.status] || r.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={closeModal} title={isEditing ? 'Modifier Encaissement' : 'Nouvel Encaissement'}>
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
          <FormField label="Montant TTC" type="number" value={form.amountTtc} onChange={setField('amountTtc')} placeholder="0" required />
          <FormField label="Type" value={form.type} onChange={setField('type')} required
            options={Object.entries(RECEIPT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
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
    </>
  );
}
