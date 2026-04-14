import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccess } from '@/lib/access';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
      { status: 401 }
    );
  }

  if (!checkAccess(session.user.role, 'BANK_POSITION', 'READ')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Acces refuse' } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entity_id');
  const active = searchParams.get('active');

  try {
    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    if (active !== null && active !== undefined && active !== '') {
      where.active = active === 'true';
    }

    const bankAccounts = await prisma.bankAccount.findMany({
      where,
      include: { entity: true },
      orderBy: { createdAt: 'desc' },
    });

    return Response.json({ data: bankAccounts });
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
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
      { status: 401 }
    );
  }

  if (!checkAccess(session.user.role, 'BANK_POSITION', 'CREATE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Acces refuse' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { entityId, bankName, accountNumber, iban, label } = body;

    if (!entityId || !bankName) {
      return Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'entityId et bankName sont requis',
          },
        },
        { status: 400 }
      );
    }

    // Vérifier que l'entité existe
    const entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: `Entité introuvable (${entityId})` } },
        { status: 400 }
      );
    }

    const bankAccount = await prisma.bankAccount.create({
      data: {
        entityId,
        bankName,
        accountNumber: accountNumber || null,
        iban: iban || null,
        label: label || null,
      },
      include: { entity: true },
    });

    // Audit log (non bloquant)
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE',
          module: 'BANK_POSITION',
          details: { bankAccountId: bankAccount.id, bankName },
        },
      });
    } catch (auditErr) {
      console.error('Audit log error (non-bloquant):', auditErr);
    }

    return Response.json({ data: bankAccount }, { status: 201 });
  } catch (err) {
    console.error('POST /api/bank-accounts error:', err);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: String(err) } },
      { status: 500 }
    );
  }
}
