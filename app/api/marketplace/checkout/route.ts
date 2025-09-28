//app/api/marketplace/checkout/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(req: Request, ctx: { params: { ts: string } }) {
  const { ts } = ctx.params; // 'YYYY-MM-DD' ou 'YYYY-MM-DD.suffix'
  const tsDay = ts.split('.')[0]; // On ne garde que la date pure côté metadata

  const body = await req.json();

  // … récupère/valide listing_id + toutes les options modifiables :
  const listing_id = Number(body?.listing_id || 0);
  if (!listing_id || !tsDay) {
    return NextResponse.json({ ok: false, error: 'bad_input' }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/marketplace/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.NEXT_PUBLIC_BASE_URL}/marketplace/cancel`,
    // Prix, devise et item doivent correspondre au listing
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: Number(body?.price_cents || 0), // ou relire depuis la BDD après vérif
        product_data: { name: body?.product_name || 'Secondary sale' }
      },
      quantity: 1
    }],
    // ✅ IMPORTANT : tout ce qui doit être appliqué côté DB est passé en metadata
    metadata: {
      market_kind: 'secondary',
      listing_id: String(listing_id),
      ts: tsDay,

      // champs modifiables
      display_name:  String(body?.display_name || ''),
      title:         String(body?.title || ''),
      message:       String(body?.message || ''),
      link_url:      String(body?.link_url || ''),
      cert_style:    String(body?.cert_style || ''),
      time_display:  String(body?.time_display || ''),
      local_date_only: body?.local_date_only ? '1' : '0',
      text_color:      String(body?.text_color || ''),
      title_public:    body?.title_public ? '1' : '0',
      message_public:  body?.message_public ? '1' : '0',
      public_registry: body?.public_registry ? '1' : '0',
      custom_bg_key:   String(body?.custom_bg_key || ''),
      locale:          String(body?.locale || ''),
    },
  });

  return NextResponse.json({ ok: true, id: session.id, url: session.url });
}
