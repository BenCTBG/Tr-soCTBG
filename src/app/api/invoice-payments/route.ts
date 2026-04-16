import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccess } from '@/lib/access';

// GET payments for a specific invoice or receipt
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get('invoice_id');
  const receiptId = searchParams.get('receipt_id');

  if (!invoiceId && !receiptId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'invoice_id ou receipt_id requis' } }, { status: 400 });
  }

  try {
    const where: Record<string, string> = {};
    if (invoiceId) where.invoiceId = invoiceId;
    if (receiptId) where.receiptId = receiptId;

    const payments = await prisma.invoicePayment.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return Response.json({ data: payments });
  } catch {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
  }
}

// POST a new payment
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } }, { status: 401 });
  }

  if (!checkAccess(session.user.role, 'RECEIPTS', 'UPDATE')) {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Accès refusé' } }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { invoiceId, receiptId, amount, date, source, payer, reference, observations } = body;

    if ((!invoiceId && !receiptId) || amount == null || !date) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'invoiceId ou receiptId, amount et date sont requis' } },
        { status: 400 }
      );
    }

    // Verify the target exists
    let targetAmount = 0;
    let existingPayments: Array<{ amount: unknown }> = [];

    if (receiptId) {
      const receipt = await prisma.receipt.findUnique({
        where: { id: receiptId },
        include: { payments: true },
      });
      if (!receipt) {
        return Response.json({ error: { code: 'NOT_FOUND', message: 'Facture non trouvée' } }, { status: 404 });
      }
      targetAmount = Number(receipt.amountTtc);
      existingPayments = receipt.payments;
    } else if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true },
      });
      if (!invoice) {
        return Response.json({ error: { code: 'NOT_FOUND', message: 'Facture non trouvée' } }, { status: 404 });
      }
      targetAmount = Number(invoice.resteAPayer || invoice.amountTtc);
      existingPayments = invoice.payments;
    }

    // Create payment
    const payment = await prisma.invoicePayment.create({
      data: {
        invoiceId: invoiceId || null,
        receiptId: receiptId || null,
        amount,
        date: new Date(date),
        source: source || 'CLIENT',
        payer: payer || null,
        reference: reference || null,
        observations: observations || null,
        createdBy: session.user.id,
      },
    });

    // Calculate total paid
    const existingPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPaid = existingPaid + Number(amount);

    // Update receipt status if fully paid
    if (receiptId && totalPaid >= targetAmount) {
      await prisma.receipt.update({
        where: { id: receiptId },
        data: { status: 'ENCAISSE', receivedDate: new Date(date) },
      });
    }

    // Update invoice status if fully paid
    if (invoiceId) {
      const updateData: Record<string, unknown> = { paidAmount: totalPaid };
      if (totalPaid >= targetAmount) {
        updateData.status = 'PAYEE';
        updateData.paidDate = new Date(date);
      }
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: updateData,
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        module: 'INVOICE_PAYMENTS',
        details: { invoiceId, receiptId, amount, source, payer },
      },
    });

    return Response.json({ data: payment, totalPaid, targetAmount }, { status: 201 });
  } catch (error) {
    console.error('[INVOICE_PAYMENTS] POST error:', error);
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
  }
}
