'use client';

import { useState, useEffect, useCallback } from 'react';
import SummaryCard from '@/components/ui/SummaryCard';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface EntityData {
  id: string;
  name: string;
}

interface DailyProjection {
  date: string;
  balance: number;
  receipts: number;
  disbursements: number;
  charges: number;
}

interface EntityForecast {
  entityId: string;
  entityName: string;
  currentBalance: number;
  projectedBalance: number;
  daily: DailyProjection[];
}

interface ForecastData {
  entities: EntityForecast[];
  consolidated: {
    currentBalance: number;
    projectedBalance: number;
    daily: DailyProjection[];
  };
}

function getBalanceColor(balance: number): string {
  if (balance < 0) return 'text-red-900 font-bold';
  if (balance < 30000) return 'text-red-600 font-semibold';
  if (balance <= 50000) return 'text-orange-500 font-semibold';
  return 'text-green-600';
}

function getBalanceBg(balance: number): string {
  if (balance < 0) return 'bg-red-100';
  if (balance < 30000) return 'bg-red-50';
  if (balance <= 50000) return 'bg-orange-50';
  return 'bg-green-50';
}

export default function PrevisionnelPage() {
  const [entities, setEntities] = useState<EntityData[]>([]);
  const [filterEntity, setFilterEntity] = useState('');
  const [days, setDays] = useState(90);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

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

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterEntity) params.set('entity_id', filterEntity);
    params.set('days', String(days));
    try {
      const res = await fetch(`/api/forecast?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setForecast(json.data || null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filterEntity, days]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  // Determine active data: entity-specific or consolidated
  const activeData = filterEntity
    ? forecast?.entities.find((e) => e.entityId === filterEntity) || null
    : forecast?.consolidated || null;

  const currentBalance = activeData?.currentBalance ?? 0;
  const projectedBalance = activeData?.projectedBalance ?? 0;
  const variation = projectedBalance - currentBalance;
  const daily = activeData?.daily ?? [];

  // Alerts: days where balance goes below thresholds
  const alertsBelowZero = daily.filter((d) => d.balance < 0);
  const alertsBelow30k = daily.filter((d) => d.balance >= 0 && d.balance < 30000);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-dark">Previsionnel de Tresorerie</h2>
      </div>

      <div className="flex gap-2.5 mb-4">
        <select
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
          className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red"
        >
          <option value="">Consolide (toutes entites)</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>
              {ent.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {[30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-2 border rounded-md text-xs font-semibold cursor-pointer transition-all ${
                days === d
                  ? 'bg-ctbg-red text-white border-ctbg-red'
                  : 'bg-white text-gray-dark border-gray-border hover:border-ctbg-red'
              }`}
            >
              {d}j
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SummaryCard
          label="Solde Actuel"
          value={formatCurrency(currentBalance)}
          borderColor="border-t-ctbg-red"
        />
        <SummaryCard
          label={`Solde Projete a J+${days}`}
          value={formatCurrency(projectedBalance)}
          borderColor="border-t-ctbg-red"
        />
        <SummaryCard
          label="Variation"
          value={`${variation >= 0 ? '+' : ''}${formatCurrency(variation)}`}
          borderColor={variation >= 0 ? 'border-t-green-500' : 'border-t-error'}
        />
      </div>

      {loading ? (
        <div className="bg-white p-6 rounded-lg shadow-card text-center text-gray-text">
          Chargement des previsions...
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-card mb-5">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                    Date
                  </th>
                  <th className="bg-gray-light p-3 text-right font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                    Encaissements
                  </th>
                  <th className="bg-gray-light p-3 text-right font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                    Decaissements
                  </th>
                  <th className="bg-gray-light p-3 text-right font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                    Charges Rec.
                  </th>
                  <th className="bg-gray-light p-3 text-right font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">
                    Solde
                  </th>
                </tr>
              </thead>
              <tbody>
                {daily.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-text">
                      Aucune donnee previsionnelle
                    </td>
                  </tr>
                ) : (
                  daily.map((d) => (
                    <tr key={d.date} className="hover:bg-gray-light transition-colors">
                      <td className="p-3 border-b border-gray-border">
                        {formatDate(d.date)}
                      </td>
                      <td className="p-3 border-b border-gray-border text-right">
                        {d.receipts > 0 ? (
                          <span className="text-green-600">
                            +{formatCurrency(d.receipts)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3 border-b border-gray-border text-right">
                        {d.disbursements > 0 ? (
                          <span className="text-red-600">
                            -{formatCurrency(d.disbursements)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3 border-b border-gray-border text-right">
                        {d.charges > 0 ? (
                          <span className="text-orange-500">
                            -{formatCurrency(d.charges)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td
                        className={`p-3 border-b border-gray-border text-right ${getBalanceColor(d.balance)} ${getBalanceBg(d.balance)}`}
                      >
                        {formatCurrency(d.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(alertsBelowZero.length > 0 || alertsBelow30k.length > 0) && (
        <div className="bg-white p-6 rounded-lg shadow-card">
          <h3 className="text-sm font-bold text-gray-dark uppercase tracking-wide mb-3">
            Alertes Previsionnelles
          </h3>

          {alertsBelowZero.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
                <span className="text-sm font-semibold text-red-700">
                  Solde negatif ({alertsBelowZero.length} jour{alertsBelowZero.length > 1 ? 's' : ''})
                </span>
              </div>
              <ul className="ml-5 text-sm text-gray-dark space-y-1">
                {alertsBelowZero.slice(0, 10).map((d) => (
                  <li key={d.date}>
                    {formatDate(d.date)} : {formatCurrency(d.balance)}
                  </li>
                ))}
                {alertsBelowZero.length > 10 && (
                  <li className="text-gray-text">
                    ... et {alertsBelowZero.length - 10} autre{alertsBelowZero.length - 10 > 1 ? 's' : ''} jour{alertsBelowZero.length - 10 > 1 ? 's' : ''}
                  </li>
                )}
              </ul>
            </div>
          )}

          {alertsBelow30k.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
                <span className="text-sm font-semibold text-orange-600">
                  Solde sous 30 000 EUR ({alertsBelow30k.length} jour{alertsBelow30k.length > 1 ? 's' : ''})
                </span>
              </div>
              <ul className="ml-5 text-sm text-gray-dark space-y-1">
                {alertsBelow30k.slice(0, 10).map((d) => (
                  <li key={d.date}>
                    {formatDate(d.date)} : {formatCurrency(d.balance)}
                  </li>
                ))}
                {alertsBelow30k.length > 10 && (
                  <li className="text-gray-text">
                    ... et {alertsBelow30k.length - 10} autre{alertsBelow30k.length - 10 > 1 ? 's' : ''} jour{alertsBelow30k.length - 10 > 1 ? 's' : ''}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
