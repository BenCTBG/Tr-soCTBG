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

  if (!checkAccess(session.user.role, 'DISBURSEMENTS', 'READ')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entity_id');
  const priority = searchParams.get('priority');
  const status = searchParams.get('status');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

  try {
    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.receivedDate = {};
      if (dateFrom) (where.receivedDate as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.receivedDate as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [disbursements, total] = await Promise.all([
      prisma.disbursement.findMany({
        where,
        include: { entity: true, bankAccount: true },
        orderBy: { receivedDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.disbursement.count({ where }),
    ]);

    return Response.json({
      data: disbursements,
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

  if (!checkAccess(session.user.role, 'DISBURSEMENTS', 'CREATE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      receivedDate,
      entityId,
      bankAccountId,
      supplier,
      amountTtc,
      priority,
      siteRef,
      amountHt,
      paymentDueDate,
      paymentMethod,
      observations,
      status,
      fileUrl,
    } = body;

    if (!receivedDate || !entityId || !supplier || amountTtc == null || !priority) {
      return Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'receivedDate, entityId, supplier, amountTtc et priority sont requis',
          },
        },
        { status: 400 }
      );
    }

    const disbursement = await prisma.disbursement.create({
      data: {
        receivedDate: new Date(receivedDate),
        entityId,
        bankAccountId: bankAccountId || null,
        supplier,
        amountTtc,
        priority,
        siteRef: siteRef || null,
        amountHt: amountHt ?? null,
        paymentMethod: paymentMethod || null,
        paymentDueDate: paymentDueDate ? new Date(paymentDueDate) : null,
        observations: observations || null,
        status: status || 'A_PAYER',
        fileUrl: fileUrl || null,
        createdBy: session.user.id,
      },
      include: { entity: true, bankAccount: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        module: 'DISBURSEMENTS',
        details: { disbursementId: disbursement.id, supplier },
      },
    });

    return Response.json({ data: disbursement }, { status: 201 });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
