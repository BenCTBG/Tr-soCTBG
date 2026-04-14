import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccess } from '@/lib/access';

export async function PATCH(
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

  if (!checkAccess(session.user.role, 'DISBURSEMENTS', 'VALIDATE')) {
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

    const disbursement = await prisma.disbursement.update({
      where: { id },
      data: {
        status: 'VALIDE_DG',
        validatedBy: session.user.id,
      },
      include: { entity: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'VALIDATE',
        module: 'DISBURSEMENTS',
        details: { disbursementId: id, newStatus: 'VALIDE_DG' },
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
