export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { priceFor } from '@/lib/pricing';

type Body = { ts: string; email: string; display_name?: string; message?: string; link_url?: string };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body.ts || !body.email) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  const d = new Date(body.ts);
  if (isNaN(d.getTime())) return NextResponse.json({ error: 'invalid_ts' }, { status: 400 });
  d.setMilliseconds(0);
  const tsISO = d.toISOString();

  const origin = new URL(req.url).origin;

  // ✅ pas d'apiVersion ici non plus
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

  const { price_cents, currency } = priceFor(tsISO);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        unit_amount: price_cents,
        product_data: {
          name: `Parcels of Time — ${tsISO}`,
          description: 'Exclusive symbolic claim to a unique second.',
        }
      }
    }],
    customer_email: body.email,
    metadata: {
      ts: tsISO,
      email: body.email,
      display_name: body.display_name ?? '',
      message: body.message ?? '',
      link_url: body.link_url ?? '',
    },
    success_url: `${origin}/api/checkout/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/claim?ts=${encodeURIComponent(tsISO)}&cancelled=1`,
  });

  return NextResponse.json({ url: session.url });
}
