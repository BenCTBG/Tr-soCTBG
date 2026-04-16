'use client';

import { useState, useEffect, useCallback } from 'react';
import SummaryCard from '@/components/ui/SummaryCard';
import StatusBadge from '@/components/ui/StatusBadge';
import PriorityBadge from '@/components/ui/PriorityBadge';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import InvoiceUploadZone from '@/components/ui/InvoiceUploadZone';
import type { ExtractedFields } from '@/components/ui/InvoiceUploadZone';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { exportToExcel } from '@/utils/exportExcel';
import {
  STATUS_LABELS_DISBURSEMENT,
  PRIORITY_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/utils/constants';

interface EntityData {
  id: string;
  name: string;
}

interface BankAccountData {
  id: string;
  entityId: string;
  bankName: string;
  label: string | null;
}

interface Disbursement {
  id: string;
  receivedDate: string;
  supplier: string;
  entity: { id: string; name: string };
  entityId: string;
  bankAccountId: string | null;
  bankAccount: { id: string; bankName: string; label: string | null } | null;
  siteRef: string | null;
  amountTtc: string | number;
  priority: string;
  paymentMethod: string | null;
  paymentDueDate: string | null;
  status: string;
  observations: string | null;
  fileUrl: string | null;
}

const emptyForm = {
  receivedDate: '',
  entityId: '',
  bankAccountId: '',
  supplier: '',
  siteRef: '',
  amountTtc: '',
  priority: 'IMMEDIAT',
  paymentMethod: '',
  paymentDueDate: '',
  paymentTerms: '',
  status: 'A_PAYER',
  observations: '',
  fileUrl: '',
};

function toDateInput(val: string | null | undefined): string {
  if (!val) return '';
  return val.substring(0, 10);
}

function getISOWeek(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `S${weekNo}`;
}

export default function DecaissementsPage() {
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [entities, setEntities] = useState<EntityData[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountData[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState({ ...emptyForm });

  // CB Import modal
  const [cbModalOpen, setCbModalOpen] = useState(false);
  const [cbEntityId, setCbEntityId] = useState('');
  const [cbParsedTx, setCbParsedTx] = useState<Array<{ transactionNumber: string; transactionDate: string; label: string; amount: number }>>([]);
  const [cbImportResult, setCbImportResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const [cbParsing, setCbParsing] = useState(false);

  // Filters
  const [filterEntity, setFilterEntity] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Fetch entities + bank accounts
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

    fetch('/api/bank-accounts?active=true')
      .then((r) => r.json())
      .then((json) => setBankAccounts(json.data || []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDisbursements = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterEntity) params.set('entity_id', filterEntity);
    if (filterPriority) params.set('priority', filterPriority);
    if (filterStatus) params.set('status', filterStatus);
    try {
      const res = await fetch(`/api/disbursements?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setDisbursements(json.data || []);
      }
    } catch {
      // silent
    }
  }, [filterEntity, filterPriority, filterStatus]);

  useEffect(() => {
    fetchDisbursements();
  }, [fetchDisbursements]);

  const resetForm = useCallback(() => {
    setForm({ ...emptyForm, entityId: entities[0]?.id || '' });
    setEditingId(null);
  }, [entities]);

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (d: Disbursement) => {
    setEditingId(d.id);
    setForm({
      receivedDate: toDateInput(d.receivedDate),
      entityId: d.entityId,
      bankAccountId: d.bankAccountId || '',
      supplier: d.supplier,
      siteRef: d.siteRef || '',
      amountTtc: String(d.amountTtc),
      priority: d.priority,
      paymentMethod: d.paymentMethod || '',
      paymentDueDate: toDateInput(d.paymentDueDate),
      paymentTerms: '',
      status: d.status,
      observations: d.observations || '',
      fileUrl: d.fileUrl || '',
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
        receivedDate: form.receivedDate,
        entityId: form.entityId,
        bankAccountId: form.bankAccountId || undefined,
        supplier: form.supplier,
        siteRef: form.siteRef || undefined,
        amountTtc: Number(form.amountTtc),
        priority: form.priority,
        paymentMethod: form.paymentMethod || undefined,
        paymentDueDate: form.paymentDueDate || undefined,
        status: form.status,
        observations: form.observations || undefined,
        fileUrl: form.fileUrl || undefined,
      };

      const url = editingId ? `/api/disbursements/${editingId}` : '/api/disbursements';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        closeModal();
        fetchDisbursements();
      }
    } catch {
      // silent
    }
  };

  const setField = (key: string) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleFileUploaded = useCallback((fileUrl: string) => {
    setForm((prev) => ({ ...prev, fileUrl }));
  }, []);

  const handleOCRExtracted = useCallback((fields: ExtractedFields) => {
    setForm((prev) => ({
      ...prev,
      supplier: fields.fournisseur || prev.supplier,
      entityId: fields.entityId || prev.entityId,
      receivedDate: fields.dateFacture || prev.receivedDate,
      amountTtc: fields.montantTTC || prev.amountTtc,
      paymentMethod: fields.paymentMethod || prev.paymentMethod,
      paymentDueDate: fields.datePaiement || prev.paymentDueDate,
      paymentTerms: fields.paymentTerms || prev.paymentTerms,
      siteRef: prev.siteRef,
    }));
  }, []);

  // Summary calculations
  const getAmount = (d: Disbursement) => Number(d.amountTtc) || 0;
  const totalAPayer = disbursements
    .filter((d) => d.status === 'A_PAYER')
    .reduce((sum, d) => sum + getAmount(d), 0);
  const dontImmediat = disbursements
    .filter((d) => d.status === 'A_PAYER' && d.priority === 'IMMEDIAT')
    .reduce((sum, d) => sum + getAmount(d), 0);
  const enAttenteDG = disbursements
    .filter((d) => d.status === 'EN_ATTENTE_DG')
    .reduce((sum, d) => sum + getAmount(d), 0);

  const handleExport = () => {
    exportToExcel(
      disbursements as unknown as Record<string, unknown>[],
      [
        { header: 'Date Réception', key: 'receivedDate', transform: (v) => v ? String(v).substring(0, 10) : '' },
        { header: 'Fournisseur', key: 'supplier' },
        { header: 'Entité', key: 'entity', transform: (v) => (v as any)?.name || '' },
        { header: 'Chantier/Objet', key: 'siteRef' },
        { header: 'Montant TTC', key: 'amountTtc', transform: (v) => Number(v) || 0 },
        { header: 'Priorité', key: 'priority' },
        { header: 'Statut', key: 'status' },
      ],
      'decaissements'
    );
  };

  const isEditing = !!editingId;

  return (
    <>
      <div className="flex gap-2 mb-4">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-ctbg-red-hover hover:-translate-y-0.5 hover:shadow-lg transition-all"
        >
          + Nouvel achat
        </button>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-gray-dark border border-gray-border rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-light transition-all">
          📊 Export Excel
        </button>
        <button onClick={() => window.open('/api/import-template?type=achats', '_blank')} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-gray-dark border border-gray-border rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-light transition-all">
          📥 Modèle d&apos;import
        </button>
        <button onClick={() => setCbModalOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-blue-700 transition-all">
          💳 Import relevé CB
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SummaryCard label="Total à Payer" value={formatCurrency(totalAPayer)} borderColor="border-t-error" />
        <SummaryCard label="Dont Immédiat" value={formatCurrency(dontImmediat)} borderColor="border-t-error" />
        <SummaryCard label="En Attente DG" value={formatCurrency(enAttenteDG)} borderColor="border-t-warning" />
      </div>

      <div className="flex gap-2.5 mb-4">
        <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red">
          <option value="">Toutes les entités</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>{ent.name}</option>
          ))}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red">
          <option value="">Toutes les priorités</option>
          {Object.entries(PRIORITY_LABELS).map(([val, lab]) => (
            <option key={val} value={val}>{lab}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS_DISBURSEMENT).map(([val, lab]) => (
            <option key={val} value={val}>{lab}</option>
          ))}
        </select>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Date Réception</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Semaine</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Fournisseur</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Entité</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Compte</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Chantier/Objet</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Montant TTC</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Priorité</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Statut</th>
            </tr>
          </thead>
          <tbody>
            {disbursements.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-text">Aucun décaissement trouvé</td>
              </tr>
            ) : (
              disbursements.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => openEdit(d)}
                  className="hover:bg-gray-light transition-colors cursor-pointer"
                >
                  <td className="p-3 border-b border-gray-border">{formatDate(d.receivedDate)}</td>
                  <td className="p-3 border-b border-gray-border text-xs text-gray-text">{getISOWeek(d.receivedDate)}</td>
                  <td className="p-3 border-b border-gray-border">{d.supplier}</td>
                  <td className="p-3 border-b border-gray-border">{d.entity?.name || '-'}</td>
                  <td className="p-3 border-b border-gray-border text-xs text-gray-text">{d.bankAccount?.bankName || '-'}</td>
                  <td className="p-3 border-b border-gray-border">{d.siteRef || '-'}</td>
                  <td className="p-3 border-b border-gray-border">{formatCurrency(Number(d.amountTtc))}</td>
                  <td className="p-3 border-b border-gray-border">
                    <PriorityBadge priority={d.priority} label={PRIORITY_LABELS[d.priority] || d.priority} />
                  </td>
                  <td className="p-3 border-b border-gray-border">
                    <StatusBadge status={d.status} label={STATUS_LABELS_DISBURSEMENT[d.status] || d.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Synthèse par entité */}
      {disbursements.length > 0 && (() => {
        const entityMap = new Map<string, { name: string; count: number; total: number; immediat: number; sous3j: number; bloque: number; attenteDG: number }>();
        disbursements.forEach((d) => {
          const key = d.entityId;
          if (!entityMap.has(key)) {
            entityMap.set(key, { name: d.entity?.name || '-', count: 0, total: 0, immediat: 0, sous3j: 0, bloque: 0, attenteDG: 0 });
          }
          const entry = entityMap.get(key)!;
          const amt = Number(d.amountTtc) || 0;
          entry.count += 1;
          entry.total += amt;
          if (d.priority === 'IMMEDIAT') entry.immediat += amt;
          if (d.priority === 'SOUS_3J') entry.sous3j += amt;
          if (d.priority === 'BLOQUE') entry.bloque += amt;
          if (d.status === 'EN_ATTENTE_DG') entry.attenteDG += amt;
        });
        const rows = Array.from(entityMap.values());
        const totals = rows.reduce(
          (acc, r) => ({ count: acc.count + r.count, total: acc.total + r.total, immediat: acc.immediat + r.immediat, sous3j: acc.sous3j + r.sous3j, bloque: acc.bloque + r.bloque, attenteDG: acc.attenteDG + r.attenteDG }),
          { count: 0, total: 0, immediat: 0, sous3j: 0, bloque: 0, attenteDG: 0 }
        );
        const thClass = "bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide";
        const tdClass = "p-3 border-b border-gray-border text-sm";
        return (
          <div className="bg-white p-6 rounded-lg shadow-card mt-6">
            <h3 className="text-base font-bold text-gray-dark mb-4">{'📊'} Synthèse par entité</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Entité</th>
                  <th className={thClass}>Nb Factures</th>
                  <th className={thClass}>Montant Total</th>
                  <th className={thClass}>🔴 À payer immédiatement</th>
                  <th className={thClass}>🟠 À payer sous 3 jours</th>
                  <th className={thClass}>⛔ Paiement bloqué</th>
                  <th className={thClass}>⏳ En attente validation DG</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td className={tdClass}>{r.name}</td>
                    <td className={tdClass}>{r.count}</td>
                    <td className={tdClass}>{formatCurrency(r.total)}</td>
                    <td className={`${tdClass} text-red-600 font-semibold`}>{formatCurrency(r.immediat)}</td>
                    <td className={`${tdClass} text-orange-500 font-semibold`}>{formatCurrency(r.sous3j)}</td>
                    <td className={`${tdClass} text-gray-500`}>{formatCurrency(r.bloque)}</td>
                    <td className={`${tdClass} text-yellow-600`}>{formatCurrency(r.attenteDG)}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-gray-50">
                  <td className={tdClass}>TOTAL</td>
                  <td className={tdClass}>{totals.count}</td>
                  <td className={tdClass}>{formatCurrency(totals.total)}</td>
                  <td className={`${tdClass} text-red-600`}>{formatCurrency(totals.immediat)}</td>
                  <td className={`${tdClass} text-orange-500`}>{formatCurrency(totals.sous3j)}</td>
                  <td className={`${tdClass} text-gray-500`}>{formatCurrency(totals.bloque)}</td>
                  <td className={`${tdClass} text-yellow-600`}>{formatCurrency(totals.attenteDG)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })()}

      <Modal isOpen={modalOpen} onClose={closeModal} title={isEditing ? 'Modifier Décaissement' : 'Nouveau Décaissement'}>
        <form onSubmit={handleSubmit}>
          {!isEditing && (
            <InvoiceUploadZone entities={entities} onExtracted={handleOCRExtracted} onFileUploaded={handleFileUploaded} mode="decaissement" />
          )}
          {form.fileUrl && (
            <div className="mb-4 px-3 py-2 bg-gray-light border border-gray-border rounded-md text-xs flex items-center justify-between">
              <span>Facture jointe</span>
              <a href={form.fileUrl} target="_blank" rel="noopener noreferrer" className="text-ctbg-red hover:underline">Voir le fichier</a>
            </div>
          )}
          <FormField label="Date Réception" type="date" value={form.receivedDate} onChange={setField('receivedDate')} required />
          <FormField label="Entité" value={form.entityId} onChange={(val) => { setField('entityId')(val); setField('bankAccountId')(''); }} required
            options={entities.map((e) => ({ value: e.id, label: e.name }))} />
          <FormField label="Compte à débiter" value={form.bankAccountId} onChange={setField('bankAccountId')}
            options={[
              { value: '', label: '-- Non spécifié --' },
              ...bankAccounts
                .filter((ba) => ba.entityId === form.entityId)
                .map((ba) => ({ value: ba.id, label: ba.bankName + (ba.label ? ` (${ba.label})` : '') })),
            ]} />
          <FormField label="Fournisseur" value={form.supplier} onChange={setField('supplier')} placeholder="Nom du fournisseur" required />
          <FormField label="Chantier / Objet" value={form.siteRef} onChange={setField('siteRef')} placeholder="Description" required />
          <FormField label="Montant TTC" type="number" value={form.amountTtc} onChange={setField('amountTtc')} placeholder="0" required />
          <FormField label="Priorité" value={form.priority} onChange={setField('priority')} required
            options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          <FormField label="Mode de Règlement" value={form.paymentMethod} onChange={setField('paymentMethod')}
            options={[{ value: '', label: '-- Non spécifié --' }, ...Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
          <FormField label="Date d'Échéance" type="date" value={form.paymentDueDate} onChange={setField('paymentDueDate')} />
          {form.paymentTerms && (
            <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700">
              Conditions détectées : <strong>{form.paymentTerms}</strong>
            </div>
          )}
          <FormField label="Statut" value={form.status} onChange={setField('status')} required
            options={Object.entries(STATUS_LABELS_DISBURSEMENT).map(([v, l]) => ({ value: v, label: l }))} />
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

      {/* Modal Import Relevé CB */}
      <Modal isOpen={cbModalOpen} onClose={() => { setCbModalOpen(false); setCbParsedTx([]); setCbImportResult(null); }} title="Import Relevé Carte Bleue">
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-3">
            Importez un relevé CB au format PDF. Les transactions seront extraites automatiquement.
            Les doublons (même n° de transaction) seront ignorés.
          </p>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Entité *</label>
            <select
              value={cbEntityId}
              onChange={(e) => setCbEntityId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="">-- Sélectionner --</option>
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>{ent.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Fichier PDF du relevé</label>
            <input
              type="file"
              accept=".pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCbParsing(true);
                setCbImportResult(null);
                try {
                  // Use OCR to extract text from PDF
                  const { createWorker } = await import('tesseract.js');
                  const pdfjsLib = (window as any).pdfjsLib;
                  if (!pdfjsLib) {
                    alert('pdf.js non chargé');
                    setCbParsing(false);
                    return;
                  }

                  const arrayBuffer = await file.arrayBuffer();
                  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                  const numPages = Math.min(pdf.numPages, 10);

                  let fullText = '';
                  // Render each page and OCR
                  const worker = await createWorker('fra');
                  for (let i = 1; i <= numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 2 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      await page.render({ canvasContext: ctx, viewport }).promise;
                      const { data: { text } } = await worker.recognize(canvas);
                      fullText += text + '\n';
                    }
                  }
                  await worker.terminate();

                  // Parse transactions from OCR text
                  const lines = fullText.split('\n');
                  const transactions: Array<{ transactionNumber: string; transactionDate: string; label: string; amount: number }> = [];

                  for (const line of lines) {
                    // Common CB statement patterns:
                    // DD/MM/YYYY  LABEL  AMOUNT  TX_NUMBER
                    // or: TX_NUMBER  DD/MM/YYYY  LABEL  AMOUNT
                    const dateMatch = line.match(/(\d{2}[/.-]\d{2}[/.-]\d{4})/);
                    const amountMatch = line.match(/(\d[\d\s]*[.,]\d{2})\s*€?/);
                    // Transaction number: sequence of digits (usually 6+ digits)
                    const txMatch = line.match(/\b(\d{6,})\b/);

                    if (dateMatch && amountMatch) {
                      const dateParts = dateMatch[1].split(/[/.-]/);
                      const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
                      const amount = parseFloat(amountMatch[1].replace(/\s/g, '').replace(',', '.'));
                      const txNumber = txMatch?.[1] || `CB-${isoDate}-${amount.toFixed(2)}`;

                      // Extract label: remove date, amount, and tx number from line
                      let label = line
                        .replace(dateMatch[0], '')
                        .replace(amountMatch[0], '')
                        .replace(txMatch?.[0] || '', '')
                        .trim()
                        .replace(/\s+/g, ' ')
                        .substring(0, 200);

                      if (!label) label = 'Transaction CB';
                      if (amount > 0) {
                        transactions.push({
                          transactionNumber: txNumber,
                          transactionDate: isoDate,
                          label,
                          amount,
                        });
                      }
                    }
                  }

                  setCbParsedTx(transactions);
                } catch (err) {
                  console.error('CB PDF parse error:', err);
                  alert('Erreur lors de la lecture du PDF');
                }
                setCbParsing(false);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>

          {cbParsing && (
            <div className="text-center py-4 text-sm text-gray-500">
              ⏳ Analyse du PDF en cours...
            </div>
          )}

          {cbParsedTx.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-semibold mb-2">{cbParsedTx.length} transaction(s) détectée(s)</h4>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Libellé</th>
                      <th className="p-2 text-right">Montant</th>
                      <th className="p-2 text-left">N° Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cbParsedTx.map((tx, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="p-2">{tx.transactionDate}</td>
                        <td className="p-2">{tx.label}</td>
                        <td className="p-2 text-right font-semibold">{tx.amount.toFixed(2)} €</td>
                        <td className="p-2 text-gray-400 text-xs">{tx.transactionNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-sm font-semibold">
                Total : {formatCurrency(cbParsedTx.reduce((s, t) => s + t.amount, 0))}
              </div>
            </div>
          )}

          {cbImportResult && (
            <div className="mb-3 p-3 bg-green-50 rounded text-sm text-green-700">
              ✅ {cbImportResult.imported} transaction(s) importée(s)
              {cbImportResult.duplicates > 0 && ` — ${cbImportResult.duplicates} doublon(s) ignoré(s)`}
            </div>
          )}

          {cbParsedTx.length > 0 && !cbImportResult && (
            <button
              onClick={async () => {
                if (!cbEntityId) {
                  alert('Sélectionnez une entité');
                  return;
                }
                try {
                  const res = await fetch('/api/card-transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transactions: cbParsedTx, entityId: cbEntityId }),
                  });
                  if (res.ok) {
                    const json = await res.json();
                    setCbImportResult(json.meta);
                    fetchDisbursements();
                  }
                } catch {
                  alert('Erreur lors de l\'import');
                }
              }}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              💳 Importer {cbParsedTx.length} transaction(s)
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
