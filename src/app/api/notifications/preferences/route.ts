import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DEFAULT_PREFERENCES = {
  emailActive: true,
  soldeCritique: true,
  factureUrgente: true,
  encaissementRetard: true,
  validationDg: true,
  paiementEffectue: true,
  positionNonSaisie: true,
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
      { status: 401 }
    );
  }

  try {
    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
    });

    return Response.json({
      data: preferences || { userId: session.user.id, ...DEFAULT_PREFERENCES },
    });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const {
      emailActive,
      soldeCritique,
      factureUrgente,
      encaissementRetard,
      validationDg,
      paiementEffectue,
      positionNonSaisie,
    } = body;

    const data: Record<string, boolean> = {};
    if (emailActive !== undefined) data.emailActive = emailActive;
    if (soldeCritique !== undefined) data.soldeCritique = soldeCritique;
    if (factureUrgente !== undefined) data.factureUrgente = factureUrgente;
    if (encaissementRetard !== undefined) data.encaissementRetard = encaissementRetard;
    if (validationDg !== undefined) data.validationDg = validationDg;
    if (paiementEffectue !== undefined) data.paiementEffectue = paiementEffectue;
    if (positionNonSaisie !== undefined) data.positionNonSaisie = positionNonSaisie;

    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ...DEFAULT_PREFERENCES,
        ...data,
      },
      update: data,
    });

    return Response.json({ data: preferences });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
