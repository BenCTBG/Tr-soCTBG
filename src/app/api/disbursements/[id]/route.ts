import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccess } from '@/lib/access';
import { computePriority } from '@/lib/priority';

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

  const canUpdateAll = checkAccess(session.user.role, 'DISBURSEMENTS', 'UPDATE');
  const canUpdateBank = checkAccess(session.user.role, 'DISBURSEMENTS', 'UPDATE_BANK');

  if (!canUpdateAll && !canUpdateBank) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.disbursement.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Décaissement non trouvé' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    let data: Record<string, unknown> = { ...body };

    // Si l'utilisateur n'a que UPDATE_BANK (pas UPDATE complet), ne garder que bankAccountId
    if (!canUpdateAll && canUpdateBank) {
      data = { bankAccountId: data.bankAccountId ?? null };
    }

    // Parse date fields
    if (data.receivedDate) data.receivedDate = new Date(data.receivedDate as string);
    if (data.paymentDueDate) data.paymentDueDate = new Date(data.paymentDueDate as string);
    if (data.paidDate) data.paidDate = new Date(data.paidDate as string);

    // Recalcul priorité auto si paymentDueDate change (sauf BLOQUE/ATTENTE)
    if (data.paymentDueDate !== undefined) {
      data.priority = computePriority(
        data.paymentDueDate as Date | null,
        (data.priority as string | undefined) ?? existing.priority
      );
    }

    // Remove fields that should not be updated
    delete data.id;
    delete data.createdBy;
    delete data.createdAt;

    const disbursement = await prisma.disbursement.update({
      where: { id },
      data,
      include: { entity: true, bankAccount: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        module: 'DISBURSEMENTS',
        details: { disbursementId: id },
      },
    });

    return Response.json({ data: disbursement });
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

  if (!checkAccess(session.user.role, 'DISBURSEMENTS', 'DELETE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé (ADMIN uniquement)' } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.disbursement.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Décaissement non trouvé' } },
        { status: 404 }
      );
    }

    await prisma.disbursement.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        module: 'DISBURSEMENTS',
        details: { disbursementId: id, supplier: existing.supplier },
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
