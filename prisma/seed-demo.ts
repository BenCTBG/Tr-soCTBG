import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  Role,
  AlertLevel,
  ReceiptType,
  ReceiptStatus,
  DisbursementPriority,
  DisbursementStatus,
  PaymentMethod,
  ChargeFrequency,
  ChargeCategory,
  InvoiceStatus,
  NotificationType,
  InvoicePaymentSource,
} from '../src/generated/prisma/enums';
import { PrismaPg } from '@prisma/adapter-pg';
import bcryptjs from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function alertLevelForBalance(balance: number): AlertLevel {
  if (balance < 0) return AlertLevel.NEGATIF;
  if (balance < 30000) return AlertLevel.CRITIQUE;
  if (balance < 50000) return AlertLevel.ATTENTION;
  return AlertLevel.NORMAL;
}

function formatInvoiceNumber(n: number): string {
  return `FAC-2026-${String(n).padStart(4, '0')}`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== CTBG Demo Seed ===\n');

  // 1. Check if entities exist, if not run base seed logic
  const entityCount = await prisma.entity.count();
  if (entityCount === 0) {
    console.log('Aucune entité trouvée, création des données de base...');
    const entities = [
      { name: 'CTBG PREMIUM', code: 'CTBG_PREMIUM' },
      { name: 'CTBG GROUPE', code: 'CTBG_GROUPE' },
      { name: 'CTBG EP', code: 'CTBG_EP' },
      { name: "CTBG HOME RENOV'", code: 'CTBG_HOME_RENOV' },
      { name: 'CVH', code: 'CVH' },
      { name: 'DOMOS ENERGIE', code: 'DOMOS_ENERGIE' },
    ];
    for (const entity of entities) {
      await prisma.entity.upsert({
        where: { code: entity.code },
        update: {},
        create: entity,
      });
    }
    const defaultPassword = await bcryptjs.hash('Ctbg2026!', 12);
    const users = [
      { email: 'mehdi@ctbg.fr', name: 'Mehdi BOUZOU', role: Role.ADMIN },
      { email: 'hocine@ctbg.fr', name: 'Hocine', role: Role.ADMIN },
      { email: 'sophie@ctbg.fr', name: 'Sophie', role: Role.COMPTABLE },
      { email: 'elsa@ctbg.fr', name: 'Elsa', role: Role.COMPTABLE },
      { email: 'olivier@ctbg.fr', name: 'Olivier', role: Role.ADV },
      { email: 'melisa@ctbg.fr', name: 'Melisa', role: Role.ADV_RESTREINT },
      { email: 'anissa@ctbg.fr', name: 'Anissa', role: Role.OPERATEUR },
      { email: 'laetitia@ctbg.fr', name: 'Laetitia', role: Role.OPERATEUR },
    ];
    for (const user of users) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: { ...user, password: defaultPassword },
      });
    }
    console.log('Entités et utilisateurs créés.\n');
  }

  // Fetch entities and users
  const allEntities = await prisma.entity.findMany();
  const allUsers = await prisma.user.findMany();

  const entityByCode = Object.fromEntries(allEntities.map((e) => [e.code, e]));
  const userByEmail = Object.fromEntries(allUsers.map((u) => [u.email, u]));

  const adminUser = userByEmail['mehdi@ctbg.fr'];
  const comptableUser = userByEmail['sophie@ctbg.fr'];
  const advUser = userByEmail['olivier@ctbg.fr'];
  const admin2 = userByEmail['hocine@ctbg.fr'];

  // 2. Clear transactional data (order matters for FK constraints)
  console.log('Suppression des données transactionnelles...');
  await prisma.invoicePayment.deleteMany();
  await prisma.invoiceReminder.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.cardTransaction.deleteMany();
  await prisma.disbursement.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.recurringCharge.deleteMany();
  await prisma.bankPosition.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notificationPreference.deleteMany();
  console.log('Données transactionnelles supprimées.\n');

  // ─── Bank Accounts ─────────────────────────────────────────────────────

  console.log('Création des comptes bancaires...');
  const bankAccountsData = [
    { entityCode: 'CTBG_PREMIUM', bankName: 'BNP Paribas', label: 'Compte courant', accountNumber: '30004 01234 00012345678 90', iban: 'FR76 3000 4012 3400 0123 4567 890' },
    { entityCode: 'CTBG_GROUPE', bankName: 'Crédit Agricole', label: 'Compte courant', accountNumber: '30006 02345 00023456789 01', iban: 'FR76 3000 6023 4500 0234 5678 901' },
    { entityCode: 'CTBG_EP', bankName: 'BNP Paribas', label: 'Compte courant', accountNumber: '30004 03456 00034567890 12', iban: 'FR76 3000 4034 5600 0345 6789 012' },
    { entityCode: 'CTBG_HOME_RENOV', bankName: 'Société Générale', label: 'Compte courant', accountNumber: '30003 04567 00045678901 23', iban: 'FR76 3000 3045 6700 0456 7890 123' },
    { entityCode: 'CVH', bankName: 'CIC', label: 'Compte courant', accountNumber: '30066 05678 00056789012 34', iban: 'FR76 3006 6056 7800 0567 8901 234' },
    { entityCode: 'DOMOS_ENERGIE', bankName: 'Banque Populaire', label: 'Compte courant', accountNumber: '10207 06789 00067890123 45', iban: 'FR76 1020 7067 8900 0678 9012 345' },
  ];

  const bankAccounts: Record<string, string> = {};
  for (const ba of bankAccountsData) {
    const created = await prisma.bankAccount.create({
      data: {
        entityId: entityByCode[ba.entityCode].id,
        bankName: ba.bankName,
        label: ba.label,
        accountNumber: ba.accountNumber,
        iban: ba.iban,
      },
    });
    bankAccounts[ba.entityCode] = created.id;
  }
  console.log(`${bankAccountsData.length} comptes bancaires créés.\n`);

  // ─── Bank Positions ─────────────────────────────────────────────────────

  console.log('Création des positions bancaires...');

  const entityBalanceConfig: Record<string, { start: number; min: number; max: number }> = {
    CTBG_PREMIUM: { start: 155000, min: 120000, max: 180000 },
    CTBG_GROUPE: { start: 120000, min: 80000, max: 150000 },
    CTBG_EP: { start: 65000, min: 40000, max: 90000 },
    CTBG_HOME_RENOV: { start: 95000, min: 60000, max: 120000 },
    CVH: { start: 32000, min: 15000, max: 45000 },
    DOMOS_ENERGIE: { start: 48000, min: 25000, max: 70000 },
  };

  let bankPositionCount = 0;

  for (const [code, config] of Object.entries(entityBalanceConfig)) {
    let balance = config.start;

    // Create positions for the last 60 business days (skip weekends)
    for (let dayOffset = 60; dayOffset >= 0; dayOffset--) {
      const date = daysAgo(dayOffset);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends

      const previousBalance = balance;
      const variation = randomBetween(-25000, 25000);
      balance = Math.round((previousBalance + variation) * 100) / 100;

      // Clamp to realistic range
      if (balance < config.min) balance = config.min + randomBetween(0, 10000);
      if (balance > config.max) balance = config.max - randomBetween(0, 10000);

      // Introduce a few alert-level positions for CVH and DOMOS_ENERGIE
      if ((code === 'CVH' && dayOffset % 20 === 5) || (code === 'DOMOS_ENERGIE' && dayOffset === 30)) {
        balance = randomBetween(18000, 28000);
      }

      const actualVariation = Math.round((balance - previousBalance) * 100) / 100;

      await prisma.bankPosition.create({
        data: {
          date,
          entityId: entityByCode[code].id,
          bankAccountId: bankAccounts[code],
          balance,
          previousBalance,
          variation: actualVariation,
          alertLevel: alertLevelForBalance(balance),
          createdBy: pick([adminUser.id, comptableUser.id]),
        },
      });
      bankPositionCount++;
    }
  }
  console.log(`${bankPositionCount} positions bancaires créées.\n`);

  // ─── Receipts ───────────────────────────────────────────────────────────

  console.log('Création des encaissements...');

  const clientNames = [
    'M. et Mme DUPONT', 'SCI Les Tilleuls', 'M. BENALI Ahmed', 'Mme MARTIN Catherine',
    'M. LEFEBVRE Jean-Pierre', 'SCI du Parc', 'Mme NGUYEN Thanh', 'M. GARCIA Antonio',
    'M. et Mme PETIT', 'SCI Résidence Beausoleil', 'Mme ROUX Isabelle', 'M. MOREAU François',
    'M. et Mme LAMBERT', 'SCI Haussmann', 'M. DAVID Philippe', 'Mme BERNARD Nathalie',
    'M. THOMAS Éric', 'SCI Les Glycines', 'M. et Mme ROBERT', 'Mme RICHARD Sylvie',
    'M. DURAND Christophe', 'SCI Val de Seine', 'M. et Mme DUBOIS', 'Mme LEROY Sandrine',
    'M. SIMON Patrick', 'SCI Monceau', 'M. et Mme LAURENT', 'Mme MICHEL Valérie',
    'M. CHEVALIER Bruno', 'SCI Riviera', 'M. et Mme FOURNIER', 'Mme GIRARD Anne',
    'M. BONNET Jacques', 'SCI Les Ormes', 'M. et Mme MERCIER', 'Mme BLANC Marie-Claire',
    'M. MOREL Stéphane', 'SCI Bellevue', 'M. et Mme GUERIN', 'Mme FAURE Christine',
    'M. ANDRE Julien', 'Copropriété Les Acacias', 'M. et Mme MULLER',
  ];

  const addresses = [
    '12 rue des Lilas, 75015 Paris', '45 avenue Jean Jaurès, 93100 Montreuil',
    '8 boulevard Voltaire, 75011 Paris', '23 rue de la République, 92130 Issy-les-Moulineaux',
    '67 avenue du Général Leclerc, 94700 Maisons-Alfort', '3 rue Victor Hugo, 77200 Torcy',
    '15 rue des Merisiers, 78150 Le Chesnay', '91 avenue de Paris, 91300 Massy',
    '28 rue Diderot, 93200 Saint-Denis', '54 boulevard de Strasbourg, 94130 Nogent-sur-Marne',
    '7 allée des Chênes, 95100 Argenteuil', '19 rue Pasteur, 92400 Courbevoie',
    '36 rue de la Paix, 75002 Paris', '42 avenue Foch, 93600 Aulnay-sous-Bois',
    '11 rue Molière, 78000 Versailles', '55 rue du Maréchal Foch, 92000 Nanterre',
    '29 chemin des Vignes, 77100 Meaux', '6 place de la Mairie, 91400 Orsay',
    '73 boulevard Gambetta, 94100 Saint-Maur-des-Fossés', '18 rue de Rivoli, 75004 Paris',
    '44 avenue des Ternes, 75017 Paris', '82 rue de Belleville, 75020 Paris',
    '5 impasse des Roses, 93500 Pantin', '14 rue Thiers, 92100 Boulogne-Billancourt',
  ];

  const departments = ['75', '92', '93', '94', '77', '78', '91', '95'];
  const ceeDelegataires = ['VERTIGO', 'EFFY', 'TOTAL ENERGIES', 'ENGIE', 'HELLIO', 'PRIMESENERGIE', 'CARREFOUR ENERGIES'];
  const entityCodes = Object.keys(entityByCode);

  const receiptIds: string[] = [];
  const receiptInvoiceNumbers: string[] = [];

  for (let i = 1; i <= 45; i++) {
    const invoiceNumber = formatInvoiceNumber(i);
    receiptInvoiceNumbers.push(invoiceNumber);

    const type = pickWeighted(
      [ReceiptType.CLIENT_DIRECT, ReceiptType.CEE, ReceiptType.MPR, ReceiptType.AVOIR],
      [60, 25, 10, 5]
    );
    const status = pickWeighted(
      [ReceiptStatus.ATTENDU, ReceiptStatus.ENCAISSE, ReceiptStatus.EN_RETARD, ReceiptStatus.ANNULE],
      [40, 35, 15, 10]
    );

    const expectedDaysAgo = Math.floor(Math.random() * 80) + 5;
    const expectedDate = daysAgo(expectedDaysAgo);

    let receivedDate: Date | null = null;
    let filingDate: Date | null = null;
    let delayDays: number | null = null;

    if (status === ReceiptStatus.ENCAISSE) {
      const receiveDelay = Math.floor(Math.random() * 15) + 1;
      receivedDate = daysAgo(expectedDaysAgo - receiveDelay);
      filingDate = daysAgo(expectedDaysAgo - receiveDelay - Math.floor(Math.random() * 5));
      delayDays = receiveDelay;
    } else if (status === ReceiptStatus.EN_RETARD) {
      delayDays = Math.floor(Math.random() * 30) + 10;
    }

    const amount = type === ReceiptType.AVOIR
      ? randomBetween(-5000, -500)
      : type === ReceiptType.CEE
        ? randomBetween(3000, 25000)
        : type === ReceiptType.MPR
          ? randomBetween(2000, 15000)
          : randomBetween(2500, 85000);

    const addr = pick(addresses);
    const deptMatch = addr.match(/(\d{2})\d{3}/);
    const department = deptMatch ? deptMatch[1] : pick(departments);

    const receipt = await prisma.receipt.create({
      data: {
        expectedDate,
        entityId: pick(allEntities).id,
        invoiceNumber,
        clientName: pick(clientNames),
        siteAddress: addr,
        department,
        amountTtc: Math.abs(amount),
        type,
        ceeDelegataire: type === ReceiptType.CEE ? pick(ceeDelegataires) : null,
        status,
        filingDate,
        receivedDate,
        delayDays,
        observations: i % 5 === 0 ? pick([
          'Relance effectuée le 15/03/2026',
          'Client contacté par téléphone',
          'Dossier CEE en cours de traitement',
          'Paiement attendu sous 15 jours',
          'Chèque reçu, en attente d\'encaissement',
          'Virement reçu partiellement',
          'Litige qualité en cours',
          'Accord de paiement échelonné',
        ]) : null,
        createdBy: pick([comptableUser.id, advUser.id, adminUser.id]),
      },
    });
    receiptIds.push(receipt.id);
  }
  console.log(`${receiptIds.length} encaissements créés.\n`);

  // ─── Disbursements ──────────────────────────────────────────────────────

  console.log('Création des décaissements...');

  const suppliers = [
    'POINT P', 'CEDEO', 'WÜRTH France', 'REXEL', 'LEROY MERLIN PRO',
    'KILOUTOU', 'MANPOWER', 'AXA ASSURANCES', 'OVH', 'ENEDIS',
    'BRICO DEPOT', 'PROLIANS', 'SAINT-GOBAIN DISTRIBUTION', 'DAIKIN France',
    'ATLANTIC', 'GROHE', 'SCHNEIDER ELECTRIC', 'LEGRAND', 'VELUX France',
    'LAPEYRE PRO', 'SODEXO CHÈQUES', 'MALAKOFF HUMANIS', 'URSSAF',
    'IMPRIMERIE NATIONALE', 'EDF PRO', 'ORANGE BUSINESS', 'SFR BUSINESS',
    'BOUYGUES TELECOM PRO', 'TOTAL ENERGIES PRO', 'VINCI PARK',
    'LA POSTE', 'DOCUSIGN', 'MICROSOFT 365', 'SAGE',
  ];

  const siteRefs = [
    'CH-2026-001 Rénovation Dupont', 'CH-2026-002 ITE Montreuil', 'CH-2026-003 PAC Versailles',
    'CH-2026-004 Combles Saint-Denis', 'CH-2026-005 Salle de bain Nanterre',
    'CH-2026-006 Rénovation globale Pantin', 'CH-2026-007 Fenêtres Boulogne',
    'CH-2026-008 Chauffage Massy', 'CH-2026-009 VMC Argenteuil', null, null, null,
  ];

  for (let i = 0; i < 40; i++) {
    const priority = pickWeighted(
      [DisbursementPriority.IMMEDIAT, DisbursementPriority.SOUS_3J, DisbursementPriority.SOUS_15J, DisbursementPriority.SOUS_1_MOIS, DisbursementPriority.ATTENTE, DisbursementPriority.BLOQUE],
      [20, 25, 20, 15, 10, 10]
    );
    const status = pickWeighted(
      [DisbursementStatus.A_PAYER, DisbursementStatus.EN_ATTENTE_DG, DisbursementStatus.VALIDE_DG, DisbursementStatus.PAYE, DisbursementStatus.ANNULE],
      [30, 15, 10, 35, 10]
    );
    const paymentMethod = pickWeighted(
      [PaymentMethod.VIREMENT, PaymentMethod.CB, PaymentMethod.LCR, PaymentMethod.CHEQUE, PaymentMethod.PRELEVEMENT],
      [60, 15, 10, 10, 5]
    );

    const amountTtc = randomBetween(500, 45000);
    const amountHt = Math.round((amountTtc / 1.2) * 100) / 100;

    const receivedDaysAgo = Math.floor(Math.random() * 75) + 2;
    const receivedDate = daysAgo(receivedDaysAgo);

    let paidDate: Date | null = null;
    let validatedBy: string | null = null;
    let paymentDueDate: Date | null = null;

    if (status === DisbursementStatus.PAYE) {
      const payDelay = Math.floor(Math.random() * 20) + 1;
      paidDate = daysAgo(receivedDaysAgo - payDelay);
      validatedBy = admin2.id;
    }
    if (status === DisbursementStatus.VALIDE_DG) {
      validatedBy = admin2.id;
    }

    // Payment due date based on priority
    if (priority === DisbursementPriority.IMMEDIAT) {
      paymentDueDate = daysAgo(receivedDaysAgo - 1);
    } else if (priority === DisbursementPriority.SOUS_3J) {
      paymentDueDate = daysAgo(receivedDaysAgo - 3);
    } else if (priority === DisbursementPriority.SOUS_15J) {
      paymentDueDate = daysAgo(receivedDaysAgo - 15);
    } else if (priority === DisbursementPriority.SOUS_1_MOIS) {
      paymentDueDate = daysAgo(receivedDaysAgo - 30);
    }

    const entityCode = pick(entityCodes);

    await prisma.disbursement.create({
      data: {
        receivedDate,
        entityId: entityByCode[entityCode].id,
        bankAccountId: bankAccounts[entityCode],
        supplier: pick(suppliers),
        siteRef: pick(siteRefs),
        amountHt,
        amountTtc,
        priority,
        paymentMethod,
        paymentDueDate,
        status,
        validatedBy,
        paidDate,
        observations: i % 7 === 0 ? pick([
          'Facture en double, vérifier',
          'Validation urgente demandée par le conducteur de travaux',
          'Attente bon de livraison',
          'Remise commerciale à appliquer',
          'Paiement fractionné accepté',
          'Retour matériel en cours',
        ]) : null,
        createdBy: pick([comptableUser.id, adminUser.id, advUser.id]),
      },
    });
  }
  console.log('40 décaissements créés.\n');

  // ─── Invoices ───────────────────────────────────────────────────────────

  console.log('Création des factures...');

  const invoiceIds: string[] = [];

  for (let i = 0; i < 28; i++) {
    const status = pickWeighted(
      [InvoiceStatus.EMISE, InvoiceStatus.ENVOYEE, InvoiceStatus.RELANCEE, InvoiceStatus.PAYEE, InvoiceStatus.IMPAYEE],
      [15, 25, 15, 30, 15]
    );

    const amountTtc = randomBetween(3000, 85000);
    const amountHt = Math.round((amountTtc / 1.2) * 100) / 100;
    const hasCee = Math.random() < 0.3;
    const amountCee = hasCee ? randomBetween(2000, 15000) : null;
    const ceeDelegataire = hasCee ? pick(ceeDelegataires) : null;

    const issueDaysAgo = Math.floor(Math.random() * 80) + 5;
    const issueDate = daysAgo(issueDaysAgo);
    const dueDate = daysAgo(issueDaysAgo - 30);

    let paidDate: Date | null = null;
    let paidAmount: number | null = null;
    let resteAPayer: number | null = null;

    if (status === InvoiceStatus.PAYEE) {
      const payDelay = Math.floor(Math.random() * 25) + 3;
      paidDate = daysAgo(issueDaysAgo - payDelay);
      paidAmount = amountTtc;
      resteAPayer = 0;
    } else if (status === InvoiceStatus.RELANCEE || status === InvoiceStatus.IMPAYEE) {
      // Some partial payments
      if (Math.random() < 0.4) {
        paidAmount = Math.round(amountTtc * randomBetween(0.2, 0.7) * 100) / 100;
        resteAPayer = Math.round((amountTtc - paidAmount) * 100) / 100;
      } else {
        resteAPayer = amountTtc;
      }
    } else {
      resteAPayer = amountTtc;
    }

    // Link some invoices to receipts
    const receiptId = i < receiptIds.length && Math.random() < 0.3 ? receiptIds[i] : null;

    const entityCode = pick(entityCodes);

    const invoice = await prisma.invoice.create({
      data: {
        entityId: entityByCode[entityCode].id,
        bankAccountId: bankAccounts[entityCode],
        invoiceNumber: `FAC-2026-${String(100 + i).padStart(4, '0')}`,
        clientName: pick(clientNames),
        siteRef: pick(siteRefs),
        amountHt,
        amountTtc,
        amountCee,
        ceeDelegataire,
        resteAPayer,
        issueDate,
        dueDate,
        paymentMethod: pickWeighted(
          [PaymentMethod.VIREMENT, PaymentMethod.CHEQUE, PaymentMethod.CB, PaymentMethod.PRELEVEMENT],
          [50, 25, 15, 10]
        ),
        status,
        paidDate,
        paidAmount,
        observations: i % 6 === 0 ? pick([
          'Relance n°2 envoyée',
          'Client en difficulté de paiement',
          'Paiement partiel reçu',
          'Dossier CEE transmis au délégataire',
          'Mise en demeure envoyée',
          'Accord amiable trouvé',
        ]) : null,
        receiptId,
        createdBy: pick([comptableUser.id, advUser.id, adminUser.id]),
      },
    });
    invoiceIds.push(invoice.id);
  }
  console.log(`${invoiceIds.length} factures créées.\n`);

  // ─── Invoice Reminders ──────────────────────────────────────────────────

  console.log('Création des relances factures...');
  const relancedInvoices = invoiceIds.filter(() => Math.random() < 0.3);
  for (const invoiceId of relancedInvoices) {
    const reminderCount = Math.floor(Math.random() * 3) + 1;
    for (let r = 0; r < reminderCount; r++) {
      await prisma.invoiceReminder.create({
        data: {
          invoiceId,
          date: daysAgo(Math.floor(Math.random() * 30) + 1),
          note: pick([
            'Relance téléphonique - client promet paiement sous 8 jours',
            'Email de relance envoyé',
            'Courrier recommandé envoyé',
            'Relance n°2 - aucune réponse',
            'Contact avec le comptable du client',
            null,
          ]),
          createdBy: pick([comptableUser.id, advUser.id]),
        },
      });
    }
  }
  console.log(`Relances créées pour ${relancedInvoices.length} factures.\n`);

  // ─── Recurring Charges ──────────────────────────────────────────────────

  console.log('Création des charges récurrentes...');

  const recurringChargesData = [
    { entityCode: 'CTBG_GROUPE', label: 'Loyer bureaux Montreuil', category: ChargeCategory.LOYER, frequency: ChargeFrequency.MENSUEL, amount: 4500, day: 5 },
    { entityCode: 'CTBG_GROUPE', label: 'Salaires nets', category: ChargeCategory.SALAIRES, frequency: ChargeFrequency.MENSUEL, amount: 42000, day: 28 },
    { entityCode: 'CTBG_GROUPE', label: 'Charges sociales URSSAF', category: ChargeCategory.SALAIRES, frequency: ChargeFrequency.MENSUEL, amount: 28000, day: 15 },
    { entityCode: 'CTBG_PREMIUM', label: 'RC Pro décennale AXA', category: ChargeCategory.ASSURANCE, frequency: ChargeFrequency.MENSUEL, amount: 3200, day: 1 },
    { entityCode: 'CTBG_PREMIUM', label: 'Multirisque bureaux', category: ChargeCategory.ASSURANCE, frequency: ChargeFrequency.ANNUEL, amount: 1800, day: 15 },
    { entityCode: 'CTBG_PREMIUM', label: 'Leasing Renault Master x3', category: ChargeCategory.CREDIT, frequency: ChargeFrequency.MENSUEL, amount: 2400, day: 5 },
    { entityCode: 'CTBG_PREMIUM', label: 'Salaires nets équipe', category: ChargeCategory.SALAIRES, frequency: ChargeFrequency.MENSUEL, amount: 35000, day: 28 },
    { entityCode: 'CTBG_EP', label: 'Loyer entrepôt Pantin', category: ChargeCategory.LOYER, frequency: ChargeFrequency.MENSUEL, amount: 3200, day: 5 },
    { entityCode: 'CTBG_EP', label: 'Assurance flotte véhicules', category: ChargeCategory.ASSURANCE, frequency: ChargeFrequency.MENSUEL, amount: 1800, day: 1 },
    { entityCode: 'CTBG_HOME_RENOV', label: 'Loyer showroom Versailles', category: ChargeCategory.LOYER, frequency: ChargeFrequency.MENSUEL, amount: 5200, day: 1 },
    { entityCode: 'CTBG_HOME_RENOV', label: 'Salaires nets', category: ChargeCategory.SALAIRES, frequency: ChargeFrequency.MENSUEL, amount: 18000, day: 28 },
    { entityCode: 'CVH', label: 'Leasing Citroën Berlingo x2', category: ChargeCategory.CREDIT, frequency: ChargeFrequency.MENSUEL, amount: 980, day: 10 },
    { entityCode: 'DOMOS_ENERGIE', label: 'RC Pro décennale MAAF', category: ChargeCategory.ASSURANCE, frequency: ChargeFrequency.MENSUEL, amount: 2100, day: 1 },
    { entityCode: 'DOMOS_ENERGIE', label: 'Salaires nets', category: ChargeCategory.SALAIRES, frequency: ChargeFrequency.MENSUEL, amount: 15000, day: 28 },
    { entityCode: 'CTBG_GROUPE', label: 'OVH Hébergement serveurs', category: ChargeCategory.ABONNEMENT, frequency: ChargeFrequency.MENSUEL, amount: 89.99, day: 1, variable: true },
    { entityCode: 'CTBG_GROUPE', label: 'Logiciel Pixel (gestion chantier)', category: ChargeCategory.ABONNEMENT, frequency: ChargeFrequency.MENSUEL, amount: 299, day: 1 },
    { entityCode: 'CTBG_GROUPE', label: 'Microsoft 365 Business', category: ChargeCategory.ABONNEMENT, frequency: ChargeFrequency.MENSUEL, amount: 450, day: 15 },
    { entityCode: 'CTBG_GROUPE', label: 'CFE Montreuil', category: ChargeCategory.IMPOT, frequency: ChargeFrequency.ANNUEL, amount: 3200, day: 15 },
    { entityCode: 'CTBG_PREMIUM', label: 'TVA acompte', category: ChargeCategory.IMPOT, frequency: ChargeFrequency.TRIMESTRIEL, amount: 12000, day: 20 },
    { entityCode: 'CTBG_GROUPE', label: 'Téléphonie Orange Business', category: ChargeCategory.ABONNEMENT, frequency: ChargeFrequency.MENSUEL, amount: 320, day: 10, variable: true },
    { entityCode: 'CTBG_GROUPE', label: 'Crédit BNP - Trésorerie', category: ChargeCategory.CREDIT, frequency: ChargeFrequency.MENSUEL, amount: 5800, day: 5 },
    { entityCode: 'CTBG_EP', label: 'Charges sociales', category: ChargeCategory.SALAIRES, frequency: ChargeFrequency.MENSUEL, amount: 12000, day: 15 },
    { entityCode: 'DOMOS_ENERGIE', label: 'Abonnement EDF Pro', category: ChargeCategory.ABONNEMENT, frequency: ChargeFrequency.MENSUEL, amount: 185, day: 8, variable: true },
  ];

  for (const charge of recurringChargesData) {
    await prisma.recurringCharge.create({
      data: {
        entityId: entityByCode[charge.entityCode].id,
        label: charge.label,
        category: charge.category,
        frequency: charge.frequency,
        amountTtc: charge.amount,
        variableAmount: (charge as any).variable || false,
        dayOfMonth: charge.day,
        startDate: daysAgo(365),
        active: true,
        createdBy: pick([adminUser.id, comptableUser.id]),
      },
    });
  }
  console.log(`${recurringChargesData.length} charges récurrentes créées.\n`);

  // ─── Invoice Payments ───────────────────────────────────────────────────

  console.log('Création des paiements de factures...');

  let paymentCount = 0;
  for (let i = 0; i < 18; i++) {
    const invoiceId = invoiceIds[i % invoiceIds.length];
    const receiptId = i < receiptIds.length ? receiptIds[i] : null;

    const source = pickWeighted(
      [InvoicePaymentSource.CLIENT, InvoicePaymentSource.CEE, InvoicePaymentSource.ANAH, InvoicePaymentSource.MPR],
      [50, 25, 10, 15]
    );

    const amount = randomBetween(1500, 35000);
    const payDaysAgo = Math.floor(Math.random() * 60) + 1;

    const payerNames: Record<string, string[]> = {
      CLIENT: clientNames.slice(0, 10),
      CEE: ceeDelegataires,
      ANAH: ['ANAH - Agence Nationale de l\'Habitat'],
      MPR: ['Ma Prime Rénov\' - ANAH'],
    };

    await prisma.invoicePayment.create({
      data: {
        invoiceId,
        receiptId,
        amount,
        date: daysAgo(payDaysAgo),
        source,
        payer: pick(payerNames[source]),
        reference: `VIR-${String(2026000 + i)}`,
        observations: i % 4 === 0 ? pick([
          'Paiement partiel - solde attendu',
          'Virement reçu conforme',
          'Prime CEE versée',
          'Acompte reçu',
        ]) : null,
        createdBy: pick([comptableUser.id, adminUser.id]),
      },
    });
    paymentCount++;
  }
  console.log(`${paymentCount} paiements créés.\n`);

  // ─── Card Transactions ──────────────────────────────────────────────────

  console.log('Création des transactions CB...');

  const cardTransactions = [
    { label: 'STATION TOTAL MONTREUIL', amount: 85.40, card: '4521', daysAgo: 1 },
    { label: 'LEROY MERLIN PRO VILLIERS', amount: 342.80, card: '4521', daysAgo: 2 },
    { label: 'AMAZON BUSINESS EU', amount: 129.99, card: '7833', daysAgo: 3 },
    { label: 'DARTY PRO', amount: 599.00, card: '7833', daysAgo: 4 },
    { label: 'PÉAGE SANEF A1', amount: 12.60, card: '4521', daysAgo: 5 },
    { label: 'STATION TOTAL ROISSY', amount: 92.15, card: '4521', daysAgo: 7 },
    { label: 'NOVOTEL PARIS EST', amount: 145.00, card: '7833', daysAgo: 8 },
    { label: 'BRICO DEPOT MONTREUIL', amount: 267.45, card: '4521', daysAgo: 10 },
    { label: 'RESTAURANT LE CENTRAL', amount: 78.50, card: '7833', daysAgo: 12 },
    { label: 'FNAC PRO', amount: 449.00, card: '7833', daysAgo: 14 },
    { label: 'STATION TOTAL PANTIN', amount: 73.90, card: '4521', daysAgo: 16 },
    { label: 'KILOUTOU LOCATION', amount: 185.00, card: '4521', daysAgo: 18 },
    { label: 'IKEA BUSINESS', amount: 312.60, card: '7833', daysAgo: 22 },
  ];

  for (let i = 0; i < cardTransactions.length; i++) {
    const ct = cardTransactions[i];
    const entityCode = pick(['CTBG_PREMIUM', 'CTBG_GROUPE', 'CTBG_HOME_RENOV']);

    await prisma.cardTransaction.create({
      data: {
        transactionNumber: `CB-2026-${String(i + 1).padStart(5, '0')}`,
        transactionDate: daysAgo(ct.daysAgo),
        label: ct.label,
        amount: ct.amount,
        cardLast4: ct.card,
        entityId: entityByCode[entityCode].id,
        createdBy: pick([adminUser.id, comptableUser.id]),
      },
    });
  }
  console.log(`${cardTransactions.length} transactions CB créées.\n`);

  // ─── Notifications ──────────────────────────────────────────────────────

  console.log('Création des notifications...');

  const notifications = [
    { type: NotificationType.SOLDE_CRITIQUE, title: 'Solde critique - CVH', message: 'Le solde du compte CVH est passé sous le seuil critique (22 450 €). Action requise.', daysAgo: 1, userId: adminUser.id },
    { type: NotificationType.SOLDE_CRITIQUE, title: 'Solde en attention - DOMOS ENERGIE', message: 'Le solde DOMOS ENERGIE est à 28 100 €, proche du seuil critique.', daysAgo: 2, userId: adminUser.id },
    { type: NotificationType.FACTURE_URGENTE, title: 'Facture urgente - POINT P', message: 'La facture POINT P de 12 450 € est en priorité IMMEDIAT et nécessite un paiement aujourd\'hui.', daysAgo: 0, userId: comptableUser.id },
    { type: NotificationType.ENCAISSEMENT_RETARD, title: 'Retard encaissement - M. et Mme DUPONT', message: 'L\'encaissement de 45 000 € pour le chantier Dupont accuse un retard de 18 jours.', daysAgo: 1, userId: advUser.id },
    { type: NotificationType.VALIDATION_DG, title: 'Décaissement en attente de validation', message: '3 décaissements totalisant 23 500 € sont en attente de validation DG.', daysAgo: 0, userId: admin2.id },
    { type: NotificationType.PAIEMENT_EFFECTUE, title: 'Paiement CEDEO effectué', message: 'Le virement de 8 900 € à CEDEO a été effectué avec succès.', daysAgo: 1, userId: comptableUser.id, read: true },
    { type: NotificationType.POSITION_NON_SAISIE, title: 'Position non saisie - CTBG EP', message: 'Aucune position bancaire saisie pour CTBG EP depuis 3 jours.', daysAgo: 0, userId: comptableUser.id },
    { type: NotificationType.ENCAISSEMENT_RETARD, title: 'Retard CEE - EFFY', message: 'Le versement CEE de EFFY (7 800 €) pour le dossier Nguyen est en retard de 25 jours.', daysAgo: 3, userId: advUser.id },
    { type: NotificationType.SYSTEME, title: 'Import Excel terminé', message: 'L\'import des positions bancaires du 10/04/2026 a été traité avec succès (6 lignes importées).', daysAgo: 4, userId: adminUser.id, read: true },
    { type: NotificationType.FACTURE_URGENTE, title: 'Échéance LCR - REXEL', message: 'La LCR REXEL de 5 600 € arrive à échéance dans 2 jours.', daysAgo: 0, userId: comptableUser.id },
    { type: NotificationType.PAIEMENT_EFFECTUE, title: 'Encaissement reçu - SCI Les Tilleuls', message: 'Virement de 32 000 € reçu de SCI Les Tilleuls pour le chantier ITE.', daysAgo: 2, userId: advUser.id, read: true },
    { type: NotificationType.VALIDATION_DG, title: 'Décaissement validé par DG', message: 'Le décaissement WÜRTH de 4 200 € a été validé par Hocine.', daysAgo: 1, userId: comptableUser.id, read: true },
  ];

  for (const notif of notifications) {
    await prisma.notification.create({
      data: {
        userId: notif.userId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        read: (notif as any).read || false,
        createdAt: daysAgo(notif.daysAgo),
      },
    });
  }
  console.log(`${notifications.length} notifications créées.\n`);

  // ─── Audit Logs ─────────────────────────────────────────────────────────

  console.log('Création des logs d\'audit...');

  const auditLogs = [
    { action: 'CREATE', module: 'bank_positions', details: { entity: 'CTBG PREMIUM', balance: 155230.50 }, daysAgo: 0 },
    { action: 'CREATE', module: 'bank_positions', details: { entity: 'CTBG GROUPE', balance: 128450.00 }, daysAgo: 0 },
    { action: 'CREATE', module: 'receipts', details: { invoiceNumber: 'FAC-2026-0042', client: 'M. et Mme DUPONT', amount: 45000 }, daysAgo: 1 },
    { action: 'UPDATE', module: 'receipts', details: { invoiceNumber: 'FAC-2026-0015', status: 'ENCAISSE', previousStatus: 'ATTENDU' }, daysAgo: 1 },
    { action: 'CREATE', module: 'disbursements', details: { supplier: 'POINT P', amount: 12450, priority: 'IMMEDIAT' }, daysAgo: 1 },
    { action: 'UPDATE', module: 'disbursements', details: { supplier: 'CEDEO', status: 'PAYE', previousStatus: 'VALIDE_DG' }, daysAgo: 1 },
    { action: 'UPDATE', module: 'disbursements', details: { supplier: 'WÜRTH France', status: 'VALIDE_DG', validatedBy: 'Hocine' }, daysAgo: 2 },
    { action: 'CREATE', module: 'invoices', details: { invoiceNumber: 'FAC-2026-0100', client: 'SCI Les Tilleuls', amount: 32000 }, daysAgo: 2 },
    { action: 'UPDATE', module: 'invoices', details: { invoiceNumber: 'FAC-2026-0105', status: 'RELANCEE' }, daysAgo: 3 },
    { action: 'DELETE', module: 'receipts', details: { invoiceNumber: 'FAC-2026-0039', reason: 'Doublon' }, daysAgo: 3 },
    { action: 'CREATE', module: 'recurring_charges', details: { label: 'Loyer bureaux Montreuil', amount: 4500, entity: 'CTBG GROUPE' }, daysAgo: 5 },
    { action: 'UPDATE', module: 'bank_positions', details: { entity: 'CVH', alertLevel: 'CRITIQUE', balance: 22450 }, daysAgo: 5 },
    { action: 'CREATE', module: 'card_transactions', details: { label: 'LEROY MERLIN PRO', amount: 342.80 }, daysAgo: 2 },
    { action: 'CREATE', module: 'invoice_payments', details: { source: 'CEE', payer: 'EFFY', amount: 7800 }, daysAgo: 4 },
    { action: 'UPDATE', module: 'receipts', details: { invoiceNumber: 'FAC-2026-0008', status: 'EN_RETARD', delayDays: 18 }, daysAgo: 6 },
    { action: 'CREATE', module: 'disbursements', details: { supplier: 'KILOUTOU', amount: 2850, priority: 'SOUS_3J' }, daysAgo: 7 },
    { action: 'UPDATE', module: 'invoices', details: { invoiceNumber: 'FAC-2026-0112', status: 'PAYEE', paidAmount: 28500 }, daysAgo: 8 },
    { action: 'CREATE', module: 'bank_positions', details: { entity: 'DOMOS ENERGIE', balance: 28100, alertLevel: 'CRITIQUE' }, daysAgo: 10 },
    { action: 'UPDATE', module: 'disbursements', details: { supplier: 'MANPOWER', status: 'ANNULE', reason: 'Facture erronée' }, daysAgo: 12 },
    { action: 'CREATE', module: 'receipts', details: { invoiceNumber: 'FAC-2026-0035', client: 'Mme NGUYEN Thanh', type: 'CEE' }, daysAgo: 14 },
    { action: 'UPDATE', module: 'recurring_charges', details: { label: 'OVH Hébergement', newAmount: 94.99, previousAmount: 89.99 }, daysAgo: 15 },
    { action: 'CREATE', module: 'invoices', details: { invoiceNumber: 'FAC-2026-0120', client: 'M. GARCIA Antonio', amount: 18500 }, daysAgo: 18 },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({
      data: {
        userId: pick([adminUser.id, comptableUser.id, advUser.id, admin2.id]),
        action: log.action,
        module: log.module,
        details: log.details,
        createdAt: daysAgo(log.daysAgo),
      },
    });
  }
  console.log(`${auditLogs.length} logs d'audit créés.\n`);

  // ─── Notification Preferences ───────────────────────────────────────────

  console.log('Création des préférences de notification...');
  for (const user of allUsers) {
    await prisma.notificationPreference.create({
      data: {
        userId: user.id,
        emailActive: true,
        soldeCritique: true,
        factureUrgente: true,
        encaissementRetard: true,
        validationDg: user.role === Role.ADMIN,
        paiementEffectue: user.role === Role.ADMIN || user.role === Role.COMPTABLE,
        positionNonSaisie: user.role === Role.ADMIN || user.role === Role.COMPTABLE,
      },
    });
  }
  console.log(`${allUsers.length} préférences de notification créées.\n`);

  // ─── Summary ────────────────────────────────────────────────────────────

  console.log('=== Seed démo terminé avec succès ! ===');
  console.log(`
Résumé:
  - ${bankPositionCount} positions bancaires (60 jours, 6 entités)
  - ${receiptIds.length} encaissements
  - 40 décaissements
  - ${invoiceIds.length} factures
  - ${paymentCount} paiements de factures
  - ${cardTransactions.length} transactions CB
  - ${recurringChargesData.length} charges récurrentes
  - ${notifications.length} notifications
  - ${auditLogs.length} logs d'audit
  - ${allUsers.length} préférences de notification
  - ${bankAccountsData.length} comptes bancaires
  `);
}

main()
  .catch((e) => {
    console.error('Erreur lors du seed démo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
