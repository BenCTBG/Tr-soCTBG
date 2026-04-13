import type { Role } from '@/generated/prisma/enums';

export type Module = 'DASHBOARD' | 'BANK_POSITION' | 'RECEIPTS' | 'DISBURSEMENTS' | 'SETTINGS';
export type Action = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'VALIDATE';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

// Extend next-auth types
declare module 'next-auth' {
  interface Session {
    user: SessionUser;
  }
  interface User extends SessionUser {}
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}
