import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

  const { id } = await params;

  try {
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Notification non trouvée' } },
        { status: 404 }
      );
    }

    if (existing.userId !== session.user.id) {
      return Response.json(
        { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const notification = await prisma.notification.update({
      where: { id },
      data: { read: body.read === true },
    });

    return Response.json({ data: notification });
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

  const { id } = await params;

  try {
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Notification non trouvée' } },
        { status: 404 }
      );
    }

    if (existing.userId !== session.user.id) {
      return Response.json(
        { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
        { status: 403 }
      );
    }

    await prisma.notification.delete({ where: { id } });

    return Response.json({ data: { id } });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
