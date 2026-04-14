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

  if (!checkAccess(session.user.role, 'RECURRING_CHARGES', 'UPDATE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.recurringCharge.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Charge récurrente non trouvée' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data: Record<string, unknown> = { ...body };

    // Parse date fields
    if (data.startDate) data.startDate = new Date(data.startDate as string);
    if (data.endDate) data.endDate = new Date(data.endDate as string);

    // Remove fields that should not be updated
    delete data.id;
    delete data.createdBy;
    delete data.createdAt;

    const recurringCharge = await prisma.recurringCharge.update({
      where: { id },
      data,
      include: { entity: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        module: 'RECURRING_CHARGES',
        details: { recurringChargeId: id },
      },
    });

    return Response.json({ data: recurringCharge });
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

  if (!checkAccess(session.user.role, 'RECURRING_CHARGES', 'DELETE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé (ADMIN uniquement)' } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.recurringCharge.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Charge récurrente non trouvée' } },
        { status: 404 }
      );
    }

    await prisma.recurringCharge.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        module: 'RECURRING_CHARGES',
        details: { recurringChargeId: id, label: existing.label },
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
