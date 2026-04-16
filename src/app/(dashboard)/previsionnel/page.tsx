'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

// --- Weekly aggregation helpers ---

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const week = getISOWeekNumber(d);
  const year = d.getFullYear();
  return `${year}-W${week}`;
}

interface WeeklyEntityRow {
  entityId: string;
  entityName: string;
  currentBalance: number;
  weeks: {
    key: string;
    label: string;
    receipts: number;
    disbursements: number;
    charges: number;
    net: number;
    endBalance: number;
  }[];
}

function aggregateWeekly(forecast: ForecastData, numWeeks: number): { rows: WeeklyEntityRow[]; currentWeekNum: number; weekLabels: string[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentWeekNum = getISOWeekNumber(today);

  // Determine week keys for S, S+1, ... S+(numWeeks-1)
  const weekKeys: string[] = [];
  const weekLabels: string[] = [];
  for (let i = 0; i < numWeeks; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i * 7);
    const key = getWeekKey(d.toISOString().split('T')[0]);
    if (!weekKeys.includes(key)) {
      weekKeys.push(key);
      weekLabels.push(i === 0 ? 'S' : `S+${i}`);
    }
  }

  // Ensure we have exactly numWeeks
  while (weekKeys.length < numWeeks) {
    const lastDate = new Date(today);
    lastDate.setDate(lastDate.getDate() + weekKeys.length * 7);
    const key = getWeekKey(lastDate.toISOString().split('T')[0]);
    weekKeys.push(key);
    weekLabels.push(`S+${weekKeys.length - 1}`);
  }

  const rows: WeeklyEntityRow[] = forecast.entities.map((entity) => {
    const weeks = weekKeys.map((wk, idx) => {
      let receipts = 0;
      let disbursements = 0;
      let charges = 0;
      let endBalance = entity.currentBalance;

      for (const day of entity.daily) {
        const dayWeek = getWeekKey(day.date);
        if (dayWeek === wk) {
          receipts += day.receipts;
          disbursements += day.disbursements;
          charges += day.charges;
        }
        // Track end balance up to and including this week
        if (weekKeys.indexOf(dayWeek) <= idx) {
          endBalance = day.balance;
        }
      }

      return {
        key: wk,
        label: weekLabels[idx],
        receipts: Math.round(receipts * 100) / 100,
        disbursements: Math.round(disbursements * 100) / 100,
        charges: Math.round(charges * 100) / 100,
        net: Math.round((receipts - disbursements - charges) * 100) / 100,
        endBalance: Math.round(endBalance * 100) / 100,
      };
    });

    return {
      entityId: entity.entityId,
      entityName: entity.entityName,
      currentBalance: entity.currentBalance,
      weeks,
    };
  });

  return { rows, currentWeekNum, weekLabels };
}

// --- Monthly aggregation helpers ---

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

interface MonthlyEntityRow {
  entityId: string;
  entityName: string;
  currentBalance: number;
  months: {
    key: string;
    label: string;
    receipts: number;
    disbursements: number;
    charges: number;
    net: number;
    endBalance: number;
  }[];
}

function aggregateMonthly(forecast: ForecastData, numMonths: number): { rows: MonthlyEntityRow[]; currentMonthName: string; monthLabels: string[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonthName = MONTH_NAMES[today.getMonth()];

  const monthKeys: string[] = [];
  const monthLabels: string[] = [];
  for (let i = 0; i < numMonths; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthKeys.push(key);
    monthLabels.push(i === 0 ? 'M' : `M+${i}`);
  }

  const rows: MonthlyEntityRow[] = forecast.entities.map((entity) => {
    const months = monthKeys.map((mk, idx) => {
      let receipts = 0;
      let disbursements = 0;
      let charges = 0;
      let endBalance = entity.currentBalance;

      for (const day of entity.daily) {
        const dayMonth = getMonthKey(day.date);
        if (dayMonth === mk) {
          receipts += day.receipts;
          disbursements += day.disbursements;
          charges += day.charges;
        }
        if (monthKeys.indexOf(dayMonth) <= idx) {
          endBalance = day.balance;
        }
      }

      return {
        key: mk,
        label: monthLabels[idx],
        receipts: Math.round(receipts * 100) / 100,
        disbursements: Math.round(disbursements * 100) / 100,
        charges: Math.round(charges * 100) / 100,
        net: Math.round((receipts - disbursements - charges) * 100) / 100,
        endBalance: Math.round(endBalance * 100) / 100,
      };
    });

    return {
      entityId: entity.entityId,
      entityName: entity.entityName,
      currentBalance: entity.currentBalance,
      months,
    };
  });

  return { rows, currentMonthName, monthLabels };
}

// --- Shared styling ---

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

function getValueColor(value: number): string {
  if (value < 0) return 'text-red-600';
  if (value > 0) return 'text-green-600';
  return 'text-gray-400';
}

const thClass = 'bg-gray-light p-2.5 text-center font-semibold text-gray-dark border-b border-gray-border text-[11px] uppercase tracking-wide whitespace-nowrap';
const tdClass = 'p-2.5 border-b border-gray-border text-right text-xs whitespace-nowrap';
const tdEntityClass = 'p-2.5 border-b border-gray-border text-left text-xs font-semibold whitespace-nowrap';
const totalRowClass = 'bg-gray-100 font-bold';

type ViewTab = 'hebdomadaire' | 'mensuel' | 'journalier';

export default function PrevisionnelPage() {
  const [entities, setEntities] = useState<EntityData[]>([]);
  const [filterEntity, setFilterEntity] = useState('');
  const [days, setDays] = useState(90);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('hebdomadaire');

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
    // For weekly/monthly views, we need enough days
    const effectiveDays = activeTab === 'mensuel' ? Math.max(days, 120) : Math.max(days, 35);
    params.set('days', String(effectiveDays));
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
  }, [filterEntity, days, activeTab]);

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

  // Weekly aggregation (S to S+4 = 5 weeks)
  const weeklyData = useMemo(() => {
    if (!forecast || forecast.entities.length === 0) return null;
    return aggregateWeekly(forecast, 5);
  }, [forecast]);

  // Monthly aggregation (M to M+3 = 4 months)
  const monthlyData = useMemo(() => {
    if (!forecast || forecast.entities.length === 0) return null;
    return aggregateMonthly(forecast, 4);
  }, [forecast]);

  // Compute weekly totals
  const weeklyTotals = useMemo(() => {
    if (!weeklyData) return null;
    const totalCurrentBalance = weeklyData.rows.reduce((s, r) => s + r.currentBalance, 0);
    const weeks = weeklyData.rows[0]?.weeks.map((_, wIdx) => {
      const receipts = weeklyData.rows.reduce((s, r) => s + r.weeks[wIdx].receipts, 0);
      const disbursements = weeklyData.rows.reduce((s, r) => s + r.weeks[wIdx].disbursements, 0);
      const charges = weeklyData.rows.reduce((s, r) => s + r.weeks[wIdx].charges, 0);
      const net = weeklyData.rows.reduce((s, r) => s + r.weeks[wIdx].net, 0);
      const endBalance = weeklyData.rows.reduce((s, r) => s + r.weeks[wIdx].endBalance, 0);
      return { receipts: Math.round(receipts * 100) / 100, disbursements: Math.round(disbursements * 100) / 100, charges: Math.round(charges * 100) / 100, net: Math.round(net * 100) / 100, endBalance: Math.round(endBalance * 100) / 100 };
    }) ?? [];
    return { totalCurrentBalance, weeks };
  }, [weeklyData]);

  // Compute monthly totals
  const monthlyTotals = useMemo(() => {
    if (!monthlyData) return null;
    const totalCurrentBalance = monthlyData.rows.reduce((s, r) => s + r.currentBalance, 0);
    const months = monthlyData.rows[0]?.months.map((_, mIdx) => {
      const receipts = monthlyData.rows.reduce((s, r) => s + r.months[mIdx].receipts, 0);
      const disbursements = monthlyData.rows.reduce((s, r) => s + r.months[mIdx].disbursements, 0);
      const charges = monthlyData.rows.reduce((s, r) => s + r.months[mIdx].charges, 0);
      const net = monthlyData.rows.reduce((s, r) => s + r.months[mIdx].net, 0);
      const endBalance = monthlyData.rows.reduce((s, r) => s + r.months[mIdx].endBalance, 0);
      return { receipts: Math.round(receipts * 100) / 100, disbursements: Math.round(disbursements * 100) / 100, charges: Math.round(charges * 100) / 100, net: Math.round(net * 100) / 100, endBalance: Math.round(endBalance * 100) / 100 };
    }) ?? [];
    return { totalCurrentBalance, months };
  }, [monthlyData]);

  const tabs: { key: ViewTab; label: string }[] = [
    { key: 'hebdomadaire', label: 'Hebdomadaire' },
    { key: 'mensuel', label: 'Mensuel' },
    { key: 'journalier', label: 'Journalier' },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-dark">Previsionnel de Tresorerie</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
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

      {/* Summary cards */}
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

      {/* Tabs */}
      <div className="flex gap-0 mb-5 border-b border-gray-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-xs font-semibold cursor-pointer transition-all border-b-2 ${
              activeTab === tab.key
                ? 'border-b-ctbg-red text-ctbg-red bg-white'
                : 'border-b-transparent text-gray-text hover:text-gray-dark hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white p-6 rounded-lg shadow-card text-center text-gray-text">
          Chargement des previsions...
        </div>
      ) : (
        <>
          {/* ===== HEBDOMADAIRE VIEW ===== */}
          {activeTab === 'hebdomadaire' && weeklyData && weeklyTotals && (
            <div className="bg-white p-4 rounded-lg shadow-card mb-5">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-bold text-gray-dark uppercase tracking-wide">
                  Previsionnel Hebdomadaire
                </h3>
                <span className="text-xs text-gray-text bg-gray-100 px-2 py-1 rounded">
                  Semaine actuelle : S{weeklyData.currentWeekNum}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={thClass} style={{ minWidth: 120 }}>Entite</th>
                      <th className={thClass}>Solde Actuel</th>
                      {weeklyData.rows[0]?.weeks.map((w, i) => {
                        // For current week (S): ENC, DEC, NET
                        // For S+1, S+2: ENC, DEC
                        // Last column: SOLDE PREVI
                        if (i === 0) {
                          return [
                            <th key={`enc-${i}`} className={`${thClass} bg-blue-50`}>Enc. {w.label}</th>,
                            <th key={`dec-${i}`} className={`${thClass} bg-blue-50`}>Dec. {w.label}</th>,
                            <th key={`net-${i}`} className={`${thClass} bg-blue-50`}>Net {w.label}</th>,
                          ];
                        }
                        if (i <= 2) {
                          return [
                            <th key={`enc-${i}`} className={thClass}>Enc. {w.label}</th>,
                            <th key={`dec-${i}`} className={thClass}>Dec. {w.label}</th>,
                          ];
                        }
                        return null;
                      })}
                      <th className={`${thClass} bg-green-50`}>Solde Previ. S+2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyData.rows.map((row) => (
                      <tr key={row.entityId} className="hover:bg-gray-50 transition-colors">
                        <td className={tdEntityClass}>{row.entityName}</td>
                        <td className={`${tdClass} ${getBalanceColor(row.currentBalance)}`}>
                          {formatCurrency(row.currentBalance)}
                        </td>
                        {row.weeks.map((w, i) => {
                          if (i === 0) {
                            return [
                              <td key={`enc-${i}`} className={`${tdClass} bg-blue-50/30`}>
                                <span className={getValueColor(w.receipts)}>
                                  {w.receipts > 0 ? `+${formatCurrency(w.receipts)}` : '-'}
                                </span>
                              </td>,
                              <td key={`dec-${i}`} className={`${tdClass} bg-blue-50/30`}>
                                <span className={w.disbursements > 0 ? 'text-red-600' : 'text-gray-400'}>
                                  {w.disbursements > 0 ? `-${formatCurrency(w.disbursements)}` : '-'}
                                </span>
                              </td>,
                              <td key={`net-${i}`} className={`${tdClass} bg-blue-50/30 font-semibold`}>
                                <span className={getValueColor(w.net)}>
                                  {w.net >= 0 ? `+${formatCurrency(w.net)}` : formatCurrency(w.net)}
                                </span>
                              </td>,
                            ];
                          }
                          if (i <= 2) {
                            return [
                              <td key={`enc-${i}`} className={tdClass}>
                                <span className={getValueColor(w.receipts)}>
                                  {w.receipts > 0 ? `+${formatCurrency(w.receipts)}` : '-'}
                                </span>
                              </td>,
                              <td key={`dec-${i}`} className={tdClass}>
                                <span className={w.disbursements > 0 ? 'text-red-600' : 'text-gray-400'}>
                                  {w.disbursements > 0 ? `-${formatCurrency(w.disbursements)}` : '-'}
                                </span>
                              </td>,
                            ];
                          }
                          return null;
                        })}
                        {/* Solde Previ S+2 = endBalance of week index 2 (or last available) */}
                        {(() => {
                          const soldeIdx = Math.min(2, row.weeks.length - 1);
                          const solde = row.weeks[soldeIdx]?.endBalance ?? row.currentBalance;
                          return (
                            <td className={`${tdClass} ${getBalanceColor(solde)} ${getBalanceBg(solde)}`}>
                              {formatCurrency(solde)}
                            </td>
                          );
                        })()}
                      </tr>
                    ))}
                    {/* TOTAL row */}
                    <tr className={totalRowClass}>
                      <td className={`${tdEntityClass} text-sm`}>TOTAL</td>
                      <td className={`${tdClass} ${getBalanceColor(weeklyTotals.totalCurrentBalance)} text-sm`}>
                        {formatCurrency(weeklyTotals.totalCurrentBalance)}
                      </td>
                      {weeklyTotals.weeks.map((w, i) => {
                        if (i === 0) {
                          return [
                            <td key={`enc-${i}`} className={`${tdClass} bg-blue-50/30 text-sm`}>
                              <span className={getValueColor(w.receipts)}>
                                {w.receipts > 0 ? `+${formatCurrency(w.receipts)}` : '-'}
                              </span>
                            </td>,
                            <td key={`dec-${i}`} className={`${tdClass} bg-blue-50/30 text-sm`}>
                              <span className={w.disbursements > 0 ? 'text-red-600' : 'text-gray-400'}>
                                {w.disbursements > 0 ? `-${formatCurrency(w.disbursements)}` : '-'}
                              </span>
                            </td>,
                            <td key={`net-${i}`} className={`${tdClass} bg-blue-50/30 font-bold text-sm`}>
                              <span className={getValueColor(w.net)}>
                                {w.net >= 0 ? `+${formatCurrency(w.net)}` : formatCurrency(w.net)}
                              </span>
                            </td>,
                          ];
                        }
                        if (i <= 2) {
                          return [
                            <td key={`enc-${i}`} className={`${tdClass} text-sm`}>
                              <span className={getValueColor(w.receipts)}>
                                {w.receipts > 0 ? `+${formatCurrency(w.receipts)}` : '-'}
                              </span>
                            </td>,
                            <td key={`dec-${i}`} className={`${tdClass} text-sm`}>
                              <span className={w.disbursements > 0 ? 'text-red-600' : 'text-gray-400'}>
                                {w.disbursements > 0 ? `-${formatCurrency(w.disbursements)}` : '-'}
                              </span>
                            </td>,
                          ];
                        }
                        return null;
                      })}
                      {(() => {
                        const soldeIdx = Math.min(2, weeklyTotals.weeks.length - 1);
                        const solde = weeklyTotals.weeks[soldeIdx]?.endBalance ?? weeklyTotals.totalCurrentBalance;
                        return (
                          <td className={`${tdClass} ${getBalanceColor(solde)} ${getBalanceBg(solde)} text-sm`}>
                            {formatCurrency(solde)}
                          </td>
                        );
                      })()}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== MENSUEL VIEW ===== */}
          {activeTab === 'mensuel' && monthlyData && monthlyTotals && (
            <div className="bg-white p-4 rounded-lg shadow-card mb-5">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-bold text-gray-dark uppercase tracking-wide">
                  Previsionnel Mensuel
                </h3>
                <span className="text-xs text-gray-text bg-gray-100 px-2 py-1 rounded">
                  Mois actuel : {monthlyData.currentMonthName}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={thClass} style={{ minWidth: 120 }}>Entite</th>
                      <th className={thClass}>Solde Actuel</th>
                      {monthlyData.rows[0]?.months.map((m, i) => {
                        if (i <= 1) {
                          return [
                            <th key={`enc-${i}`} className={i === 0 ? `${thClass} bg-blue-50` : thClass}>Enc. {m.label}</th>,
                            <th key={`dec-${i}`} className={i === 0 ? `${thClass} bg-blue-50` : thClass}>Dec. {m.label}</th>,
                            <th key={`chg-${i}`} className={i === 0 ? `${thClass} bg-blue-50` : thClass}>Charges {m.label}</th>,
                            <th key={`net-${i}`} className={i === 0 ? `${thClass} bg-blue-50` : thClass}>Net {m.label}</th>,
                          ];
                        }
                        return null;
                      })}
                      <th className={`${thClass} bg-green-50`}>Solde Previ. M+1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.rows.map((row) => (
                      <tr key={row.entityId} className="hover:bg-gray-50 transition-colors">
                        <td className={tdEntityClass}>{row.entityName}</td>
                        <td className={`${tdClass} ${getBalanceColor(row.currentBalance)}`}>
                          {formatCurrency(row.currentBalance)}
                        </td>
                        {row.months.map((m, i) => {
                          if (i <= 1) {
                            const bgClass = i === 0 ? 'bg-blue-50/30' : '';
                            return [
                              <td key={`enc-${i}`} className={`${tdClass} ${bgClass}`}>
                                <span className={getValueColor(m.receipts)}>
                                  {m.receipts > 0 ? `+${formatCurrency(m.receipts)}` : '-'}
                                </span>
                              </td>,
                              <td key={`dec-${i}`} className={`${tdClass} ${bgClass}`}>
                                <span className={m.disbursements > 0 ? 'text-red-600' : 'text-gray-400'}>
                                  {m.disbursements > 0 ? `-${formatCurrency(m.disbursements)}` : '-'}
                                </span>
                              </td>,
                              <td key={`chg-${i}`} className={`${tdClass} ${bgClass}`}>
                                <span className={m.charges > 0 ? 'text-orange-500' : 'text-gray-400'}>
                                  {m.charges > 0 ? `-${formatCurrency(m.charges)}` : '-'}
                                </span>
                              </td>,
                              <td key={`net-${i}`} className={`${tdClass} ${bgClass} font-semibold`}>
                                <span className={getValueColor(m.net)}>
                                  {m.net >= 0 ? `+${formatCurrency(m.net)}` : formatCurrency(m.net)}
                                </span>
                              </td>,
                            ];
                          }
                          return null;
                        })}
                        {/* Solde Previ M+1 */}
                        {(() => {
                          const solde = row.months[1]?.endBalance ?? row.currentBalance;
                          return (
                            <td className={`${tdClass} ${getBalanceColor(solde)} ${getBalanceBg(solde)}`}>
                              {formatCurrency(solde)}
                            </td>
                          );
                        })()}
                      </tr>
                    ))}
                    {/* TOTAL row */}
                    <tr className={totalRowClass}>
                      <td className={`${tdEntityClass} text-sm`}>TOTAL</td>
                      <td className={`${tdClass} ${getBalanceColor(monthlyTotals.totalCurrentBalance)} text-sm`}>
                        {formatCurrency(monthlyTotals.totalCurrentBalance)}
                      </td>
                      {monthlyTotals.months.map((m, i) => {
                        if (i <= 1) {
                          const bgClass = i === 0 ? 'bg-blue-50/30' : '';
                          return [
                            <td key={`enc-${i}`} className={`${tdClass} ${bgClass} text-sm`}>
                              <span className={getValueColor(m.receipts)}>
                                {m.receipts > 0 ? `+${formatCurrency(m.receipts)}` : '-'}
                              </span>
                            </td>,
                            <td key={`dec-${i}`} className={`${tdClass} ${bgClass} text-sm`}>
                              <span className={m.disbursements > 0 ? 'text-red-600' : 'text-gray-400'}>
                                {m.disbursements > 0 ? `-${formatCurrency(m.disbursements)}` : '-'}
                              </span>
                            </td>,
                            <td key={`chg-${i}`} className={`${tdClass} ${bgClass} text-sm`}>
                              <span className={m.charges > 0 ? 'text-orange-500' : 'text-gray-400'}>
                                {m.charges > 0 ? `-${formatCurrency(m.charges)}` : '-'}
                              </span>
                            </td>,
                            <td key={`net-${i}`} className={`${tdClass} ${bgClass} font-bold text-sm`}>
                              <span className={getValueColor(m.net)}>
                                {m.net >= 0 ? `+${formatCurrency(m.net)}` : formatCurrency(m.net)}
                              </span>
                            </td>,
                          ];
                        }
                        return null;
                      })}
                      {(() => {
                        const solde = monthlyTotals.months[1]?.endBalance ?? monthlyTotals.totalCurrentBalance;
                        return (
                          <td className={`${tdClass} ${getBalanceColor(solde)} ${getBalanceBg(solde)} text-sm`}>
                            {formatCurrency(solde)}
                          </td>
                        );
                      })()}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== JOURNALIER VIEW (original) ===== */}
          {activeTab === 'journalier' && (
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
        </>
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
