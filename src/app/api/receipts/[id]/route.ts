import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccess } from '@/lib/access';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
      { status: 401 }
    );
  }

  if (!checkAccess(session.user.role, 'RECEIPTS', 'UPDATE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.receipt.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Encaissement non trouvé' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data: Record<string, unknown> = { ...body };

    // Normalize amountCee (empty string → null)
    if (data.amountCee === '' || data.amountCee === undefined) {
      data.amountCee = null;
    }

    // Parse date fields
    if (data.expectedDate) data.expectedDate = new Date(data.expectedDate as string);
    if (data.filingDate) data.filingDate = new Date(data.filingDate as string);
    if (data.receivedDate) data.receivedDate = new Date(data.receivedDate as string);

    // Recalculate delayDays if receivedDate is being set and filingDate exists
    const filingDate = data.filingDate
      ? new Date(data.filingDate as string)
      : existing.filingDate;
    const receivedDate = data.receivedDate
      ? new Date(data.receivedDate as string)
      : existing.receivedDate;
    const type = (data.type as string) || existing.type;

    if (
      receivedDate &&
      filingDate &&
      (type === 'CEE' || type === 'MPR')
    ) {
      data.delayDays = Math.round(
        (new Date(receivedDate).getTime() - new Date(filingDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );
    }

    // Remove fields that should not be updated
    delete data.id;
    delete data.createdBy;
    delete data.createdAt;

    const receipt = await prisma.receipt.update({
      where: { id },
      data,
      include: { entity: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        module: 'RECEIPTS',
        details: { receiptId: id },
      },
    });

    return Response.json({ data: receipt });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
      { status: 401 }
    );
  }

  if (!checkAccess(session.user.role, 'RECEIPTS', 'DELETE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé (ADMIN uniquement)' } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.receipt.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Encaissement non trouvé' } },
        { status: 404 }
      );
    }

    await prisma.receipt.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        module: 'RECEIPTS',
        details: { receiptId: id, invoiceNumber: existing.invoiceNumber },
      },
    });

    return Response.json({ data: { id } });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
