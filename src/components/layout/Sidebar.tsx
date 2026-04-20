'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import type { Role } from '@/generated/prisma/enums';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: Role[];
  separator?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '🏠',
    roles: ['ADMIN', 'COMPTABLE', 'ADV'],
  },
  {
    label: 'Position Bancaire',
    href: '/position',
    icon: '🏦',
    roles: ['ADMIN', 'COMPTABLE', 'ADV'],
  },
  {
    label: 'Facturation client',
    href: '/encaissements',
    icon: '📥',
    roles: ['ADMIN', 'COMPTABLE', 'ADV', 'ADV_RESTREINT', 'OPERATEUR'],
    separator: true,
  },
  {
    label: 'Achat / Charge',
    href: '/decaissements',
    icon: '📤',
    roles: ['ADMIN', 'COMPTABLE', 'ADV', 'ADV_RESTREINT', 'OPERATEUR'],
  },
  {
    label: 'Appel à facturation CEE',
    href: '/facturation',
    icon: '📄',
    roles: ['ADMIN', 'COMPTABLE', 'ADV', 'ADV_RESTREINT', 'OPERATEUR'],
    separator: true,
  },
  {
    label: 'Charges Récurrentes',
    href: '/charges',
    icon: '🔄',
    roles: ['ADMIN', 'COMPTABLE', 'ADV'],
    separator: true,
  },
  {
    label: 'Prévisionnel',
    href: '/previsionnel',
    icon: '📊',
    roles: ['ADMIN', 'COMPTABLE', 'ADV'],
  },
  {
    label: 'Rapprochement',
    href: '/rapprochement',
    icon: '🔍',
    roles: ['ADMIN', 'COMPTABLE'],
  },
  {
    label: 'Notifications',
    href: '/notifications',
    icon: '🔔',
    roles: ['ADMIN', 'COMPTABLE', 'ADV', 'ADV_RESTREINT', 'OPERATEUR'],
    separator: true,
  },
  {
    label: 'Historique',
    href: '/historique',
    icon: '📋',
    roles: ['ADMIN'],
  },
  {
    label: 'Paramètres',
    href: '/parametres',
    icon: '⚙️',
    roles: ['ADMIN'],
  },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  COMPTABLE: 'Comptable',
  ADV: 'ADV',
  ADV_RESTREINT: 'ADV Restreint',
  OPERATEUR: 'Opérateur',
};

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userRole = session?.user?.role as Role | undefined;

  const filteredItems = navItems.filter(
    (item) => userRole && item.roles.includes(userRole)
  );

  return (
    <aside className="flex flex-col w-sidebar min-h-screen bg-sidebar border-r border-gray-border">
      {/* Logo */}
      <div className="flex items-center justify-center h-20 bg-black px-4">
        <Image
          src="/logo-ctbg-noir.svg"
          alt="CTBG"
          width={160}
          height={54}
          priority
          className="h-11 w-auto"
        />
      </div>

      {/* Subtitle */}
      <div className="px-4 py-3 border-b border-gray-border bg-white">
        <p className="text-[10px] font-bold uppercase tracking-[3px] text-gray-text text-center">
          Trésorerie
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {filteredItems.map((item, idx) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const prevItem = filteredItems[idx - 1];
            const showDivider = prevItem?.separator;

            return (
              <li key={item.href}>
                {showDivider && (
                  <div className="my-2 mx-2 border-t border-gray-border/60" />
                )}
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-ctbg-red text-white shadow-sm font-medium'
                      : 'text-gray-dark hover:bg-gray-light/80 hover:text-ctbg-red'
                  }`}
                >
                  <span className={`text-base ${isActive ? 'grayscale-0' : ''}`}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      {session?.user && (
        <div className="border-t border-gray-border p-4 bg-white/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-ctbg-red flex items-center justify-center text-white font-bold text-sm">
              {session.user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-dark truncate">
                {session.user.name}
              </p>
              <p className="text-[11px] text-gray-text">
                {ROLE_LABELS[session.user.role] || session.user.role}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-xs text-gray-text hover:text-ctbg-red hover:bg-ctbg-red-light rounded-md px-3 py-2 transition-all text-left flex items-center gap-2"
          >
            <span>↩</span>
            Déconnexion
          </button>
        </div>
      )}
    </aside>
  );
}
