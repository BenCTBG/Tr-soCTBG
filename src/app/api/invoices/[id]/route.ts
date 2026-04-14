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

  if (!checkAccess(session.user.role, 'INVOICES', 'UPDATE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { id } = await params;

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
      issueDate,
      dueDate,
      paymentMethod,
      status,
      paidDate,
      paidAmount,
      observations,
      fileUrl,
    } = body;

    // Check if status changed to PAYEE — auto-create receipt
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Facture introuvable' } },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (entityId !== undefined) data.entityId = entityId;
    if (bankAccountId !== undefined) data.bankAccountId = bankAccountId || null;
    if (invoiceNumber !== undefined) data.invoiceNumber = invoiceNumber;
    if (clientName !== undefined) data.clientName = clientName;
    if (siteRef !== undefined) data.siteRef = siteRef || null;
    if (amountHt !== undefined) data.amountHt = amountHt ?? null;
    if (amountTtc !== undefined) data.amountTtc = amountTtc;
    if (issueDate !== undefined) data.issueDate = new Date(issueDate);
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod || null;
    if (status !== undefined) data.status = status;
    if (paidDate !== undefined) data.paidDate = paidDate ? new Date(paidDate) : null;
    if (paidAmount !== undefined) data.paidAmount = paidAmount ?? null;
    if (observations !== undefined) data.observations = observations || null;
    if (fileUrl !== undefined) data.fileUrl = fileUrl || null;

    // If changing to PAYEE and wasn't before, auto-create receipt
    let receiptCreated = false;
    if (status === 'PAYEE' && existing.status !== 'PAYEE' && !existing.receiptId) {
      const receipt = await prisma.receipt.create({
        data: {
          expectedDate: paidDate ? new Date(paidDate) : new Date(),
          entityId: entityId || existing.entityId,
          invoiceNumber: invoiceNumber || existing.invoiceNumber,
          clientName: clientName || existing.clientName,
          amountTtc: paidAmount || amountTtc || existing.amountTtc,
          type: 'CLIENT_DIRECT',
          status: 'ENCAISSE',
          receivedDate: paidDate ? new Date(paidDate) : new Date(),
          siteAddress: siteRef || existing.siteRef || null,
          observations: `Encaissement automatique — Facture ${existing.invoiceNumber}`,
          createdBy: session.user.id,
        },
      });
      data.receiptId = receipt.id;
      receiptCreated = true;

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE',
          module: 'RECEIPTS',
          details: {
            receiptId: receipt.id,
            autoCreated: true,
            fromInvoice: id,
          },
        },
      });
    }

    // If changing to RELANCEE, update status
    if (status === 'RELANCEE' && existing.status !== 'RELANCEE') {
      // status already set via data.status
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data,
      include: { entity: true, bankAccount: true, reminders: { orderBy: { date: 'desc' } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        module: 'INVOICES',
        details: {
          invoiceId: id,
          changes: Object.keys(data),
          receiptCreated,
        },
      },
    });

    return Response.json({ data: invoice });
  } catch (err) {
    console.error('PUT /api/invoices/[id] error:', err);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: String(err) } },
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

  if (!checkAccess(session.user.role, 'INVOICES', 'DELETE')) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    await prisma.invoice.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        module: 'INVOICES',
        details: { invoiceId: id },
      },
    });

    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
