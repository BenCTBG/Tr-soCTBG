import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

type NotifType = 'SOLDE_CRITIQUE' | 'FACTURE_URGENTE' | 'ENCAISSEMENT_RETARD' | 'VALIDATION_DG' | 'PAIEMENT_EFFECTUE' | 'POSITION_NON_SAISIE' | 'SYSTEME';

interface CreateNotificationParams {
  userId: string;
  type: NotifType;
  title: string;
  message: string;
  link?: string;
}

// Map NotificationType to preference field name
const TYPE_TO_PREF: Record<NotifType, string> = {
  SOLDE_CRITIQUE: 'soldeCritique',
  FACTURE_URGENTE: 'factureUrgente',
  ENCAISSEMENT_RETARD: 'encaissementRetard',
  VALIDATION_DG: 'validationDg',
  PAIEMENT_EFFECTUE: 'paiementEffectue',
  POSITION_NON_SAISIE: 'positionNonSaisie',
  SYSTEME: 'soldeCritique', // always send system notifications
};

export async function createNotification({ userId, type, title, message, link }: CreateNotificationParams) {
  // Create in-app notification
  const notification = await prisma.notification.create({
    data: { userId, type, title, message, link },
  });

  // Check user preference for email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, notificationPreference: true },
  });

  if (!user) return notification;

  const prefs = user.notificationPreference;
  const prefField = TYPE_TO_PREF[type];

  // Default: send email if no preferences set yet (first time)
  const shouldEmail = !prefs || (prefs.emailActive && (prefs as Record<string, unknown>)[prefField] !== false);

  if (shouldEmail) {
    const emailHtml = buildEmailHtml(title, message, link);
    const sent = await sendEmail({
      to: user.email,
      subject: `[CTBG Tréso] ${title}`,
      html: emailHtml,
    });

    if (sent) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true },
      });
    }
  }

  return notification;
}

export async function notifyByRole(role: string, type: NotifType, title: string, message: string, link?: string) {
  const users = await prisma.user.findMany({
    where: { role: role as any, active: true },
    select: { id: true },
  });

  for (const user of users) {
    await createNotification({ userId: user.id, type, title, message, link });
  }
}

export async function notifyAdminsAndComptables(type: NotifType, title: string, message: string, link?: string) {
  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'COMPTABLE'] }, active: true },
    select: { id: true },
  });

  for (const user of users) {
    await createNotification({ userId: user.id, type, title, message, link });
  }
}

function buildEmailHtml(title: string, message: string, link?: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #C00000; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">CTBG Trésorerie</h1>
      </div>
      <div style="padding: 30px; background: #f8f9fa; border: 1px solid #dee2e6;">
        <h2 style="color: #333; margin-top: 0;">${title}</h2>
        <p style="color: #555; line-height: 1.6;">${message}</p>
        ${link ? `<a href="${process.env.NEXTAUTH_URL || 'http://localhost:3007'}${link}" style="display: inline-block; background: #C00000; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px;">Voir dans l'application</a>` : ''}
      </div>
      <div style="padding: 15px; text-align: center; color: #999; font-size: 12px;">
        CTBG Trésorerie — Notification automatique
      </div>
    </div>
  `;
}
