'use client';

import { useState, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

interface EntityData {
  id: string;
  name: string;
}

export interface ExtractedFields {
  fournisseur?: string;
  client?: string;
  entityId?: string;
  dateFacture?: string;
  datePaiement?: string;
  montantHT?: string;
  montantTTC?: string;
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

// Month names in French for date parsing
const FRENCH_MONTHS: Record<string, string> = {
  'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03',
  'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07',
  'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10',
  'novembre': '11', 'décembre': '12', 'decembre': '12',
  'janv': '01', 'févr': '02', 'avr': '04', 'juil': '07',
  'sept': '09', 'oct': '10', 'nov': '11', 'déc': '12', 'dec': '12',
};

/**
 * Extract supplier name from filename.
 * Convention: "FOURNISSEUR rest_of_filename DU dd.mm.yy DE montant€.pdf"
 * The supplier is everything before the first occurrence of a known separator pattern.
 */
function extractSupplierFromFilename(fileName: string): string | null {
  if (!fileName) return null;
  // Remove extension
  const name = fileName.replace(/\.[^.]+$/, '');
  // Supplier is the part before the first reference number, "Facture", "FACT", "FAC", "FR", "INV", "_", or digit sequence
  const match = name.match(/^([A-ZÀ-Ü][A-ZÀ-Ü\s.+'-]+?)[\s_](?:Facture|FACTURE|FACT|FAC[0-9]|FR\d|INV|[A-Z]*[-_]\d|\d{4,})/i);
  if (match) {
    return match[1].trim();
  }
  // Fallback: take everything before " DU " or first long number
  const match2 = name.match(/^(.+?)\s+(?:DU\s|DE\s|\d{6,})/i);
  if (match2) {
    // Clean up: remove trailing reference-like parts
    let supplier = match2[1].trim();
    // Remove trailing parts that look like ref numbers
    supplier = supplier.replace(/\s+[\w-]*\d{4,}[\w-]*$/, '').trim();
    if (supplier.length > 2) return supplier;
  }
  return null;
}

function parseAmount(str: string): number | null {
  // Handle formats: "1 614,20", "270,00", "4534.16", "******654,00"
  const cleaned = str.replace(/[*\s]/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return (!isNaN(val) && val > 0) ? val : null;
}

function parseOCRText(text: string, entities: EntityData[], fileName?: string): ExtractedFields {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullText = text.toUpperCase();
  const result: ExtractedFields = {};

  // ============================================
  // 1. FOURNISSEUR — primarily from filename
  // ============================================
  if (fileName) {
    const fromFile = extractSupplierFromFilename(fileName);
    if (fromFile) {
      result.fournisseur = fromFile;
      result.client = fromFile;
    }
  }

  // Fallback: look in OCR text for company-like patterns
  if (!result.fournisseur) {
    // Try lines with SAS, SARL, etc.
    for (const line of lines.slice(0, 15)) {
      if (/\b(SAS|SARL|SASU|SCI|EURL|SNC)\s+/i.test(line)) {
        const companyName = line.replace(/^(SAS|SARL|SASU|SCI|EURL|SNC)\s+/i, '').trim();
        if (companyName.length > 2) {
          result.fournisseur = companyName;
          result.client = companyName;
          break;
        }
      }
    }
  }

  // ============================================
  // 2. ENTITÉ FACTURÉE
  // ============================================
  // Try exact entity name match
  for (const ent of entities) {
    if (fullText.includes(ent.name.toUpperCase())) {
      result.entityId = ent.id;
      break;
    }
  }
  // Try partial match (all words of entity name present)
  if (!result.entityId) {
    for (const ent of entities) {
      const words = ent.name.toUpperCase().split(/\s+/);
      if (words.length > 1 && words.every((w) => fullText.includes(w))) {
        result.entityId = ent.id;
        break;
      }
    }
  }
  // Try abbreviations from OCR text
  if (!result.entityId) {
    const abbrevMap: [RegExp, string][] = [
      [/ENERGY\s*PERFORMANCE|CTBG\s*EP\b/i, 'CTBG EP'],
      [/CTBG\s*PREMIUM/i, 'CTBG PREMIUM'],
      [/CTBG\s*GROUPE/i, 'CTBG GROUPE'],
      [/HOME\s*RENOV/i, "CTBG HOME RENOV'"],
      [/\bCVH\b/i, 'CVH'],
      [/DOMOS/i, 'DOMOS ENERGIE'],
    ];
    for (const [pattern, entName] of abbrevMap) {
      if (pattern.test(text)) {
        const found = entities.find((e) => e.name.toUpperCase() === entName.toUpperCase());
        if (found) { result.entityId = found.id; break; }
      }
    }
  }

  // ============================================
  // 3. N° FACTURE
  // ============================================
  // Try structured patterns first
  const facPatterns = [
    /FACTURE\s*:\s*([A-Z]{1,3}-?\d[\w\-]{3,})/i,          // "FACTURE : FC-21055254"
    /facture\s*n[°o]?\s*:?\s*([A-Z0-9][\w\-\/]{2,})/i,
    /facture\s*n[°o]?\s+([A-Z0-9][\w\-\/]{2,})/i,
    /facture[_\s]+([A-Z0-9][\w\-\/]{2,})/i,
    /n[°o]\s*(?:de\s+)?facture\s*:?\s*([A-Z0-9][\w\-\/]{2,})/i,
    /FACTURE\s*N[°O]?\s*(\d[\w\-\/]{2,})/i,
  ];
  for (const p of facPatterns) {
    const m = text.match(p);
    if (m) { result.invoiceNumber = m[1].trim(); break; }
  }

  // ============================================
  // 3b. DÉTECTION FACTURE CTBG (encaissement)
  // ============================================
  // If the invoice is FROM a CTBG entity (emitted by CTBG), extract client info
  const isCTBGInvoice = /CTBG\s*(HOME\s*RENOV|EP|PREMIUM|GROUPE)/i.test(text)
    && (/FACTURE\s*:?\s*FC[-\s]?\d/i.test(text) || /S\.?A\.?R\.?L|SIRE?T?\s*:?\s*504\s*382/i.test(text));

  if (isCTBGInvoice) {
    // Extract client name — look for "M." or "Mme" or "Mr" followed by name
    const clientPatterns = [
      // "FACTURE : FC-21055254 M. NICOLAS PATRICK"
      /FACTURE\s*:?\s*FC[-\s]?\d+\s+(?:M\.|Mme|Mr|Monsieur|Madame)\s*(.+)/i,
      // "M. NICOLAS PATRICK" standalone
      /(?:^|\n)\s*(?:M\.|Mme|Mr|Monsieur|Madame)\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇa-zàâäéèêëïîôùûüÿç\s]+)/m,
      // "Client : NICOLAS PATRICK"
      /Client\s*:\s*(?:M\.|Mme|Mr|Monsieur|Madame)?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇa-zàâäéèêëïîôùûüÿç\s]+)/i,
    ];
    for (const p of clientPatterns) {
      const m = text.match(p);
      if (m) {
        // Clean up: remove trailing whitespace, newlines, and stop at short words/numbers
        let clientName = m[1].trim().split('\n')[0].trim();
        // Remove trailing noise (addresses, numbers, etc.)
        clientName = clientName.replace(/\s+\d+.*$/, '').trim();
        if (clientName.length > 2) {
          result.client = clientName;
          break;
        }
      }
    }

    // Extract site address
    const adressePatterns = [
      /Adresse\s*(?:des\s*travaux|chantier|du\s*chantier)?\s*:?\s*(.+)/i,
      /Chantier\s*:?\s*(.+)/i,
    ];
    for (const p of adressePatterns) {
      const m = text.match(p);
      if (m) {
        let addr = m[1].trim().split('\n')[0].trim();
        if (addr.length > 3) {
          result.siteAddress = addr;
          break;
        }
      }
    }

    // Extract department from postal code in client/site address
    // Look for all 5-digit postal codes followed by city name
    const postalRegex = /(\d{5})\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇa-zàâäéèêëïîôùûüÿç\s-]+/g;
    let postalMatch;
    while ((postalMatch = postalRegex.exec(text)) !== null) {
      const postal = postalMatch[1];
      // Skip CTBG's own postal codes (91350 GRIGNY, 91000, etc.)
      if (!postal.startsWith('913') && !postal.startsWith('910')) {
        result.department = postal.substring(0, 2);
        // If no site address found yet, try to grab address from surrounding context
        if (!result.siteAddress) {
          const beforeIdx = Math.max(0, (postalMatch.index || 0) - 80);
          const contextStr = text.substring(beforeIdx, (postalMatch.index || 0) + postalMatch[0].length);
          const addrLines = contextStr.split('\n').map(l => l.trim()).filter(Boolean);
          if (addrLines.length > 0) {
            result.siteAddress = addrLines[addrLines.length - 1];
          }
        }
        break;
      }
    }

    // Date de facture — look for "Date de facture :" or "Date :"
    const dateFactureMatch = text.match(/Date\s*(?:de\s*facture|facture)?\s*:\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i);
    if (dateFactureMatch) {
      const day = dateFactureMatch[1].padStart(2, '0');
      const month = dateFactureMatch[2].padStart(2, '0');
      let year = dateFactureMatch[3];
      if (year.length === 2) year = '20' + year;
      result.dateFacture = `${year}-${month}-${day}`;
    }
  }

  // ============================================
  // 4. DATES
  // ============================================
  const dates: string[] = [];

  // 4a. French month names: "21 Octobre 2025", "30 août 2025", "18 Décembre 2025"
  const frMonthPattern = /(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|janv|f[ée]vr|avr|juil|sept|oct|nov|d[ée]c)\.?\s+(\d{4})/gi;
  let dm;
  while ((dm = frMonthPattern.exec(text)) !== null) {
    const day = dm[1].padStart(2, '0');
    const mName = dm[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = FRENCH_MONTHS[mName];
    if (month) dates.push(`${dm[3]}-${month}-${day}`);
  }

  // 4b. "30 juil. 2025" abbreviated
  const frAbbrPattern = /(\d{1,2})\s+(janv|f[ée]vr|avr|juil|sept|oct|nov|d[ée]c)\.?\s+(\d{4})/gi;
  while ((dm = frAbbrPattern.exec(text)) !== null) {
    const day = dm[1].padStart(2, '0');
    const mName = dm[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = FRENCH_MONTHS[mName];
    if (month) dates.push(`${dm[3]}-${month}-${day}`);
  }

  // 4c. Numeric: DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY or DD/MM/YY
  const numDateRegex = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
  while ((dm = numDateRegex.exec(text)) !== null) {
    const day = dm[1].padStart(2, '0');
    const month = dm[2].padStart(2, '0');
    let year = dm[3];
    if (year.length === 2) year = '20' + year;
    const m = parseInt(month), d = parseInt(day);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      dates.push(`${year}-${month}-${day}`);
    }
  }

  if (dates.length > 0 && !result.dateFacture) {
    result.dateFacture = dates[0];
  }

  // Look for échéance date specifically
  const echeanceMatch = text.match(/[ée]ch[ée]ance\s*(?:le|:)?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i)
    || text.match(/REGLEMENT\s+AU\s+PLUS\s+TARD\s+LE\s+(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i)
    || text.match(/Date\s+d['']?[ée]ch[ée]ance\s*:?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i);
  if (echeanceMatch) {
    const day = echeanceMatch[1].padStart(2, '0');
    const month = echeanceMatch[2].padStart(2, '0');
    let year = echeanceMatch[3];
    if (year.length === 2) year = '20' + year;
    result.datePaiement = `${year}-${month}-${day}`;
  }

  // ============================================
  // 5. MONTANTS — TTC then HT
  // ============================================
  // The amount pattern handles: "270,00", "1 614,20", "4 534,16", "4796.45", "******654,00"
  // It allows large whitespace gaps between label and value (OCR columns)
  const amtCapture = '([\\d\\s*]+[,.]\\d{2})';
  const amtGap = '[\\s:]*'; // Allow any whitespace/colon between label and amount

  // TTC patterns — ordered by specificity
  const ttcPatterns = [
    new RegExp(`TOTAL\\s*TTC${amtGap}${amtCapture}\\s*[€]?`, 'i'),
    new RegExp(`MONTANT\\s*TOTAL\\s*TTC${amtGap}${amtCapture}\\s*[€]?`, 'i'),
    new RegExp(`NET\\s*[ÀAa]\\s*PAYER${amtGap}${amtCapture}\\s*[€]?`, 'i'),
    new RegExp(`RESTE\\s*[ÀAa]\\s*PAYER${amtGap}${amtCapture}\\s*[€]?`, 'i'),
    new RegExp(`T\\.?T\\.?C\\.?${amtGap}${amtCapture}\\s*[€]?`, 'i'),
    new RegExp(`\\*+${amtCapture}\\s*EUR`, 'i'), // ******654,00EUR (Axdis format)
  ];

  for (const pattern of ttcPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseAmount(match[1]);
      if (val && val > 0) {
        result.montantTTC = val.toFixed(2);
        break;
      }
    }
  }

  // HT patterns
  const htPatterns = [
    new RegExp(`TOTAL\\s*H\\.?T\\.?\\s*(?:Net)?${amtGap}${amtCapture}\\s*[€]?`, 'i'),
    new RegExp(`TOTAL\\s*H\\.?T\\.?${amtGap}${amtCapture}\\s*[€]?`, 'i'),
    new RegExp(`MONTANT\\s*(?:HORS|H\\.?)\\s*T(?:AXES|TC)?${amtGap}${amtCapture}\\s*[€]?`, 'i'),
    new RegExp(`(?:^|\\s)H\\.?T\\.?${amtGap}${amtCapture}\\s*[€]?`, 'im'),
  ];
  for (const pattern of htPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseAmount(match[1]);
      if (val && val > 0) {
        result.montantHT = val.toFixed(2);
        break;
      }
    }
  }

  // ============================================
  // 6. FILENAME FALLBACK — most reliable source for amount/date
  // ============================================
  if (fileName) {
    // Amount from filename: "DE 270€", "DE 4534.16€", "DE 2355.14€"
    const fileAmountMatch = fileName.match(/DE\s*([\d.,]+)\s*[€]/i);
    if (fileAmountMatch) {
      const val = parseFloat(fileAmountMatch[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        // Use filename amount as TTC — it's the most reliable
        // Only override if OCR didn't find TTC, or if OCR amount differs a lot
        if (!result.montantTTC) {
          result.montantTTC = val.toFixed(2);
        } else {
          const ocrVal = parseFloat(result.montantTTC);
          // If OCR TTC is very different from filename TTC, trust filename
          if (Math.abs(ocrVal - val) > 1) {
            result.montantTTC = val.toFixed(2);
          }
        }
      }
    }

    // Date from filename: "DU 21.10.25", "DU 02.07.2025"
    const fileDateMatch = fileName.match(/DU\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i);
    if (fileDateMatch) {
      const day = fileDateMatch[1].padStart(2, '0');
      const month = fileDateMatch[2].padStart(2, '0');
      let year = fileDateMatch[3];
      if (year.length === 2) year = '20' + year;
      if (!result.dateFacture) {
        result.dateFacture = `${year}-${month}-${day}`;
      }
    }
  }

  // ============================================
  // 6b. MODE DE RÈGLEMENT + CONDITIONS DE PAIEMENT
  // ============================================

  // Detect payment method
  if (/CARTE\s*BANCAIRE|PAIEMENT\s*CB|\bCB\b|CARTE\s*BLEUE/i.test(text)) {
    result.paymentMethod = 'CB';
  } else if (/VIREMENT\s*(?:SEPA|BANCAIRE)?|MODE\s*DE\s*PAIEMENT\s*:?\s*VIREMENT/i.test(text)) {
    result.paymentMethod = 'VIREMENT';
  } else if (/\bLCR\b|LCR[\s-]?NA|LETTRE\s*DE\s*CHANGE|TRAITE\s*(?:DOMICILI[ÉE]E)?/i.test(text)) {
    result.paymentMethod = 'LCR';
  } else if (/CH[ÈE]QUE\s*(?:[ÀA]\s*\d+\s*JOURS)?/i.test(text)) {
    result.paymentMethod = 'CHEQUE';
  } else if (/PR[ÉE]L[ÈE]VEMENT/i.test(text)) {
    result.paymentMethod = 'PRELEVEMENT';
  } else if (/COMPTANT|REGLEMENT\s*COMPTANT/i.test(text)) {
    result.paymentMethod = 'CB';
  }

  // Detect payment terms and calculate due date
  let paymentDays: number | null = null;
  let isEndOfMonth = false;

  // Patterns for payment terms
  const termsPatterns: [RegExp, string][] = [
    // "30 jours fin de mois" / "45 jours fin de mois"
    [/(\d+)\s*jours?\s*fin\s*de\s*mois/i, '$1 jours fin de mois'],
    // "30 jours nets" / "30 jours net"
    [/(\d+)\s*jours?\s*net(?:s)?/i, '$1 jours nets'],
    // "à 30 jours" / "a 45 jours"
    [/[àa]\s*(\d+)\s*jours/i, '$1 jours'],
    // "Chèque à 45 jours date de facture"
    [/ch[èe]que\s*[àa]\s*(\d+)\s*jours/i, 'Chèque $1 jours'],
    // "LCR directe" with days
    [/LCR[^.]*?(\d+)\s*jours/i, 'LCR $1 jours'],
    // "payable au comptant" / "paiement comptant"
    [/pay(?:able|ement)\s*(?:au\s*)?comptant/i, 'Comptant'],
    // "Conditions de paiement : 30 jours fin de mois"
    [/conditions?\s*de\s*paiement\s*:?\s*(\d+)\s*jours?\s*(fin\s*de\s*mois|net(?:s)?)?/i, '$1 jours $2'],
    // Just "comptant"
    [/\bCOMPTANT\b/i, 'Comptant'],
  ];

  for (const [pattern, template] of termsPatterns) {
    const match = text.match(pattern);
    if (match) {
      // Extract days
      const daysMatch = match[0].match(/(\d+)\s*jours?/i);
      if (daysMatch) {
        paymentDays = parseInt(daysMatch[1]);
      } else if (/comptant/i.test(match[0])) {
        paymentDays = 0;
      }

      // Check if "fin de mois"
      isEndOfMonth = /fin\s*de\s*mois/i.test(match[0]);

      // Build display string
      let terms = template;
      if (match[1]) terms = terms.replace('$1', match[1]);
      if (match[2]) terms = terms.replace('$2', match[2].trim());
      terms = terms.replace(/\$\d/g, '').trim();
      result.paymentTerms = terms;
      break;
    }
  }

  // Also check for explicit due date from "REGLEMENT AU PLUS TARD LE" / "Échéance :"
  // (already parsed in section 4 as datePaiement)

  // If we have payment days and a facture date, calculate due date
  if (paymentDays !== null && result.dateFacture && !result.datePaiement) {
    const factureDate = new Date(result.dateFacture);
    if (!isNaN(factureDate.getTime())) {
      if (paymentDays === 0) {
        // Comptant = same day
        result.datePaiement = result.dateFacture;
      } else {
        const dueDate = new Date(factureDate);
        dueDate.setDate(dueDate.getDate() + paymentDays);

        if (isEndOfMonth) {
          // "fin de mois" = go to last day of that month
          dueDate.setMonth(dueDate.getMonth() + 1, 0);
        }

        const y = dueDate.getFullYear();
        const m = String(dueDate.getMonth() + 1).padStart(2, '0');
        const d = String(dueDate.getDate()).padStart(2, '0');
        result.datePaiement = `${y}-${m}-${d}`;
      }
    }
  }

  // ============================================
  // 7. FALLBACK — biggest amount = TTC if still empty
  // ============================================
  if (!result.montantTTC) {
    const amountRegex = /(\d[\d\s]*\d)[,.](\d{2})\s*[€]?/g;
    const amounts: number[] = [];
    let amtMatch;
    while ((amtMatch = amountRegex.exec(text)) !== null) {
      const numStr = amtMatch[1].replace(/\s/g, '') + '.' + amtMatch[2];
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 1 && num < 10000000) {
        amounts.push(num);
      }
    }
    if (amounts.length > 0) {
      const sorted = [...new Set(amounts)].sort((a, b) => b - a);
      result.montantTTC = sorted[0].toFixed(2);
      if (sorted.length > 1 && !result.montantHT) {
        result.montantHT = sorted[1].toFixed(2);
      }
    }
  }

  return result;
}

export default function InvoiceUploadZone({ entities, onExtracted, onFileUploaded, mode }: InvoiceUploadZoneProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load pdf.js from CDN (once)
  const loadPdfJs = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.pdfjsLib) return win.pdfjsLib;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        win.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(win.pdfjsLib);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }, []);

  // Convert a File to a usable image source for Tesseract
  const fileToImageSource = useCallback(async (file: File): Promise<string> => {
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPDF) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfjsLib = await loadPdfJs() as any;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      return canvas.toDataURL('image/png');
    } else {
      // For images, convert to data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  }, [loadPdfJs]);

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setIsProcessing(true);
    setProgress(0);
    setDone(false);

    try {
      // Convert file to image data URL first
      const imageSource = await fileToImageSource(file);

      const worker = await createWorker('fra', undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(imageSource);
      await worker.terminate();

      const fields = parseOCRText(text, entities, file.name);
      onExtracted(fields);

      // Upload file to server
      if (onFileUploaded) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        try {
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadFormData });
          if (uploadRes.ok) {
            const uploadJson = await uploadRes.json();
            onFileUploaded(uploadJson.data.fileUrl);
          }
        } catch {
          // Upload failed silently, OCR data still valid
        }
      }

      setDone(true);
    } catch (err) {
      console.error('OCR Error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [entities, onExtracted, onFileUploaded, fileToImageSource]);

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
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-gray-dark mb-1.5 uppercase tracking-wide">
        {mode === 'decaissement' ? 'Upload Facture Fournisseur' : 'Upload Facture'}
      </label>

      {!isProcessing && !done && (
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
            Déposez votre facture ici
          </div>
          <div className="text-[11px] text-gray-text">
            (PDF, JPG, PNG) — Les champs seront pré-remplis
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="border border-gray-border rounded-lg p-4 bg-gray-light text-center">
          <div className="text-lg mb-2 animate-pulse">🔍</div>
          <div className="text-xs font-semibold text-gray-dark mb-2">
            Analyse de {fileName}...
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 max-w-[200px] mx-auto">
            <div
              className="bg-ctbg-red h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[11px] text-gray-text mt-1">{progress}%</div>
        </div>
      )}

      {done && (
        <div className="border border-green-300 rounded-lg p-3 bg-green-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <div>
              <div className="text-xs font-semibold text-green-700">Facture analysée — champs pré-remplis</div>
              <div className="text-[11px] text-green-600">{fileName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-gray-text hover:text-gray-dark underline"
          >
            Réinitialiser
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
