import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccess } from '@/lib/access';
import { AlertLevel } from '@/generated/prisma/enums';

function computeAlertLevel(balance: number): AlertLevel {
  if (balance >= 50000) return AlertLevel.NORMAL;
  if (balance >= 30000) return AlertLevel.ATTENTION;
  if (balance >= 0) return AlertLevel.CRITIQUE;
  return AlertLevel.NEGATIF;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
      { status: 401 }
    );
  }

  if (!checkAccess(session.user.role, 'BANK_POSITION', 'READ')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entity_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

  try {
    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [positions, total] = await Promise.all([
      prisma.bankPosition.findMany({
        where,
        include: { entity: true, user: true, bankAccount: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bankPosition.count({ where }),
    ]);

    return Response.json({
      data: positions,
      meta: { total, page, limit },
    });
  } catch (err) {
    console.error('GET /api/bank-positions error:', err);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: String(err) } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
      { status: 401 }
    );
  }

  if (!checkAccess(session.user.role, 'BANK_POSITION', 'CREATE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { date, positions } = body as {
      date: string;
      positions: { entityId: string; balance: number; bankAccountId?: string }[];
    };

    if (!date || !positions || !Array.isArray(positions) || positions.length === 0) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'date et positions sont requis' } },
        { status: 400 }
      );
    }

    const positionDate = new Date(date);
    const results = [];

    for (const pos of positions) {
      // Find previous balance (most recent before this date) for this specific bank account
      const previousWhere: Record<string, unknown> = {
        entityId: pos.entityId,
        date: { lt: positionDate },
      };
      if (pos.bankAccountId) previousWhere.bankAccountId = pos.bankAccountId;

      const previous = await prisma.bankPosition.findFirst({
        where: previousWhere,
        orderBy: { date: 'desc' },
      });

      const previousBalance = previous ? Number(previous.balance) : 0;
      const variation = pos.balance - previousBalance;
      const alertLevel = computeAlertLevel(pos.balance);

      const bankAccountId = pos.bankAccountId || null;

      // Chercher si une position existe déjà pour ce jour/entité/compte
      const existing = await prisma.bankPosition.findFirst({
        where: {
          date: positionDate,
          entityId: pos.entityId,
          bankAccountId: bankAccountId,
        },
      });

      let result;
      if (existing) {
        result = await prisma.bankPosition.update({
          where: { id: existing.id },
          data: {
            balance: pos.balance,
            previousBalance,
            variation,
            alertLevel,
            createdBy: session.user.id,
          },
        });
      } else {
        result = await prisma.bankPosition.create({
          data: {
            date: positionDate,
            entityId: pos.entityId,
            bankAccountId,
            balance: pos.balance,
            previousBalance,
            variation,
            alertLevel,
            createdBy: session.user.id,
          },
        });
      }

      results.push(result);
    }

    // Audit log (non bloquant)
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE',
          module: 'BANK_POSITION',
          details: { date, count: positions.length },
        },
      });
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    return Response.json({ data: results }, { status: 201 });
  } catch (err) {
    console.error('POST /api/bank-positions error:', err);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: String(err) } },
      { status: 500 }
    );
  }
}
