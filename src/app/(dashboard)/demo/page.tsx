'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DemoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const activateDemo = async () => {
    setLoading(true);
    setStatus(null);
    try {
      // Seed demo data
      const res = await fetch('/api/demo/seed', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Erreur lors du chargement');
      }

      // Enable demo mode
      localStorage.setItem('demoMode', 'true');
      await fetch('/api/demo/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: true }),
      });

      setStatus({ type: 'success', message: 'Donnees de demo chargees avec succes !' });

      // Redirect after a short delay
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1500);
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
      setLoading(false);
    }
  };

  const resetData = async () => {
    setResetting(true);
    setStatus(null);
    try {
      const res = await fetch('/api/demo/seed', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Erreur lors de la reinitialisation');
      }

      localStorage.removeItem('demoMode');
      await fetch('/api/demo/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: false }),
      });

      setStatus({ type: 'success', message: 'Donnees reintialisees avec succes.' });
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header gradient */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-8 text-center">
            <div className="text-5xl mb-3">🎯</div>
            <h1 className="text-2xl font-bold text-white">Mode Demonstration</h1>
            <p className="text-blue-100 mt-2 text-sm">
              Activez le mode demo pour presenter l&apos;outil avec des donnees fictives realistes
            </p>
          </div>

          {/* Content */}
          <div className="px-8 py-6 space-y-5">
            {/* Status message */}
            {status && (
              <div
                className={`px-4 py-3 rounded-lg text-sm font-medium ${
                  status.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {status.type === 'success' ? '✅' : '❌'} {status.message}
              </div>
            )}

            {/* Features preview */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Donnees generees
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: '🏦', label: '84 positions bancaires' },
                  { icon: '📥', label: '25 encaissements' },
                  { icon: '📤', label: '20 decaissements' },
                  { icon: '📄', label: '15 factures CEE' },
                  { icon: '🔄', label: '8 charges recurrentes' },
                  { icon: '🔔', label: '6 notifications' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-xs text-gray-600">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={activateDemo}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Chargement des donnees...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Activer le mode demo</span>
                  </>
                )}
              </button>

              <button
                onClick={resetData}
                disabled={resetting}
                className="w-full py-3 px-4 bg-white border-2 border-red-200 hover:border-red-400 text-red-600 hover:text-red-700 rounded-xl font-medium text-sm transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resetting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Reinitialisation en cours...</span>
                  </>
                ) : (
                  <>
                    <span>🗑️</span>
                    <span>Reinitialiser les donnees</span>
                  </>
                )}
              </button>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-sm mt-0.5">⚠️</span>
              <p className="text-xs text-amber-700">
                Cela remplacera toutes les donnees actuelles par des donnees fictives.
                Utilisez la reinitialisation pour revenir a un etat propre.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom text */}
        <p className="text-center text-xs text-gray-400 mt-4">
          CTBG Tresorerie — Mode presentation
        </p>
      </div>
    </div>
  );
}
