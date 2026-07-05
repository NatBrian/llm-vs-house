// Vercel serverless function: POST /api/decide -> one schema-validated LLM decision.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleDecide, type DecidePayload } from './handler';

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  try {
    const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as DecidePayload;
    const { status, json } = await handleDecide(payload);
    res.status(status).json(json);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'bad request' });
  }
}
