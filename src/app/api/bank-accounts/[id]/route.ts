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
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
      { status: 401 }
    );
  }

  if (!checkAccess(session.user.role, 'BANK_POSITION', 'UPDATE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Acces refuse' } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Compte bancaire non trouve' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.bankName !== undefined) data.bankName = body.bankName;
    if (body.accountNumber !== undefined) data.accountNumber = body.accountNumber || null;
    if (body.iban !== undefined) data.iban = body.iban || null;
    if (body.label !== undefined) data.label = body.label || null;
    if (body.active !== undefined) data.active = body.active;

    const bankAccount = await prisma.bankAccount.update({
      where: { id },
      data,
      include: { entity: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        module: 'BANK_POSITION',
        details: { bankAccountId: id },
      },
    });

    return Response.json({ data: bankAccount });
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
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifie' } },
      { status: 401 }
    );
  }

  if (session.user.role !== 'ADMIN') {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Seuls les administrateurs peuvent supprimer un compte bancaire' } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Compte bancaire non trouve' } },
        { status: 404 }
      );
    }

    await prisma.bankAccount.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        module: 'BANK_POSITION',
        details: { bankAccountId: id, bankName: existing.bankName, action: 'DELETE' },
      },
    });

    return Response.json({ data: { success: true } });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
