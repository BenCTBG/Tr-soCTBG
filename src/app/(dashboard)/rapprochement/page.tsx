'use client';

import { useState, useEffect, useCallback } from 'react';
import SummaryCard from '@/components/ui/SummaryCard';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface EntityData {
  id: string;
  name: string;
}

interface BankPosition {
  id: string;
  date: string;
  balance: number | string;
  variation: number | string;
  entity: { id: string; name: string };
}

interface Receipt {
  id: string;
  expectedDate: string;
  receivedDate: string | null;
  clientName: string;
  amountTtc: number | string;
  status: string;
}

interface Disbursement {
  id: string;
  receivedDate: string;
  paymentDueDate: string | null;
  supplier: string;
  amountTtc: number | string;
  status: string;
}

interface Movement {
  id: string;
  date: string;
  type: 'Encaissement' | 'Decaissement';
  label: string;
  amount: number;
}

function getDefaultDateFrom(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().substring(0, 10);
}

function getDefaultDateTo(): string {
  return new Date().toISOString().substring(0, 10);
}

export default function RapprochementPage() {
  const [entities, setEntities] = useState<EntityData[]>([]);
  const [filterEntity, setFilterEntity] = useState('');
  const [dateFrom, setDateFrom] = useState(getDefaultDateFrom);
  const [dateTo, setDateTo] = useState(getDefaultDateTo);

  const [bankPositions, setBankPositions] = useState<BankPosition[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [bankVariationTotal, setBankVariationTotal] = useState(0);
  const [movementsTotal, setMovementsTotal] = useState(0);

  // Fetch entities
  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then((json) => {
        const list = json.data || json || [];
        setEntities(list);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterEntity) params.set('entity_id', filterEntity);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    params.set('limit', '100');

    try {
      const [bankRes, receiptsRes, disbursementsRes] = await Promise.all([
        fetch(`/api/bank-positions?${params.toString()}`),
        fetch(`/api/receipts?${params.toString()}&status=ENCAISSE`),
        fetch(`/api/disbursements?${params.toString()}&status=PAYE`),
      ]);

      // Bank positions
      if (bankRes.ok) {
        const bankJson = await bankRes.json();
        const positions: BankPosition[] = bankJson.data || [];
        setBankPositions(positions);
        const variationSum = positions.reduce(
          (sum, p) => sum + (Number(p.variation) || 0),
          0
        );
        setBankVariationTotal(variationSum);
      }

      // Receipts
      const receiptMovements: Movement[] = [];
      let receiptTotal = 0;
      if (receiptsRes.ok) {
        const receiptsJson = await receiptsRes.json();
        const receipts: Receipt[] = receiptsJson.data || [];
        for (const r of receipts) {
          const amt = Number(r.amountTtc) || 0;
          receiptTotal += amt;
          receiptMovements.push({
            id: r.id,
            date: r.receivedDate || r.expectedDate,
            type: 'Encaissement',
            label: r.clientName,
            amount: amt,
          });
        }
      }

      // Disbursements
      const disbursementMovements: Movement[] = [];
      let disbursementTotal = 0;
      if (disbursementsRes.ok) {
        const disbursementsJson = await disbursementsRes.json();
        const disbursements: Disbursement[] = disbursementsJson.data || [];
        for (const d of disbursements) {
          const amt = Number(d.amountTtc) || 0;
          disbursementTotal += amt;
          disbursementMovements.push({
            id: d.id,
            date: d.paymentDueDate || d.receivedDate,
            type: 'Decaissement',
            label: d.supplier,
            amount: amt,
          });
        }
      }

      const allMovements = [...receiptMovements, ...disbursementMovements].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setMovements(allMovements);
      setMovementsTotal(receiptTotal - disbursementTotal);
    } catch {
      // silent
    }
  }, [filterEntity, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ecart = bankVariationTotal - movementsTotal;

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2.5 mb-5">
        <select
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red"
        >
          <option value="">Toutes les entites</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>
              {ent.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs bg-white focus:outline-none focus:border-ctbg-red"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs bg-white focus:outline-none focus:border-ctbg-red"
        />
      </div>

      {/* Two side-by-side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Left panel: Mouvements Reels */}
        <div className="bg-white p-6 rounded-lg shadow-card">
          <h2 className="text-sm font-semibold text-gray-dark uppercase tracking-wide mb-4">
            Mouvements Reels (Position Bancaire)
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                  Date
                </th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                  Solde
                </th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                  Variation
                </th>
              </tr>
            </thead>
            <tbody>
              {bankPositions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-gray-text">
                    Aucune position bancaire
                  </td>
                </tr>
              ) : (
                bankPositions.map((bp) => {
                  const variation = Number(bp.variation) || 0;
                  return (
                    <tr key={bp.id} className="hover:bg-gray-light transition-colors">
                      <td className="p-3 border-b border-gray-border">
                        {formatDate(bp.date)}
                      </td>
                      <td className="p-3 border-b border-gray-border">
                        {formatCurrency(Number(bp.balance))}
                      </td>
                      <td
                        className={`p-3 border-b border-gray-border font-semibold ${
                          variation >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {variation >= 0 ? '+' : ''}
                        {formatCurrency(variation)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right panel: Mouvements Saisis */}
        <div className="bg-white p-6 rounded-lg shadow-card">
          <h2 className="text-sm font-semibold text-gray-dark uppercase tracking-wide mb-4">
            Mouvements Saisis
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                  Date
                </th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                  Type
                </th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                  Libelle
                </th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-text">
                    Aucun mouvement saisi
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isEncaissement = m.type === 'Encaissement';
                  return (
                    <tr key={m.id} className="hover:bg-gray-light transition-colors">
                      <td className="p-3 border-b border-gray-border">
                        {formatDate(m.date)}
                      </td>
                      <td
                        className={`p-3 border-b border-gray-border font-semibold ${
                          isEncaissement ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {m.type}
                      </td>
                      <td className="p-3 border-b border-gray-border">{m.label}</td>
                      <td
                        className={`p-3 border-b border-gray-border font-semibold ${
                          isEncaissement ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {isEncaissement ? '+' : '-'}
                        {formatCurrency(m.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom section: Analyse de l'Ecart */}
      <h2 className="text-sm font-semibold text-gray-dark uppercase tracking-wide mb-3">
        Analyse de l&apos;Ecart
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SummaryCard
          label="Variation Bancaire"
          value={formatCurrency(bankVariationTotal)}
          borderColor="border-t-ctbg-red"
        />
        <SummaryCard
          label="Mouvements Saisis"
          value={formatCurrency(movementsTotal)}
          borderColor="border-t-ctbg-red"
        />
        <SummaryCard
          label="Ecart"
          value={formatCurrency(ecart)}
          borderColor={ecart > 0 ? 'border-t-error' : 'border-t-ctbg-red'}
        />
      </div>
    </>
  );
}
