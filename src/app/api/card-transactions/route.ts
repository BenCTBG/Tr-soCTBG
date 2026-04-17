import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAccess } from '@/lib/access';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } }, { status: 401 });
  }

  if (!checkAccess(session.user.role, 'DISBURSEMENTS', 'READ')) {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Accès refusé' } }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entity_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  try {
    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    if (dateFrom || dateTo) {
      where.transactionDate = {};
      if (dateFrom) (where.transactionDate as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.transactionDate as Record<string, unknown>).lte = new Date(dateTo);
    }

    const transactions = await prisma.cardTransaction.findMany({
      where,
      include: { entity: true },
      orderBy: { transactionDate: 'desc' },
    });

    return Response.json({ data: transactions });
  } catch (error) {
    console.error('[CARD_TRANSACTIONS] GET error:', error);
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } }, { status: 401 });
  }

  if (!checkAccess(session.user.role, 'DISBURSEMENTS', 'CREATE')) {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Accès refusé' } }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { transactions, entityId } = body as {
      transactions: Array<{
        transactionNumber: string;
        transactionDate: string;
        label: string;
        amount: number;
        cardLast4?: string;
      }>;
      entityId: string;
    };

    if (!transactions || !Array.isArray(transactions) || !entityId) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'transactions (array) et entityId sont requis' } },
        { status: 400 }
      );
    }

    // Check for existing transaction numbers to avoid duplicates
    const txNumbers = transactions.map((t) => t.transactionNumber).filter(Boolean);
    const existingTx = await prisma.cardTransaction.findMany({
      where: { transactionNumber: { in: txNumbers } },
      select: { transactionNumber: true },
    });
    const existingSet = new Set(existingTx.map((t) => t.transactionNumber));

    const newTransactions = transactions.filter(
      (t) => t.transactionNumber && !existingSet.has(t.transactionNumber)
    );
    const duplicateCount = transactions.length - newTransactions.length;

    // Create new transactions + matching disbursements (already paid by card)
    const created = [];
    for (const tx of newTransactions) {
      const record = await prisma.cardTransaction.create({
        data: {
          transactionNumber: tx.transactionNumber,
          transactionDate: new Date(tx.transactionDate),
          label: tx.label,
          amount: tx.amount,
          cardLast4: tx.cardLast4 || null,
          entityId,
          createdBy: session.user.id,
        },
      });

      // Create matching disbursement so it shows up in the list
      await prisma.disbursement.create({
        data: {
          receivedDate: new Date(tx.transactionDate),
          entityId,
          supplier: tx.label,
          amountTtc: tx.amount,
          priority: 'IMMEDIAT',
          paymentMethod: 'CB',
          paymentDueDate: new Date(tx.transactionDate),
          paidDate: new Date(tx.transactionDate),
          status: 'PAYE',
          observations: tx.cardLast4 ? `Import CB ****${tx.cardLast4}` : 'Import CB',
          createdBy: session.user.id,
        },
      });

      created.push(record);
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'IMPORT',
        module: 'CARD_TRANSACTIONS',
        details: {
          imported: created.length,
          duplicates: duplicateCount,
          total: transactions.length,
        },
      },
    });

    return Response.json({
      data: created,
      meta: {
        imported: created.length,
        duplicates: duplicateCount,
        total: transactions.length,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[CARD_TRANSACTIONS] POST error:', error);
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
  }
}
