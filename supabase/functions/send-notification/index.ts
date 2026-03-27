// supabase/functions/send-notification/index.ts
// Multi-channel notification dispatcher
// Channels: In-app (Supabase), Push (FCM), SMS (Twilio), Email (Resend)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── SMS via Twilio ───────────────────────────────────────────
async function sendSMS(to: string, body: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

  if (!accountSid || !authToken || !fromNumber) return

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
    }
  )
  const data = await response.json()
  if (!response.ok) console.error('Twilio error:', data)
  return data
}

// ─── Email via Resend ─────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Delivr <orders@delivr.app>',
      to:   [to],
      subject,
      html,
    }),
  })
  return response.json()
}

// ─── Push via FCM (Firebase Cloud Messaging) ──────────────────
async function sendPushNotification(fcmToken: string, title: string, body: string, data: Record<string,string> = {}) {
  const serverKey = Deno.env.get('FCM_SERVER_KEY')
  if (!serverKey || !fcmToken) return

  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Authorization': `key=${serverKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: fcmToken,
      notification: { title, body, icon: '/icon-192.png', badge: '/badge-72.png' },
      data,
    }),
  })
  return response.json()
}

// ─── Order status email template ─────────────────────────────
function orderStatusEmailHTML(params: {
  customerName: string
  storeName: string
  orderId: string
  status: string
  total: number
  eta?: string
  trackingUrl: string
}) {
  const statusMessages: Record<string, string> = {
    confirmed:  '✓ Η παραγγελία σου επιβεβαιώθηκε!',
    preparing:  '👨‍🍳 Το κατάστημα ετοιμάζει την παραγγελία σου',
    on_the_way: '🛵 Ο rider είναι στο δρόμο!',
    delivered:  '📦 Η παραγγελία παραδόθηκε!',
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background:#f0eee9;font-family:'DM Sans',Arial,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;margin-top:24px;">

        <!-- Header -->
        <div style="background:#1a1814;padding:32px 24px;text-align:center;">
          <h1 style="color:#ff4500;font-size:32px;font-weight:900;margin:0;letter-spacing:-1px;">delivr</h1>
        </div>

        <!-- Status -->
        <div style="background:#fff8f6;border-left:4px solid #ff4500;padding:20px 24px;margin:24px;">
          <p style="font-size:18px;font-weight:700;color:#1a1814;margin:0 0 4px;">
            ${statusMessages[params.status] ?? 'Ενημέρωση παραγγελίας'}
          </p>
          <p style="font-size:13px;color:#6b6760;margin:0;">
            Παραγγελία #${params.orderId.slice(0,8).toUpperCase()} · ${params.storeName}
          </p>
        </div>

        <!-- Details -->
        <div style="padding:0 24px 24px;">
          <p style="font-size:15px;color:#1a1814;margin:0 0 16px;">
            Γεια σου, <strong>${params.customerName}</strong>!
          </p>

          ${params.eta ? `
          <div style="background:#f8f7f5;border-radius:12px;padding:16px;margin-bottom:16px;text-align:center;">
            <p style="font-size:12px;color:#a8a49e;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Εκτιμώμενη παράδοση</p>
            <p style="font-size:22px;font-weight:900;color:#ff4500;margin:0;">${params.eta}</p>
          </div>` : ''}

          <!-- CTA -->
          <a href="${params.trackingUrl}"
             style="display:block;background:#ff4500;color:#fff;text-align:center;padding:16px;border-radius:50px;
                    text-decoration:none;font-weight:700;font-size:15px;margin-bottom:16px;">
            📍 Παρακολούθηση παραγγελίας
          </a>

          <!-- Total -->
          <div style="display:flex;justify-content:space-between;border-top:1px solid #f0eee9;padding-top:16px;">
            <span style="color:#6b6760;font-size:13px;">Σύνολο παραγγελίας</span>
            <span style="font-weight:700;color:#ff4500;font-size:15px;">€${params.total.toFixed(2)}</span>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#f8f7f5;padding:16px 24px;text-align:center;">
          <p style="font-size:11px;color:#a8a49e;margin:0;">
            © 2025 Delivr · <a href="#" style="color:#a8a49e;">Unsubscribe</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

// ─── Main handler ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const payload = await req.json()
    const { userId, storeId, title, body, type, data = {} } = payload

    const results: Record<string, unknown> = {}

    // ── In-app notification (always) ──────────────────────────
    if (userId) {
      const { error } = await supabase.from('notifications').insert({
        user_id:   userId,
        title,
        body,
        type,
        data,
        is_read:   false,
        created_at: new Date().toISOString(),
      })
      results.inApp = error ? { error: error.message } : { success: true }
    }

    // ── Get user preferences & contact info ───────────────────
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, fcm_token, notification_preferences')
        .eq('id', userId)
        .single()

      const prefs = profile?.notification_preferences ?? { sms: true, email: true, push: true }

      // ── Push notification ──────────────────────────────────
      if (prefs.push && profile?.fcm_token) {
        results.push = await sendPushNotification(
          profile.fcm_token, title, body,
          Object.fromEntries(Object.entries(data).map(([k,v]) => [k, String(v)]))
        )
      }

      // ── SMS ───────────────────────────────────────────────
      if (prefs.sms && profile?.phone) {
        const smsBody = `${title}\n${body}\nDelivr App`
        results.sms = await sendSMS(profile.phone, smsBody)
      }

      // ── Email ─────────────────────────────────────────────
      if (prefs.email && data.orderId && data.status) {
        const { data: userEmail } = await supabase.auth.admin.getUserById(userId)
        if (userEmail?.user?.email) {
          const html = orderStatusEmailHTML({
            customerName: profile?.full_name ?? 'Φίλε',
            storeName:    data.storeName ?? 'Κατάστημα',
            orderId:      data.orderId,
            status:       data.status,
            total:        Number(data.total ?? 0),
            eta:          data.eta,
            trackingUrl:  `${Deno.env.get('APP_URL') ?? 'https://delivr.app'}/track/${data.orderId}`,
          })
          results.email = await sendEmail(
            userEmail.user.email,
            `${title} — Delivr`,
            html
          )
        }
      }
    }

    // ── Merchant notification (store-level) ───────────────────
    if (storeId && type === 'new_order') {
      // Notify all merchant users for this store
      const { data: merchantUsers } = await supabase
        .from('store_users')
        .select('user_id, fcm_token')
        .eq('store_id', storeId)

      for (const mu of merchantUsers ?? []) {
        if (mu.fcm_token) {
          await sendPushNotification(mu.fcm_token, title, body, {
            type: 'new_order',
            orderId: data.orderId ?? '',
          })
        }
        // In-app notification for merchant
        await supabase.from('notifications').insert({
          user_id: mu.user_id,
          title, body, type,
          data,
        })
      }
      results.merchantNotified = merchantUsers?.length ?? 0
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('send-notification error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
