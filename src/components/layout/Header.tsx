'use client';

import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/ui/NotificationBell';

const titleMap: Record<string, string> = {
  '/dashboard': 'Tableau de Bord',
  '/position': 'Position Bancaire',
  '/encaissements': 'Facturation',
  '/decaissements': 'Achat / Charge',
  '/facturation': 'CEE',
  '/charges': 'Charges Récurrentes',
  '/previsionnel': 'Prévisionnel',
  '/parametres': 'Paramètres',
  '/notifications': 'Notifications',
  '/historique': 'Historique',
  '/rapprochement': 'Rapprochement Bancaire',
};

const subtitleMap: Record<string, string> = {
  '/dashboard': 'Vue d\'ensemble de la trésorerie',
  '/position': 'Soldes bancaires par entité',
  '/encaissements': 'Suivi des factures et paiements clients',
  '/decaissements': 'Suivi des achats et charges fournisseurs',
  '/facturation': 'Certificats d\'Économie d\'Énergie',
  '/charges': 'Charges fixes et récurrentes',
  '/previsionnel': 'Projections de trésorerie',
  '/parametres': 'Configuration du système',
  '/notifications': 'Centre de notifications',
  '/historique': 'Journal des modifications',
  '/rapprochement': 'Comparaison mouvements reels vs saisis',
};

export default function Header() {
  const pathname = usePathname();

  const entry = Object.entries(titleMap).find(([path]) =>
    pathname === path || pathname.startsWith(path + '/')
  );
  const title = entry?.[1] ?? 'CTBG Trésorerie';
  const subtitle = entry ? subtitleMap[entry[0]] : '';

  return (
    <header className="h-16 bg-white border-b border-gray-border flex items-center justify-between px-6 shadow-sm">
      <div>
        <h1 className="text-lg font-semibold text-gray-dark leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-xs text-gray-text">{subtitle}</p>
        )}
      </div>
      <NotificationBell />
    </header>
  );
}
