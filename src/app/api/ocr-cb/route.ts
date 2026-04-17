import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `Tu es un extracteur de transactions de relevés de carte bancaire (CB). Tu reçois une image d'un relevé bancaire CB et tu dois extraire TOUTES les transactions en JSON.

RÈGLES IMPORTANTES :
- Retourne UNIQUEMENT un tableau JSON valide, sans texte autour, sans markdown, sans backticks
- Chaque transaction est un objet avec : transactionDate, label, amount, transactionNumber
- Les dates sont en format YYYY-MM-DD
- Les montants sont des nombres décimaux positifs (ex: 125.50)
- Le numéro de transaction est le numéro de référence/opération s'il existe, sinon génère "CB-YYYY-MM-DD-montant"
- Le label est la description/libellé de la transaction (nom du commerçant, etc.)
- N'inclus PAS les totaux, soldes, ou lignes de résumé — uniquement les transactions individuelles
- Ignore les crédits/remboursements (montants négatifs)

Format attendu :
[
  {
    "transactionDate": "2025-03-15",
    "label": "CARREFOUR GRIGNY",
    "amount": 87.45,
    "transactionNumber": "0485291"
  }
]`;

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

    if (!file) {
      return Response.json(
        { error: { code: 'BAD_REQUEST', message: 'Aucun fichier fourni' } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    const isPDF = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');

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
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [fileBlock, { type: 'text', text: 'Extrais toutes les transactions de ce relevé CB en JSON. Uniquement les débits (pas les crédits).' }],
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const textBlock = response.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return Response.json(
        { error: { code: 'OCR_ERROR', message: 'Pas de réponse de Claude Vision' } },
        { status: 500 }
      );
    }

    let jsonText = textBlock.text.trim();
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    let transactions;
    try {
      transactions = JSON.parse(jsonText);
    } catch {
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        transactions = JSON.parse(jsonMatch[0]);
      } else {
        return Response.json(
          { error: { code: 'PARSE_ERROR', message: 'Impossible de parser les transactions' } },
          { status: 500 }
        );
      }
    }

    if (!Array.isArray(transactions)) {
      transactions = [transactions];
    }

    // Validate and clean transactions
    const cleaned = transactions
      .filter((t: Record<string, unknown>) => t.transactionDate && t.amount && Number(t.amount) > 0)
      .map((t: Record<string, unknown>) => ({
        transactionNumber: String(t.transactionNumber || `CB-${t.transactionDate}-${Number(t.amount).toFixed(2)}`),
        transactionDate: String(t.transactionDate),
        label: String(t.label || 'Transaction CB').substring(0, 200),
        amount: Number(t.amount),
      }));

    return Response.json({ data: cleaned });
  } catch (err) {
    console.error('OCR CB Error:', err);
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
