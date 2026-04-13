'use client';

import { usePathname } from 'next/navigation';

const titleMap: Record<string, string> = {
  '/dashboard': 'Tableau de Bord',
  '/position': 'Position Bancaire',
  '/encaissements': 'Encaissements',
  '/decaissements': 'D\u00e9caissements',
};

export default function Header() {
  const pathname = usePathname();

  const title =
    Object.entries(titleMap).find(([path]) =>
      pathname === path || pathname.startsWith(path + '/')
    )?.[1] ?? 'CTBG Tr\u00e9sorerie';

  return (
    <header className="h-16 bg-white border-b border-gray-border flex items-center px-6">
      <h1 className="text-xl font-semibold text-gray-dark">{title}</h1>
    </header>
  );
}
