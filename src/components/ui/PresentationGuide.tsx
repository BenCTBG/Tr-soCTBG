'use client';

import { useState } from 'react';
import Link from 'next/link';

interface GuideItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  details: string[];
}

const guideItems: GuideItem[] = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    href: '/dashboard',
    icon: '📊',
    details: [
      'KPIs en temps reel (tresorerie totale, alertes)',
      'Vue consolidee des 6 entites',
    ],
  },
  {
    id: 'position',
    label: 'Position Bancaire',
    href: '/position',
    icon: '🏦',
    details: [
      'Saisie quotidienne des soldes',
      'Historique et alertes automatiques',
      'Multi-comptes par entite',
    ],
  },
  {
    id: 'encaissements',
    label: 'Facturation',
    href: '/encaissements',
    icon: '📥',
    details: [
      'Suivi des encaissements clients',
      'Paiements partiels (solde)',
      'Colonnes Paye/Restant',
      'Import Excel',
    ],
  },
  {
    id: 'decaissements',
    label: 'Achat / Charge',
    href: '/decaissements',
    icon: '📤',
    details: [
      'Gestion des decaissements fournisseurs',
      'Priorites de paiement',
      'Validation DG',
      'Import releve CB (OCR)',
    ],
  },
  {
    id: 'facturation',
    label: 'CEE',
    href: '/facturation',
    icon: '📄',
    details: [
      "Certificats d'Economie d'Energie",
      'Delegataires CEE',
      'Relances automatiques',
    ],
  },
  {
    id: 'charges',
    label: 'Charges Recurrentes',
    href: '/charges',
    icon: '🔄',
    details: [
      'Charges fixes mensuelles',
      'Prix variables',
    ],
  },
  {
    id: 'previsionnel',
    label: 'Previsionnel',
    href: '/previsionnel',
    icon: '📊',
    details: [
      'Projection de tresorerie a 30 jours',
    ],
  },
  {
    id: 'rapprochement',
    label: 'Rapprochement',
    href: '/rapprochement',
    icon: '🔍',
    details: [
      'Rapprochement bancaire automatique',
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    href: '/notifications',
    icon: '🔔',
    details: [
      'Alertes en temps reel',
      'Digest email quotidien',
    ],
  },
  {
    id: 'parametres',
    label: 'Administration',
    href: '/parametres',
    icon: '⚙️',
    details: [
      'Gestion utilisateurs et roles',
      'Multi-entites',
    ],
  },
];

interface PresentationGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PresentationGuide({ isOpen, onClose }: PresentationGuideProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggleCheck = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const completedCount = Object.values(checked).filter(Boolean).length;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[9998] transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-[40px] right-0 bottom-0 w-[400px] bg-white shadow-2xl z-[9999] transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h2 className="text-base font-bold text-gray-800">Guide de Presentation</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {completedCount}/{guideItems.length} fonctionnalites presentees
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${(completedCount / guideItems.length) * 100}%` }}
          />
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto py-3">
          {guideItems.map((item, index) => (
            <div
              key={item.id}
              className={`px-5 py-3 border-b border-gray-100 transition-colors duration-200 ${
                checked[item.id] ? 'bg-green-50/50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => toggleCheck(item.id)}
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                    checked[item.id]
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {checked[item.id] && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={item.href}
                    onClick={() => toggleCheck(item.id)}
                    className="flex items-center gap-2 group"
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className={`text-sm font-semibold group-hover:text-blue-600 transition-colors ${
                      checked[item.id] ? 'text-green-700 line-through' : 'text-gray-800'
                    }`}>
                      {index + 1}. {item.label}
                    </span>
                  </Link>
                  <ul className="mt-1.5 space-y-1 ml-7">
                    {item.details.map((detail, i) => (
                      <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                        <span className="text-gray-300 mt-0.5">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-[10px] text-gray-400 text-center">
            Cliquez sur un element pour naviguer vers la page correspondante
          </p>
        </div>
      </div>
    </>
  );
}
