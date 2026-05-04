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
  const entityIds = entities.map((e) => e.id);

  // ===== Toutes les requêtes indépendantes lancées EN PARALLÈLE =====
  const [
    latestPositionsRaw,
    urgentInvoices,
    expectedAgg,
    allReceipts,
    orphanInvoices,
    urgentUnpaid,
    overdueReceipts,
    todayPositionCount,
    receiptsPerEntity,
    avoirsPerEntity,
    disbursementsPerEntity,
  ] = await Promise.all([
    // 1 query unique pour récupérer les dernières positions de toutes les entités
    prisma.$queryRaw<Array<{ entity_id: string; balance: string | number; alert_level: string; variation: string | number }>>`
      SELECT DISTINCT ON (entity_id) entity_id, balance, alert_level, variation
      FROM bank_positions
      WHERE entity_id = ANY(${entityIds}::text[])
      ORDER BY entity_id, date DESC
    `,
    prisma.disbursement.count({ where: { priority: 'IMMEDIAT', status: 'A_PAYER' } }),
    prisma.receipt.aggregate({
      where: { status: 'ATTENDU', expectedDate: { gte: today, lte: in7Days } },
      _sum: { amountTtc: true },
    }),
    prisma.receipt.findMany({ include: { payments: true, invoice: true } }),
    prisma.invoice.findMany({ where: { receiptId: null, status: { not: 'PAYEE' } }, include: { payments: true } }),
    prisma.disbursement.findMany({
      where: { priority: 'IMMEDIAT', status: 'A_PAYER' },
      include: { entity: true },
      take: 5,
    }),
    prisma.receipt.findMany({
      where: { status: 'ATTENDU', expectedDate: { lt: today } },
      include: { entity: true },
      take: 5,
    }),
    prisma.bankPosition.count({ where: { date: today } }),
    prisma.receipt.groupBy({
      by: ['entityId'],
      where: { status: 'ATTENDU', type: { not: 'AVOIR' } },
      _sum: { amountTtc: true },
    }),
    prisma.receipt.groupBy({
      by: ['entityId'],
      where: { type: 'AVOIR' },
      _sum: { amountTtc: true },
    }),
    prisma.disbursement.groupBy({
      by: ['entityId'],
      where: { status: { in: ['A_PAYER', 'EN_ATTENTE_DG', 'VALIDE_DG'] } },
      _sum: { amountTtc: true },
    }),
  ]);

  // ===== Build positions map from raw query =====
  const positionsByEntity = new Map(
    latestPositionsRaw.map((r) => [
      r.entity_id,
      { balance: Number(r.balance), alertLevel: r.alert_level, variation: Number(r.variation) },
    ])
  );

  const latestPositions = entities.map((entity) => {
    const p = positionsByEntity.get(entity.id);
    return {
      entityName: entity.name,
      balance: p?.balance ?? 0,
      alertLevel: p?.alertLevel ?? 'NORMAL',
    };
  });

  const totalTreasury = latestPositions.reduce((sum, p) => sum + p.balance, 0);
  const entitiesInAlert = latestPositions.filter((p) => p.alertLevel !== 'NORMAL').length;
  const entitiesInAlertNames = latestPositions
    .filter((p) => p.alertLevel !== 'NORMAL')
    .map((p) => p.entityName)
    .join(', ');

  const expectedReceipts = Number(expectedAgg._sum.amountTtc || 0);
  let chiffreAffaires = 0;
  let aEncaisser = 0;
  let encaisse = 0;
  for (const r of allReceipts) {
    const ttc = Number(r.amountTtc);
    const cee = Number(r.amountCee || 0);
    const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);

    if (r.type === 'AVOIR') {
      // Avoir client = crédit accordé → déduit du CA et du à encaisser
      chiffreAffaires -= ttc;
      aEncaisser -= ttc;
      // Pas de paiement à compter
      continue;
    }

    chiffreAffaires += ttc;
    encaisse += paid;
    const base = (cee > 0 && !r.invoice) ? ttc - cee : ttc;
    aEncaisser += Math.max(0, base - paid);
  }
  for (const inv of orphanInvoices) {
    const ttc = Number(inv.amountTtc);
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    aEncaisser += Math.max(0, ttc - paid);
    encaisse += paid;
    chiffreAffaires += ttc;
  }

  // Alerts
  const alerts: { variant: 'rouge' | 'orange' | 'vert'; icon: string; message: string }[] = [];

  // Urgent unpaid
  for (const d of urgentUnpaid) {
    alerts.push({
      variant: 'rouge',
      icon: '🔴',
      message: `Facture prioritaire non payée : ${d.supplier} (${d.entity.name}) - ${formatCurrency(Number(d.amountTtc))}`,
    });
  }

  // Overdue receipts
  for (const r of overdueReceipts) {
    alerts.push({
      variant: 'orange',
      icon: '🟠',
      message: `Encaissement en retard : ${r.clientName} (${r.entity.name}) - ${formatCurrency(Number(r.amountTtc))}`,
    });
  }

  // Check if positions were entered today
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

  // --- Per-entity expected receipts (status ATTENDU, hors AVOIR) ---
  // Les avoirs sont DÉDUITS du total attendu (et non additionnés)
  const avoirsMap = new Map(
    avoirsPerEntity.map((a) => [a.entityId, Number(a._sum.amountTtc || 0)])
  );
  const receiptsMap = new Map(
    receiptsPerEntity.map((r) => [
      r.entityId,
      Number(r._sum.amountTtc || 0) - (avoirsMap.get(r.entityId) || 0),
    ])
  );
  // Entities with only avoirs (no expected receipts)
  for (const [entityId, avoirAmount] of avoirsMap) {
    if (!receiptsMap.has(entityId)) {
      receiptsMap.set(entityId, -avoirAmount);
    }
  }

  // --- Per-entity pending disbursements (A_PAYER, EN_ATTENTE_DG, VALIDE_DG) ---
  const disbursementsMap = new Map(
    disbursementsPerEntity.map((d) => [d.entityId, Number(d._sum.amountTtc || 0)])
  );

  // --- Build enriched entity data for the table (zero query, réutilise positionsByEntity) ---
  const entityDetails = entities.map((entity) => {
    const p = positionsByEntity.get(entity.id);
    const balance = p?.balance ?? 0;
    const variation = p?.variation ?? 0;
    const alertLevel = p?.alertLevel ?? 'NORMAL';
    const encAttendus = receiptsMap.get(entity.id) || 0;
    const decAVenir = disbursementsMap.get(entity.id) || 0;
    const soldePrevisionnel = balance + encAttendus - decAVenir;

    let tendance: 'hausse' | 'baisse' | 'stable' = 'stable';
    if (variation > 0) tendance = 'hausse';
    else if (variation < 0) tendance = 'baisse';

    return {
      entityName: entity.name,
      balance,
      variation,
      tendance,
      alertLevel,
      encAttendus,
      decAVenir,
      soldePrevisionnel,
    };
  });

  // --- Lowest balance entity ---
  const lowestEntity = entityDetails.reduce(
    (min, e) => (e.balance < min.balance ? e : min),
    entityDetails[0] || { entityName: '-', balance: 0 }
  );

  const maxBalance = Math.max(...latestPositions.map((e) => e.balance), 1);

  // Alert level color helpers
  const alertBadgeClasses: Record<string, string> = {
    NORMAL: 'bg-green-100 text-green-800',
    ATTENTION: 'bg-orange-100 text-orange-800',
    CRITIQUE: 'bg-red-100 text-red-800',
    NEGATIF: 'bg-red-200 text-red-900',
  };

  const alertBarColors: Record<string, string> = {
    NORMAL: 'bg-success',
    ATTENTION: 'bg-warning',
    CRITIQUE: 'bg-error',
    NEGATIF: 'bg-red-900',
  };

  return (
    <>
      {/* KPI Grid - Trésorerie */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
          subtitle="À traiter aujourd'hui — voir la liste"
          variant="red"
          href="/decaissements?priority=IMMEDIAT&status=A_PAYER"
        />
        <KpiCard
          label="Solde le plus bas (entité)"
          value={formatCurrency(lowestEntity.balance)}
          subtitle={lowestEntity.entityName}
          variant={lowestEntity.balance < 30000 ? 'red' : 'default'}
        />
      </div>

      {/* KPI Grid - Facturation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
        <KpiCard
          label="Chiffre d'Affaires"
          value={formatCurrency(chiffreAffaires)}
          subtitle="Σ factures clients TTC − avoirs + appels CEE indépendants"
          variant="default"
        />
        <KpiCard
          label="À Encaisser"
          value={formatCurrency(aEncaisser)}
          subtitle="Reste à charge + appels CEE"
          variant="orange"
        />
        <KpiCard
          label="Encaissé"
          value={formatCurrency(encaisse)}
          subtitle="Total paiements reçus"
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

      {/* Position par Entité */}
      <div className="bg-white p-5 rounded-lg shadow-card mb-7">
        <h2 className="text-sm font-semibold text-gray-dark mb-4 uppercase tracking-wide">
          📊 Position par entité
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 px-3 font-semibold text-gray-dark">ENTITÉ</th>
                <th className="py-2 px-3 font-semibold text-gray-dark text-right">SOLDE ACTUEL</th>
                <th className="py-2 px-3 font-semibold text-gray-dark text-right">VARIATION JOUR</th>
                <th className="py-2 px-3 font-semibold text-gray-dark text-center">TENDANCE</th>
                <th className="py-2 px-3 font-semibold text-gray-dark text-center">ALERTE</th>
                <th className="py-2 px-3 font-semibold text-gray-dark text-right">ENC. ATTENDUS</th>
                <th className="py-2 px-3 font-semibold text-gray-dark text-right">DÉC. À VENIR</th>
                <th className="py-2 px-3 font-semibold text-gray-dark text-right">SOLDE PRÉVI.</th>
              </tr>
            </thead>
            <tbody>
              {entityDetails.map((e) => (
                <tr key={e.entityName} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-dark">{e.entityName}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatCurrency(e.balance)}</td>
                  <td className={`py-2 px-3 text-right font-mono ${e.variation > 0 ? 'text-green-600' : e.variation < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {e.variation > 0 ? '+' : ''}{formatCurrency(e.variation)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {e.tendance === 'hausse' && <span className="text-green-600 font-medium">↗ Hausse</span>}
                    {e.tendance === 'baisse' && <span className="text-red-600 font-medium">↘ Baisse</span>}
                    {e.tendance === 'stable' && <span className="text-gray-500 font-medium">→ Stable</span>}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${alertBadgeClasses[e.alertLevel] || alertBadgeClasses.NORMAL}`}>
                      {e.alertLevel}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-green-700">{formatCurrency(e.encAttendus)}</td>
                  <td className="py-2 px-3 text-right font-mono text-red-600">{formatCurrency(e.decAVenir)}</td>
                  <td className={`py-2 px-3 text-right font-mono font-semibold ${e.soldePrevisionnel < 0 ? 'text-red-700' : 'text-gray-dark'}`}>
                    {formatCurrency(e.soldePrevisionnel)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trésorerie par entité - Bar Chart */}
      <div className="bg-white p-5 rounded-lg shadow-card mb-7">
        <h2 className="text-sm font-semibold text-gray-dark mb-4 uppercase tracking-wide">
          📈 Trésorerie par entité
        </h2>
        <div className="space-y-3">
          {entityDetails.map((e) => {
            const maxBar = Math.max(...entityDetails.map((d) => Math.abs(d.balance)), 1);
            const widthPct = Math.max((Math.abs(e.balance) / maxBar) * 100, 2);
            return (
              <div key={e.entityName} className="flex items-center gap-3">
                <div className="w-32 text-sm font-medium text-gray-dark truncate flex-shrink-0">
                  {e.entityName}
                </div>
                <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden relative">
                  <div
                    className={`h-full rounded ${alertBarColors[e.alertLevel] || 'bg-success'}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <div className={`w-28 text-right text-sm font-mono font-semibold flex-shrink-0 ${e.balance < 0 ? 'text-red-700' : 'text-gray-dark'}`}>
                  {formatCurrency(e.balance)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
