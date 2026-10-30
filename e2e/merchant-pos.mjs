/**
 * Merchant POS (/merchant): a signed-in store moves an order through the
 * kitchen steps. Every change must go through delivr_merchant_set_order_status
 * (migration 016) — never a direct write on `orders` (blocked since 011a) and
 * no longer the order's store_token. Supabase is mocked; nothing reaches live.
 *
 *   BASE_URL=http://localhost:5174 E2E_SUPABASE_REF=<ref of VITE_SUPABASE_URL> node e2e/merchant-pos.mjs
 */
import { launchChromium } from './browser.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const REF = process.env.E2E_SUPABASE_REF || 'ifgzciraogohycuvujip'
const SHOTS = process.env.SHOTS_DIR || null
const USER_ID = '22222222-3333-4444-5555-666666666666'
const STORE_ID = '7a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

const STORE = {
  id: STORE_ID, name: 'Souvlaki Corner', slug: 'souvlaki-corner', category: 'restaurant', cuisine_tags: [],
  address: 'Πλατεία 1', city: 'Άγιος Νικόλαος', lat: 35.19, lng: 25.72, phone: '6912345678',
  delivery_fee: 2, min_order_amount: 8, avg_delivery_time: 30, prep_time_min: 20,
  supports_delivery: true, supports_takeaway: true, accepts_cash: true, accepts_online: false,
  billing_mode: 'inherit', billing_value: 0, onboarding_status: 'active', is_open: true, is_active: true,
  is_promoted: false, rating: 0, review_count: 0, created_at: new Date().toISOString(),
  standalone_enabled: true, marketplace_listed: true, self_registered_at: null, requested_plan_id: null,
}

// The server's state machine, as the mock sees it (mirrors 016).
const NEXT = {
  accept: ['pending'], reject: ['pending', 'confirmed', 'preparing'], preparing: ['confirmed'],
  ready: ['confirmed', 'preparing'], on_the_way: ['ready'], delivered: ['on_the_way'],
}
const TO = { accept: 'confirmed', reject: 'cancelled', preparing: 'preparing', ready: 'ready',
  on_the_way: 'on_the_way', delivered: 'delivered' }

const order = {
  id: 'o-1', order_number: 'DLV-261030-0001', status: 'pending', channel: 'app', delivery_type: 'delivery',
  guest_name: 'Μαρία', guest_phone: '6900000001', customer_notes: null,
  delivery_address: { label: 'Σπίτι', street: 'Οδός 5', area: 'Κέντρο', city: 'Άγιος Νικόλαος' },
  subtotal: 12, delivery_fee: 2, discount_amount: 0, total: 14, payment_method: 'cash',
  prep_minutes: null, scheduled_for: null, estimated_ready_at: null,
  store_token: 'tok-1',        // only the ticket view (print) still reads by token
  public_token: 'pub', printed_at: null, created_at: new Date().toISOString(),
  order_items: [{ id: 'i1', name: 'Πίτα γύρος', quantity: 3, subtotal: 12, notes: null, modifiers: null }],
  properties: null,
}

const session = {
  access_token: 'stub-access-token', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'stub-refresh',
  user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'owner@test',
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
}

const errors = []
const calls = []          // every RPC the POS made
const writes = []         // any non-GET on a table (must stay empty for orders)
let forceStale = false    // simulate another device having moved the order already

const browser = await launchChromium()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'el-GR' })
await ctx.addInitScript(([ref, s]) => {
  try {
    if (!sessionStorage.getItem('e2e_init')) {
      localStorage.clear()
      localStorage.setItem('delivr_lang', 'el')
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
      sessionStorage.setItem('e2e_init', '1')
    }
  } catch { /* private mode */ }
}, [REF, session])
ctx.setDefaultTimeout(8000)
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))

const json = (route, body, status = 200) => route.fulfill({
  status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body),
})
const wantsSingle = (req) => (req.headers()['accept'] || '').includes('pgrst.object')

await page.route('**/*.supabase.co/**', async route => {
  const req = route.request(); const url = req.url(); const method = req.method()
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } })
  const body = (() => { try { return JSON.parse(req.postData() || '{}') } catch { return {} } })()

  if (url.includes('/auth/v1/user')) return json(route, session.user)
  if (url.includes('/auth/v1/')) return json(route, {})
  if (url.includes('/rpc/delivr_merchant_set_order_status')) {
    calls.push({ fn: 'delivr_merchant_set_order_status', ...body })
    const a = body.p_action
    if (a === 'print') { order.printed_at = new Date().toISOString(); return json(route, { ok: true, status: order.status, printed: true }) }
    if (forceStale || !NEXT[a]?.includes(order.status)) {
      forceStale = false
      return json(route, { code: 'P0001', message: 'BAD_TRANSITION', details: null, hint: null }, 400)
    }
    order.status = TO[a]
    if (a === 'accept') order.prep_minutes = body.p_prep_minutes
    return json(route, { ok: true, status: order.status, prep_minutes: order.prep_minutes })
  }
  if (url.includes('/rpc/delivr_store_order')) {
    return json(route, {
      order_id: order.id, order_number: order.order_number, status: order.status, service: 'delivery', channel: 'app',
      created_at: order.created_at, scheduled_for: null, prep_minutes: order.prep_minutes, estimated_ready_at: null,
      subtotal: 12, discount_amount: 0, delivery_fee: 2, total: 14, platform_fee: 1.2,
      payment_method: 'cash', payment_status: 'pending', promo_code: null, customer_notes: null, delivery_notes: null,
      cancel_reason: null, printed_at: null,
      guest: { name: 'Μαρία', phone: '6900000001', email: null },
      address: { label: 'Σπίτι', street: 'Οδός 5', doorbell: null }, property: null,
      store: { id: STORE_ID, name: STORE.name, phone: STORE.phone, address: STORE.address, logo_url: null,
               print_format: '80mm', prep_time_min: 20 },
      settings: { currency: 'EUR', platform_name: 'Delivr', support_phone: null },
      items: [{ name: 'Πίτα γύρος', quantity: 3, price: 4, modifiers: [], notes: null, subtotal: 12 }],
      events: [],
    })
  }
  if (url.includes('/rpc/')) { calls.push({ fn: url.split('/rpc/')[1].split('?')[0], ...body }); return json(route, [] ) }
  if (method !== 'GET') { writes.push({ url, method, body }); return json(route, []) }
  if (url.includes('/profiles')) {
    const row = { id: USER_ID, full_name: 'Owner', email: 'owner@test', phone: null, role: 'store',
      is_active: true, loyalty_points: 0, avatar_url: null, created_at: '', updated_at: '' }
    return json(route, wantsSingle(req) ? row : [row])
  }
  if (url.includes('/store_users')) return json(route, [{ store_id: STORE_ID, role: 'owner', stores: STORE }])
  if (url.includes('/orders')) return json(route, [order])
  if (url.includes('/stores')) return json(route, wantsSingle(req) ? STORE : [STORE])
  return json(route, [])
})

let failed = 0
const step = async (name, fn) => {
  try { await fn(); console.log(`✅ ${name}`) }
  catch (e) {
    failed++
    console.log(`❌ ${name} — ${e.message.split('\n').slice(0, 3).join(' | ')}`)
    try { console.log('   page:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300)) } catch { /* gone */ }
  }
}
const shot = async (name) => {
  if (!SHOTS) return
  try { await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 8000 }) } catch { /* people only */ }
}
const lastCall = () => calls.filter(c => c.fn === 'delivr_merchant_set_order_status').at(-1)
const waitFor = async (cond, what) => {
  for (let i = 0; i < 40; i++) { if (cond()) return; await page.waitForTimeout(100) }
  throw new Error(`timed out waiting for ${what}`)
}

await step('POS shows the pending order', async () => {
  await page.goto(`${BASE}/merchant`, { waitUntil: 'domcontentloaded' })
  await page.getByText('DLV-261030-0001').waitFor()
  await page.getByRole('button', { name: /Αποδοχή/ }).waitFor()
})
await shot('merchant-m-03-pos-pending')

await step('Accept goes through the signed-in RPC with the prep time', async () => {
  await page.getByRole('button', { name: '15′', exact: true }).click()
  await page.getByRole('button', { name: /Αποδοχή · 15′/ }).click()
  await waitFor(() => lastCall()?.p_action === 'accept', 'accept call')
  const c = lastCall()
  if (c.p_order_id !== 'o-1' || c.p_prep_minutes !== 15) throw new Error(JSON.stringify(c))
  await page.getByRole('button', { name: /Έναρξη ετοιμασίας/ }).waitFor()
})

await step('Print marks the order through the RPC (ticket still read by token)', async () => {
  await page.evaluate(() => { window.print = () => {} })
  await page.getByRole('button', { name: /Εκτύπωση/ }).first().click()
  await waitFor(() => lastCall()?.p_action === 'print', 'print call')
})

await step('Kitchen steps: preparing → ready → on the way → delivered', async () => {
  for (const [label, action] of [[/Έναρξη ετοιμασίας/, 'preparing'], [/Έτοιμη/, 'ready'], [/Έφυγε/, 'on_the_way'], [/Παραδόθηκε/, 'delivered']]) {
    await page.getByRole('button', { name: label }).click()
    await waitFor(() => lastCall()?.p_action === action, action)
  }
  await waitFor(() => order.status === 'delivered', 'delivered')
})

await step('A stale step shows a clear message and refreshes', async () => {
  order.status = 'confirmed'; order.printed_at = null
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Έναρξη ετοιμασίας/ }).waitFor()
  forceStale = true
  await page.getByRole('button', { name: /Έναρξη ετοιμασίας/ }).click()
  await page.getByText('Η παραγγελία έχει ήδη αλλάξει κατάσταση').waitFor()
})

await step('No direct writes on orders and no token RPC from the POS', async () => {
  const bad = writes.filter(w => w.url.includes('/orders') || w.url.includes('/order_events'))
  if (bad.length) throw new Error('direct writes: ' + JSON.stringify(bad))
  if (calls.some(c => c.fn === 'delivr_store_action')) throw new Error('POS still uses delivr_store_action')
})

await step('No console errors', async () => {
  const real = errors.filter(e => !/favicon|Failed to load resource|400|WebSocket|realtime/.test(e))
  if (real.length) throw new Error(real.slice(0, 3).join(' | '))
})

await browser.close()
console.log(failed ? `\n${failed} failed` : '\nAll merchant POS checks passed')
process.exitCode = failed ? 1 : 0
