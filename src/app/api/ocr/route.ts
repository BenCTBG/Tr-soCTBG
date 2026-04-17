import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `Tu es un extracteur de données de factures françaises. Tu reçois une image de facture (PDF converti en image) et tu dois extraire les informations suivantes en JSON.

RÈGLES IMPORTANTES :
- Retourne UNIQUEMENT un objet JSON valide, sans texte autour, sans markdown, sans backticks
- Les montants sont en format décimal avec point (ex: "1614.20", pas "1 614,20")
- Les dates sont en format YYYY-MM-DD
- Si un champ n'est pas trouvé, ne l'inclus pas dans le JSON (ne mets pas null)
- Pour le fournisseur : extrais le nom de l'entreprise qui ÉMET la facture
- Pour le client : extrais le nom du DESTINATAIRE de la facture
- Pour l'entité : cherche parmi les entités CTBG (CTBG PREMIUM, CTBG GROUPE, CTBG EP, CTBG HOME RENOV', CVH, DOMOS ENERGIE) celle qui apparaît sur la facture
- Pour le mode de paiement : VIREMENT, CHEQUE, CB, LCR, PRELEVEMENT
- Pour les conditions de paiement : extrais le texte (ex: "30 jours fin de mois")

Champs à extraire :
{
  "fournisseur": "Nom du fournisseur/émetteur",
  "client": "Nom du client/destinataire",
  "entityName": "Nom exact de l'entité CTBG facturée (parmi: CTBG PREMIUM, CTBG GROUPE, CTBG EP, CTBG HOME RENOV', CVH, DOMOS ENERGIE)",
  "dateFacture": "YYYY-MM-DD",
  "datePaiement": "YYYY-MM-DD (date d'échéance)",
  "montantHT": "1234.56",
  "montantTTC": "1481.47",
  "montantCEE": "500.00 (si prime CEE mentionnée)",
  "resteAPayer": "981.47 (si reste à payer mentionné)",
  "invoiceNumber": "Numéro de facture",
  "paymentMethod": "VIREMENT/CHEQUE/CB/LCR/PRELEVEMENT",
  "paymentTerms": "30 jours fin de mois",
  "siteAddress": "Adresse du chantier si mentionnée",
  "department": "Code département (2 chiffres, depuis le code postal du chantier)"
}`;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
      { status: 401 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: { code: 'CONFIG_ERROR', message: 'Clé API Anthropic non configurée' } },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileName = formData.get('fileName') as string | null;

    if (!file) {
      return Response.json(
        { error: { code: 'BAD_REQUEST', message: 'Aucun fichier fourni' } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    const isPDF = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');

    const userMessage = fileName
      ? `Analyse cette facture. Nom du fichier : "${fileName}". Extrais tous les champs en JSON.`
      : `Analyse cette facture et extrais tous les champs en JSON.`;

    // Build the content block based on file type
    let fileBlock: Anthropic.Messages.DocumentBlockParam | Anthropic.Messages.ImageBlockParam;
    if (isPDF) {
      fileBlock = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      };
    } else {
      let imgType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
      if (file.type === 'image/png') imgType = 'image/png';
      else if (file.type === 'image/webp') imgType = 'image/webp';
      fileBlock = {
        type: 'image',
        source: { type: 'base64', media_type: imgType, data: base64 },
      };
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [fileBlock, { type: 'text', text: userMessage }],
        },
      ],
      system: SYSTEM_PROMPT,
    });

    // Extract text from response
    const textBlock = response.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return Response.json(
        { error: { code: 'OCR_ERROR', message: 'Pas de réponse de Claude Vision' } },
        { status: 500 }
      );
    }

    // Parse JSON from response — handle potential markdown wrapping
    let jsonText = textBlock.text.trim();
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    let extracted;
    try {
      extracted = JSON.parse(jsonText);
    } catch {
      // Try to find JSON object in text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        return Response.json(
          { error: { code: 'PARSE_ERROR', message: 'Impossible de parser la réponse', raw: jsonText } },
          { status: 500 }
        );
      }
    }

    return Response.json({ data: extracted });
  } catch (err) {
    console.error('OCR API Error:', err);
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
