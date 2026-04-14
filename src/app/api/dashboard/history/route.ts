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

  if (!checkAccess(session.user.role, 'DASHBOARD', 'READ')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '30', 10)));

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const entities = await prisma.entity.findMany();

    const entitiesWithPositions = await Promise.all(
      entities.map(async (entity) => {
        const positions = await prisma.bankPosition.findMany({
          where: {
            entityId: entity.id,
            date: { gte: since },
          },
          orderBy: { date: 'asc' },
          select: { date: true, balance: true },
        });

        return {
          name: entity.name,
          positions: positions.map((p) => ({
            date: p.date.toISOString(),
            balance: Number(p.balance),
          })),
        };
      })
    );

    return Response.json({ data: { entities: entitiesWithPositions } });
  } catch (error) {
    console.error('Dashboard history error:', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
