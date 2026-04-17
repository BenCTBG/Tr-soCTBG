'use client';

import { useState, useRef, useCallback } from 'react';

interface EntityData {
  id: string;
  name: string;
  code?: string;
}

export interface ExtractedFields {
  fournisseur?: string;
  client?: string;
  entityId?: string;
  dateFacture?: string;
  datePaiement?: string;
  montantHT?: string;
  montantTTC?: string;
  montantCEE?: string;
  resteAPayer?: string;
  invoiceNumber?: string;
  paymentMethod?: string;
  paymentTerms?: string;
  siteAddress?: string;
  department?: string;
}

interface InvoiceUploadZoneProps {
  entities: EntityData[];
  onExtracted: (fields: ExtractedFields) => void;
  onFileUploaded?: (fileUrl: string) => void;
  mode: 'encaissement' | 'decaissement';
}

function matchEntityByName(entityName: string | undefined, entities: EntityData[]): string | undefined {
  if (!entityName) return undefined;
  const search = entityName.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();

  // Exact code match
  const byCode = entities.find((e) => e.code?.toUpperCase().replace(/[^A-Z0-9]/g, '') === search.replace(/ /g, ''));
  if (byCode) return byCode.id;

  // Exact name match
  const byName = entities.find((e) => e.name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim() === search);
  if (byName) return byName.id;

  // Partial match
  const byPartial = entities.find((e) => {
    const eName = e.name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
    return eName.includes(search) || search.includes(eName);
  });
  if (byPartial) return byPartial.id;

  // Keyword match
  const abbrevMap: [RegExp, string][] = [
    [/HOME\s*RENOV/i, 'CTBG HOME RENOV'],
    [/ENERGY\s*PERFORMANCE|CTBG\s*EP\b/i, 'CTBG EP'],
    [/CTBG\s*PREMIUM/i, 'CTBG PREMIUM'],
    [/CTBG\s*GROUPE/i, 'CTBG GROUPE'],
    [/\bCVH\b|VITAL\s*HOMES/i, 'CVH'],
    [/DOMOS/i, 'DOMOS ENERGIE'],
  ];
  for (const [pattern, entName] of abbrevMap) {
    if (pattern.test(entityName)) {
      const found = entities.find((e) => e.name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().includes(entName.toUpperCase().replace(/[^A-Z0-9 ]/g, '')));
      if (found) return found.id;
    }
  }

  return undefined;
}

export default function InvoiceUploadZone({ entities, onExtracted, onFileUploaded, mode }: InvoiceUploadZoneProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setIsProcessing(true);
    setProgress('Envoi à Claude Vision...');
    setDone(false);
    setError('');

    try {
      // 1. Send to Claude Vision API for extraction
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);

      setProgress('Analyse par IA en cours...');
      const ocrRes = await fetch('/api/ocr', { method: 'POST', body: formData });

      if (!ocrRes.ok) {
        const errJson = await ocrRes.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Erreur OCR (${ocrRes.status})`);
      }

      const ocrJson = await ocrRes.json();
      const extracted = ocrJson.data;

      // 2. Map Claude's response to ExtractedFields
      const fields: ExtractedFields = {};

      if (extracted.fournisseur) fields.fournisseur = extracted.fournisseur;
      if (extracted.client) fields.client = extracted.client;
      if (extracted.dateFacture) fields.dateFacture = extracted.dateFacture;
      if (extracted.datePaiement) fields.datePaiement = extracted.datePaiement;
      if (extracted.montantHT) fields.montantHT = String(extracted.montantHT);
      if (extracted.montantTTC) fields.montantTTC = String(extracted.montantTTC);
      if (extracted.montantCEE) fields.montantCEE = String(extracted.montantCEE);
      if (extracted.resteAPayer) fields.resteAPayer = String(extracted.resteAPayer);
      if (extracted.invoiceNumber) fields.invoiceNumber = extracted.invoiceNumber;
      if (extracted.paymentMethod) fields.paymentMethod = extracted.paymentMethod;
      if (extracted.paymentTerms) fields.paymentTerms = extracted.paymentTerms;
      if (extracted.siteAddress) fields.siteAddress = extracted.siteAddress;
      if (extracted.department) fields.department = String(extracted.department);

      // 3. Match entity name to entity ID
      if (extracted.entityName) {
        const entityId = matchEntityByName(extracted.entityName, entities);
        if (entityId) fields.entityId = entityId;
      }

      onExtracted(fields);

      // 4. Upload file to server storage
      if (onFileUploaded) {
        setProgress('Sauvegarde du fichier...');
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        try {
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadFormData });
          if (uploadRes.ok) {
            const uploadJson = await uploadRes.json();
            onFileUploaded(uploadJson.data.fileUrl);
          }
        } catch {
          // Upload failed silently, extraction data still valid
        }
      }

      setDone(true);
    } catch (err) {
      console.error('OCR Error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse');
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  }, [entities, onExtracted, onFileUploaded]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const reset = () => {
    setDone(false);
    setFileName('');
    setProgress('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-gray-dark mb-1.5 uppercase tracking-wide">
        {mode === 'decaissement' ? 'Upload Facture Fournisseur' : 'Upload Facture'}
      </label>

      {!isProcessing && !done && !error && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-ctbg-red bg-red-50'
              : 'border-gray-border bg-gray-light hover:border-ctbg-red hover:bg-red-50/30'
          }`}
        >
          <div className="text-2xl mb-1">📎</div>
          <div className="text-xs font-semibold text-gray-dark mb-1">
            Deposez votre facture ici
          </div>
          <div className="text-[11px] text-gray-text">
            (PDF, JPG, PNG) — Analyse IA Claude Vision
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="border border-gray-border rounded-lg p-4 bg-gray-light text-center">
          <div className="text-lg mb-2 animate-pulse">🤖</div>
          <div className="text-xs font-semibold text-gray-dark mb-2">
            {progress || 'Analyse en cours...'}
          </div>
          <div className="text-[11px] text-gray-text">{fileName}</div>
        </div>
      )}

      {error && (
        <div className="border border-red-300 rounded-lg p-3 bg-red-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <div className="text-xs font-semibold text-red-700">Erreur d&apos;analyse</div>
              <div className="text-[11px] text-red-600">{error}</div>
            </div>
          </div>
          <button type="button" onClick={reset} className="text-xs text-gray-text hover:text-gray-dark underline">
            Reessayer
          </button>
        </div>
      )}

      {done && (
        <div className="border border-green-300 rounded-lg p-3 bg-green-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <div>
              <div className="text-xs font-semibold text-green-700">Facture analysee par IA — champs pre-remplis</div>
              <div className="text-[11px] text-green-600">{fileName}</div>
            </div>
          </div>
          <button type="button" onClick={reset} className="text-xs text-gray-text hover:text-gray-dark underline">
            Reinitialiser
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
