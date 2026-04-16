import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

// API endpoint called by a CRON job every evening (e.g., 19h)
// Sends a single digest email with all disbursements pending DG validation
export async function POST(request: Request) {
  // Verify secret key (for CRON security)
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (secret !== (process.env.DIGEST_SECRET || 'ctbg-digest-2026')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all disbursements pending validation (EN_ATTENTE_DG or A_PAYER)
    const pendingDisbursements = await prisma.disbursement.findMany({
      where: {
        status: { in: ['A_PAYER', 'EN_ATTENTE_DG'] },
      },
      include: { entity: true, bankAccount: true },
      orderBy: [{ priority: 'asc' }, { receivedDate: 'desc' }],
    });

    if (pendingDisbursements.length === 0) {
      return Response.json({ message: 'Aucun achat en attente de validation', sent: false });
    }

    // Build digest HTML
    const totalAmount = pendingDisbursements.reduce(
      (sum, d) => sum + (Number(d.amountTtc) || 0),
      0
    );

    const priorityLabels: Record<string, string> = {
      IMMEDIAT: '🔴 Immédiat',
      SOUS_3J: '🟠 Sous 3 jours',
      SOUS_15J: '🟡 Sous 15 jours',
      SOUS_1_MOIS: '🔵 Sous 1 mois',
      ATTENTE: '⚪ En attente',
      BLOQUE: '⚫ Bloqué',
    };

    const statusLabels: Record<string, string> = {
      A_PAYER: 'À payer',
      EN_ATTENTE_DG: 'En attente validation DG',
    };

    const rows = pendingDisbursements
      .map(
        (d) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.entity.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.supplier}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.siteRef || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">
            ${Number(d.amountTtc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${priorityLabels[d.priority] || d.priority}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${statusLabels[d.status] || d.status}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${d.paymentDueDate ? new Date(d.paymentDueDate).toLocaleDateString('fr-FR') : '-'}
          </td>
        </tr>`
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="background: #C00000; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">CTBG Trésorerie — Récapitulatif du soir</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa; border: 1px solid #dee2e6;">
          <h2 style="color: #333; margin-top: 0;">Achats en attente de validation</h2>
          <p style="color: #555;">
            <strong>${pendingDisbursements.length}</strong> achat(s) en attente —
            Total : <strong>${totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € TTC</strong>
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
            <thead>
              <tr style="background: #333; color: white;">
                <th style="padding: 10px; text-align: left;">Entité</th>
                <th style="padding: 10px; text-align: left;">Fournisseur</th>
                <th style="padding: 10px; text-align: left;">Objet</th>
                <th style="padding: 10px; text-align: right;">Montant TTC</th>
                <th style="padding: 10px; text-align: left;">Priorité</th>
                <th style="padding: 10px; text-align: left;">Statut</th>
                <th style="padding: 10px; text-align: left;">Échéance</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div style="margin-top: 20px; text-align: center;">
            <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3007'}/decaissements"
               style="display: inline-block; background: #C00000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              Voir les achats dans l'application
            </a>
          </div>
        </div>
        <div style="padding: 15px; text-align: center; color: #999; font-size: 12px;">
          CTBG Trésorerie — Récapitulatif quotidien automatique (${new Date().toLocaleDateString('fr-FR')})
        </div>
      </div>
    `;

    // Send to all ADMIN and COMPTABLE users
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'COMPTABLE'] }, active: true },
      select: { email: true, name: true },
    });

    let sentCount = 0;
    for (const admin of admins) {
      const sent = await sendEmail({
        to: admin.email,
        subject: `[CTBG] ${pendingDisbursements.length} achat(s) en attente de validation`,
        html,
      });
      if (sent) sentCount++;
    }

    // Create in-app notification too
    for (const admin of admins) {
      const user = await prisma.user.findUnique({ where: { email: admin.email } });
      if (user) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: 'VALIDATION_DG',
            title: `${pendingDisbursements.length} achat(s) en attente`,
            message: `Total : ${totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € TTC`,
            link: '/decaissements',
          },
        });
      }
    }

    return Response.json({
      message: `Digest envoyé à ${sentCount}/${admins.length} destinataires`,
      sent: true,
      disbursementsCount: pendingDisbursements.length,
      totalAmount,
    });
  } catch (error) {
    console.error('[DIGEST] Error:', error);
    return Response.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
