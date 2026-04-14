import type { Module, Action } from '@/types';

const ACCESS_MATRIX: Record<string, Record<Module, Action[]>> = {
  ADMIN: {
    DASHBOARD: ['READ'],
    BANK_POSITION: ['READ', 'CREATE', 'UPDATE'],
    RECEIPTS: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    DISBURSEMENTS: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'VALIDATE'],
    INVOICES: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    RECURRING_CHARGES: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    FORECAST: [],
    SETTINGS: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    NOTIFICATIONS: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  },
  COMPTABLE: {
    DASHBOARD: ['READ'],
    BANK_POSITION: ['READ', 'CREATE', 'UPDATE'],
    RECEIPTS: ['READ', 'CREATE', 'UPDATE'],
    DISBURSEMENTS: ['READ', 'CREATE', 'UPDATE'],
    INVOICES: ['READ', 'CREATE', 'UPDATE'],
    RECURRING_CHARGES: ['READ', 'CREATE', 'UPDATE'],
    FORECAST: [],
    SETTINGS: [],
    NOTIFICATIONS: ['READ', 'UPDATE'],
  },
  ADV: {
    DASHBOARD: ['READ'],
    BANK_POSITION: ['READ'],
    RECEIPTS: ['READ', 'CREATE', 'UPDATE'],
    DISBURSEMENTS: ['READ'],
    INVOICES: ['READ', 'CREATE', 'UPDATE'],
    RECURRING_CHARGES: ['READ'],
    FORECAST: [],
    SETTINGS: [],
    NOTIFICATIONS: ['READ', 'UPDATE'],
  },
  ADV_RESTREINT: {
    DASHBOARD: [],
    BANK_POSITION: [],
    RECEIPTS: ['READ', 'CREATE', 'UPDATE'],
    DISBURSEMENTS: ['READ', 'CREATE', 'UPDATE'],
    INVOICES: ['READ'],
    RECURRING_CHARGES: [],
    FORECAST: [],
    SETTINGS: [],
    NOTIFICATIONS: ['READ'],
  },
  OPERATEUR: {
    DASHBOARD: [],
    BANK_POSITION: [],
    RECEIPTS: ['READ', 'CREATE', 'UPDATE'],
    DISBURSEMENTS: ['READ', 'CREATE', 'UPDATE'],
    INVOICES: ['READ'],
    RECURRING_CHARGES: [],
    FORECAST: [],
    SETTINGS: [],
    NOTIFICATIONS: ['READ'],
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
