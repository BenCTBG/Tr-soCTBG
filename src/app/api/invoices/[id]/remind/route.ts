import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccess } from '@/lib/access';

export async function POST(
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

  if (!checkAccess(session.user.role, 'INVOICES', 'UPDATE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const note = (body as Record<string, string>).note || null;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Facture introuvable' } },
        { status: 404 }
      );
    }

    const reminder = await prisma.invoiceReminder.create({
      data: {
        invoiceId: id,
        note,
        createdBy: session.user.id,
      },
      include: { user: { select: { name: true } } },
    });

    // Update invoice status to RELANCEE if not already paid
    if (invoice.status !== 'PAYEE' && invoice.status !== 'LITIGE') {
      await prisma.invoice.update({
        where: { id },
        data: { status: 'RELANCEE' },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        module: 'INVOICES',
        details: { invoiceId: id, action: 'REMINDER', note },
      },
    });

    return Response.json({ data: reminder }, { status: 201 });
  } catch (err) {
    console.error('POST /api/invoices/[id]/remind error:', err);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: String(err) } },
      { status: 500 }
    );
  }
}
