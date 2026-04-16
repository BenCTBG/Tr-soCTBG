import * as XLSX from 'xlsx';

// Generate and return Excel import templates
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'facturation';

  const templates: Record<string, { headers: string[]; example: (string | number)[]; sheetName: string; fileName: string }> = {
    facturation: {
      sheetName: 'Factures',
      fileName: 'modele_import_factures.xlsx',
      headers: [
        'N° Facture*',
        'Client*',
        'Entité*',
        'Montant HT',
        'Montant TTC*',
        'Prime CEE',
        'Reste à payer',
        'Délégataire CEE',
        "Date d'émission* (JJ/MM/AAAA)",
        "Date d'échéance (JJ/MM/AAAA)",
        'Mode de paiement (VIREMENT/CB/LCR/CHEQUE/PRELEVEMENT)',
        'Statut (EMISE/ENVOYEE/RELANCEE/PAYEE)',
        'Observations',
      ],
      example: [
        'FC-2026-001',
        'DUPONT Jean',
        'CTBG HOME RENOV',
        15000,
        18000,
        5000,
        13000,
        'VERTIGO',
        '14/04/2026',
        '14/05/2026',
        'VIREMENT',
        'EMISE',
        'Chantier rénovation Paris 15',
      ],
    },
    achats: {
      sheetName: 'Achats',
      fileName: 'modele_import_achats.xlsx',
      headers: [
        'Fournisseur*',
        'Entité*',
        'Chantier/Objet',
        'Montant HT',
        'Montant TTC*',
        'Date réception* (JJ/MM/AAAA)',
        "Date d'échéance (JJ/MM/AAAA)",
        'Mode de paiement (VIREMENT/CB/LCR/CHEQUE/PRELEVEMENT)',
        'Priorité (IMMEDIAT/SOUS_3J/SOUS_15J/SOUS_1_MOIS/ATTENTE)',
        'Statut (A_PAYER/EN_ATTENTE_DG/VALIDE_DG/PAYE)',
        'Observations',
      ],
      example: [
        'LEROY MERLIN',
        'CTBG HOME RENOV',
        'Matériaux chantier Grigny',
        1500,
        1800,
        '14/04/2026',
        '30/04/2026',
        'VIREMENT',
        'IMMEDIAT',
        'A_PAYER',
        'Commande urgente',
      ],
    },
    encaissements: {
      sheetName: 'Encaissements',
      fileName: 'modele_import_encaissements.xlsx',
      headers: [
        'N° Facture*',
        'Client*',
        'Entité*',
        'Montant TTC*',
        'Type (CLIENT_DIRECT/CEE/MPR/AVOIR)',
        'Délégataire CEE',
        'Date prévue* (JJ/MM/AAAA)',
        'Date réception (JJ/MM/AAAA)',
        'Adresse chantier',
        'Département',
        'Statut (ATTENDU/ENCAISSE/EN_RETARD)',
        'Observations',
      ],
      example: [
        'FC-2026-001',
        'DUPONT Jean',
        'CTBG HOME RENOV',
        18000,
        'CLIENT_DIRECT',
        '',
        '14/04/2026',
        '',
        '12 rue de la Paix, 75002 Paris',
        '75',
        'ATTENDU',
        '',
      ],
    },
    charges: {
      sheetName: 'Charges',
      fileName: 'modele_import_charges.xlsx',
      headers: [
        'Libellé*',
        'Entité*',
        'Catégorie* (LOYER/SALAIRES/ASSURANCE/ABONNEMENT/CREDIT/IMPOT/AUTRE)',
        'Fréquence* (MENSUEL/TRIMESTRIEL/ANNUEL/HEBDOMADAIRE)',
        'Montant TTC*',
        'Prix variable (OUI/NON)',
        'Jour du mois (1-31)',
        'Date début* (JJ/MM/AAAA)',
        'Date fin (JJ/MM/AAAA)',
        'Observations',
      ],
      example: [
        'Loyer bureau Grigny',
        'CTBG GROUPE',
        'LOYER',
        'MENSUEL',
        3500,
        'NON',
        5,
        '01/01/2026',
        '',
        '',
      ],
    },
  };

  const tpl = templates[type];
  if (!tpl) {
    return Response.json(
      { error: `Type inconnu: ${type}. Types disponibles: ${Object.keys(templates).join(', ')}` },
      { status: 400 }
    );
  }

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create data array with headers and example row
  const data = [tpl.headers, tpl.example];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = tpl.headers.map((h) => ({ wch: Math.max(h.length, 18) }));

  XLSX.utils.book_append_sheet(wb, ws, tpl.sheetName);

  // Add instructions sheet
  const instrData = [
    ['INSTRUCTIONS D\'IMPORT'],
    [''],
    ['1. Remplissez les colonnes marquées * (obligatoires)'],
    ['2. Respectez le format des dates : JJ/MM/AAAA'],
    ['3. Les montants sont en euros, sans symbole €'],
    ['4. Les noms d\'entité doivent correspondre exactement aux entités CTBG'],
    ['5. Supprimez la ligne d\'exemple avant l\'import'],
    [''],
    ['ENTITÉS DISPONIBLES :'],
    ['CTBG HOME RENOV'],
    ['CTBG EP'],
    ['CTBG PREMIUM'],
    ['CTBG GROUPE'],
    ['CVH'],
    ['DOMOS ENERGIE'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
  wsInstr['!cols'] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  // Generate buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${tpl.fileName}"`,
    },
  });
}
