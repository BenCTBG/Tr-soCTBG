'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import type { Role } from '@/generated/prisma/enums';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: Role[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '\uD83C\uDFE0',
    roles: ['ADMIN', 'COMPTABLE', 'ADV'],
  },
  {
    label: 'Position Bancaire',
    href: '/position',
    icon: '\uD83C\uDFE6',
    roles: ['ADMIN', 'COMPTABLE', 'ADV'],
  },
  {
    label: 'Encaissements',
    href: '/encaissements',
    icon: '\uD83D\uDCE5',
    roles: ['ADMIN', 'COMPTABLE', 'ADV', 'ADV_RESTREINT', 'OPERATEUR'],
  },
  {
    label: 'D\u00e9caissements',
    href: '/decaissements',
    icon: '\uD83D\uDCE4',
    roles: ['ADMIN', 'COMPTABLE', 'ADV', 'ADV_RESTREINT', 'OPERATEUR'],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userRole = session?.user?.role as Role | undefined;

  const filteredItems = navItems.filter(
    (item) => userRole && item.roles.includes(userRole)
  );

  return (
    <aside className="flex flex-col w-sidebar min-h-screen bg-white border-r border-gray-border">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 bg-ctbg-red">
        <span className="text-white text-xl font-bold tracking-wide">CTBG</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-ctbg-red-light text-ctbg-red border-l-4 border-ctbg-red font-medium'
                      : 'text-gray-dark hover:bg-gray-light border-l-4 border-transparent'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      {session?.user && (
        <div className="border-t border-gray-border p-4">
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-dark truncate">
              {session.user.name}
            </p>
            <p className="text-xs text-gray-text">{session.user.role}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-sm text-ctbg-red hover:text-ctbg-red-hover hover:bg-ctbg-red-light rounded px-3 py-1.5 transition-colors text-left"
          >
            D\u00e9connexion
          </button>
        </div>
      )}
    </aside>
  );
}
