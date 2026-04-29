'use client';

import { useState, useRef, useCallback } from 'react';

interface EntityData {
  id: string;
  name: string;
  code?: string;
}

interface BankAccountData {
  id: string;
  entityId: string;
  bankName: string;
  isDefault?: boolean;
}

interface BatchInvoiceUploadProps {
  entities: EntityData[];
  bankAccounts: BankAccountData[];
  mode: 'achat'; // achat = disbursement
  onComplete: () => void;
}

interface ExtractedPreview {
  entityName?: string;
  entityMatched?: string; // resolved entity name
  fournisseur?: string;
  montantTTC?: string | number;
  montantHT?: string | number;
  dateFacture?: string;
  datePaiement?: string;
  paymentMethod?: string;
  invoiceNumber?: string;
  bankAccount?: string;
}

interface FileResult {
  name: string;
  status: 'pending' | 'ocr' | 'creating' | 'done' | 'error';
  error?: string;
  createdId?: string;
  extracted?: ExtractedPreview;
  expanded?: boolean;
}

function matchEntityByName(entityName: string | undefined, entities: EntityData[]): string | undefined {
  if (!entityName) return undefined;
  const search = entityName.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
  const byCode = entities.find((e) => e.code?.toUpperCase().replace(/[^A-Z0-9]/g, '') === search.replace(/ /g, ''));
  if (byCode) return byCode.id;
  const byName = entities.find((e) => e.name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim() === search);
  if (byName) return byName.id;
  const byPartial = entities.find((e) => {
    const eName = e.name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
    return eName.includes(search) || search.includes(eName);
  });
  if (byPartial) return byPartial.id;
  return undefined;
}

export default function BatchInvoiceUpload({ entities, bankAccounts, onComplete }: BatchInvoiceUploadProps) {
  const [files, setFiles] = useState<FileResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (fileList: FileList) => {
    const arr: FileResult[] = Array.from(fileList).map((f) => ({ name: f.name, status: 'pending' as const }));
    setFiles(arr);
    setIsProcessing(true);

    // Process sequentially to avoid hammering Claude Vision
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      try {
        // Update status: OCR
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'ocr' } : f));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', file.name);
        const ocrRes = await fetch('/api/ocr', { method: 'POST', body: formData });
        if (!ocrRes.ok) {
          const err = await ocrRes.json().catch(() => ({}));
          throw new Error(err.error?.message || 'Échec OCR');
        }
        const ocrJson = await ocrRes.json();
        const extracted = ocrJson.data;

        // Upload file
        let fileUrl: string | null = null;
        try {
          const upFormData = new FormData();
          upFormData.append('file', file);
          const upRes = await fetch('/api/upload', { method: 'POST', body: upFormData });
          if (upRes.ok) {
            const upJson = await upRes.json();
            fileUrl = upJson.data.fileUrl;
          }
        } catch {
          // ignore
        }

        // Find entity (default to first if no match)
        const entityId = matchEntityByName(extracted.entityName, entities) || entities[0]?.id;
        if (!entityId) throw new Error('Aucune entité disponible');
        const matchedEntity = entities.find((e) => e.id === entityId);

        // Find default bank account for this entity
        const defaultBank = bankAccounts.find((ba) => ba.entityId === entityId && ba.isDefault);

        // Build extracted preview to display to user
        const preview: ExtractedPreview = {
          entityName: extracted.entityName,
          entityMatched: matchedEntity?.name,
          fournisseur: extracted.fournisseur,
          montantTTC: extracted.montantTTC,
          montantHT: extracted.montantHT,
          dateFacture: extracted.dateFacture,
          datePaiement: extracted.datePaiement,
          paymentMethod: extracted.paymentMethod,
          invoiceNumber: extracted.invoiceNumber,
          bankAccount: defaultBank?.bankName,
        };

        // Update status: creating + store preview
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'creating', extracted: preview } : f));

        // Build payload
        const payload = {
          receivedDate: extracted.dateFacture || new Date().toISOString().split('T')[0],
          entityId,
          bankAccountId: defaultBank?.id,
          supplier: extracted.fournisseur || 'Fournisseur inconnu',
          amountTtc: extracted.montantTTC ? Number(extracted.montantTTC) : 0,
          amountHt: extracted.montantHT ? Number(extracted.montantHT) : undefined,
          paymentDueDate: extracted.datePaiement || undefined,
          paymentMethod: extracted.paymentMethod || undefined,
          siteRef: extracted.siteAddress || extracted.invoiceNumber || '-',
          fileUrl: fileUrl || undefined,
          status: 'A_PAYER',
        };

        const createRes = await fetch('/api/disbursements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          throw new Error(err.error?.message || `Erreur création (${createRes.status})`);
        }
        const created = await createRes.json();
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'done', createdId: created.data?.id } : f));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue';
        setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: msg } : f));
      }
    }

    setIsProcessing(false);
    onComplete();
  }, [entities, bankAccounts, onComplete]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list && list.length > 0) processFiles(list);
  };

  const reset = () => {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalDone = files.filter((f) => f.status === 'done').length;
  const totalError = files.filter((f) => f.status === 'error').length;

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-dark">📂 Import multiple de factures</p>
          <p className="text-xs text-gray-500">Sélectionnez plusieurs PDF/images à la fois — chacun sera analysé et créé automatiquement</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="px-3 py-2 bg-ctbg-red text-white rounded-md text-sm font-semibold hover:bg-ctbg-red-hover disabled:opacity-50"
        >
          {isProcessing ? 'Traitement…' : 'Choisir des fichiers'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <>
          <div className="text-xs text-gray-700 mb-2">
            {totalDone}/{files.length} créés
            {totalError > 0 && <span className="text-red-600 ml-2">• {totalError} erreur(s)</span>}
          </div>
          <ul className="text-xs space-y-1 max-h-96 overflow-y-auto">
            {files.map((f, i) => (
              <li key={i} className="bg-white rounded border border-gray-200 overflow-hidden">
                <div
                  className={`flex items-center gap-2 p-1.5 ${f.extracted ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={() => {
                    if (!f.extracted) return;
                    setFiles((prev) => prev.map((x, idx) => idx === i ? { ...x, expanded: !x.expanded } : x));
                  }}
                >
                  <span className="flex-shrink-0">
                    {f.status === 'pending' && '⏳'}
                    {f.status === 'ocr' && '🔍'}
                    {f.status === 'creating' && '💾'}
                    {f.status === 'done' && '✅'}
                    {f.status === 'error' && '❌'}
                  </span>
                  <span className="flex-1 truncate" title={f.name}>{f.name}</span>
                  {f.extracted?.fournisseur && (
                    <span className="text-gray-600 text-[11px] truncate max-w-[160px]">{f.extracted.fournisseur}</span>
                  )}
                  {f.extracted?.montantTTC && (
                    <span className="font-semibold text-[11px]">{Number(f.extracted.montantTTC).toLocaleString('fr-FR')} €</span>
                  )}
                  {f.error && <span className="text-red-600 text-[10px]" title={f.error}>{f.error.substring(0, 40)}</span>}
                  {f.status === 'ocr' && <span className="text-blue-600 text-[10px]">OCR…</span>}
                  {f.status === 'creating' && <span className="text-blue-600 text-[10px]">Création…</span>}
                  {f.extracted && (
                    <span className="text-gray-400 text-[10px]">{f.expanded ? '▼' : '▶'}</span>
                  )}
                </div>
                {f.expanded && f.extracted && (
                  <div className="bg-blue-50 border-t border-blue-200 p-2 text-[11px] grid grid-cols-2 gap-x-3 gap-y-1">
                    <div><span className="text-gray-500">Fournisseur :</span> <strong>{f.extracted.fournisseur || '—'}</strong></div>
                    <div><span className="text-gray-500">N° facture :</span> {f.extracted.invoiceNumber || '—'}</div>
                    <div><span className="text-gray-500">Montant TTC :</span> <strong>{f.extracted.montantTTC ? `${Number(f.extracted.montantTTC).toLocaleString('fr-FR')} €` : '—'}</strong></div>
                    <div><span className="text-gray-500">Montant HT :</span> {f.extracted.montantHT ? `${Number(f.extracted.montantHT).toLocaleString('fr-FR')} €` : '—'}</div>
                    <div><span className="text-gray-500">Date facture :</span> {f.extracted.dateFacture || '—'}</div>
                    <div><span className="text-gray-500">Date échéance :</span> {f.extracted.datePaiement || '—'}</div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Entité détectée :</span> {f.extracted.entityName || '—'}
                      {f.extracted.entityMatched && f.extracted.entityName !== f.extracted.entityMatched && (
                        <span className="text-orange-600"> → assignée à <strong>{f.extracted.entityMatched}</strong></span>
                      )}
                      {!f.extracted.entityMatched && f.extracted.entityName && (
                        <span className="text-red-600"> ⚠️ pas de correspondance, fallback sur 1ère entité</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Banque utilisée :</span> {f.extracted.bankAccount || '— (aucune par défaut)'}
                    </div>
                    {f.extracted.paymentMethod && (
                      <div className="col-span-2"><span className="text-gray-500">Mode paiement :</span> {f.extracted.paymentMethod}</div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-gray-500 mt-2">💡 Cliquez sur une ligne pour voir les champs extraits par l&apos;IA</p>
          {!isProcessing && (
            <button
              type="button"
              onClick={reset}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Réinitialiser
            </button>
          )}
        </>
      )}
    </div>
  );
}
