/**
 * End-to-end walk of a store's own ordering link (/store/<slug>) — the flow a
 * shop uses when it is not one of our properties' neighbours. Supabase is
 * unreachable from this sandbox, so every RPC is answered with a payload
 * shaped exactly like the real one.
 */
import { launchChromium } from './browser.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const OUT = process.env.OUT_DIR || '/tmp/claude-0/-home-user-delivr/8f1d7cd8-f060-5e84-aef3-e097fa6a3f63/scratchpad'

const STORE_ID = '4f2e6d70-2b5a-4c8e-9d31-7c9a1f0e5b22'

const STORE = {
  id: STORE_ID, slug: 'taverna-marina', name: 'Ταβέρνα Μαρίνα',
  description: 'Ψάρι και κρητική κουζίνα', intro: 'Παραγγείλετε απευθείας από εμάς.',
  category: 'restaurant', cuisine_tags: ['ψαροταβέρνα'], logo_url: null, cover_url: null,
  address: 'Ακτή Ελούντας 3', city: 'Ελούντα', phone: '+302841041000',
  rating: 4.8, review_count: 210, discount_pct: null, pickup_discount_pct: 10,
  delivery_fee: 3, min_order: 12, free_above: null, eta_min: 35, prep_min: 25,
  supports_delivery: true, supports_takeaway: true, accepts_cash: true, is_open_now: true,
  zones_required: true,
  zones: [
    { id: 'z1', name: 'Άγιος Νικόλαος - Κέντρο', area: 'Άγιος Νικόλαος', city: 'Άγιος Νικόλαος',
      postal_code: '72100', fee: 2, min_order: 12, free_above: 35, extra_min: 0 },
    { id: 'z2', name: 'Ελούντα', area: 'Ελούντα', city: 'Ελούντα',
      postal_code: '72053', fee: 4.5, min_order: 25, free_above: 60, extra_min: 15 },
  ],
}

const CATEGORIES = [{ id: 'c1', name: 'Θαλασσινά', description: null, sort_order: 1 }]
const ITEMS = [
  { id: 'i1', category_id: 'c1', name: 'Αρνί αντικριστό', description: 'Ψημένο στα κάρβουνα',
    price: 18.5, image_url: null, emoji: '🍖', is_available: true, is_popular: true, is_vegan: false,
    is_vegetarian: false, is_gluten_free: false, allergens: [], sort_order: 1, item_modifier_groups: [] },
]

const SETTINGS = {
  platform_name: 'Delivr', currency: 'EUR', timezone: 'Europe/Athens', brand_color: '#FF6B35',
  logo_url: null, support_phone: null, support_email: null, support_whatsapp: null, terms_url: null,
  allow_cash: true, allow_online_payment: false, allow_scheduled_orders: true,
  guest_requires_phone: true, guest_requires_email: false, default_prep_time: 20,
}

const TOKEN = 'aa11bb22cc33dd44ee55ff66'
let placed = null
let storeDisabled = false

const errors = []
const browser = await launchChromium()
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'el-GR' })
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('delivr_lang', 'el')
    // Start from an empty cart — but only once: this script runs on every
    // navigation, and wiping it each time would also wipe the saved address
    // the last step is there to check.
    if (!sessionStorage.getItem('delivr_e2e_started')) {
      localStorage.removeItem('delivr_guest_cart')
      sessionStorage.setItem('delivr_e2e_started', '1')
    }
  } catch { /* private mode */ }
})
ctx.setDefaultTimeout(8000)
ctx.setDefaultNavigationTimeout(15000)
const page = await ctx.newPage()

page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))

await page.route('**://fonts.googleapis.com/**', r => r.abort())
await page.route('**://fonts.gstatic.com/**', r => r.abort())

const json = (route, body) => route.fulfill({
  status: 200, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
})
const fail = (route, code) => route.fulfill({
  status: 400, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify({ message: code }),
})

await page.route('**/*.supabase.co/**', async route => {
  const url = route.request().url()
  if (route.request().method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  if (url.includes('/rpc/delivr_store_by_slug')) {
    return storeDisabled ? fail(route, 'STANDALONE_DISABLED') : json(route, STORE)
  }
  if (url.includes('/rpc/delivr_public_settings')) return json(route, SETTINGS)
  if (url.includes('/rpc/delivr_place_order')) {
    placed = JSON.parse(route.request().postData() || '{}')
    return json(route, { ok: true, order_id: 'o9', order_number: 'DLV-260922-0099',
      public_token: TOKEN, status: 'pending', service: 'delivery',
      subtotal: 37, discount: 0, delivery_fee: 4.5, total: 41.5, eta_min: 50,
      currency: 'EUR', payment_method: 'cash', items: [],
      store: { id: STORE_ID, name: STORE.name, phone: STORE.phone, address: STORE.address,
               whatsapp: STORE.phone, notify_whatsapp: true, notify_email: true },
      address: { street: 'Οδός Σχίσμα 14', area: 'Ελούντα', city: 'Ελούντα', source: 'customer' },
      property: null })
  }
  if (url.includes('/rpc/delivr_order_status')) {
    return json(route, {
      order_number: 'DLV-260922-0099', status: 'pending', service: 'delivery',
      created_at: new Date().toISOString(), confirmed_at: null, prepared_at: null,
      picked_up_at: null, delivered_at: null, cancelled_at: null, cancel_reason: null,
      estimated_ready_at: new Date(Date.now() + 25 * 60000).toISOString(),
      estimated_delivery_at: new Date(Date.now() + 50 * 60000).toISOString(),
      scheduled_for: null, prep_minutes: 25,
      subtotal: 37, discount_amount: 0, delivery_fee: 4.5, total: 41.5,
      payment_method: 'cash', payment_status: 'pending', guest_name: 'Μαρία Τεστ',
      delivery_address: { street: 'Οδός Σχίσμα 14', area: 'Ελούντα', city: 'Ελούντα' },
      customer_notes: null,
      store: { id: STORE_ID, name: STORE.name, phone: STORE.phone, address: STORE.address, logo_url: null },
      items: [{ name: 'Αρνί αντικριστό', quantity: 2, price: 18.5, modifiers: [], notes: null, subtotal: 37 }],
      events: [{ status: 'pending', actor: 'guest', note: null, at: new Date().toISOString() }],
    })
  }
  if (url.includes('/menu_categories')) return json(route, CATEGORIES)
  if (url.includes('/menu_items')) return json(route, ITEMS)
  if (url.includes('/functions/v1/notify-order')) return json(route, { ok: true, results: { email: 'skipped_no_key' } })
  if (url.includes('/auth/v1/')) return json(route, { session: null, user: null })
  return json(route, [])
})

const shot = async (path) => {
  try { await page.screenshot({ path, fullPage: true, timeout: 6000 }) }
  catch { /* screenshots are diagnostics, never the test */ }
}

const step = async (name, fn) => {
  try { await fn(); console.log(`✅ ${name}`) }
  catch (e) {
    console.log(`❌ ${name} — ${e.message.split('\n').slice(0, 4).join(' | ')}`)
    try { console.log('   page state:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300)) } catch { /* page gone */ }
    process.exitCode = 1
  }
}

// 1 — The store's own landing page
await step('Store link shows the store, its intro and both services', async () => {
  await page.goto(`${BASE}/store/taverna-marina`, { waitUntil: 'domcontentloaded' })
  await page.getByText('Ταβέρνα Μαρίνα').first().waitFor({ timeout: 8000 })
  // The menu is a second request, so wait for it rather than for the shell.
  await page.getByText('Αρνί αντικριστό').first().waitFor({ timeout: 8000 })
  const body = await page.locator('body').innerText()
  if (!body.includes('Παραγγείλετε απευθείας')) throw new Error('intro missing')
  if (!body.includes('Αρνί αντικριστό')) throw new Error('menu not rendered')
  if (!body.toLowerCase().includes('delivery')) throw new Error('delivery option missing')
  if (!body.toLowerCase().includes('take away')) throw new Error('takeaway option missing')
})
await shot(`${OUT}/20-shop-home.png`)

// 2 — The area drives the fee and the minimum
await step('Picking an area applies that zone fee and minimum', async () => {
  const select = page.locator('#shop-area')
  await select.waitFor({ timeout: 8000 })
  await select.selectOption('Ελούντα')
  await page.waitForTimeout(400)
  const body = await page.locator('body').innerText()
  if (!body.includes('4,50') && !body.includes('4.50')) throw new Error('zone fee not applied')
  if (!body.includes('25,00') && !body.includes('25.00')) throw new Error('zone minimum not applied')
})

// 3 — Adding items
await step('An item can be added from the store menu', async () => {
  await page.getByText('Αρνί αντικριστό').first().click()
  const sheet = page.getByRole('dialog')
  await sheet.waitFor({ timeout: 8000 })
  await sheet.getByRole('button', { name: '+' }).click()   // quantity 2 → 37,00
  await sheet.getByRole('button', { name: /Προσθήκη/ }).click()
  await page.waitForTimeout(400)
  const body = await page.locator('body').innerText()
  if (!body.includes('41,50') && !body.includes('41.50')) throw new Error('cart bar total wrong')
})
await shot(`${OUT}/21-shop-cart-bar.png`)

// 4 — Cart
await step('Cart lists the line and the zone delivery fee', async () => {
  await page.getByRole('button', { name: /Το καλάθι σου/ }).click()
  await page.waitForURL('**/store/taverna-marina/cart', { timeout: 8000 })
  const body = await page.locator('body').innerText()
  if (!body.includes('Αρνί αντικριστό')) throw new Error('line missing')
  if (!body.includes('37,00') && !body.includes('37.00')) throw new Error('subtotal wrong')
  if (!body.includes('4,50') && !body.includes('4.50')) throw new Error('fee missing')
})
await shot(`${OUT}/22-shop-cart.png`)

// 5 — Checkout asks for the customer's own address
await step('Checkout asks for a street and keeps the picked area', async () => {
  await page.getByRole('button', { name: /Ολοκλήρωση παραγγελίας/ }).click()
  await page.waitForURL('**/store/taverna-marina/checkout', { timeout: 8000 })
  await page.locator('#a-street').waitFor({ timeout: 8000 })
  const area = await page.locator('#a-area').inputValue()
  if (area !== 'Ελούντα') throw new Error(`area not carried over: "${area}"`)
})

// 6 — The order cannot be sent without an address
await step('Send stays disabled until the address and the customer are filled in', async () => {
  const send = page.getByRole('button', { name: /Αποστολή παραγγελίας/ })
  if (!(await send.isDisabled())) throw new Error('send enabled with an empty form')
  await page.locator('#a-street').fill('Οδός Σχίσμα 14')
  await page.locator('#a-floor').fill('2ος')
  await page.locator('#s-name').fill('Μαρία Τεστ')
  await page.waitForTimeout(200)
  if (!(await send.isDisabled())) throw new Error('send enabled without a phone')
  await page.locator('#s-phone').fill('6941234567')
  await page.waitForTimeout(200)
  if (await send.isDisabled()) throw new Error('send still disabled with a complete form')
})
await shot(`${OUT}/23-shop-checkout.png`)

// 7 — What actually reaches the RPC
await step('Order is sent with no property code and the typed address', async () => {
  await page.getByRole('button', { name: /Αποστολή παραγγελίας/ }).click()
  await page.waitForURL(`**/t/${TOKEN}**`, { timeout: 12000 })
  if (!placed) throw new Error('place_order never called')
  if (placed.p_code !== null) throw new Error(`property code should be null, got ${placed.p_code}`)
  if (placed.p_channel !== 'store') throw new Error(`channel should be "store", got ${placed.p_channel}`)
  if (placed.p_address?.street !== 'Οδός Σχίσμα 14') throw new Error('street not sent')
  if (placed.p_address?.area !== 'Ελούντα') throw new Error('area not sent')
  if (placed.p_address?.floor !== '2ος') throw new Error('floor not sent')
  if (placed.p_items?.[0]?.quantity !== 2) throw new Error('quantity wrong')
  if (placed.p_guest?.phone !== '6941234567') throw new Error('phone not sent')
})

// 8 — Tracking works the same as for a QR order
await step('The customer lands on the tracking page', async () => {
  await page.getByText('DLV-260922-0099').first().waitFor({ timeout: 8000 })
  const body = await page.locator('body').innerText()
  if (!body.includes('41,50') && !body.includes('41.50')) throw new Error('total missing')
})
await shot(`${OUT}/24-shop-tracking.png`)

// 9 — The address is remembered on this device
await step('The address comes back on the next visit', async () => {
  await page.goto(`${BASE}/store/taverna-marina/`, { waitUntil: 'domcontentloaded' })
  await page.locator('#shop-area').waitFor({ timeout: 8000 })
  const area = await page.locator('#shop-area').inputValue()
  if (area !== 'Ελούντα') throw new Error(`saved area lost: "${area}"`)
})

// 10 — A store that has not opted in
await step('A store without its own link says so instead of breaking', async () => {
  storeDisabled = true
  await page.goto(`${BASE}/store/souvlaki-corner`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  const body = await page.locator('body').innerText()
  if (!body.includes('κατάστημα')) throw new Error('no explanation shown')
})

const realErrors = errors.filter(e =>
  !e.includes('WebSocket') && !e.includes('realtime') && !e.includes('Failed to load resource'))
console.log('\nConsole errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5), null, 1) : 'none')
if (realErrors.length) process.exitCode = 1

await browser.close()
