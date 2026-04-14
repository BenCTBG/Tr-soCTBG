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
  INVOICE_STATUS_LABELS,
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

interface ReminderData {
  id: string;
  date: string;
  note: string | null;
  user?: { name: string };
}

interface Invoice {
  id: string;
  entityId: string;
  entity: { id: string; name: string };
  bankAccountId: string | null;
  bankAccount: { id: string; bankName: string; label: string | null } | null;
  invoiceNumber: string;
  clientName: string;
  siteRef: string | null;
  amountHt: string | number | null;
  amountTtc: string | number;
  issueDate: string;
  dueDate: string | null;
  paymentMethod: string | null;
  status: string;
  paidDate: string | null;
  paidAmount: string | number | null;
  fileUrl: string | null;
  observations: string | null;
  receiptId: string | null;
  reminders: ReminderData[];
  user?: { name: string };
}

const emptyForm = {
  entityId: '',
  bankAccountId: '',
  invoiceNumber: '',
  clientName: '',
  siteRef: '',
  amountHt: '',
  amountTtc: '',
  issueDate: '',
  dueDate: '',
  paymentMethod: '',
  status: 'EMISE',
  paidDate: '',
  paidAmount: '',
  observations: '',
  fileUrl: '',
};

function toDateInput(val: string | null | undefined): string {
  if (!val) return '';
  return val.substring(0, 10);
}

function isOverdue(invoice: Invoice): boolean {
  if (!invoice.dueDate) return false;
  if (invoice.status === 'PAYEE' || invoice.status === 'LITIGE') return false;
  return new Date(invoice.dueDate) < new Date();
}

export default function FacturationPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [entities, setEntities] = useState<EntityData[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountData[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [reminderNote, setReminderNote] = useState('');
  const [reminderLoading, setReminderLoading] = useState(false);

  const [form, setForm] = useState({ ...emptyForm });

  // Filters
  const [filterEntity, setFilterEntity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

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

  const fetchInvoices = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterEntity) params.set('entity_id', filterEntity);
    if (filterStatus) params.set('status', filterStatus);
    try {
      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setInvoices(json.data || []);
      }
    } catch {
      // silent
    }
  }, [filterEntity, filterStatus]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const resetForm = useCallback(() => {
    setForm({ ...emptyForm, entityId: entities[0]?.id || '' });
    setEditingId(null);
  }, [entities]);

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setForm({
      entityId: inv.entityId,
      bankAccountId: inv.bankAccountId || '',
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientName,
      siteRef: inv.siteRef || '',
      amountHt: inv.amountHt ? String(inv.amountHt) : '',
      amountTtc: String(inv.amountTtc),
      issueDate: toDateInput(inv.issueDate),
      dueDate: toDateInput(inv.dueDate),
      paymentMethod: inv.paymentMethod || '',
      status: inv.status,
      paidDate: toDateInput(inv.paidDate),
      paidAmount: inv.paidAmount ? String(inv.paidAmount) : '',
      observations: inv.observations || '',
      fileUrl: inv.fileUrl || '',
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
        bankAccountId: form.bankAccountId || undefined,
        invoiceNumber: form.invoiceNumber,
        clientName: form.clientName,
        siteRef: form.siteRef || undefined,
        amountHt: form.amountHt ? Number(form.amountHt) : undefined,
        amountTtc: Number(form.amountTtc),
        issueDate: form.issueDate,
        dueDate: form.dueDate || undefined,
        paymentMethod: form.paymentMethod || undefined,
        status: form.status,
        paidDate: form.paidDate || undefined,
        paidAmount: form.paidAmount ? Number(form.paidAmount) : undefined,
        observations: form.observations || undefined,
        fileUrl: form.fileUrl || undefined,
      };

      const url = editingId ? `/api/invoices/${editingId}` : '/api/invoices';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        closeModal();
        fetchInvoices();
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
      clientName: fields.fournisseur || prev.clientName,
      entityId: fields.entityId || prev.entityId,
      issueDate: fields.dateFacture || prev.issueDate,
      amountTtc: fields.montantTTC || prev.amountTtc,
      amountHt: fields.montantHT || prev.amountHt,
      invoiceNumber: fields.numeroFacture || prev.invoiceNumber,
      paymentMethod: fields.paymentMethod || prev.paymentMethod,
      dueDate: fields.datePaiement || prev.dueDate,
    }));
  }, []);

  // Reminder
  const handleRemind = async () => {
    if (!detailInvoice) return;
    setReminderLoading(true);
    try {
      const res = await fetch(`/api/invoices/${detailInvoice.id}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: reminderNote || undefined }),
      });
      if (res.ok) {
        setReminderNote('');
        fetchInvoices();
        // Refresh detail
        const refreshRes = await fetch(`/api/invoices?limit=100`);
        if (refreshRes.ok) {
          const json = await refreshRes.json();
          const updated = (json.data || []).find((i: Invoice) => i.id === detailInvoice.id);
          if (updated) setDetailInvoice(updated);
        }
      }
    } catch {
      // silent
    } finally {
      setReminderLoading(false);
    }
  };

  // Summary
  const getAmount = (inv: Invoice) => Number(inv.amountTtc) || 0;
  const totalEmises = invoices
    .filter((i) => i.status !== 'PAYEE' && i.status !== 'ANNULE')
    .reduce((sum, i) => sum + getAmount(i), 0);
  const totalEnRetard = invoices
    .filter((i) => isOverdue(i))
    .reduce((sum, i) => sum + getAmount(i), 0);
  const totalPayees = invoices
    .filter((i) => i.status === 'PAYEE')
    .reduce((sum, i) => sum + getAmount(i), 0);
  const nbEnRetard = invoices.filter((i) => isOverdue(i)).length;

  const handleExport = () => {
    exportToExcel(
      invoices as unknown as Record<string, unknown>[],
      [
        { header: 'N° Facture', key: 'invoiceNumber' },
        { header: 'Client', key: 'clientName' },
        { header: 'Entité', key: 'entity', transform: (v) => (v as { name?: string })?.name || '' },
        { header: 'Montant TTC', key: 'amountTtc', transform: (v) => Number(v) || 0 },
        { header: 'Date Émission', key: 'issueDate', transform: (v) => v ? String(v).substring(0, 10) : '' },
        { header: 'Échéance', key: 'dueDate', transform: (v) => v ? String(v).substring(0, 10) : '' },
        { header: 'Statut', key: 'status', transform: (v) => INVOICE_STATUS_LABELS[String(v)] || String(v) },
      ],
      'facturation'
    );
  };

  const isEditing = !!editingId;
  const showPaidFields = form.status === 'PAYEE';

  function getStatusColor(status: string, inv?: Invoice): string {
    if (inv && isOverdue(inv)) return 'bg-red-100 text-red-800';
    switch (status) {
      case 'EMISE': return 'bg-blue-100 text-blue-800';
      case 'ENVOYEE': return 'bg-indigo-100 text-indigo-800';
      case 'RELANCEE': return 'bg-orange-100 text-orange-800';
      case 'PAYEE': return 'bg-green-100 text-green-800';
      case 'IMPAYEE': return 'bg-red-100 text-red-800';
      case 'LITIGE': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <>
      <div className="flex gap-2 mb-4">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-ctbg-red-hover hover:-translate-y-0.5 hover:shadow-lg transition-all"
        >
          + Nouvel Appel à Facturation
        </button>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-gray-dark border border-gray-border rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-light transition-all">
          Export Excel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="En cours" value={formatCurrency(totalEmises)} borderColor="border-t-blue-500" />
        <SummaryCard label="En retard" value={`${nbEnRetard} facture${nbEnRetard > 1 ? 's' : ''}`} borderColor="border-t-error" />
        <SummaryCard label="Montant en retard" value={formatCurrency(totalEnRetard)} borderColor="border-t-error" />
        <SummaryCard label="Total encaissé" value={formatCurrency(totalPayees)} borderColor="border-t-success" />
      </div>

      <div className="flex gap-2.5 mb-4">
        <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red">
          <option value="">Toutes les entités</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>{ent.name}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red">
          <option value="">Tous les statuts</option>
          {Object.entries(INVOICE_STATUS_LABELS).map(([val, lab]) => (
            <option key={val} value={val}>{lab}</option>
          ))}
        </select>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">N° Facture</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Client</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Entité</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Montant TTC</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Émission</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Échéance</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Statut</th>
              <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Relances</th>
              <th className="bg-gray-light p-3 text-center font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-text">Aucune facture trouvée</td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const overdue = isOverdue(inv);
                return (
                  <tr
                    key={inv.id}
                    onClick={() => openEdit(inv)}
                    className={`hover:bg-gray-light transition-colors cursor-pointer ${overdue ? 'bg-red-50/40' : ''}`}
                  >
                    <td className="p-3 border-b border-gray-border font-medium">{inv.invoiceNumber}</td>
                    <td className="p-3 border-b border-gray-border">{inv.clientName}</td>
                    <td className="p-3 border-b border-gray-border">{inv.entity?.name || '-'}</td>
                    <td className="p-3 border-b border-gray-border font-semibold">{formatCurrency(Number(inv.amountTtc))}</td>
                    <td className="p-3 border-b border-gray-border">{formatDate(inv.issueDate)}</td>
                    <td className={`p-3 border-b border-gray-border ${overdue ? 'text-error font-semibold' : ''}`}>
                      {inv.dueDate ? formatDate(inv.dueDate) : '-'}
                      {overdue && <span className="ml-1 text-xs">EN RETARD</span>}
                    </td>
                    <td className="p-3 border-b border-gray-border">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(inv.status, inv)}`}>
                        {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="p-3 border-b border-gray-border text-center">
                      {inv.reminders.length > 0 ? (
                        <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                          {inv.reminders.length}
                        </span>
                      ) : (
                        <span className="text-gray-text text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3 border-b border-gray-border text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDetailInvoice(inv)}
                        className="text-xs px-2 py-1 bg-gray-light text-gray-dark rounded hover:bg-gray-200 transition-all border border-gray-border"
                      >
                        Détail
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Création / Édition */}
      <Modal isOpen={modalOpen} onClose={closeModal} title={isEditing ? 'Modifier la Facture' : 'Nouvel Appel à Facturation'}>
        <form onSubmit={handleSubmit}>
          {!isEditing && (
            <InvoiceUploadZone entities={entities} onExtracted={handleOCRExtracted} onFileUploaded={handleFileUploaded} mode="encaissement" />
          )}
          {form.fileUrl && (
            <div className="mb-4 px-3 py-2 bg-gray-light border border-gray-border rounded-md text-xs flex items-center justify-between">
              <span>Facture jointe</span>
              <a href={form.fileUrl} target="_blank" rel="noopener noreferrer" className="text-ctbg-red hover:underline">Voir le fichier</a>
            </div>
          )}
          <FormField label="N° Facture" value={form.invoiceNumber} onChange={setField('invoiceNumber')} placeholder="FC-2024-001" required />
          <FormField label="Client" value={form.clientName} onChange={setField('clientName')} placeholder="Nom du client" required />
          <FormField label="Entité" value={form.entityId} onChange={(val) => { setField('entityId')(val); setField('bankAccountId')(''); }} required
            options={entities.map((e) => ({ value: e.id, label: e.name }))} />
          <FormField label="Compte à créditer" value={form.bankAccountId} onChange={setField('bankAccountId')}
            options={[
              { value: '', label: '-- Non spécifié --' },
              ...bankAccounts
                .filter((ba) => ba.entityId === form.entityId)
                .map((ba) => ({ value: ba.id, label: ba.bankName + (ba.label ? ` (${ba.label})` : '') })),
            ]} />
          <FormField label="Chantier / Objet" value={form.siteRef} onChange={setField('siteRef')} placeholder="Description du chantier" />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Montant HT" type="number" value={form.amountHt} onChange={setField('amountHt')} placeholder="0" />
            <FormField label="Montant TTC" type="number" value={form.amountTtc} onChange={setField('amountTtc')} placeholder="0" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date d'émission" type="date" value={form.issueDate} onChange={setField('issueDate')} required />
            <FormField label="Date d'échéance" type="date" value={form.dueDate} onChange={setField('dueDate')} />
          </div>
          <FormField label="Mode de Règlement attendu" value={form.paymentMethod} onChange={setField('paymentMethod')}
            options={[{ value: '', label: '-- Non spécifié --' }, ...Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
          <FormField label="Statut" value={form.status} onChange={setField('status')} required
            options={Object.entries(INVOICE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          {showPaidFields && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-green-50 border border-green-200 rounded-md mb-4">
              <FormField label="Date de paiement" type="date" value={form.paidDate} onChange={setField('paidDate')} />
              <FormField label="Montant encaissé" type="number" value={form.paidAmount} onChange={setField('paidAmount')} placeholder="Montant reçu" />
              {isEditing && (
                <p className="col-span-2 text-xs text-green-700">Un encaissement sera automatiquement créé lors de la validation.</p>
              )}
            </div>
          )}
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

      {/* Modal Détail + Relances */}
      <Modal isOpen={!!detailInvoice} onClose={() => { setDetailInvoice(null); setReminderNote(''); }} title={detailInvoice ? `Facture ${detailInvoice.invoiceNumber}` : ''}>
        {detailInvoice && (
          <div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-6">
              <div>
                <span className="text-gray-text text-xs">Client</span>
                <p className="font-semibold">{detailInvoice.clientName}</p>
              </div>
              <div>
                <span className="text-gray-text text-xs">Entité</span>
                <p className="font-semibold">{detailInvoice.entity?.name}</p>
              </div>
              <div>
                <span className="text-gray-text text-xs">Montant TTC</span>
                <p className="font-semibold">{formatCurrency(Number(detailInvoice.amountTtc))}</p>
              </div>
              <div>
                <span className="text-gray-text text-xs">Statut</span>
                <p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(detailInvoice.status, detailInvoice)}`}>
                    {INVOICE_STATUS_LABELS[detailInvoice.status] || detailInvoice.status}
                    {isOverdue(detailInvoice) && ' - EN RETARD'}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-gray-text text-xs">Émission</span>
                <p>{formatDate(detailInvoice.issueDate)}</p>
              </div>
              <div>
                <span className="text-gray-text text-xs">Échéance</span>
                <p className={isOverdue(detailInvoice) ? 'text-error font-semibold' : ''}>
                  {detailInvoice.dueDate ? formatDate(detailInvoice.dueDate) : '-'}
                </p>
              </div>
              {detailInvoice.bankAccount && (
                <div>
                  <span className="text-gray-text text-xs">Compte à créditer</span>
                  <p>{detailInvoice.bankAccount.bankName}{detailInvoice.bankAccount.label ? ` (${detailInvoice.bankAccount.label})` : ''}</p>
                </div>
              )}
              {detailInvoice.siteRef && (
                <div>
                  <span className="text-gray-text text-xs">Chantier</span>
                  <p>{detailInvoice.siteRef}</p>
                </div>
              )}
              {detailInvoice.fileUrl && (
                <div className="col-span-2">
                  <a href={detailInvoice.fileUrl} target="_blank" rel="noopener noreferrer" className="text-ctbg-red hover:underline text-sm">
                    Voir la facture PDF
                  </a>
                </div>
              )}
            </div>

            {/* Historique des relances */}
            <div className="border-t border-gray-border pt-4">
              <h3 className="text-sm font-semibold text-gray-dark mb-3 uppercase tracking-wide">
                Historique des Relances ({detailInvoice.reminders.length})
              </h3>

              {detailInvoice.reminders.length === 0 ? (
                <p className="text-xs text-gray-text mb-4">Aucune relance enregistrée.</p>
              ) : (
                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                  {detailInvoice.reminders.map((r) => (
                    <div key={r.id} className="flex items-start gap-3 p-2 bg-orange-50 border border-orange-200 rounded-md text-xs">
                      <span className="text-orange-600 font-semibold whitespace-nowrap">
                        {formatDate(r.date)}
                      </span>
                      <span className="text-gray-dark flex-1">
                        {r.note || 'Relance effectuée'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Ajouter une relance */}
              {detailInvoice.status !== 'PAYEE' && detailInvoice.status !== 'LITIGE' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    placeholder="Note de relance (optionnel)..."
                    className="flex-1 px-3 py-2 border border-gray-border rounded-md text-sm focus:outline-none focus:border-ctbg-red focus:ring-2 focus:ring-ctbg-red/[0.08]"
                  />
                  <button
                    type="button"
                    onClick={handleRemind}
                    disabled={reminderLoading}
                    className="px-4 py-2 bg-orange-500 text-white rounded-md text-sm font-semibold hover:bg-orange-600 transition-all disabled:opacity-50 border-none cursor-pointer"
                  >
                    {reminderLoading ? '...' : 'Relancer'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
