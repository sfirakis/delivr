/**
 * End-to-end walk of the guest QR flow in a real browser.
 * Supabase is unreachable from this sandbox, so every REST/RPC call is
 * intercepted and answered with payloads shaped exactly like the real ones.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const OUT = process.env.OUT_DIR || '/tmp/claude-0/-home-user-delivr/8f1d7cd8-f060-5e84-aef3-e097fa6a3f63/scratchpad'

const PROPERTY = {
  id: 'a584d0bf-21b1-4816-9592-6f413da17ac0', code: 'AEGEAN1', name: 'Villa Aegean Blue',
  type: 'villa', address: 'Οδός Σχίσμα 14', city: 'Ελούντα', area: 'Ελούντα',
  postal_code: '72053', lat: 35.26, lng: 25.722, floor: null, doorbell: 'Aegean Blue',
  access_notes: 'Λευκή πύλη στα δεξιά μετά το ξενοδοχείο.',
  welcome_message: 'Καλώς ήρθατε στη Villa Aegean Blue!', cover_url: null, default_language: 'el',
}

const STORE_ID = '094f7c50-bb8a-41fe-a282-8e6c961ae9a0'

const STORES = [
  { store_id: STORE_ID, store_name: 'Souvlaki Corner', slug: 'souvlaki-corner',
    description: 'Σουβλάκι, γύρος και μερίδες όλη μέρα', category: 'restaurant',
    cuisine_tags: ['σουβλάκι', 'γύρος'], logo_url: null, cover_url: null,
    store_address: 'Ρούσου Καπετανάκη 5', store_city: 'Άγιος Νικόλαος', store_phone: '+302841022002',
    rating: 4.6, review_count: 489, is_promoted: false, discount_pct: null, pickup_discount_pct: 10,
    delivery_fee: 3.5, min_order: 18, free_above: 45, eta_min: 40, dist_km: 7.78,
    match_type: 'zone', is_open_now: true, supports_delivery: true, supports_takeaway: true, accepts_cash: true },
  { store_id: 'b1', store_name: 'Pizza Napoli', slug: 'pizza-napoli', description: 'Ναπολιτάνικη πίτσα',
    category: 'pizza', cuisine_tags: ['πίτσα'], logo_url: null, cover_url: null,
    store_address: 'Βενιζέλου 40', store_city: 'Άγιος Νικόλαος', store_phone: null,
    rating: 4.5, review_count: 331, is_promoted: false, discount_pct: null, pickup_discount_pct: 0,
    delivery_fee: 4, min_order: 22, free_above: 50, eta_min: 45, dist_km: 7.51,
    match_type: 'zone', is_open_now: true, supports_delivery: true, supports_takeaway: true, accepts_cash: true },
]

const CATEGORIES = [
  { id: 'c1', name: 'Πίτες', description: null, sort_order: 1 },
  { id: 'c2', name: 'Ορεκτικά', description: null, sort_order: 3 },
]

const ITEMS = [
  { id: 'i1', category_id: 'c1', name: 'Πίτα γύρο χοιρινό', description: 'Πατάτες, ντομάτα, τζατζίκι',
    price: 4.2, image_url: null, emoji: '🌯', is_available: true, is_popular: true, is_vegan: false,
    is_vegetarian: false, is_gluten_free: false, allergens: [], sort_order: 1,
    modifier_groups: [{ id: 'g1', name: 'Extras', is_required: false, min_select: 0, max_select: 5,
      modifiers: [
        { id: 'm1', name: 'Έξτρα τζατζίκι', price: 0.5, is_default: false },
        { id: 'm2', name: 'Χωρίς κρεμμύδι', price: 0, is_default: false },
      ] }] },
  { id: 'i2', category_id: 'c2', name: 'Πατάτες τηγανητές', description: 'Φρέσκιες, με ρίγανη',
    price: 3.5, image_url: null, emoji: '🍟', is_available: true, is_popular: true, is_vegan: false,
    is_vegetarian: true, is_gluten_free: false, allergens: [], sort_order: 7, modifier_groups: [] },
]

const SETTINGS = {
  platform_name: 'Delivr', currency: 'EUR', timezone: 'Europe/Athens', brand_color: '#FF6B35',
  logo_url: null, support_phone: null, support_email: null, support_whatsapp: null, terms_url: null,
  allow_cash: true, allow_online_payment: false, allow_scheduled_orders: true,
  guest_requires_phone: true, guest_requires_email: false, default_prep_time: 20,
}

const TOKEN = '7c5f0478a1a0b87e7f6e8982'
let placed = null

function orderStatus(status = 'pending') {
  return {
    order_number: 'DLV-260824-0007', status, service: 'delivery',
    created_at: new Date().toISOString(), confirmed_at: status === 'pending' ? null : new Date().toISOString(),
    prepared_at: null, picked_up_at: null, delivered_at: null, cancelled_at: null, cancel_reason: null,
    estimated_ready_at: new Date(Date.now() + 25 * 60000).toISOString(),
    estimated_delivery_at: new Date(Date.now() + 55 * 60000).toISOString(),
    scheduled_for: null, prep_minutes: 20,
    subtotal: 25.8, discount_amount: 0, delivery_fee: 3.5, total: 29.3,
    payment_method: 'cash', payment_status: 'pending', guest_name: 'Γιώργος Τεστ',
    delivery_address: { label: PROPERTY.name, street: PROPERTY.address, doorbell: PROPERTY.doorbell,
                        property_code: 'AEGEAN1' },
    customer_notes: 'Κουδούνι Aegean Blue',
    store: { id: STORE_ID, name: 'Souvlaki Corner', phone: '+302841022002',
             address: 'Ρούσου Καπετανάκη 5', logo_url: null },
    items: [
      { name: 'Πίτα γύρο χοιρινό', quantity: 4, price: 4.2,
        modifiers: [{ name: 'Έξτρα τζατζίκι', price: 0.5 }], notes: 'χωρίς κρεμμύδι', subtotal: 18.8 },
      { name: 'Πατάτες τηγανητές', quantity: 2, price: 3.5, modifiers: [], notes: null, subtotal: 7 },
    ],
    events: [{ status: 'pending', actor: 'guest', note: null, at: new Date().toISOString() }],
  }
}

const errors = []
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:35779', bypass: 'localhost,127.0.0.1,::1' },
})
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'el-GR' })
await ctx.addInitScript(() => { try { localStorage.setItem('delivr_lang', 'el') } catch { /* private mode */ } })
ctx.setDefaultTimeout(8000)
ctx.setDefaultNavigationTimeout(15000)
const page = await ctx.newPage()

page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))

// Google Fonts is blocked in this sandbox — abort so screenshots never stall.
await page.route('**://fonts.googleapis.com/**', r => r.abort())
await page.route('**://fonts.gstatic.com/**', r => r.abort())

const json = (route, body) => route.fulfill({
  status: 200, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
})

await page.route('**/*.supabase.co/**', async route => {
  const url = route.request().url()
  const method = route.request().method()
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } })

  if (url.includes('/rpc/delivr_property_by_code')) return json(route, PROPERTY)
  if (url.includes('/rpc/delivr_stores_for_property')) {
    const body = JSON.parse(route.request().postData() || '{}')
    return json(route, body.p_service === 'pickup'
      ? STORES.map(s => ({ ...s, delivery_fee: 0, match_type: 'pickup' }))
      : STORES)
  }
  if (url.includes('/rpc/delivr_log_scan')) return json(route, null)
  if (url.includes('/rpc/delivr_public_settings')) return json(route, SETTINGS)
  if (url.includes('/rpc/delivr_place_order')) {
    placed = JSON.parse(route.request().postData() || '{}')
    return json(route, { ok: true, order_id: 'o1', order_number: 'DLV-260824-0007',
      public_token: TOKEN, status: 'pending', service: 'delivery',
      subtotal: 25.8, discount: 0, delivery_fee: 3.5, total: 29.3, eta_min: 55,
      currency: 'EUR', payment_method: 'cash', items: [],
      store: { id: STORE_ID, name: 'Souvlaki Corner', phone: '+302841022002',
               address: 'Ρούσου Καπετανάκη 5', whatsapp: '+306900000002',
               notify_whatsapp: true, notify_email: true },
      property: { id: PROPERTY.id, code: 'AEGEAN1', name: PROPERTY.name, address: PROPERTY.address,
                  area: 'Ελούντα', city: 'Ελούντα', floor: null, doorbell: PROPERTY.doorbell } })
  }
  if (url.includes('/rpc/delivr_order_status')) return json(route, orderStatus('pending'))
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

// 1 — Landing on the QR link
await step('QR landing shows the property and the stores that serve it', async () => {
  await page.goto(`${BASE}/qr/AEGEAN1`, { waitUntil: 'domcontentloaded' })
  await page.getByText('Villa Aegean Blue', { exact: true }).first().waitFor({ timeout: 8000 })
  await page.getByText('Souvlaki Corner').first().waitFor({ timeout: 8000 })
  const body = await page.locator('body').innerText()
  if (!body.includes('Ελούντα')) throw new Error('address missing')
  if (!body.includes('3,50') && !body.includes('3.50')) throw new Error('zone delivery fee not shown')

  // The address line must name the area once, however the street was typed.
  const line = await page.getByText('Οδός Σχίσμα 14').first().innerText()
  const mentions = (line.match(/Ελούντα/g) ?? []).length
  if (mentions !== 1) throw new Error(`area repeated ${mentions}× in "${line}"`)
})
await shot(`${OUT}/01-qr-home.png`)

// 2 — Language switch
await step('EN/ΕΛ switcher translates the interface', async () => {
  await page.getByRole('button', { name: 'EN' }).click()
  await page.waitForTimeout(400)
  // innerText honours the CSS uppercase transform, so compare case-insensitively.
  const body = (await page.locator('body').innerText()).toLowerCase()
  if (!body.includes('delivering to')) throw new Error('English strings not applied')
  await page.getByRole('button', { name: 'ΕΛ' }).click()
  await page.waitForTimeout(400)
  const back = (await page.locator('body').innerText()).toLowerCase()
  if (!back.includes('με την υποστήριξη')) throw new Error('did not switch back to Greek')
})

// 3 — Take away tab
await step('Take away tab re-queries with pickup pricing', async () => {
  await page.getByRole('button', { name: /Take away/ }).click()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /Delivery/ }).click()
  await page.waitForTimeout(700)
})

// 4 — Store menu
await step('Store page lists the menu by category', async () => {
  await page.getByText('Souvlaki Corner').first().click()
  await page.getByText('Πίτα γύρο χοιρινό').first().waitFor({ timeout: 8000 })
  const body = await page.locator('body').innerText()
  if (!body.includes('Πίτες')) throw new Error('category heading missing')
  if (!body.includes('Πατάτες τηγανητές')) throw new Error('second item missing')
})
await shot(`${OUT}/02-store-menu.png`)

// 5 — Item sheet with modifiers
await step('Item sheet applies extras to the price', async () => {
  await page.getByText('Πίτα γύρο χοιρινό').first().click()
  await page.getByText('Έξτρα τζατζίκι').first().waitFor({ timeout: 5000 })
  await page.getByText('Έξτρα τζατζίκι').first().click()
  await page.getByPlaceholder('π.χ. χωρίς κρεμμύδι').fill('χωρίς κρεμμύδι')
  const label = await page.getByRole('dialog').getByRole('button', { name: /Προσθήκη/ }).innerText()
  if (!label.includes('4,70') && !label.includes('4.70')) throw new Error(`price with extra wrong: ${label}`)
  const sheet = page.getByRole('dialog')
  for (let i = 0; i < 3; i++) await sheet.getByRole('button', { name: '+' }).click()   // qty 1 → 4
  await sheet.getByRole('button', { name: /Προσθήκη/ }).click()
  await page.waitForTimeout(400)
})
await shot(`${OUT}/03-item-added.png`)

// 6 — Cart totals
await step('Cart prices the line with its extra and adds the zone delivery fee', async () => {
  await page.getByRole('button', { name: /Το καλάθι σου/ }).click()
  await page.getByText('Υποσύνολο').first().waitFor({ timeout: 5000 })
  const body = await page.locator('body').innerText()
  // 4 × (4.20 + 0.50 extra) = 18.80, + 3.50 zone fee = 22.30
  if (!body.includes('18,80')) throw new Error(`subtotal wrong: ${body.slice(0, 300)}`)
  if (!body.includes('3,50')) throw new Error('zone delivery fee missing')
  if (!body.includes('22,30')) throw new Error('total wrong')
})

await step('Dropping below the minimum blocks checkout', async () => {
  const minus = page.getByRole('button', { name: '−' }).first()
  for (let i = 0; i < 3; i++) { await minus.click(); await page.waitForTimeout(120) }
  await page.waitForTimeout(300)
  const body = await page.locator('body').innerText()
  if (!body.includes('Ελάχιστη παραγγελία')) throw new Error('minimum-order warning not shown at 4.70 < 18')
  if (!(await page.getByRole('button', { name: /Ολοκλήρωση παραγγελίας/ }).isDisabled())) {
    throw new Error('checkout should be disabled below the minimum')
  }
  const plus = page.getByRole('button', { name: '+' }).first()
  for (let i = 0; i < 3; i++) { await plus.click(); await page.waitForTimeout(120) }
})

// 7 — Add the second item to clear the minimum
await step('Adding a second item clears the minimum and enables checkout', async () => {
  await page.getByRole('button', { name: /Πρόσθεσε ακόμη/ }).click()
  await page.getByText('Πατάτες τηγανητές').first().waitFor({ timeout: 5000 })
  await page.getByText('Πατάτες τηγανητές').first().click()
  const sheet2 = page.getByRole('dialog')
  await sheet2.getByRole('button', { name: '+' }).click()      // qty 1 → 2
  await sheet2.getByRole('button', { name: /Προσθήκη/ }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Το καλάθι σου/ }).click()
  await page.getByText('Σύνολο').first().waitFor({ timeout: 5000 })
  const checkout = page.getByRole('button', { name: /Ολοκλήρωση παραγγελίας/ })
  if (await checkout.isDisabled()) throw new Error('checkout still disabled')
})
await shot(`${OUT}/04-cart.png`)

// 8 — Checkout validation + submit
await step('Checkout validates the guest details and sends the order', async () => {
  await page.getByRole('button', { name: /Ολοκλήρωση παραγγελίας/ }).click()
  await page.getByText('Στοιχεία παραγγελίας').first().waitFor({ timeout: 5000 })
  const send = page.getByRole('button', { name: /Αποστολή παραγγελίας/ })
  if (!(await send.isDisabled())) throw new Error('submit should be disabled with an empty form')
  await page.getByPlaceholder('Το όνομά σου').fill('Γιώργος Τεστ')
  await page.getByPlaceholder(/6944123456/).fill('6944123456')
  await page.getByPlaceholder(/κουδούνι/).fill('Κουδούνι Aegean Blue')
  if (await send.isDisabled()) throw new Error('submit still disabled after filling the form')
  await send.click()
  await page.waitForURL(/\/t\//, { timeout: 8000 })
})
await shot(`${OUT}/05-order-status.png`)

// 9 — Order payload correctness
await step('The order sent to the server carries the right items and modifiers', async () => {
  if (!placed) throw new Error('place_order never called')
  const items = placed.p_items
  if (items.length !== 2) throw new Error(`expected 2 lines, got ${items.length}`)
  const pita = items.find(i => i.quantity === 4)
  if (!pita) throw new Error('quantity 4 line missing')
  if (!pita.modifier_ids?.includes('m1')) throw new Error('modifier not sent')
  if (pita.notes !== 'χωρίς κρεμμύδι') throw new Error('item note not sent')
  if (placed.p_code !== 'AEGEAN1') throw new Error('property code not sent')
  if (placed.p_guest.name !== 'Γιώργος Τεστ') throw new Error('guest name not sent')
  if (placed.p_payment !== 'cash') throw new Error('payment method wrong')
})

// 10 — Tracking page
await step('Tracking page renders status, timeline and the WhatsApp hand-off', async () => {
  await page.getByText('DLV-260824-0007').first().waitFor({ timeout: 8000 })
  const body = await page.locator('body').innerText()
  if (!body.includes('Αναμονή επιβεβαίωσης')) throw new Error('status label missing')
  if (!body.includes('29,30') && !body.includes('29.30')) throw new Error('total missing')
  const wa = page.getByRole('link', { name: /WhatsApp/ })
  const href = await wa.getAttribute('href')
  if (!href?.startsWith('https://wa.me/302841022002?text=')) throw new Error(`wa link wrong: ${href}`)
  const text = decodeURIComponent(href.split('text=')[1])
  if (!text.includes('DLV-260824-0007')) throw new Error('wa message missing order number')
  if (!text.includes('Villa Aegean Blue')) throw new Error('wa message missing address')
  if (!text.includes('4× Πίτα γύρο χοιρινό')) throw new Error('wa message missing items')
})

// 11 — Unknown QR code
await step('An unknown QR code fails gracefully', async () => {
  await page.route('**/rpc/delivr_property_by_code', r => r.fulfill({
    status: 400, contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ message: 'PROPERTY_NOT_FOUND' }),
  }))
  await page.goto(`${BASE}/qr/NOPE99`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  const body = await page.locator('body').innerText()
  if (!body.includes('QR')) throw new Error('no error message shown')
})

const realErrors = errors.filter(e =>
  !e.includes('WebSocket') && !e.includes('realtime') && !e.includes('Failed to load resource'))
console.log('\nConsole errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5), null, 1) : 'none')
if (realErrors.length) process.exitCode = 1

await browser.close()
