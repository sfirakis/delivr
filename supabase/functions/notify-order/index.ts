// ============================================================
// notify-order — sends a new order to the store
//
// Channels:
//   • Email (Resend) with a one-tap confirmation link that needs no login
//   • Copy to the platform support address and, optionally, the property owner
//   • Returns a ready-to-open wa.me link for the WhatsApp hand-off
//
// Every attempt is written to order_dispatch_log, so the admin dashboard can
// show what actually left the building. A missing RESEND_API_KEY is not an
// error: the order still stands and the store link is returned for manual use.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const eur = (n: unknown) => `${Number(n ?? 0).toFixed(2)} €`

interface OrderItem {
  name: string; quantity: number; price: number
  modifiers: { name: string; price: number }[] | null
  notes: string | null; subtotal: number
}

// ── Email templates (EL / EN) ────────────────────────────────
const T = {
  el: {
    subject: (n: string, type: string) => `🛵 Νέα παραγγελία ${n} — ${type}`,
    newOrder: 'ΝΕΑ ΠΑΡΑΓΓΕΛΙΑ', delivery: 'Delivery', takeaway: 'Take away',
    customer: 'Πελάτης', phone: 'Τηλέφωνο', address: 'Διεύθυνση παράδοσης',
    items: 'Προϊόντα', subtotal: 'Υποσύνολο', discount: 'Έκπτωση',
    deliveryFee: 'Μεταφορικά', total: 'ΣΥΝΟΛΟ', payment: 'Πληρωμή',
    cash: 'Μετρητά κατά την παράδοση', notes: 'Σημειώσεις',
    cta: 'Άνοιγμα & επιβεβαίωση παραγγελίας',
    ctaHint: 'Από τον σύνδεσμο μπορείτε να αποδεχθείτε, να απορρίψετε και να εκτυπώσετε την παραγγελία. Δεν χρειάζεται λογαριασμός.',
    scheduled: 'Προγραμματισμένη για',
    footer: 'Αυτό το email στάλθηκε αυτόματα από το',
  },
  en: {
    subject: (n: string, type: string) => `🛵 New order ${n} — ${type}`,
    newOrder: 'NEW ORDER', delivery: 'Delivery', takeaway: 'Take away',
    customer: 'Customer', phone: 'Phone', address: 'Delivery address',
    items: 'Items', subtotal: 'Subtotal', discount: 'Discount',
    deliveryFee: 'Delivery fee', total: 'TOTAL', payment: 'Payment',
    cash: 'Cash on delivery', notes: 'Notes',
    cta: 'Open & confirm the order',
    ctaHint: 'From this link you can accept, reject and print the order. No account needed.',
    scheduled: 'Scheduled for',
    footer: 'This email was sent automatically by',
  },
}

function buildEmailHtml(o: Record<string, any>, items: OrderItem[], confirmUrl: string, lang: 'el' | 'en') {
  const t = T[lang]
  const addr = o.delivery_address ?? {}
  const isDelivery = o.delivery_type === 'delivery'

  const itemRows = items.map(it => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">
        <strong>${it.quantity}× ${esc(it.name)}</strong>
        ${it.modifiers?.length ? `<div style="font-size:12px;color:#666;">+ ${esc(it.modifiers.map(m => m.name).join(', '))}</div>` : ''}
        ${it.notes ? `<div style="font-size:12px;color:#c2410c;font-weight:600;">✏️ ${esc(it.notes)}</div>` : ''}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${eur(it.subtotal)}</td>
    </tr>`).join('')

  return `<!doctype html>
<html lang="${lang}"><body style="margin:0;padding:0;background:#f5f5f5;font-family:Verdana,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#1a1814;padding:20px 24px;">
          <div style="color:#ffffff;font-size:12px;letter-spacing:1px;">${t.newOrder}</div>
          <div style="color:#ffffff;font-size:24px;font-weight:bold;">${esc(o.order_number)}</div>
          <div style="color:#ff8c66;font-size:14px;margin-top:4px;">
            ${isDelivery ? '🏠 ' + t.delivery : '🥡 ' + t.takeaway}
          </div>
        </td></tr>

        ${o.scheduled_for ? `<tr><td style="background:#eff6ff;padding:10px 24px;color:#1d4ed8;font-weight:bold;font-size:14px;">
          🕒 ${t.scheduled}: ${esc(new Date(o.scheduled_for).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB'))}
        </td></tr>` : ''}

        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;">${t.customer}</p>
          <p style="margin:0;font-size:16px;font-weight:bold;">${esc(o.guest_name)}</p>
          ${o.guest_phone ? `<p style="margin:2px 0 0;font-size:14px;">📞 <a href="tel:${esc(o.guest_phone)}" style="color:#1a1a1a;">${esc(o.guest_phone)}</a></p>` : ''}

          ${isDelivery ? `
            <p style="margin:16px 0 4px;font-size:12px;color:#888;text-transform:uppercase;">${t.address}</p>
            ${addr.label ? `<p style="margin:0;font-weight:bold;">${esc(addr.label)}</p>` : ''}
            <p style="margin:0;font-size:14px;">${esc(addr.street ?? '')}</p>
            ${addr.floor || addr.doorbell ? `<p style="margin:0;font-size:13px;color:#666;">${esc([addr.floor, addr.doorbell].filter(Boolean).join(' · '))}</p>` : ''}
            ${addr.notes ? `<p style="margin:4px 0 0;font-size:13px;color:#666;font-style:italic;">${esc(addr.notes)}</p>` : ''}
          ` : ''}

          <p style="margin:20px 0 6px;font-size:12px;color:#888;text-transform:uppercase;">${t.items}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            ${itemRows}
            <tr><td style="padding:10px 0 0;color:#666;">${t.subtotal}</td>
                <td style="padding:10px 0 0;text-align:right;">${eur(o.subtotal)}</td></tr>
            ${Number(o.discount_amount) > 0 ? `<tr><td style="color:#16a34a;">${t.discount}</td>
                <td style="text-align:right;color:#16a34a;">−${eur(o.discount_amount)}</td></tr>` : ''}
            ${Number(o.delivery_fee) > 0 ? `<tr><td style="color:#666;">${t.deliveryFee}</td>
                <td style="text-align:right;">${eur(o.delivery_fee)}</td></tr>` : ''}
            <tr><td style="padding-top:8px;font-size:18px;font-weight:bold;">${t.total}</td>
                <td style="padding-top:8px;font-size:18px;font-weight:bold;text-align:right;">${eur(o.total)}</td></tr>
          </table>

          <p style="margin:14px 0 0;font-size:14px;">
            💶 <strong>${t.payment}:</strong> ${o.payment_method === 'cash' ? t.cash : esc(o.payment_method)}
          </p>

          ${o.customer_notes ? `<p style="margin:14px 0 0;padding:10px;background:#fffbeb;border-radius:8px;font-size:13px;">
            📝 <strong>${t.notes}:</strong> ${esc(o.customer_notes)}</p>` : ''}
        </td></tr>

        <tr><td style="padding:0 24px 24px;">
          <a href="${confirmUrl}" style="display:block;background:#ff4500;color:#ffffff;text-decoration:none;
             padding:16px;border-radius:10px;text-align:center;font-weight:bold;font-size:16px;">
            ${t.cta}
          </a>
          <p style="margin:10px 0 0;font-size:12px;color:#888;text-align:center;">${t.ctaHint}</p>
        </td></tr>

        <tr><td style="background:#fafafa;padding:14px 24px;font-size:11px;color:#999;text-align:center;">
          ${t.footer} ${esc(o.platform_name ?? 'Delivr')}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function buildWhatsAppText(o: Record<string, any>, items: OrderItem[], trackUrl: string, lang: 'el' | 'en') {
  const t = T[lang]
  const addr = o.delivery_address ?? {}
  const L: string[] = []
  L.push(`🛵 *${t.newOrder}* — ${o.order_number}`)
  L.push(o.delivery_type === 'delivery' ? `🏠 ${t.delivery}` : `🥡 ${t.takeaway}`)
  if (o.delivery_type === 'delivery') {
    L.push(`📍 ${addr.label ? addr.label + ' — ' : ''}${addr.street ?? ''}`)
    if (addr.floor || addr.doorbell) L.push(`   ${[addr.floor, addr.doorbell].filter(Boolean).join(' · ')}`)
  }
  L.push(`👤 ${o.guest_name}${o.guest_phone ? ` — ${o.guest_phone}` : ''}`)
  L.push('')
  for (const it of items) {
    L.push(`${it.quantity}× ${it.name} — ${eur(it.subtotal)}`)
    if (it.modifiers?.length) L.push(`   + ${it.modifiers.map(m => m.name).join(', ')}`)
    if (it.notes) L.push(`   ✏️ ${it.notes}`)
  }
  L.push('')
  L.push(`*${t.total}: ${eur(o.total)}*`)
  L.push(`💳 ${o.payment_method === 'cash' ? t.cash : o.payment_method}`)
  if (o.customer_notes) L.push(`📝 ${o.customer_notes}`)
  L.push('')
  L.push(trackUrl)
  return L.join('\n')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { order_id, public_token, lang: rawLang } = await req.json()
    const lang: 'el' | 'en' = rawLang === 'en' ? 'en' : 'el'

    if (!order_id || !public_token) return json({ ok: false, error: 'MISSING_PARAMS' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // public_token proves the caller is the guest who just placed this order.
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, stores(*), properties(name, code, contact_email, address, area)')
      .eq('id', order_id)
      .eq('public_token', public_token)
      .single()

    if (error || !order) return json({ ok: false, error: 'ORDER_NOT_FOUND' }, 404)

    const { data: items } = await supabase
      .from('order_items').select('*').eq('order_id', order_id)

    const { data: settings } = await supabase
      .from('platform_settings').select('*').eq('id', 1).single()

    const store = order.stores as Record<string, any>
    const property = order.properties as Record<string, any> | null
    const appUrl = (settings?.app_url ?? '').replace(/\/$/, '') || 'http://localhost:5173'
    const confirmUrl = `${appUrl}/s/${order.store_token}`
    const trackUrl = `${appUrl}/t/${order.public_token}`

    const orderView = { ...order, platform_name: settings?.platform_name ?? 'Delivr' }
    const orderItems = (items ?? []) as OrderItem[]

    const results: Record<string, unknown> = {}
    const logs: Record<string, unknown>[] = []

    // ── Email ────────────────────────────────────────────────
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('RESEND_FROM') ?? 'Delivr <onboarding@resend.dev>'
    const storeEmail = store.order_email || store.email
    const wantsEmail = (settings?.notify_store_email ?? true) && store.notify_email !== false

    if (!resendKey) {
      results.email = 'skipped_no_key'
      logs.push({ order_id, channel: 'email', target: storeEmail ?? null, status: 'skipped',
                  provider: 'resend', error: 'RESEND_API_KEY not configured' })
    } else if (!wantsEmail || !storeEmail) {
      results.email = 'skipped_disabled'
      logs.push({ order_id, channel: 'email', target: storeEmail ?? null, status: 'skipped',
                  provider: 'resend', error: !storeEmail ? 'store has no email' : 'notifications disabled' })
    } else {
      const to = [storeEmail]
      if (settings?.support_email) to.push(settings.support_email)
      if (settings?.notify_property_email && property?.contact_email) to.push(property.contact_email)

      const html = buildEmailHtml(orderView, orderItems, confirmUrl, lang)
      const subject = T[lang].subject(order.order_number,
        order.delivery_type === 'delivery' ? T[lang].delivery : T[lang].takeaway)

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html, reply_to: settings?.support_email ?? undefined }),
      })

      const body = await res.text()
      results.email = res.ok ? 'sent' : `failed_${res.status}`
      logs.push({ order_id, channel: 'email', target: to.join(', '),
                  status: res.ok ? 'sent' : 'failed', provider: 'resend',
                  error: res.ok ? null : body.slice(0, 500) })
    }

    // ── Guest confirmation copy ──────────────────────────────
    if (resendKey && order.guest_email) {
      const guestHtml = `<!doctype html><html><body style="font-family:Verdana,Arial,sans-serif;padding:20px;">
        <h2 style="color:#1a1814;">${lang === 'el' ? 'Η παραγγελία σου καταχωρήθηκε' : 'Your order was placed'}</h2>
        <p>${lang === 'el' ? 'Αριθμός' : 'Number'}: <strong>${esc(order.order_number)}</strong> — ${esc(store.name)}</p>
        <p>${lang === 'el' ? 'Σύνολο' : 'Total'}: <strong>${eur(order.total)}</strong></p>
        <p><a href="${trackUrl}" style="background:#ff4500;color:#fff;padding:12px 20px;border-radius:8px;
           text-decoration:none;display:inline-block;">
           ${lang === 'el' ? 'Παρακολούθηση παραγγελίας' : 'Track your order'}</a></p>
      </body></html>`

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to: [order.guest_email],
          subject: lang === 'el' ? `Η παραγγελία σου ${order.order_number}` : `Your order ${order.order_number}`,
          html: guestHtml,
        }),
      })
      results.guest_email = res.ok ? 'sent' : 'failed'
      logs.push({ order_id, channel: 'email', target: order.guest_email,
                  status: res.ok ? 'sent' : 'failed', provider: 'resend' })
    }

    // ── WhatsApp hand-off link ───────────────────────────────
    const waPhone = String(store.order_whatsapp || store.phone || '').replace(/\D/g, '')
    const waText = buildWhatsAppText(orderView, orderItems, trackUrl, lang)
    const waUrl = waPhone.length >= 8
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`
      : null

    if (waUrl && (settings?.notify_store_whatsapp ?? true) && store.notify_whatsapp !== false) {
      results.whatsapp = 'link_ready'
      logs.push({ order_id, channel: 'whatsapp', target: waPhone, status: 'manual', provider: 'wa.me' })
    } else {
      results.whatsapp = 'skipped'
    }

    if (logs.length > 0) await supabase.from('order_dispatch_log').insert(logs)

    return json({
      ok: true,
      results,
      whatsapp_url: waUrl,
      track_url: trackUrl,
    })
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 500)
  }
})
