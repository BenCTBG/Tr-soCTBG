import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccess } from '@/lib/access';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
      { status: 401 }
    );
  }

  if (!checkAccess(session.user.role, 'DASHBOARD', 'READ')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    // Get all entities
    const entities = await prisma.entity.findMany();

    // Get latest bank position for each entity
    const latestPositions = await Promise.all(
      entities.map(async (entity) => {
        const position = await prisma.bankPosition.findFirst({
          where: { entityId: entity.id },
          orderBy: { date: 'desc' },
        });
        return {
          entityId: entity.id,
          entityName: entity.name,
          balance: position ? Number(position.balance) : 0,
          alertLevel: position?.alertLevel || 'NORMAL',
          hasPosition: !!position,
        };
      })
    );

    // Total treasury: sum of latest balances
    const totalTreasury = latestPositions.reduce(
      (sum, p) => sum + p.balance,
      0
    );

    // Entities in alert
    const entitiesInAlert = latestPositions.filter(
      (p) => p.alertLevel !== 'NORMAL'
    ).length;

    // Urgent invoices: disbursements with IMMEDIAT priority and A_PAYER status
    const urgentInvoices = await prisma.disbursement.count({
      where: {
        priority: 'IMMEDIAT',
        status: 'A_PAYER',
      },
    });

    // Expected receipts within next 7 days
    const expectedReceiptsAgg = await prisma.receipt.aggregate({
      where: {
        status: 'ATTENDU',
        expectedDate: {
          gte: today,
          lte: in7Days,
        },
      },
      _sum: { amountTtc: true },
    });
    const expectedReceipts = Number(expectedReceiptsAgg._sum.amountTtc || 0);

    // ===== 3 NOTIONS DISTINCTES =====
    // CA = somme factures clients globales (CEE inclus)
    // À encaisser = reste à charge client (sans CEE) + appels CEE créés non payés
    // Encaissé = somme paiements reçus
    const allReceipts = await prisma.receipt.findMany({
      include: { payments: true, invoice: true },
    });

    let chiffreAffaires = 0;
    let aEncaisser = 0;
    let encaisse = 0;

    for (const r of allReceipts) {
      const ttc = Number(r.amountTtc);
      const cee = Number(r.amountCee || 0);
      const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
      chiffreAffaires += ttc;
      encaisse += paid;
      // Si part CEE mais pas d'appel créé, on l'exclut du "à encaisser"
      const base = (cee > 0 && !r.invoice) ? ttc - cee : ttc;
      const rest = Math.max(0, base - paid);
      aEncaisser += rest;
    }

    // Appels CEE (Invoice) non liés à un Receipt : ajouter leur montant restant
    const orphanInvoices = await prisma.invoice.findMany({
      where: { receiptId: null, status: { not: 'PAYEE' } },
      include: { payments: true },
    });
    for (const inv of orphanInvoices) {
      const ttc = Number(inv.amountTtc);
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      aEncaisser += Math.max(0, ttc - paid);
      encaisse += paid;
      chiffreAffaires += ttc;
    }

    // Entity balances
    const entityBalances = latestPositions.map((p) => ({
      entityName: p.entityName,
      balance: p.balance,
      alertLevel: p.alertLevel,
    }));

    // Alerts
    const alerts: Array<{ type: string; message: string; severity: string; data?: unknown }> = [];

    // Urgent unpaid disbursements
    const urgentUnpaid = await prisma.disbursement.findMany({
      where: {
        priority: 'IMMEDIAT',
        status: 'A_PAYER',
      },
      include: { entity: true },
      take: 10,
    });
    for (const d of urgentUnpaid) {
      alerts.push({
        type: 'URGENT_UNPAID',
        message: `Décaissement urgent impayé: ${d.supplier} (${d.entity.name}) - ${Number(d.amountTtc).toLocaleString('fr-FR')} EUR`,
        severity: 'HIGH',
        data: { disbursementId: d.id, supplier: d.supplier, amount: Number(d.amountTtc) },
      });
    }

    // Overdue receipts
    const overdueReceipts = await prisma.receipt.findMany({
      where: {
        status: 'ATTENDU',
        expectedDate: { lt: today },
      },
      include: { entity: true },
      take: 10,
    });
    for (const r of overdueReceipts) {
      alerts.push({
        type: 'OVERDUE_RECEIPT',
        message: `Encaissement en retard: ${r.clientName} (${r.entity.name}) - ${Number(r.amountTtc).toLocaleString('fr-FR')} EUR`,
        severity: 'MEDIUM',
        data: { receiptId: r.id, clientName: r.clientName, amount: Number(r.amountTtc) },
      });
    }

    // Missing position today
    const todayPositionEntityIds = (
      await prisma.bankPosition.findMany({
        where: { date: today },
        select: { entityId: true },
      })
    ).map((p) => p.entityId);

    for (const entity of entities) {
      if (!todayPositionEntityIds.includes(entity.id)) {
        alerts.push({
          type: 'MISSING_POSITION',
          message: `Position bancaire manquante aujourd'hui: ${entity.name}`,
          severity: 'LOW',
          data: { entityId: entity.id, entityName: entity.name },
        });
      }
    }

    return Response.json({
      data: {
        totalTreasury,
        entitiesInAlert,
        urgentInvoices,
        expectedReceipts,
        chiffreAffaires,
        aEncaisser,
        encaisse,
        entityBalances,
        alerts,
      },
    });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
