import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkAccess } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import KpiCard from '@/components/ui/KpiCard';
import EntityBar from '@/components/ui/EntityBar';
import AlertItem from '@/components/ui/AlertItem';
import TreasuryChart from '@/components/ui/TreasuryChart';
import { formatCurrency } from '@/utils/formatters';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (!checkAccess(session.user.role, 'DASHBOARD', 'READ')) {
    return <p className="text-center text-gray-text mt-10">Accès non autorisé.</p>;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);

  // Get all entities
  const entities = await prisma.entity.findMany();

  // Get latest bank position for each entity
  const latestPositions = await Promise.all(
    entities.map(async (entity) => {
      const position = await prisma.bankPosition.findFirst({
        where: { entityId: entity.id },
        orderBy: { date: 'desc' },
      });
      return {
        entityName: entity.name,
        balance: position ? Number(position.balance) : 0,
        alertLevel: position?.alertLevel || 'NORMAL',
      };
    })
  );

  const totalTreasury = latestPositions.reduce((sum, p) => sum + p.balance, 0);
  const entitiesInAlert = latestPositions.filter((p) => p.alertLevel !== 'NORMAL').length;
  const entitiesInAlertNames = latestPositions
    .filter((p) => p.alertLevel !== 'NORMAL')
    .map((p) => p.entityName)
    .join(', ');

  // Urgent invoices
  const urgentInvoices = await prisma.disbursement.count({
    where: { priority: 'IMMEDIAT', status: 'A_PAYER' },
  });

  // Expected receipts within 7 days
  const expectedAgg = await prisma.receipt.aggregate({
    where: {
      status: 'ATTENDU',
      expectedDate: { gte: today, lte: in7Days },
    },
    _sum: { amountTtc: true },
  });
  const expectedReceipts = Number(expectedAgg._sum.amountTtc || 0);

  // Alerts
  const alerts: { variant: 'rouge' | 'orange' | 'vert'; icon: string; message: string }[] = [];

  // Urgent unpaid
  const urgentUnpaid = await prisma.disbursement.findMany({
    where: { priority: 'IMMEDIAT', status: 'A_PAYER' },
    include: { entity: true },
    take: 5,
  });
  for (const d of urgentUnpaid) {
    alerts.push({
      variant: 'rouge',
      icon: '🔴',
      message: `Facture prioritaire non payée : ${d.supplier} (${d.entity.name}) - ${formatCurrency(Number(d.amountTtc))}`,
    });
  }

  // Overdue receipts
  const overdueReceipts = await prisma.receipt.findMany({
    where: { status: 'ATTENDU', expectedDate: { lt: today } },
    include: { entity: true },
    take: 5,
  });
  for (const r of overdueReceipts) {
    alerts.push({
      variant: 'orange',
      icon: '🟠',
      message: `Encaissement en retard : ${r.clientName} (${r.entity.name}) - ${formatCurrency(Number(r.amountTtc))}`,
    });
  }

  // Check if positions were entered today
  const todayPositionCount = await prisma.bankPosition.count({ where: { date: today } });
  if (todayPositionCount === entities.length && entities.length > 0) {
    alerts.push({
      variant: 'vert',
      icon: '🟢',
      message: `Position bancaire saisie : Tous les soldes validés ce jour`,
    });
  } else if (todayPositionCount === 0) {
    alerts.push({
      variant: 'orange',
      icon: '⏰',
      message: `Position bancaire non saisie aujourd'hui`,
    });
  }

  // If no alerts, show a positive one
  if (alerts.length === 0) {
    alerts.push({
      variant: 'vert',
      icon: '✅',
      message: 'Aucune alerte en cours. Tout est en ordre.',
    });
  }

  const maxBalance = Math.max(...latestPositions.map((e) => e.balance), 1);

  return (
    <>
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <KpiCard
          label="Trésorerie Totale"
          value={formatCurrency(totalTreasury)}
          subtitle="Consolidé toutes entités"
          variant="default"
        />
        <KpiCard
          label="Entités en Alerte"
          value={String(entitiesInAlert)}
          subtitle={entitiesInAlertNames || 'Aucune'}
          variant="orange"
        />
        <KpiCard
          label="Factures Urgentes"
          value={String(urgentInvoices)}
          subtitle="À traiter aujourd'hui"
          variant="red"
        />
        <KpiCard
          label="Encaissements Attendus"
          value={formatCurrency(expectedReceipts)}
          subtitle="Prochains 7 jours"
          variant="green"
        />
      </div>

      {/* Solde par Entité */}
      <div className="bg-white p-5 rounded-lg shadow-card mb-7">
        <h2 className="text-sm font-semibold text-gray-dark mb-4 uppercase tracking-wide">
          Solde par Entité
        </h2>
        {latestPositions.map((entity) => (
          <EntityBar
            key={entity.entityName}
            label={entity.entityName}
            value={formatCurrency(entity.balance)}
            percentage={maxBalance > 0 ? (entity.balance / maxBalance) * 100 : 0}
          />
        ))}
      </div>

      {/* Évolution Trésorerie */}
      <TreasuryChart />

      {/* Alertes et Anomalies */}
      <div className="bg-white p-5 rounded-lg shadow-card mb-7">
        <h2 className="text-sm font-semibold text-gray-dark mb-4 uppercase tracking-wide">
          Alertes et Anomalies
        </h2>
        {alerts.map((alert, index) => (
          <AlertItem key={index} variant={alert.variant} icon={alert.icon}>
            {alert.message}
          </AlertItem>
        ))}
      </div>
    </>
  );
}
