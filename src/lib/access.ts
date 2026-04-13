import type { Module, Action } from '@/types';

const ACCESS_MATRIX: Record<string, Record<Module, Action[]>> = {
  ADMIN: {
    DASHBOARD: ['READ'],
    BANK_POSITION: ['READ', 'CREATE', 'UPDATE'],
    RECEIPTS: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    DISBURSEMENTS: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'VALIDATE'],
    SETTINGS: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  },
  COMPTABLE: {
    DASHBOARD: ['READ'],
    BANK_POSITION: ['READ', 'CREATE', 'UPDATE'],
    RECEIPTS: ['READ', 'CREATE', 'UPDATE'],
    DISBURSEMENTS: ['READ', 'CREATE', 'UPDATE'],
    SETTINGS: [],
  },
  ADV: {
    DASHBOARD: ['READ'],
    BANK_POSITION: ['READ'],
    RECEIPTS: ['READ', 'CREATE', 'UPDATE'],
    DISBURSEMENTS: ['READ'],
    SETTINGS: [],
  },
  ADV_RESTREINT: {
    DASHBOARD: [],
    BANK_POSITION: [],
    RECEIPTS: ['READ', 'CREATE', 'UPDATE'],
    DISBURSEMENTS: ['READ', 'CREATE', 'UPDATE'],
    SETTINGS: [],
  },
  OPERATEUR: {
    DASHBOARD: [],
    BANK_POSITION: [],
    RECEIPTS: ['READ', 'CREATE', 'UPDATE'],
    DISBURSEMENTS: ['READ', 'CREATE', 'UPDATE'],
    SETTINGS: [],
  },
};

export function checkAccess(role: string, module: Module, action: Action): boolean {
  return ACCESS_MATRIX[role]?.[module]?.includes(action) ?? false;
}

export function getAccessibleModules(role: string): Module[] {
  return Object.entries(ACCESS_MATRIX[role] || {})
    .filter(([, actions]) => actions.length > 0)
    .map(([module]) => module as Module);
}
