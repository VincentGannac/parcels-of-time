//app/api/marketplace/confirm/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function GET(req: Request, _ctx: { params: { ts: string } }) {
  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get('session_id') || '';
  if (!session_id) {
    return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const s = await stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] });

  // Ici, on NE réécrit rien en DB : le webhook fait foi.
  // On renvoie juste l’état au client.
  const paid = !s.payment_status || s.payment_status === 'paid';
  return NextResponse.json({
    ok: true,
    paid,
    market_kind: s.metadata?.market_kind || '',
  });
}
