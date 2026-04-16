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

  if (!checkAccess(session.user.role, 'INVOICES', 'READ')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entity_id');
  const status = searchParams.get('status');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

  try {
    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.issueDate = {};
      if (dateFrom) (where.issueDate as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.issueDate as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          entity: true,
          bankAccount: true,
          reminders: { orderBy: { date: 'desc' } },
          user: { select: { name: true } },
        },
        orderBy: { issueDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return Response.json({
      data: invoices,
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

  if (!checkAccess(session.user.role, 'INVOICES', 'CREATE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      entityId,
      bankAccountId,
      invoiceNumber,
      clientName,
      siteRef,
      amountHt,
      amountTtc,
      amountCee,
      ceeDelegataire,
      resteAPayer,
      issueDate,
      dueDate,
      paymentMethod,
      status,
      observations,
      fileUrl,
    } = body;

    if (!entityId || !invoiceNumber || !clientName || amountTtc == null || !issueDate) {
      return Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'entityId, invoiceNumber, clientName, amountTtc et issueDate sont requis',
          },
        },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.create({
      data: {
        entityId,
        bankAccountId: bankAccountId || null,
        invoiceNumber,
        clientName,
        siteRef: siteRef || null,
        amountHt: amountHt ?? null,
        amountTtc,
        amountCee: amountCee ?? null,
        ceeDelegataire: ceeDelegataire || null,
        resteAPayer: resteAPayer ?? null,
        issueDate: new Date(issueDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        paymentMethod: paymentMethod || null,
        status: status || 'EMISE',
        observations: observations || null,
        fileUrl: fileUrl || null,
        createdBy: session.user.id,
      },
      include: { entity: true, bankAccount: true, reminders: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        module: 'INVOICES',
        details: { invoiceId: invoice.id, invoiceNumber, clientName },
      },
    });

    return Response.json({ data: invoice }, { status: 201 });
  } catch (err) {
    console.error('POST /api/invoices error:', err);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: String(err) } },
      { status: 500 }
    );
  }
}
