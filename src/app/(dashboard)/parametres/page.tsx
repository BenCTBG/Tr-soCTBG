'use client';

import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import { formatDate } from '@/utils/formatters';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
}

interface Entity {
  id: string;
  name: string;
  code: string;
}

interface BankAccount {
  id: string;
  entityId: string;
  bankName: string;
  accountNumber: string | null;
  iban: string | null;
  label: string | null;
  active: boolean;
  createdAt: string;
  entity?: { name: string };
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'COMPTABLE', label: 'Comptable' },
  { value: 'ADV', label: 'ADV' },
  { value: 'ADV_RESTREINT', label: 'ADV Restreint' },
  { value: 'OPERATEUR', label: 'Operateur' },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  COMPTABLE: 'Comptable',
  ADV: 'ADV',
  ADV_RESTREINT: 'ADV Restreint',
  OPERATEUR: 'Operateur',
};

const emptyUserForm = {
  name: '',
  email: '',
  password: '',
  role: 'OPERATEUR',
  active: 'true',
};

const emptyBankAccountForm = {
  entityId: '',
  bankName: '',
  accountNumber: '',
  iban: '',
  label: '',
  active: 'true',
};

export default function ParametresPage() {
  const [activeTab, setActiveTab] = useState<'utilisateurs' | 'entites' | 'comptes'>('utilisateurs');

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ ...emptyUserForm });

  // Entities state
  const [entities, setEntities] = useState<Entity[]>([]);

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountModalOpen, setBankAccountModalOpen] = useState(false);
  const [editingBankAccountId, setEditingBankAccountId] = useState<string | null>(null);
  const [bankAccountForm, setBankAccountForm] = useState({ ...emptyBankAccountForm });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch('/api/entities');
      if (res.ok) {
        const json = await res.json();
        setEntities(json.data || json || []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchBankAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/bank-accounts');
      if (res.ok) {
        const json = await res.json();
        setBankAccounts(json.data || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchEntities();
    fetchBankAccounts();
  }, [fetchUsers, fetchEntities, fetchBankAccounts]);

  // --- User handlers ---
  const resetUserForm = useCallback(() => {
    setUserForm({ ...emptyUserForm });
    setEditingUserId(null);
  }, []);

  const openCreateUser = () => {
    resetUserForm();
    setUserModalOpen(true);
  };

  const openEditUser = (u: User) => {
    setEditingUserId(u.id);
    setUserForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      active: String(u.active),
    });
    setUserModalOpen(true);
  };

  const closeUserModal = () => {
    setUserModalOpen(false);
    resetUserForm();
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        const payload: Record<string, unknown> = {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          active: userForm.active === 'true',
        };
        if (userForm.password) {
          payload.password = userForm.password;
        }
        const res = await fetch(`/api/users/${editingUserId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          closeUserModal();
          fetchUsers();
        }
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userForm.name,
            email: userForm.email,
            password: userForm.password,
            role: userForm.role,
          }),
        });
        if (res.ok) {
          closeUserModal();
          fetchUsers();
        }
      }
    } catch {
      // silent
    }
  };

  const setUserField = (key: string) => (value: string) =>
    setUserForm((prev) => ({ ...prev, [key]: value }));

  const isEditingUser = !!editingUserId;

  // --- Bank account handlers ---
  const resetBankAccountForm = useCallback(() => {
    setBankAccountForm({ ...emptyBankAccountForm });
    setEditingBankAccountId(null);
  }, []);

  const openCreateBankAccount = () => {
    resetBankAccountForm();
    if (entities.length > 0) {
      setBankAccountForm((prev) => ({ ...prev, entityId: entities[0].id }));
    }
    setBankAccountModalOpen(true);
  };

  const openEditBankAccount = (ba: BankAccount) => {
    setEditingBankAccountId(ba.id);
    setBankAccountForm({
      entityId: ba.entityId,
      bankName: ba.bankName,
      accountNumber: ba.accountNumber || '',
      iban: ba.iban || '',
      label: ba.label || '',
      active: String(ba.active),
    });
    setBankAccountModalOpen(true);
  };

  const closeBankAccountModal = () => {
    setBankAccountModalOpen(false);
    resetBankAccountForm();
  };

  const handleBankAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBankAccountId) {
        const res = await fetch(`/api/bank-accounts/${editingBankAccountId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bankName: bankAccountForm.bankName,
            accountNumber: bankAccountForm.accountNumber,
            iban: bankAccountForm.iban,
            label: bankAccountForm.label,
            active: bankAccountForm.active === 'true',
          }),
        });
        if (res.ok) {
          closeBankAccountModal();
          fetchBankAccounts();
        }
      } else {
        const res = await fetch('/api/bank-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityId: bankAccountForm.entityId,
            bankName: bankAccountForm.bankName,
            accountNumber: bankAccountForm.accountNumber || undefined,
            iban: bankAccountForm.iban || undefined,
            label: bankAccountForm.label || undefined,
          }),
        });
        if (res.ok) {
          closeBankAccountModal();
          fetchBankAccounts();
        }
      }
    } catch {
      // silent
    }
  };

  const setBankAccountField = (key: string) => (value: string) =>
    setBankAccountForm((prev) => ({ ...prev, [key]: value }));

  const isEditingBankAccount = !!editingBankAccountId;

  const entityOptions = entities.map((e) => ({ value: e.id, label: e.name }));

  return (
    <>
      {/* Tabs */}
      <div className="flex border-b border-gray-border mb-5">
        <button
          onClick={() => setActiveTab('utilisateurs')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors bg-transparent cursor-pointer ${
            activeTab === 'utilisateurs'
              ? 'border-ctbg-red text-ctbg-red'
              : 'border-transparent text-gray-text hover:text-gray-dark'
          }`}
        >
          Utilisateurs
        </button>
        <button
          onClick={() => setActiveTab('entites')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors bg-transparent cursor-pointer ${
            activeTab === 'entites'
              ? 'border-ctbg-red text-ctbg-red'
              : 'border-transparent text-gray-text hover:text-gray-dark'
          }`}
        >
          Entites
        </button>
        <button
          onClick={() => setActiveTab('comptes')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors bg-transparent cursor-pointer ${
            activeTab === 'comptes'
              ? 'border-ctbg-red text-ctbg-red'
              : 'border-transparent text-gray-text hover:text-gray-dark'
          }`}
        >
          Comptes Bancaires
        </button>
      </div>

      {/* Utilisateurs Tab */}
      {activeTab === 'utilisateurs' && (
        <>
          <button
            onClick={openCreateUser}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-ctbg-red-hover hover:-translate-y-0.5 hover:shadow-lg transition-all mb-4"
          >
            + Nouvel utilisateur
          </button>

          <div className="bg-white p-6 rounded-lg shadow-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Nom</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Email</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Role</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Statut</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Date creation</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-text">Aucun utilisateur trouve</td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => openEditUser(u)}
                      className="hover:bg-gray-light transition-colors cursor-pointer"
                    >
                      <td className="p-3 border-b border-gray-border">{u.name}</td>
                      <td className="p-3 border-b border-gray-border">{u.email}</td>
                      <td className="p-3 border-b border-gray-border">{ROLE_LABELS[u.role] || u.role}</td>
                      <td className="p-3 border-b border-gray-border">
                        <StatusBadge
                          status={u.active ? 'ENCAISSE' : 'ANNULE'}
                          label={u.active ? 'Actif' : 'Inactif'}
                        />
                      </td>
                      <td className="p-3 border-b border-gray-border">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Modal isOpen={userModalOpen} onClose={closeUserModal} title={isEditingUser ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}>
            <form onSubmit={handleUserSubmit}>
              <FormField label="Nom" value={userForm.name} onChange={setUserField('name')} placeholder="Nom complet" required />
              <FormField label="Email" type="email" value={userForm.email} onChange={setUserField('email')} placeholder="email@exemple.com" required />
              <FormField
                label={isEditingUser ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}
                type="password"
                value={userForm.password}
                onChange={setUserField('password')}
                placeholder="--------"
                required={!isEditingUser}
              />
              <FormField
                label="Role"
                value={userForm.role}
                onChange={setUserField('role')}
                required
                options={ROLE_OPTIONS}
              />
              {isEditingUser && (
                <FormField
                  label="Statut"
                  value={userForm.active}
                  onChange={setUserField('active')}
                  required
                  options={[
                    { value: 'true', label: 'Actif' },
                    { value: 'false', label: 'Inactif' },
                  ]}
                />
              )}
              <div className="flex gap-2.5 mt-5">
                <button type="submit" className="px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold uppercase tracking-wide hover:bg-ctbg-red-hover">
                  {isEditingUser ? 'Mettre a jour' : 'Enregistrer'}
                </button>
                <button type="button" onClick={closeUserModal} className="px-4 py-2.5 bg-gray-light text-gray-dark border border-gray-border rounded-md text-sm font-semibold">
                  Annuler
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* Entites Tab */}
      {activeTab === 'entites' && (
        <div className="bg-white p-6 rounded-lg shadow-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Nom</th>
                <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Code</th>
              </tr>
            </thead>
            <tbody>
              {entities.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-6 text-center text-gray-text">Aucune entite trouvee</td>
                </tr>
              ) : (
                entities.map((ent) => (
                  <tr key={ent.id} className="hover:bg-gray-light transition-colors">
                    <td className="p-3 border-b border-gray-border">{ent.name}</td>
                    <td className="p-3 border-b border-gray-border">{ent.code}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Comptes Bancaires Tab */}
      {activeTab === 'comptes' && (
        <>
          <button
            onClick={openCreateBankAccount}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-ctbg-red-hover hover:-translate-y-0.5 hover:shadow-lg transition-all mb-4"
          >
            + Nouveau compte bancaire
          </button>

          <div className="bg-white p-6 rounded-lg shadow-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Entite</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Banque</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">N Compte</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">IBAN</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Label</th>
                  <th className="bg-gray-light p-3 text-left font-semibold text-gray-dark border-b border-gray-border text-xs uppercase tracking-wide">Statut</th>
                </tr>
              </thead>
              <tbody>
                {bankAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-text">Aucun compte bancaire trouve</td>
                  </tr>
                ) : (
                  bankAccounts.map((ba) => (
                    <tr
                      key={ba.id}
                      onClick={() => openEditBankAccount(ba)}
                      className="hover:bg-gray-light transition-colors cursor-pointer"
                    >
                      <td className="p-3 border-b border-gray-border">{ba.entity?.name || '-'}</td>
                      <td className="p-3 border-b border-gray-border">{ba.bankName}</td>
                      <td className="p-3 border-b border-gray-border">{ba.accountNumber || '-'}</td>
                      <td className="p-3 border-b border-gray-border">{ba.iban || '-'}</td>
                      <td className="p-3 border-b border-gray-border">{ba.label || '-'}</td>
                      <td className="p-3 border-b border-gray-border">
                        <StatusBadge
                          status={ba.active ? 'ENCAISSE' : 'ANNULE'}
                          label={ba.active ? 'Actif' : 'Inactif'}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Modal isOpen={bankAccountModalOpen} onClose={closeBankAccountModal} title={isEditingBankAccount ? 'Modifier Compte Bancaire' : 'Nouveau Compte Bancaire'}>
            <form onSubmit={handleBankAccountSubmit}>
              {!isEditingBankAccount && (
                <FormField
                  label="Entite"
                  value={bankAccountForm.entityId}
                  onChange={setBankAccountField('entityId')}
                  required
                  options={entityOptions}
                />
              )}
              <FormField label="Nom de la banque" value={bankAccountForm.bankName} onChange={setBankAccountField('bankName')} placeholder="Ex: BNP Paribas" required />
              <FormField label="Numero de compte" value={bankAccountForm.accountNumber} onChange={setBankAccountField('accountNumber')} placeholder="Ex: 00012345678" />
              <FormField label="IBAN" value={bankAccountForm.iban} onChange={setBankAccountField('iban')} placeholder="Ex: FR76 3000 1007 ..." />
              <FormField label="Label" value={bankAccountForm.label} onChange={setBankAccountField('label')} placeholder="Ex: Compte courant principal" />
              {isEditingBankAccount && (
                <FormField
                  label="Statut"
                  value={bankAccountForm.active}
                  onChange={setBankAccountField('active')}
                  required
                  options={[
                    { value: 'true', label: 'Actif' },
                    { value: 'false', label: 'Inactif' },
                  ]}
                />
              )}
              <div className="flex gap-2.5 mt-5">
                <button type="submit" className="px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold uppercase tracking-wide hover:bg-ctbg-red-hover">
                  {isEditingBankAccount ? 'Mettre a jour' : 'Enregistrer'}
                </button>
                <button type="button" onClick={closeBankAccountModal} className="px-4 py-2.5 bg-gray-light text-gray-dark border border-gray-border rounded-md text-sm font-semibold">
                  Annuler
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </>
  );
}
