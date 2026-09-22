/**
 * Dashboard surfaces: analytics, subscriptions, the extras editor and the guides.
 * Auth and Supabase are stubbed, so this checks rendering and wiring, not the DB
 * (the SQL behind these screens is exercised directly against Postgres).
 */
import { launchChromium } from './browser.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const OUT = process.env.OUT_DIR || '/tmp/claude-0/-home-user-delivr/8f1d7cd8-f060-5e84-aef3-e097fa6a3f63/scratchpad'
const REF = 'ifgzciraogohycuvujip'
const USER_ID = '11111111-2222-3333-4444-555555555555'
const STORE_ID = '094f7c50-bb8a-41fe-a282-8e6c961ae9a0'

const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10)

const PLATFORM_STATS = {
  from: day(29), to: day(0),
  totals: {
    orders: 142, live_orders: 131, gmv: 3894.5, aov: 29.73,
    delivered: 128, cancelled: 11, rejection_rate: 7.7,
    qr_orders: 118, delivery_orders: 96, pickup_orders: 35, scans: 412,
  },
  income: { commission: 389.45, subscriptions: 108.0, adjustments: 0, total: 497.45 },
  payouts: 62.3, net: 435.15, pending: 214.8, paid: 282.65,
  series: Array.from({ length: 30 }, (_, i) => ({
    day: day(29 - i),
    orders: 3 + ((i * 7) % 9),
    gmv: 90 + ((i * 37) % 210),
    commission: 9 + ((i * 11) % 22),
  })),
  by_store: [
    { id: STORE_ID, name: 'Souvlaki Corner', orders: 71, gmv: 1902.4, aov: 26.8, commission: 190.24, cancelled: 4 },
    { id: 'b1', name: 'Pizza Napoli', orders: 38, gmv: 1204.1, aov: 31.7, commission: 120.41, cancelled: 5 },
    { id: 'b2', name: 'Ταβέρνα Μαρίνα', orders: 22, gmv: 788.0, aov: 35.8, commission: 78.8, cancelled: 2 },
  ],
  by_property: [
    { id: 'p1', name: 'Villa Aegean Blue', code: 'AEGEAN1', area: 'Ελούντα', orders: 54, gmv: 1688.2, payout: 42.1, scans: 190 },
    { id: 'p2', name: 'Sunset Apartment 2A', code: 'SUNSET2A', area: 'Άγιος Νικόλαος', orders: 41, gmv: 1102.5, payout: 0, scans: 142 },
  ],
  top_items: [
    { name: 'Πίτα γύρο χοιρινό', qty: 214, revenue: 898.8 },
    { name: 'Margherita', qty: 61, revenue: 579.5 },
    { name: 'Πατάτες τηγανητές', qty: 143, revenue: 500.5 },
  ],
  hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: h >= 12 && h <= 22 ? (h % 5) + 2 : 0 })),
  subscriptions: { active: 2, mrr: 108.0, past_due: 1, trials: 1 },
}

const PLANS = [
  { id: 'pl1', name: 'Basic', description: 'Δωρεάν, προμήθεια 12%', audience: 'store', price: 0,
    billing_cycle: 'month', trial_days: 0, commission_mode: 'commission', commission_value: 12,
    included_orders: null, features: [], is_active: true, sort_order: 1 },
  { id: 'pl2', name: 'Pro', description: 'Μειωμένη προμήθεια 6%', audience: 'store', price: 29,
    billing_cycle: 'month', trial_days: 14, commission_mode: 'commission', commission_value: 6,
    included_orders: null, features: [], is_active: true, sort_order: 2 },
]

const SUBS = [
  { id: 's1', plan_id: 'pl2', party_type: 'store', party_id: STORE_ID, status: 'active',
    price: 29, billing_cycle: 'month', started_on: day(20), trial_ends_on: null,
    next_charge_on: day(-10), cancelled_at: null, cancel_reason: null, notes: null,
    subscription_plans: { name: 'Pro', audience: 'store' } },
  { id: 's2', plan_id: 'pl2', party_type: 'store', party_id: 'b1', status: 'trial',
    price: 29, billing_cycle: 'month', started_on: day(3), trial_ends_on: day(-11),
    next_charge_on: null, cancelled_at: null, cancel_reason: null, notes: null,
    subscription_plans: { name: 'Pro', audience: 'store' } },
]

const MODIFIER_GROUPS = [{
  id: 'g1', item_id: 'i1', name: 'Extras', is_required: false, min_select: 0, max_select: 5, sort_order: 1,
  modifiers: [
    { id: 'm1', group_id: 'g1', name: 'Έξτρα τζατζίκι', price: 0.5, is_default: false, sort_order: 1 },
    { id: 'm2', group_id: 'g1', name: 'Χωρίς κρεμμύδι', price: 0, is_default: false, sort_order: 2 },
  ],
}]

const MENU_ITEMS = [{
  id: 'i1', store_id: STORE_ID, category_id: 'c1', name: 'Πίτα γύρο χοιρινό',
  description: 'Πατάτες, ντομάτα, τζατζίκι', price: 4.2, image_url: null, emoji: '🌯',
  is_available: true, is_popular: true, is_new: false, is_vegan: false, is_vegetarian: false,
  is_gluten_free: false, is_weight_based: false, unit: 'τεμ.', allergens: [], calories: null,
  sort_order: 1, modifier_groups: MODIFIER_GROUPS,
}]

const SETTINGS_ROW = {
  id: 1, platform_name: 'Delivr', currency: 'EUR', timezone: 'Europe/Athens', order_prefix: 'DLV',
  support_phone: '+302841000000', support_email: 'support@delivr.gr', support_whatsapp: null,
  brand_color: '#FF6B35', logo_url: null, terms_url: null,
  store_billing_mode: 'commission', store_billing_value: 10,
  property_billing_mode: 'none', property_billing_value: 0, property_billing_direction: 'payout',
  commission_base: 'subtotal', default_prep_time: 20,
  guest_requires_phone: true, guest_requires_email: false,
  allow_cash: true, allow_online_payment: false, allow_scheduled_orders: true,
  notify_store_email: true, notify_store_whatsapp: true, notify_property_email: false,
  app_url: 'http://localhost:5174',
}

const errors = []
const browser = await launchChromium({
  executablePath: '/opt/pw-browsers/chromium',
  proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:35779', bypass: 'localhost,127.0.0.1,::1' },
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'el-GR' })
ctx.setDefaultTimeout(9000)

// A signed-in admin, without touching the network.
await ctx.addInitScript(([ref, uid]) => {
  const session = {
    access_token: 'stub-access-token', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'stub-refresh',
    user: {
      id: uid, aud: 'authenticated', role: 'authenticated', email: 'admin@delivr.gr',
      app_metadata: {}, user_metadata: { full_name: 'Γιώργος Admin' },
      created_at: new Date().toISOString(),
    },
  }
  try {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session))
    localStorage.setItem('delivr_lang', 'el')
  } catch { /* private mode */ }
}, [REF, USER_ID])

const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))

await page.route('**://fonts.googleapis.com/**', r => r.abort())
await page.route('**://fonts.gstatic.com/**', r => r.abort())

const json = (route, body) => route.fulfill({
  status: 200, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body),
})

const captured = { rpc: [], writes: [] }

/** PostgREST returns a bare object when the client asked for .single(). */
const wantsSingle = (req) => (req.headers()['accept'] || '').includes('pgrst.object')

await page.route('**/*.supabase.co/**', async route => {
  const req = route.request()
  const url = req.url()
  const method = req.method()
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } })

  if (url.includes('/rpc/')) {
    const fn = url.split('/rpc/')[1].split('?')[0]
    let body = {}
    try { body = JSON.parse(req.postData() || '{}') } catch { /* GET rpc */ }
    captured.rpc.push({ fn, body })
    if (fn === 'delivr_platform_stats') return json(route, PLATFORM_STATS)
    if (fn === 'delivr_bill_subscriptions') {
      return json(route, { ok: true, created: 2, total: 58, period_start: day(20), period_end: day(0) })
    }
    return json(route, {})
  }

  if (method !== 'GET') {
    captured.writes.push({ url, method, body: req.postData() })
    return json(route, [{ id: 'new-id' }])
  }

  if (url.includes('/profiles')) {
    const row = {
      id: USER_ID, full_name: 'Γιώργος Admin', email: 'admin@delivr.gr', phone: null,
      role: 'admin', is_active: true, loyalty_points: 0, avatar_url: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    // .single() asks PostgREST for an object, not an array — mirror that here.
    return json(route, wantsSingle(req) ? row : [row])
  }
  if (url.includes('/platform_settings')) return json(route, wantsSingle(req) ? SETTINGS_ROW : [SETTINGS_ROW])
  if (url.includes('/subscription_plans')) return json(route, PLANS)
  if (url.includes('/subscriptions')) return json(route, SUBS)
  if (url.includes('/item_modifier_groups')) return json(route, MODIFIER_GROUPS)
  if (url.includes('/menu_items')) return json(route, MENU_ITEMS)
  if (url.includes('/menu_categories')) return json(route, [{ id: 'c1', name: 'Πίτες', description: null, sort_order: 1 }])
  if (url.includes('/stores')) {
    return json(route, [{
      id: STORE_ID, name: 'Souvlaki Corner', slug: 'souvlaki-corner', description: null,
      category: 'restaurant', cuisine_tags: [], address: 'Ρούσου Καπετανάκη 5', city: 'Άγιος Νικόλαος',
      lat: 35.19, lng: 25.71, phone: null, email: null, order_email: null, order_whatsapp: null,
      notify_email: true, notify_whatsapp: true, delivery_fee: 1.5, min_order_amount: 8,
      free_delivery_above: 25, avg_delivery_time: 25, delivery_radius_km: 10, pickup_radius_km: 20,
      pickup_discount_pct: 10, prep_time_min: 15, supports_delivery: true, supports_takeaway: true,
      accepts_cash: true, accepts_online: false, auto_accept: false, billing_mode: 'inherit',
      billing_value: 0, onboarding_status: 'active', is_open: true, is_active: true,
      is_promoted: false, rating: 4.6, review_count: 489, notes: null, created_at: new Date().toISOString(),
    }])
  }
  if (url.includes('/properties')) return json(route, [])
  if (url.includes('/orders')) return json(route, [])
  if (url.includes('/order_charges')) return json(route, [])
  if (url.includes('/store_users')) return json(route, [])
  if (url.includes('/auth/v1/user')) {
    return json(route, { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'admin@delivr.gr' })
  }
  return json(route, [])
})

const shot = async p => { try { await page.screenshot({ path: p, fullPage: true, timeout: 7000 }) } catch { /* diagnostics */ } }
const step = async (name, fn) => {
  try { await fn(); console.log(`✅ ${name}`) }
  catch (e) {
    console.log(`❌ ${name} — ${e.message.split('\n').slice(0, 3).join(' | ')}`)
    try { console.log('   page:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 260)) } catch { /* gone */ }
    process.exitCode = 1
  }
}

await step('Admin dashboard opens with the new tabs', async () => {
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Στατιστικά/ }).waitFor()
  for (const tab of ['Συνδρομές', 'Οδηγός', 'Χρεώσεις', 'Καταλύματα & QR']) {
    await page.getByRole('button', { name: new RegExp(tab) }).waitFor()
  }
})

await step('Analytics shows the P&L headline and per-store take rate', async () => {
  await page.getByRole('button', { name: /Στατιστικά/ }).click()
  await page.getByText('Τζίρος (GMV)').waitFor()
  const body = await page.locator('body').innerText()
  for (const needed of ['3.894,50', 'Έσοδα πλατφόρμας', '497,45', 'Μικτό κέρδος', 'take rate']) {
    if (!body.includes(needed)) throw new Error(`missing: ${needed}`)
  }
  // 389.45 commission on 3894.50 GMV = exactly 10.0%
  if (!body.includes('10,0%')) throw new Error('take rate not computed')
  if (!body.includes('Souvlaki Corner')) throw new Error('per-store table missing')
  if (!body.includes('Villa Aegean Blue')) throw new Error('per-property table missing')
  // 118 QR orders from 412 scans = 29%
  if (!body.includes('29%')) throw new Error('scan conversion not computed')
})
await shot(`${OUT}/08-admin-analytics.png`)

await step('Charts render as SVG with real geometry, not empty boxes', async () => {
  const paths = await page.locator('svg path[stroke-width="2"]').count()
  if (paths < 2) throw new Error(`expected two trend lines, found ${paths}`)
  const d = await page.locator('svg path[stroke-width="2"]').first().getAttribute('d')
  if (!d || d.split('L').length < 10) throw new Error('trend line has too few points')
  const bars = await page.locator('[aria-label="Παραγγελίες ανά ώρα"] > div').count()
  if (bars !== 24) throw new Error(`hour chart should have 24 bars, found ${bars}`)
})

await step('Subscriptions shows MRR and bills a period', async () => {
  await page.getByRole('button', { name: /Συνδρομές/ }).click()
  await page.getByText('MRR').first().waitFor()
  const body = await page.locator('body').innerText()
  if (!body.includes('29,00')) throw new Error(`MRR wrong (one active Pro at 29): ${body.slice(0, 200)}`)
  if (!body.includes('Σε δοκιμή')) throw new Error('trial counter missing')
  if (!body.includes('Basic') || !body.includes('Pro')) throw new Error('plans table missing')

  await page.getByRole('button', { name: /Έκδοση χρεώσεων περιόδου/ }).click()
  await page.waitForTimeout(800)
  const billed = captured.rpc.find(r => r.fn === 'delivr_bill_subscriptions')
  if (!billed) throw new Error('billing run never called the server')
  if (!/^\d{4}-\d{2}-01$/.test(billed.body.p_period)) throw new Error(`bad period: ${billed.body.p_period}`)
})
await shot(`${OUT}/09-subscriptions.png`)

await step('Admin guide renders and carries the printable store handout', async () => {
  await page.getByRole('button', { name: /Οδηγός/ }).click()
  await page.getByText('Στήσιμο μιας νέας περιοχής').waitFor()
  await page.getByText('Πώς αποφασίζεται ποιος παραδίδει πού').waitFor()
  const handout = page.locator('.handout')
  await handout.waitFor()
  const text = await handout.innerText()
  if (!text.includes('Καλώς ήρθες στο Delivr')) throw new Error('handout title missing')
  if (!text.includes('support@delivr.gr')) throw new Error('handout does not pull support details from settings')
  await page.getByRole('button', { name: 'EN' }).last().click()
  await page.waitForTimeout(300)
  if (!(await handout.innerText()).includes('Welcome to Delivr')) throw new Error('handout has no English version')
})
await shot(`${OUT}/10-admin-guide.png`)

await step('Merchant menu exposes the extras editor', async () => {
  await page.goto(`${BASE}/merchant`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Μενού/ }).click()
  await page.getByText('Πίτα γύρο χοιρινό').first().waitFor()
  const body = await page.locator('body').innerText()
  if (!body.includes('+2 extras')) throw new Error('item does not show its extras count')

  await page.getByTitle('Extras & επιλογές').first().click()
  await page.getByRole('dialog').getByText('Έξτρα τζατζίκι').waitFor()
  const modal = await page.getByRole('dialog').innerText()
  if (!modal.includes('Γρήγορη προσθήκη')) throw new Error('presets missing')
})
await shot(`${OUT}/11-extras-editor.png`)

await step('A preset builds a full option group ready to save', async () => {
  await page.getByRole('button', { name: /Μέγεθος πίτσας/ }).click()
  await page.getByText('Επιλογές').first().waitFor()
  const modal = page.getByRole('dialog')
  const text = await modal.innerText()
  if (!text.includes('Υποχρεωτική επιλογή')) throw new Error('required toggle missing')
  const values = await modal.locator('input:not([type="checkbox"])').evaluateAll(
    els => els.map(e => e.value))
  if (!values.includes('Μεσαία 30cm')) throw new Error(`preset options not loaded: ${values.join('|')}`)
  if (!values.includes('3')) throw new Error('preset price not loaded')

  await modal.getByRole('button', { name: /Αποθήκευση ομάδας/ }).click()
  await page.waitForTimeout(900)
  const wrote = captured.writes.some(w => w.url.includes('item_modifier_groups') && w.method === 'POST')
  if (!wrote) throw new Error('group was never written')
  const wroteOptions = captured.writes.some(w => w.url.includes('item_modifiers') && w.method === 'POST')
  if (!wroteOptions) throw new Error('options were never written')
})

await step('Store guide is available to the merchant', async () => {
  await page.goto(`${BASE}/merchant`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Οδηγός/ }).click()
  await page.getByText('Πώς φτάνει και πώς απαντάς σε μια παραγγελία').waitFor()
  await page.getByText('Το μενού σου').click()
  await page.getByText('Extras και επιλογές ανά προϊόν').waitFor()
  const body = await page.locator('body').innerText()
  if (!body.includes('Κάτι δεν δουλεύει;')) throw new Error('troubleshooting block missing')
})
await shot(`${OUT}/12-store-guide.png`)

const realErrors = errors.filter(e =>
  !e.includes('WebSocket') && !e.includes('realtime') && !e.includes('Failed to load resource'))
console.log('\nConsole errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5), null, 1) : 'none')
if (realErrors.length) process.exitCode = 1

await browser.close()
