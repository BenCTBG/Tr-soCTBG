import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccess } from '@/lib/access';

interface DailyProjection {
  date: string;
  balance: number;
  receipts: number;
  disbursements: number;
  charges: number;
}

interface EntityForecast {
  entityId: string;
  entityName: string;
  currentBalance: number;
  projectedBalance: number;
  daily: DailyProjection[];
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isDueOnDay(
  frequency: string,
  dayOfMonth: number | null,
  startDate: Date,
  checkDate: Date
): boolean {
  if (checkDate < startDate) return false;

  const day = dayOfMonth ?? startDate.getDate();

  switch (frequency) {
    case 'MENSUEL':
      return checkDate.getDate() === day;
    case 'HEBDOMADAIRE':
      return checkDate.getDay() === startDate.getDay();
    case 'TRIMESTRIEL': {
      if (checkDate.getDate() !== day) return false;
      const monthDiff =
        (checkDate.getFullYear() - startDate.getFullYear()) * 12 +
        (checkDate.getMonth() - startDate.getMonth());
      return monthDiff >= 0 && monthDiff % 3 === 0;
    }
    case 'ANNUEL': {
      return (
        checkDate.getDate() === day &&
        checkDate.getMonth() === startDate.getMonth()
      );
    }
    default:
      return false;
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
      { status: 401 }
    );
  }

  if (!checkAccess(session.user.role, 'DASHBOARD', 'READ')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Acces refuse' } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const entityIdFilter = searchParams.get('entity_id');
  const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '90', 10)));

  try {
    // Get entities
    const entities = entityIdFilter
      ? await prisma.entity.findMany({ where: { id: entityIdFilter } })
      : await prisma.entity.findMany();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    const entityForecasts: EntityForecast[] = [];

    for (const entity of entities) {
      // a. Latest bank position balance
      const latestPosition = await prisma.bankPosition.findFirst({
        where: { entityId: entity.id },
        orderBy: { date: 'desc' },
      });
      const currentBalance = latestPosition ? Number(latestPosition.balance) : 0;

      // b. Pending receipts in forecast window
      const pendingReceipts = await prisma.receipt.findMany({
        where: {
          entityId: entity.id,
          status: 'ATTENDU',
          expectedDate: { gte: today, lte: endDate },
        },
      });

      // c. Pending disbursements
      const pendingDisbursements = await prisma.disbursement.findMany({
        where: {
          entityId: entity.id,
          status: { in: ['A_PAYER', 'EN_ATTENTE_DG', 'VALIDE_DG'] },
          paymentDueDate: { gte: today, lte: endDate },
        },
      });

      // d. Active recurring charges (with fallback)
      let recurringCharges: {
        amountTtc: unknown;
        frequency: string;
        dayOfMonth: number | null;
        startDate: Date;
        endDate: Date | null;
      }[] = [];
      try {
        recurringCharges = await prisma.recurringCharge.findMany({
          where: {
            entityId: entity.id,
            active: true,
            startDate: { lte: endDate },
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
        });
      } catch {
        recurringCharges = [];
      }

      // e. Build daily projections
      const daily: DailyProjection[] = [];
      let runningBalance = currentBalance;

      for (let d = 0; d < days; d++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + d);
        const dateStr = formatDateISO(currentDate);

        // Receipts for this day
        const dayReceipts = pendingReceipts
          .filter((r) => formatDateISO(new Date(r.expectedDate)) === dateStr)
          .reduce((sum, r) => sum + Number(r.amountTtc), 0);

        // Disbursements for this day
        const dayDisbursements = pendingDisbursements
          .filter(
            (d) =>
              d.paymentDueDate && formatDateISO(new Date(d.paymentDueDate)) === dateStr
          )
          .reduce((sum, d) => sum + Number(d.amountTtc), 0);

        // Recurring charges for this day
        const dayCharges = recurringCharges
          .filter((c) => {
            if (c.endDate && currentDate > new Date(c.endDate)) return false;
            return isDueOnDay(
              c.frequency,
              c.dayOfMonth,
              new Date(c.startDate),
              currentDate
            );
          })
          .reduce((sum, c) => sum + Number(c.amountTtc), 0);

        runningBalance = runningBalance + dayReceipts - dayDisbursements - dayCharges;

        daily.push({
          date: dateStr,
          balance: Math.round(runningBalance * 100) / 100,
          receipts: Math.round(dayReceipts * 100) / 100,
          disbursements: Math.round(dayDisbursements * 100) / 100,
          charges: Math.round(dayCharges * 100) / 100,
        });
      }

      entityForecasts.push({
        entityId: entity.id,
        entityName: entity.name,
        currentBalance,
        projectedBalance: daily.length > 0 ? daily[daily.length - 1].balance : currentBalance,
        daily,
      });
    }

    // Build consolidated view
    const consolidatedDaily: DailyProjection[] = [];
    if (entityForecasts.length > 0) {
      for (let d = 0; d < days; d++) {
        const date = entityForecasts[0].daily[d]?.date || '';
        let balance = 0;
        let receipts = 0;
        let disbursements = 0;
        let charges = 0;

        for (const ef of entityForecasts) {
          if (ef.daily[d]) {
            balance += ef.daily[d].balance;
            receipts += ef.daily[d].receipts;
            disbursements += ef.daily[d].disbursements;
            charges += ef.daily[d].charges;
          }
        }

        consolidatedDaily.push({
          date,
          balance: Math.round(balance * 100) / 100,
          receipts: Math.round(receipts * 100) / 100,
          disbursements: Math.round(disbursements * 100) / 100,
          charges: Math.round(charges * 100) / 100,
        });
      }
    }

    const consolidatedCurrentBalance = entityForecasts.reduce(
      (sum, ef) => sum + ef.currentBalance,
      0
    );
    const consolidatedProjectedBalance = entityForecasts.reduce(
      (sum, ef) => sum + ef.projectedBalance,
      0
    );

    return Response.json({
      data: {
        entities: entityForecasts,
        consolidated: {
          currentBalance: consolidatedCurrentBalance,
          projectedBalance: consolidatedProjectedBalance,
          daily: consolidatedDaily,
        },
      },
    });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
