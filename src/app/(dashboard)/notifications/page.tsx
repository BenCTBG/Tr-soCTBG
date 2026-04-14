'use client';

import { useState, useEffect, useCallback } from 'react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Preferences {
  emailEnabled: boolean;
  soldeCritique: boolean;
  factureUrgente: boolean;
  encaissementRetard: boolean;
  validationDg: boolean;
  paiementEffectue: boolean;
  positionNonSaisie: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  SOLDE_CRITIQUE: '\u{1F534}',
  FACTURE_URGENTE: '\u{1F7E0}',
  ENCAISSEMENT_RETARD: '\u{1F7E1}',
  VALIDATION_DG: '\u{1F535}',
  PAIEMENT_EFFECTUE: '\u{1F7E2}',
  POSITION_NON_SAISIE: '\u23F0',
  SYSTEME: '\u2139\uFE0F',
};

const TYPE_LABELS: Record<string, string> = {
  SOLDE_CRITIQUE: 'Solde critique',
  FACTURE_URGENTE: 'Facture urgente',
  ENCAISSEMENT_RETARD: 'Encaissement en retard',
  VALIDATION_DG: 'Validation DG',
  PAIEMENT_EFFECTUE: 'Paiement effectu\u00E9',
  POSITION_NON_SAISIE: 'Position non saisie',
  SYSTEME: 'Syst\u00E8me',
};

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const defaultPreferences: Preferences = {
  emailEnabled: true,
  soldeCritique: true,
  factureUrgente: true,
  encaissementRetard: true,
  validationDg: true,
  paiementEffectue: true,
  positionNonSaisie: true,
};

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'notifications' | 'preferences'>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterType, setFilterType] = useState('');
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [saveMessage, setSaveMessage] = useState('');

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?unread_only=false&limit=100');
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
      }
    } catch {
      // silent
    }
  }, []);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/preferences');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setPreferences(json.data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
  }, [fetchNotifications, fetchPreferences]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // silent
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // silent
    }
  };

  const savePreferences = async () => {
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      if (res.ok) {
        setSaveMessage('Pr\u00E9f\u00E9rences enregistr\u00E9es avec succ\u00E8s');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch {
      // silent
    }
  };

  const filteredNotifications = filterType
    ? notifications.filter((n) => n.type === filterType)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const togglePref = (key: keyof Preferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const prefRows: { key: keyof Preferences; label: string }[] = [
    { key: 'emailEnabled', label: 'Activer les notifications email' },
    { key: 'soldeCritique', label: 'Solde critique' },
    { key: 'factureUrgente', label: 'Facture urgente' },
    { key: 'encaissementRetard', label: 'Encaissement en retard' },
    { key: 'validationDg', label: 'Validation DG' },
    { key: 'paiementEffectue', label: 'Paiement effectu\u00E9' },
    { key: 'positionNonSaisie', label: 'Position non saisie' },
  ];

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-0 mb-5 border-b border-gray-border">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors bg-transparent cursor-pointer ${
            activeTab === 'notifications'
              ? 'border-ctbg-red text-ctbg-red'
              : 'border-transparent text-gray-text hover:text-gray-dark'
          }`}
        >
          Notifications {unreadCount > 0 && (
            <span className="ml-1.5 bg-ctbg-red text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors bg-transparent cursor-pointer ${
            activeTab === 'preferences'
              ? 'border-ctbg-red text-ctbg-red'
              : 'border-transparent text-gray-text hover:text-gray-dark'
          }`}
        >
          Pr&eacute;f&eacute;rences
        </button>
      </div>

      {activeTab === 'notifications' && (
        <>
          {/* Actions bar */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-border rounded-md text-xs cursor-pointer bg-white focus:outline-none focus:border-ctbg-red"
            >
              <option value="">Tous les types</option>
              {Object.entries(TYPE_LABELS).map(([val, lab]) => (
                <option key={val} value={val}>{lab}</option>
              ))}
            </select>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-ctbg-red text-white border-none rounded-md text-xs font-semibold cursor-pointer hover:bg-ctbg-red-hover transition-colors"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="bg-white rounded-lg shadow-card">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-text text-sm">
                Aucune notification
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.isRead) markAsRead(n.id);
                  }}
                  className={`flex items-start gap-4 px-5 py-4 border-b border-gray-border last:border-b-0 cursor-pointer hover:bg-gray-light transition-colors ${
                    !n.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {TYPE_ICONS[n.type] || '\u2139\uFE0F'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!n.isRead ? 'font-bold' : 'font-medium'} text-gray-dark`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 bg-ctbg-red rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-text mt-0.5">{n.message}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-gray-text">
                        {formatDateTime(n.createdAt)}
                      </span>
                      <span className="text-[11px] text-gray-text px-1.5 py-0.5 bg-gray-light rounded">
                        {TYPE_LABELS[n.type] || n.type}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === 'preferences' && (
        <div className="bg-white rounded-lg shadow-card p-6 max-w-lg">
          <h2 className="text-base font-semibold text-gray-dark mb-5">
            Pr&eacute;f&eacute;rences de notification
          </h2>

          <div className="space-y-0">
            {prefRows.map((row, idx) => (
              <div
                key={row.key}
                className={`flex items-center justify-between py-3.5 ${
                  idx < prefRows.length - 1 ? 'border-b border-gray-border' : ''
                } ${idx === 0 ? 'pb-4 mb-1' : ''}`}
              >
                <span className={`text-sm text-gray-dark ${idx === 0 ? 'font-semibold' : ''}`}>
                  {row.label}
                </span>
                <button
                  onClick={() => togglePref(row.key)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer border-none ${
                    preferences[row.key] ? 'bg-ctbg-red' : 'bg-gray-300'
                  }`}
                  aria-label={`Toggle ${row.label}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      preferences[row.key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={savePreferences}
              className="px-4 py-2.5 bg-ctbg-red text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-ctbg-red-hover transition-colors"
            >
              Enregistrer
            </button>
            {saveMessage && (
              <span className="text-sm text-green-600 font-medium">{saveMessage}</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
