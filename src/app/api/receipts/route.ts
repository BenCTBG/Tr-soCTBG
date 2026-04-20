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

  if (!checkAccess(session.user.role, 'RECEIPTS', 'READ')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entity_id');
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

  try {
    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.expectedDate = {};
      if (dateFrom) (where.expectedDate as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.expectedDate as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        include: { entity: true, payments: true, invoice: true },
        orderBy: { expectedDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.receipt.count({ where }),
    ]);

    return Response.json({
      data: receipts,
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

  if (!checkAccess(session.user.role, 'RECEIPTS', 'CREATE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      expectedDate,
      entityId,
      invoiceNumber,
      clientName,
      amountTtc,
      amountCee,
      type,
      siteAddress,
      department,
      filingDate,
      receivedDate,
      ceeDelegataire,
      observations,
      status,
    } = body;

    if (!expectedDate || !entityId || !invoiceNumber || !clientName || amountTtc == null || !type) {
      return Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'expectedDate, entityId, invoiceNumber, clientName, amountTtc et type sont requis',
          },
        },
        { status: 400 }
      );
    }

    let delayDays: number | null = null;
    if ((type === 'CEE' || type === 'MPR') && filingDate && receivedDate) {
      const filing = new Date(filingDate);
      const received = new Date(receivedDate);
      delayDays = Math.round((received.getTime() - filing.getTime()) / (1000 * 60 * 60 * 24));
    }

    const receipt = await prisma.receipt.create({
      data: {
        expectedDate: new Date(expectedDate),
        entityId,
        invoiceNumber,
        clientName,
        amountTtc,
        amountCee: amountCee != null && amountCee !== '' ? amountCee : null,
        type,
        siteAddress: siteAddress || null,
        department: department || null,
        filingDate: filingDate ? new Date(filingDate) : null,
        receivedDate: receivedDate ? new Date(receivedDate) : null,
        delayDays,
        ceeDelegataire: ceeDelegataire || null,
        observations: observations || null,
        status: status || 'ATTENDU',
        createdBy: session.user.id,
      },
      include: { entity: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        module: 'RECEIPTS',
        details: { receiptId: receipt.id, invoiceNumber },
      },
    });

    return Response.json({ data: receipt }, { status: 201 });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
