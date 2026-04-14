'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#C00000', '#f6301b', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

interface EntityHistory {
  name: string;
  positions: { date: string; balance: number }[];
}

export default function TreasuryChart() {
  const [data, setData] = useState<EntityHistory[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch(`/api/dashboard/history?days=${days}`)
      .then(r => r.json())
      .then(json => setData(json.data?.entities || []))
      .catch(() => {});
  }, [days]);

  // Transform: merge all entities into a single array keyed by date
  const allDates = new Set<string>();
  data.forEach(e => e.positions.forEach(p => allDates.add(p.date.substring(0, 10))));
  const sortedDates = [...allDates].sort();

  const chartData = sortedDates.map(date => {
    const entry: Record<string, unknown> = { date: date.substring(5) }; // MM-DD format
    data.forEach(e => {
      const pos = e.positions.find(p => p.date.substring(0, 10) === date);
      entry[e.name] = pos ? Number(pos.balance) : null;
    });
    return entry;
  });

  if (chartData.length === 0) {
    return (
      <div className="bg-white p-5 rounded-lg shadow-card mb-7">
        <h2 className="text-sm font-semibold text-gray-dark mb-4 uppercase tracking-wide">
          Évolution Trésorerie
        </h2>
        <p className="text-center text-gray-text text-sm py-8">
          Aucune donnée disponible. Saisissez des positions bancaires pour voir le graphique.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-lg shadow-card mb-7">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-dark uppercase tracking-wide">
          Évolution Trésorerie
        </h2>
        <div className="flex gap-1">
          {[7, 14, 30, 60].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                days === d
                  ? 'bg-ctbg-red text-white'
                  : 'bg-gray-light text-gray-text hover:bg-gray-border'
              }`}
            >
              {d}j
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748B" />
          <YAxis tick={{ fontSize: 11 }} stroke="#64748B" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value))}
            labelStyle={{ fontWeight: 'bold' }}
          />
          <Legend />
          {data.map((entity, i) => (
            <Line
              key={entity.name}
              type="monotone"
              dataKey={entity.name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
