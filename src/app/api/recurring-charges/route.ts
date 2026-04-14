import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccess } from '@/lib/access';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
      { status: 401 }
    );
  }

  if (!checkAccess(session.user.role, 'RECURRING_CHARGES', 'READ')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entity_id');
  const category = searchParams.get('category');
  const frequency = searchParams.get('frequency');
  const active = searchParams.get('active');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

  try {
    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    if (category) where.category = category;
    if (frequency) where.frequency = frequency;
    if (active !== null && active !== undefined && active !== '') {
      where.active = active === 'true';
    }

    const [recurringCharges, total] = await Promise.all([
      prisma.recurringCharge.findMany({
        where,
        include: { entity: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.recurringCharge.count({ where }),
    ]);

    return Response.json({
      data: recurringCharges,
      meta: { total, page, limit },
    });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
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

  if (!checkAccess(session.user.role, 'RECURRING_CHARGES', 'CREATE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      entityId,
      label,
      category,
      frequency,
      amountTtc,
      dayOfMonth,
      startDate,
      endDate,
      active,
      observations,
    } = body;

    if (!entityId || !label || !category || !frequency || amountTtc == null || !startDate) {
      return Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'entityId, label, category, frequency, amountTtc et startDate sont requis',
          },
        },
        { status: 400 }
      );
    }

    const recurringCharge = await prisma.recurringCharge.create({
      data: {
        entityId,
        label,
        category,
        frequency,
        amountTtc,
        dayOfMonth: dayOfMonth ?? null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        active: active ?? true,
        observations: observations || null,
        createdBy: session.user.id,
      },
      include: { entity: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        module: 'RECURRING_CHARGES',
        details: { recurringChargeId: recurringCharge.id, label },
      },
    });

    return Response.json({ data: recurringCharge }, { status: 201 });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
