/**
 * Delivr Stores (product line A): the open marketplace, end to end.
 * Home → pick area → delivery/takeaway → store → cart → checkout → tracking →
 * "my orders". Every Supabase call is answered with a payload shaped like the
 * real RPC (migration 014), so this never touches the live project.
 *
 * Also checks that product line B (Delivr QR) still has its own front door at
 * /qr and that the store's own /store/<slug> link is still channel 'store'.
 *
 *   BASE_URL=http://localhost:5174 SHOTS_DIR=docs/screenshots node e2e/market-flow.mjs
 */
import { launchChromium } from './browser.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const SHOTS = process.env.SHOTS_DIR || null   // set to docs/screenshots to refresh George's screenshots
const SUB_SHOTS = process.env.SUB_SHOTS_DIR || null   // docs/screenshots/subscription-tiers (018)

const MARINA = '4f2e6d70-2b5a-4c8e-9d31-7c9a1f0e5b22'
const KAFE = '7a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const BURGER = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

const AREAS = [
  { area: 'Ελούντα', city: 'Ελούντα', stores: 2 },
  { area: 'Άγιος Νικόλαος', city: 'Άγιος Νικόλαος', stores: 1 },
  { area: 'Αμμουδάρα', city: 'Ηράκλειο', stores: 1 },
]

const base = {
  description: null, cuisine_tags: [], logo_url: null, cover_url: null,
  rating: 0, review_count: 0, is_promoted: false, discount_pct: null, pickup_discount_pct: 0,
  is_open_now: true, supports_delivery: true, supports_takeaway: true, zone_name: null,
  free_above: null, prep_min: 20,
}
const ALL = [
  { ...base, id: MARINA, slug: 'taverna-marina', name: 'Ταβέρνα Μαρίνα', category: 'restaurant',
    cuisine_tags: ['ψαροταβέρνα', 'κρητική'], address: 'Ακτή Ελούντας 3', city: 'Ελούντα',
    rating: 4.8, review_count: 210, pickup_discount_pct: 10, delivers: null, pickup: null,
    delivery_fee: 3, min_order: 12, eta_min: 35, prep_min: 25 },
  { ...base, id: BURGER, slug: 'elounda-burger', name: 'Elounda Burger Bar', category: 'burger',
    cuisine_tags: ['smash burgers'], address: 'Πλατεία 2', city: 'Ελούντα', delivers: null, pickup: null,
    delivery_fee: 2, min_order: 10, eta_min: 40 },
  { ...base, id: KAFE, slug: 'kafe-thalassa', name: 'Καφέ Θάλασσα', category: 'cafe',
    address: 'Παραλία 9', city: 'Ηράκλειο', supports_delivery: true, delivers: null, pickup: null,
    delivery_fee: 1.5, min_order: 6, eta_min: 35, is_open_now: false },
]
const IN_ELOUNDA = [
  { ...ALL[0], delivers: true, pickup: true, zone_name: 'Ελούντα', delivery_fee: 4.5, min_order: 25, free_above: 60, eta_min: 50 },
  { ...ALL[1], delivers: false, pickup: true },
]

const STORE = {
  id: MARINA, slug: 'taverna-marina', name: 'Ταβέρνα Μαρίνα',
  description: 'Ψάρι και κρητική κουζίνα', intro: null,
  category: 'restaurant', cuisine_tags: ['ψαροταβέρνα'], logo_url: null, cover_url: null,
  address: 'Ακτή Ελούντας 3', city: 'Ελούντα', phone: '+302841041000',
  rating: 4.8, review_count: 210, discount_pct: null, pickup_discount_pct: 10,
  delivery_fee: 3, min_order: 12, free_above: null, eta_min: 35, prep_min: 25,
  supports_delivery: true, supports_takeaway: true, accepts_cash: true, is_open_now: true,
  zones_required: true,
  zones: [
    { id: 'z1', name: 'Άγιος Νικόλαος', area: 'Άγιος Νικόλαος', city: 'Άγιος Νικόλαος',
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
  platform_name: 'Delivr', currency: 'EUR', timezone: 'Europe/Athens', brand_color: '#FF4500',
  logo_url: null, support_phone: null, support_email: null, support_whatsapp: null, terms_url: null,
  allow_cash: true, allow_online_payment: false, allow_scheduled_orders: true,
  guest_requires_phone: true, guest_requires_email: false, default_prep_time: 20,
}
const TOKEN = 'ab12cd34ef56ab12cd34ef56'

let empty = false
let placed = null
const storeCalls = []

const errors = []
const browser = await launchChromium()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'el-GR' })
await ctx.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('delivr_e2e_started')) {
      localStorage.clear()
      localStorage.setItem('delivr_lang', 'el')
      sessionStorage.setItem('delivr_e2e_started', '1')
    }
  } catch { /* private mode */ }
})
ctx.setDefaultTimeout(8000)
ctx.setDefaultNavigationTimeout(15000)
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
if (process.env.E2E_OFFLINE) {
  await page.route('**://fonts.googleapis.com/**', r => r.abort())
  await page.route('**://fonts.gstatic.com/**', r => r.abort())
}

const json = (route, body) => route.fulfill({
  status: 200, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body),
})

await page.route('**/*.supabase.co/**', async route => {
  const req = route.request()
  const url = req.url()
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } })
  const body = (() => { try { return JSON.parse(req.postData() || '{}') } catch { return {} } })()

  if (url.includes('/rpc/delivr_marketplace_areas')) return json(route, empty ? [] : AREAS)
  if (url.includes('/rpc/delivr_marketplace_stores')) {
    storeCalls.push(body)
    if (empty) return json(route, [])
    return json(route, body.p_area === 'Ελούντα' ? IN_ELOUNDA : body.p_area ? [] : ALL)
  }
  if (url.includes('/rpc/delivr_store_by_slug')) return json(route, STORE)
  // 018: this store takes card at the counter but its courier has no terminal.
  if (url.includes('/rpc/delivr_store_payment_options')) return json(route, { cash: true, card_pickup: true, card_delivery: false })
  if (url.includes('/rpc/delivr_public_settings')) return json(route, SETTINGS)
  if (url.includes('/rpc/delivr_place_order')) {
    placed = body
    return json(route, { ok: true, order_id: 'o1', order_number: 'DLV-261030-0001',
      public_token: TOKEN, status: 'pending', service: 'delivery',
      subtotal: 37, discount: 0, delivery_fee: 4.5, total: 41.5, eta_min: 70,
      currency: 'EUR', payment_method: 'cash', items: [],
      store: { id: MARINA, name: STORE.name, phone: STORE.phone, address: STORE.address,
               whatsapp: STORE.phone, notify_whatsapp: true, notify_email: true },
      address: { street: 'Οδός Σχίσμα 14', area: 'Ελούντα', city: 'Ελούντα', source: 'customer' },
      property: null })
  }
  if (url.includes('/rpc/delivr_order_status')) {
    return json(route, {
      order_number: 'DLV-261030-0001', status: 'pending', service: 'delivery',
      created_at: new Date().toISOString(), confirmed_at: null, prepared_at: null,
      picked_up_at: null, delivered_at: null, cancelled_at: null, cancel_reason: null,
      estimated_ready_at: new Date(Date.now() + 25 * 60000).toISOString(),
      estimated_delivery_at: new Date(Date.now() + 70 * 60000).toISOString(),
      scheduled_for: null, prep_minutes: 25,
      subtotal: 37, discount_amount: 0, delivery_fee: 4.5, total: 41.5,
      payment_method: 'cash', payment_status: 'pending', guest_name: 'Μαρία Τεστ',
      delivery_address: { street: 'Οδός Σχίσμα 14', area: 'Ελούντα', city: 'Ελούντα' },
      customer_notes: null,
      store: { id: MARINA, name: STORE.name, phone: STORE.phone, address: STORE.address, logo_url: null },
      items: [{ name: 'Αρνί αντικριστό', quantity: 2, price: 18.5, modifiers: [], notes: null, subtotal: 37 }],
      events: [{ status: 'pending', actor: 'guest', note: null, at: new Date().toISOString() }],
    })
  }
  if (url.includes('/menu_categories')) return json(route, CATEGORIES)
  if (url.includes('/menu_items')) return json(route, ITEMS)
  if (url.includes('/functions/v1/notify-order')) return json(route, { ok: true })
  if (url.includes('/auth/v1/')) return json(route, { session: null, user: null })
  return json(route, [])
})

const shot = async (name) => {
  if (!SHOTS) return
  try { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false, timeout: 8000 }) }
  catch { /* screenshots are for people, never the test */ }
}
const text = async () => (await page.locator('body').innerText())
const step = async (name, fn) => {
  try { await fn(); console.log(`✅ ${name}`) }
  catch (e) {
    console.log(`❌ ${name} — ${e.message.split('\n').slice(0, 3).join(' | ')}`)
    try { console.log('   page:', (await text()).replace(/\s+/g, ' ').slice(0, 300)) } catch { /* gone */ }
    process.exitCode = 1
  }
}

// 1 — Home
await step('Home is the marketplace: logo «by ActionWeb», area picker, both product lines', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.getByText('Ταβέρνα Μαρίνα').first().waitFor()
  const b = await text()
  for (const s of ['by ActionWeb', 'Πού βρίσκεσαι', 'Έχεις κατάστημα', 'Έχεις κατάλυμα', 'Elounda Burger Bar', 'Καφέ Θάλασσα']) {
    if (!b.includes(s)) throw new Error(`missing "${s}"`)
  }
  if (b.includes('Σκάναρε το QR του καταλύματός σου για να παραγγείλεις')) throw new Error('old QR-only landing still at /')
  const opts = await page.locator('#market-area option').allInnerTexts()
  if (opts.length !== 4) throw new Error(`areas: ${opts.join('|')}`)
})
await page.waitForTimeout(500)
await shot('market-m-01-home')

// 2 — Area
await step('Picking an area lists who delivers there, priced by the zone', async () => {
  await page.locator('#market-area').selectOption('Ελούντα')
  await page.getByText('Καταστήματα για Ελούντα').waitFor()
  await page.getByText(/4,50/).first().waitFor()
  const call = storeCalls.find(c => c.p_area === 'Ελούντα')
  if (call?.p_city !== 'Ελούντα') throw new Error(`rpc args ${JSON.stringify(storeCalls)}`)
  const cards = page.getByTestId('market-store')
  if (await cards.count() !== 1) throw new Error(`${await cards.count()} cards in delivery tab`)
  const b = await text()
  if (!b.includes('4,50')) throw new Error('zone fee not shown')
  if (!b.includes('25,00')) throw new Error('zone minimum not shown')
  if (b.includes('Καφέ Θάλασσα')) throw new Error('store from another town shown')
})
await page.waitForTimeout(300)
await shot('market-m-02-area-delivery')

// 3 — Take away tab
await step('Take away tab shows stores near enough to pick up from', async () => {
  await page.getByRole('tab', { name: /Take away/ }).click()
  const cards = page.getByTestId('market-store')
  await page.waitForTimeout(200)
  if (await cards.count() !== 2) throw new Error(`${await cards.count()} cards in takeaway tab`)
  if (!(await text()).includes('Elounda Burger Bar')) throw new Error('takeaway store missing')
})
await shot('market-m-03-area-takeaway')

// 4 — Category + search
await step('Categories and search narrow the list', async () => {
  await page.locator('button.chip', { hasText: 'Burger' }).click()
  if (await page.getByTestId('market-store').count() !== 1) throw new Error('category filter')
  await page.locator('button.chip', { hasText: 'Όλα' }).click()
  await page.locator('#market-search').fill('κρητικ')
  if (await page.getByTestId('market-store').count() !== 1) throw new Error('search by cuisine tag')
  await page.locator('#market-search').fill('')
  await page.getByRole('tab', { name: /Delivery/ }).click()
})

// 5 — Store page within the marketplace
await step('A store opens under /stores/<slug> with the area already chosen', async () => {
  await page.getByText('Ταβέρνα Μαρίνα').first().click()
  await page.waitForURL('**/stores/taverna-marina')
  await page.getByText('Αρνί αντικριστό').first().waitFor()
  if (await page.locator('#shop-area').inputValue() !== 'Ελούντα') throw new Error('area not carried over')
  const b = await text()
  if (!b.includes('Delivery & take away από το Delivr')) throw new Error('marketplace subtitle missing')
  if (!(await page.getByRole('button', { name: 'Όλα τα καταστήματα' }).isVisible())) throw new Error('no way back')
})
await shot('market-m-04-store')

await step('Add to cart → cart → checkout stay under /stores/', async () => {
  await page.getByText('Αρνί αντικριστό').first().click()
  const sheet = page.getByRole('dialog')
  await sheet.waitFor()
  await sheet.getByRole('button', { name: '+' }).click()
  await sheet.getByRole('button', { name: /Προσθήκη/ }).click()
  await page.getByRole('button', { name: /Το καλάθι σου/ }).click()
  await page.waitForURL('**/stores/taverna-marina/cart')
  await shot('market-m-05-cart')
  await page.getByRole('button', { name: /Ολοκλήρωση παραγγελίας/ }).click()
  await page.waitForURL('**/stores/taverna-marina/checkout')
  await page.locator('#a-street').fill('Οδός Σχίσμα 14')
  await page.locator('#s-name').fill('Μαρία Τεστ')
  await page.locator('#s-phone').fill('6941234567')
  await page.waitForTimeout(200)
})
await shot('market-m-06-checkout')

await step('Delivery without a card terminal: «Κάρτα» is shown but not selectable, cash stays chosen', async () => {
  const card = page.getByTestId('pay-card')
  await card.waitFor()
  if (!(await card.isDisabled())) throw new Error('card selectable for delivery')
  if (!(await page.getByTestId('pay-cash').isChecked())) throw new Error('cash not selected')
  const b = await page.locator('body').innerText()
  for (const s of ['Μετρητά κατά την παράδοση', 'Κάρτα κατά την παράδοση', 'δεν δέχεται κάρτα στην παράδοση', 'τίποτα δεν χρεώνεται online'])
    if (!b.includes(s)) throw new Error(`missing "${s}"`)
  if (/Σύντομα διαθέσιμο|Coming soon/.test(b)) throw new Error('"coming soon" card is back')
  if (SUB_SHOTS) {
    await page.getByTestId('pay-card').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SUB_SHOTS}/checkout-02-delivery-card-not-accepted.png`, timeout: 8000 }).catch(() => {})
  }
})

await step('The order goes out as a marketplace order (channel "app"), cash, no property', async () => {
  await page.getByRole('button', { name: /Αποστολή παραγγελίας/ }).click()
  await page.waitForURL(`**/t/${TOKEN}**`, { timeout: 12000 })
  if (!placed) throw new Error('place_order never called')
  if (placed.p_channel !== 'app') throw new Error(`channel ${placed.p_channel}`)
  if (placed.p_code !== null) throw new Error('property code sent')
  if (placed.p_payment !== 'cash') throw new Error(`payment ${placed.p_payment}`)
  if (placed.p_address?.area !== 'Ελούντα') throw new Error('area not sent')
  await page.getByText('DLV-261030-0001').first().waitFor()
})
await shot('market-m-07-tracking')

await step('"My orders" lists it from this device', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: 'Οι παραγγελίες μου' }).click()
  await page.waitForURL('**/orders')
  const b = await text()
  if (!b.includes('DLV-261030-0001') || !b.includes('Ταβέρνα Μαρίνα')) throw new Error('order not listed')
  await page.getByText('DLV-261030-0001').click()
  await page.waitForURL(`**/t/${TOKEN}`)
})
await shot('market-m-08-my-orders')

// 6 — A store's own link is still its own channel
await step('The store link /store/<slug> still orders as channel "store"', async () => {
  placed = null
  await page.goto(`${BASE}/store/taverna-marina`, { waitUntil: 'domcontentloaded' })
  await page.getByText('Αρνί αντικριστό').first().click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: '+' }).click()
  await sheet.getByRole('button', { name: /Προσθήκη/ }).click()
  await page.getByRole('button', { name: /Το καλάθι σου/ }).click()
  await page.waitForURL('**/store/taverna-marina/cart')
  await page.getByRole('button', { name: /Ολοκλήρωση παραγγελίας/ }).click()
  await page.waitForURL('**/store/taverna-marina/checkout')
  // Address, name and phone come back from this device.
  await page.locator('#s-name').waitFor()
  await page.getByRole('button', { name: /Αποστολή παραγγελίας/ }).click()
  await page.waitForURL(`**/t/${TOKEN}**`, { timeout: 12000 })
  if (placed?.p_channel !== 'store') throw new Error(`channel ${placed?.p_channel}`)
})

// 7 — Delivr QR keeps its front door
await step('/qr is the Delivr QR page (product line B)', async () => {
  await page.goto(`${BASE}/qr`, { waitUntil: 'domcontentloaded' })
  await page.getByText(/Σκάναρε το QR/).first().waitFor()
  const b = await text()
  if (!b.includes('Σκάναρε το QR του καταλύματός σου')) throw new Error('QR landing missing')
  if (!b.includes('by ActionWeb')) throw new Error('logo subline missing')
})
await shot('market-m-09-qr-landing')

// 8 — Empty marketplace
await step('An empty marketplace invites shops instead of showing nothing', async () => {
  empty = true
  await page.evaluate(() => localStorage.removeItem('delivr_guest_cart'))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.getByText('Δεν υπάρχουν ακόμη καταστήματα εδώ').waitFor()
  await page.getByRole('button', { name: 'Γράψου δωρεάν' }).click()
  await page.waitForURL('**/join')
})

const realErrors = errors.filter(e =>
  !e.includes('WebSocket') && !e.includes('realtime') && !e.includes('Failed to load resource'))
console.log('\nConsole errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5), null, 1) : 'none')
if (realErrors.length) process.exitCode = 1
await browser.close()
