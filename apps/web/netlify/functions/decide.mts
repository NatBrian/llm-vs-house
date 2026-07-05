// Netlify function: POST /api/decide (mapped via netlify.toml redirect).
import { handleDecide, type DecidePayload } from '../../server/handler';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405 });
  try {
    const payload = (await req.json()) as DecidePayload;
    const { status, json } = await handleDecide(payload);
    return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'bad request' }), { status: 400 });
  }
};
