'use client';

import { useEffect, useState } from 'react';
import PresentationGuide from './PresentationGuide';

export default function DemoModeBanner() {
  const [isActive, setIsActive] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const demoMode = localStorage.getItem('demoMode');
    if (demoMode === 'true') {
      setIsActive(true);
    }
  }, []);

  const handleDeactivate = () => {
    localStorage.removeItem('demoMode');
    setIsActive(false);
    setShowGuide(false);
  };

  if (!isActive) return null;

  return (
    <>
      {/* Banner */}
      <div
        className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
        style={{ height: '40px' }}
      >
        <div className="flex items-center justify-between h-full px-4 max-w-full">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-wide animate-pulse">
              🎯 MODE DEMO — Donnees fictives pour presentation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="px-3 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200 backdrop-blur-sm border border-white/30"
            >
              {showGuide ? '✕ Masquer le guide' : '📋 Guide de presentation'}
            </button>
            <button
              onClick={handleDeactivate}
              className="px-3 py-1 text-xs font-medium bg-red-500/80 hover:bg-red-500 rounded-full transition-all duration-200 border border-red-400/50"
            >
              Quitter le mode demo
            </button>
          </div>
        </div>
      </div>

      {/* Spacer to push content down */}
      <div style={{ height: '40px' }} />

      {/* Presentation Guide Panel */}
      <PresentationGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </>
  );
}
