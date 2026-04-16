import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Acces reserve aux administrateurs' } },
      { status: 403 }
    );
  }

  try {
    // Get entities and users
    const entities = await prisma.entity.findMany();
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    if (!adminUser || entities.length === 0) {
      return Response.json(
        { error: { code: 'MISSING_DATA', message: 'Entites ou utilisateurs manquants. Executez le seed de base.' } },
        { status: 400 }
      );
    }

    const userId = adminUser.id;
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Create bank accounts for each entity
    const bankNames = ['BNP Paribas', 'Societe Generale', 'Credit Agricole', 'LCL', 'CIC', 'Banque Populaire'];
    const bankAccounts: { id: string; entityId: string }[] = [];

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const existing = await prisma.bankAccount.findFirst({ where: { entityId: entity.id } });
      if (!existing) {
        const account = await prisma.bankAccount.create({
          data: {
            entityId: entity.id,
            bankName: bankNames[i % bankNames.length],
            accountNumber: `FR76 ${String(30000 + i * 1111).padStart(5, '0')} ${String(10000 + i * 100).padStart(5, '0')} 000${i}`,
            iban: `FR76${String(30000 + i * 1111).padStart(5, '0')}${String(10000 + i * 100).padStart(5, '0')}000${i}`,
            label: `Compte principal`,
            active: true,
          },
        });
        bankAccounts.push({ id: account.id, entityId: entity.id });
      } else {
        bankAccounts.push({ id: existing.id, entityId: entity.id });
      }
    }

    // Bank positions for last 14 days
    const balances = [185000, 92000, 45000, 128000, 67000, 210000];
    for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
      const date = new Date(todayDate);
      date.setDate(date.getDate() - dayOffset);

      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const account = bankAccounts.find((a) => a.entityId === entity.id);
        const variation = (Math.random() - 0.4) * 15000;
        const balance = balances[i] + variation * (14 - dayOffset) / 14;
        const previousBalance = balance - variation;

        const existing = await prisma.bankPosition.findFirst({
          where: { entityId: entity.id, date },
        });
        if (existing) continue;

        let alertLevel: 'NORMAL' | 'ATTENTION' | 'CRITIQUE' | 'NEGATIF' = 'NORMAL';
        if (balance < 0) alertLevel = 'NEGATIF';
        else if (balance < 20000) alertLevel = 'CRITIQUE';
        else if (balance < 50000) alertLevel = 'ATTENTION';

        await prisma.bankPosition.create({
          data: {
            date,
            entityId: entity.id,
            bankAccountId: account?.id || null,
            balance,
            previousBalance,
            variation,
            alertLevel,
            createdBy: userId,
          },
        });
      }
    }

    // Receipts (encaissements)
    const clients = [
      'Dupont Renovation', 'Martin Habitat', 'SCI Les Tilleuls', 'SARL Eco Confort',
      'M. Bernard Laurent', 'Mme Claire Fontaine', 'SA Batiment Plus', 'Residence Le Parc',
      'SCI Soleil', 'Copropriete Haussmann', 'M. Jean Moreau', 'Mme Sophie Legrand',
      'EURL Habitat Vert', 'SAS Renov Express', 'M. Pierre Dubois',
    ];

    const receiptTypes: ('CLIENT_DIRECT' | 'CEE' | 'MPR')[] = ['CLIENT_DIRECT', 'CEE', 'MPR'];
    const ceeDelegataires = ['EDF', 'ENGIE', 'TotalEnergies', 'Auchan Energies'];

    for (let i = 0; i < 25; i++) {
      const entityIdx = i % entities.length;
      const entity = entities[entityIdx];
      const daysOffset = Math.floor(Math.random() * 30) - 15;
      const expectedDate = new Date(todayDate);
      expectedDate.setDate(expectedDate.getDate() + daysOffset);
      const amount = Math.round((Math.random() * 25000 + 2000) * 100) / 100;
      const type = receiptTypes[i % 3];
      const status = daysOffset < -3 ? 'EN_RETARD' : daysOffset < 0 ? 'ATTENDU' : i % 5 === 0 ? 'ENCAISSE' : 'ATTENDU';

      await prisma.receipt.create({
        data: {
          expectedDate,
          entityId: entity.id,
          invoiceNumber: `FAC-${String(2026000 + i).padStart(7, '0')}`,
          clientName: clients[i % clients.length],
          siteAddress: `${10 + i} rue de la ${['Paix', 'Liberte', 'Republique', 'Nation', 'Victoire'][i % 5]}, ${['75001', '92100', '69001', '13001', '31000'][i % 5]}`,
          department: ['75', '92', '69', '13', '31'][i % 5],
          amountTtc: amount,
          type,
          ceeDelegataire: type === 'CEE' ? ceeDelegataires[i % ceeDelegataires.length] : null,
          status: status as 'ATTENDU' | 'ENCAISSE' | 'EN_RETARD' | 'ANNULE',
          receivedDate: status === 'ENCAISSE' ? todayDate : null,
          createdBy: userId,
        },
      });
    }

    // Disbursements (decaissements)
    const suppliers = [
      'Placo France', 'Saint-Gobain', 'Cedeo', 'Point P', 'Rexel',
      'Legrand SA', 'Daikin France', 'Atlantic', 'Velux', 'Knauf',
      'EDF Pro', 'Orange Business', 'AXA Assurances', 'Allianz',
    ];

    const priorities: ('IMMEDIAT' | 'SOUS_3J' | 'SOUS_15J' | 'SOUS_1_MOIS' | 'ATTENTE')[] = [
      'IMMEDIAT', 'SOUS_3J', 'SOUS_15J', 'SOUS_1_MOIS', 'ATTENTE',
    ];
    const statuses: ('A_PAYER' | 'EN_ATTENTE_DG' | 'VALIDE_DG' | 'PAYE')[] = [
      'A_PAYER', 'EN_ATTENTE_DG', 'VALIDE_DG', 'PAYE',
    ];

    for (let i = 0; i < 20; i++) {
      const entityIdx = i % entities.length;
      const entity = entities[entityIdx];
      const account = bankAccounts.find((a) => a.entityId === entity.id);
      const daysOffset = Math.floor(Math.random() * 20) - 10;
      const receivedDate = new Date(todayDate);
      receivedDate.setDate(receivedDate.getDate() + daysOffset);
      const amountTtc = Math.round((Math.random() * 18000 + 500) * 100) / 100;
      const amountHt = Math.round(amountTtc / 1.2 * 100) / 100;

      await prisma.disbursement.create({
        data: {
          receivedDate,
          entityId: entity.id,
          bankAccountId: account?.id || null,
          supplier: suppliers[i % suppliers.length],
          siteRef: i % 3 === 0 ? `CHANTIER-${String(100 + i).padStart(3, '0')}` : null,
          amountHt,
          amountTtc,
          priority: priorities[i % priorities.length],
          paymentMethod: ['VIREMENT', 'CB', 'CHEQUE', 'PRELEVEMENT'][i % 4] as 'VIREMENT' | 'CB' | 'CHEQUE' | 'PRELEVEMENT',
          paymentDueDate: new Date(receivedDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          status: statuses[i % statuses.length],
          paidDate: statuses[i % statuses.length] === 'PAYE' ? todayDate : null,
          observations: i % 4 === 0 ? 'Facture validee par le service technique' : null,
          createdBy: userId,
        },
      });
    }

    // Recurring charges
    const charges: { label: string; category: 'LOYER' | 'SALAIRES' | 'ASSURANCE' | 'ABONNEMENT' | 'CREDIT' | 'IMPOT' | 'AUTRE'; amount: number; frequency: 'MENSUEL' | 'TRIMESTRIEL' | 'ANNUEL' }[] = [
      { label: 'Loyer bureaux Paris', category: 'LOYER', amount: 4500, frequency: 'MENSUEL' },
      { label: 'Loyer entrepot Ivry', category: 'LOYER', amount: 2800, frequency: 'MENSUEL' },
      { label: 'Assurance RC Pro', category: 'ASSURANCE', amount: 3200, frequency: 'TRIMESTRIEL' },
      { label: 'Assurance vehicules', category: 'ASSURANCE', amount: 1800, frequency: 'MENSUEL' },
      { label: 'Abonnement ERP', category: 'ABONNEMENT', amount: 890, frequency: 'MENSUEL' },
      { label: 'Telephonie mobile', category: 'ABONNEMENT', amount: 450, frequency: 'MENSUEL' },
      { label: 'Credit vehicule utilitaire', category: 'CREDIT', amount: 650, frequency: 'MENSUEL' },
      { label: 'CFE', category: 'IMPOT', amount: 5600, frequency: 'ANNUEL' },
    ];

    for (let i = 0; i < charges.length; i++) {
      const charge = charges[i];
      const entityIdx = i % Math.min(entities.length, 3);
      await prisma.recurringCharge.create({
        data: {
          entityId: entities[entityIdx].id,
          label: charge.label,
          category: charge.category,
          frequency: charge.frequency,
          amountTtc: charge.amount,
          variableAmount: charge.category === 'ABONNEMENT',
          dayOfMonth: [1, 5, 10, 15][i % 4],
          startDate: new Date(2025, 0, 1),
          active: true,
          createdBy: userId,
        },
      });
    }

    // Invoices (CEE)
    for (let i = 0; i < 15; i++) {
      const entityIdx = i % entities.length;
      const entity = entities[entityIdx];
      const account = bankAccounts.find((a) => a.entityId === entity.id);
      const daysOffset = Math.floor(Math.random() * 60) - 30;
      const issueDate = new Date(todayDate);
      issueDate.setDate(issueDate.getDate() + daysOffset);
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 30);
      const amountTtc = Math.round((Math.random() * 15000 + 3000) * 100) / 100;
      const amountHt = Math.round(amountTtc / 1.2 * 100) / 100;
      const amountCee = Math.round(amountTtc * 0.3 * 100) / 100;
      const invoiceStatuses: ('EMISE' | 'ENVOYEE' | 'RELANCEE' | 'PAYEE' | 'IMPAYEE')[] = ['EMISE', 'ENVOYEE', 'RELANCEE', 'PAYEE', 'IMPAYEE'];
      const status = invoiceStatuses[i % invoiceStatuses.length];
      const paidAmount = status === 'PAYEE' ? amountTtc : status === 'RELANCEE' ? Math.round(amountTtc * 0.5 * 100) / 100 : null;

      await prisma.invoice.create({
        data: {
          entityId: entity.id,
          bankAccountId: account?.id || null,
          invoiceNumber: `CEE-${String(2026000 + i).padStart(7, '0')}`,
          clientName: clients[i % clients.length],
          siteRef: `SITE-${String(200 + i).padStart(3, '0')}`,
          amountHt,
          amountTtc,
          amountCee,
          ceeDelegataire: ceeDelegataires[i % ceeDelegataires.length],
          resteAPayer: paidAmount ? amountTtc - paidAmount : amountTtc,
          issueDate,
          dueDate,
          status,
          paidDate: status === 'PAYEE' ? todayDate : null,
          paidAmount: paidAmount ? paidAmount : null,
          createdBy: userId,
        },
      });
    }

    // Notifications
    const notifTypes: ('SOLDE_CRITIQUE' | 'FACTURE_URGENTE' | 'ENCAISSEMENT_RETARD' | 'VALIDATION_DG' | 'PAIEMENT_EFFECTUE' | 'POSITION_NON_SAISIE')[] = [
      'SOLDE_CRITIQUE', 'FACTURE_URGENTE', 'ENCAISSEMENT_RETARD',
      'VALIDATION_DG', 'PAIEMENT_EFFECTUE', 'POSITION_NON_SAISIE',
    ];
    const notifMessages = [
      { title: 'Solde critique', message: 'Le solde de CTBG EP est passe sous le seuil critique (45 000 EUR)', type: 'SOLDE_CRITIQUE' as const },
      { title: 'Facture urgente', message: 'Facture Placo France de 8 500 EUR en priorite IMMEDIAT', type: 'FACTURE_URGENTE' as const },
      { title: 'Encaissement en retard', message: 'Encaissement Martin Habitat de 12 300 EUR en retard de 5 jours', type: 'ENCAISSEMENT_RETARD' as const },
      { title: 'Validation requise', message: '3 factures en attente de validation DG pour un total de 25 600 EUR', type: 'VALIDATION_DG' as const },
      { title: 'Paiement effectue', message: 'Virement de 15 200 EUR effectue vers Saint-Gobain', type: 'PAIEMENT_EFFECTUE' as const },
      { title: 'Position non saisie', message: 'Les soldes bancaires de CVH n\'ont pas ete saisis aujourd\'hui', type: 'POSITION_NON_SAISIE' as const },
    ];

    for (const notif of notifMessages) {
      await prisma.notification.create({
        data: {
          userId,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          read: false,
          link: '/dashboard',
        },
      });
    }

    return Response.json({
      data: {
        success: true,
        message: 'Donnees de demonstration creees avec succes',
        counts: {
          bankPositions: entities.length * 14,
          receipts: 25,
          disbursements: 20,
          recurringCharges: charges.length,
          invoices: 15,
          notifications: notifMessages.length,
        },
      },
    });
  } catch (error) {
    console.error('Demo seed error:', error);
    return Response.json(
      { error: { code: 'SEED_ERROR', message: 'Erreur lors de la creation des donnees de demo', details: String(error) } },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Acces reserve aux administrateurs' } },
      { status: 403 }
    );
  }

  try {
    // Delete in correct order to respect foreign keys
    await prisma.invoiceReminder.deleteMany({});
    await prisma.invoicePayment.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.cardTransaction.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.recurringCharge.deleteMany({});
    await prisma.disbursement.deleteMany({});
    await prisma.receipt.deleteMany({});
    await prisma.bankPosition.deleteMany({});

    return Response.json({
      data: { success: true, message: 'Donnees de demonstration supprimees' },
    });
  } catch (error) {
    console.error('Demo reset error:', error);
    return Response.json(
      { error: { code: 'RESET_ERROR', message: 'Erreur lors de la reinitialisation', details: String(error) } },
      { status: 500 }
    );
  }
}
