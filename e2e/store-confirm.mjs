/**
 * The store-side surface: the login-free link that arrives by email.
 * Covers accept-with-prep-time, the reject flow and the thermal ticket markup.
 */
import { launchChromium } from './browser.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const OUT = process.env.OUT_DIR || '/tmp/claude-0/-home-user-delivr/8f1d7cd8-f060-5e84-aef3-e097fa6a3f63/scratchpad'
const TOKEN = 'abc123def456abc123def456abc12345'

let status = 'pending'
const actions = []

const order = () => ({
  order_id: 'o1', order_number: 'DLV-260824-0007', status,
  service: 'delivery', channel: 'qr',
  created_at: new Date(Date.now() - 4 * 60000).toISOString(),
  scheduled_for: null, prep_minutes: status === 'pending' ? null : 25,
  estimated_ready_at: new Date(Date.now() + 25 * 60000).toISOString(),
  subtotal: 25.8, discount_amount: 0, delivery_fee: 3.5, total: 29.3, platform_fee: 2.58,
  payment_method: 'cash', payment_status: 'pending', promo_code: null,
  customer_notes: 'Κουδούνι Aegean Blue', delivery_notes: null,
  cancel_reason: status === 'cancelled' ? 'Πολύς φόρτος' : null,
  printed_at: null,
  guest: { name: 'Γιώργος Τεστ', phone: '6944123456', email: 'guest@example.com' },
  address: { label: 'Villa Aegean Blue', street: 'Οδός Σχίσμα 14, Ελούντα', doorbell: 'Aegean Blue' },
  property: { name: 'Villa Aegean Blue', code: 'AEGEAN1', address: 'Οδός Σχίσμα 14, Ελούντα',
              area: 'Ελούντα', city: 'Ελούντα', floor: null, doorbell: 'Aegean Blue',
              access_notes: 'Λευκή πύλη στα δεξιά.', lat: 35.26, lng: 25.722 },
  store: { id: 's1', name: 'Souvlaki Corner', phone: '+302841022002',
           address: 'Ρούσου Καπετανάκη 5', logo_url: null, print_format: '80mm', prep_time_min: 20 },
  settings: { currency: 'EUR', platform_name: 'Delivr', support_phone: null },
  items: [
    { name: 'Πίτα γύρο χοιρινό', quantity: 4, price: 4.2,
      modifiers: [{ name: 'Έξτρα τζατζίκι', price: 0.5 }], notes: 'χωρίς κρεμμύδι', subtotal: 18.8 },
    { name: 'Πατάτες τηγανητές', quantity: 2, price: 3.5, modifiers: [], notes: null, subtotal: 7 },
  ],
  events: [{ status: 'pending', actor: 'guest', note: null, at: new Date().toISOString() }],
})

const errors = []
const browser = await launchChromium({
  executablePath: '/opt/pw-browsers/chromium',
  proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:35779', bypass: 'localhost,127.0.0.1,::1' },
})
const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } })
await ctx.addInitScript(() => { try { localStorage.setItem('delivr_lang', 'el') } catch { /* private mode */ } })
ctx.setDefaultTimeout(8000)
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))

await page.route('**://fonts.googleapis.com/**', r => r.abort())
await page.route('**://fonts.gstatic.com/**', r => r.abort())

const json = (route, body) => route.fulfill({
  status: 200, contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body),
})

await page.route('**/*.supabase.co/**', async route => {
  const url = route.request().url()
  if (route.request().method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
  if (url.includes('/rpc/delivr_store_order')) return json(route, order())
  if (url.includes('/rpc/delivr_store_action')) {
    const body = JSON.parse(route.request().postData() || '{}')
    actions.push(body)
    if (body.p_action === 'accept') status = 'confirmed'
    if (body.p_action === 'reject') status = 'cancelled'
    if (body.p_action === 'preparing') status = 'preparing'
    if (body.p_action === 'ready') status = 'ready'
    return json(route, { ok: true, status, prep_minutes: body.p_prep_minutes })
  }
  if (url.includes('/auth/v1/')) return json(route, { session: null, user: null })
  return json(route, [])
})

const shot = async p => { try { await page.screenshot({ path: p, fullPage: true, timeout: 6000 }) } catch { /* diagnostics only */ } }
const step = async (name, fn) => {
  try { await fn(); console.log(`✅ ${name}`) }
  catch (e) {
    console.log(`❌ ${name} — ${e.message.split('\n').slice(0, 3).join(' | ')}`)
    try { console.log('   page state:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 250)) } catch { /* page gone */ }
    process.exitCode = 1
  }
}

await step('Store link opens the order with no login at all', async () => {
  await page.goto(`${BASE}/s/${TOKEN}`, { waitUntil: 'domcontentloaded' })
  // The order number also lives in the hidden print ticket — look at the screen copy.
  await page.locator('.no-print').getByText('DLV-260824-0007').first().waitFor({ timeout: 8000 })
  const body = await page.locator('.no-print').innerText()
  for (const needed of ['Γιώργος Τεστ', 'Villa Aegean Blue', 'Οδός Σχίσμα 14',
                        'Πίτα γύρο χοιρινό', '29,30', 'Λευκή πύλη']) {
    if (!body.includes(needed)) throw new Error(`missing on the page: ${needed}`)
  }
  if (!body.includes('χωρίς κρεμμύδι')) throw new Error('item note not surfaced to the kitchen')
  if (!body.includes('2,58')) throw new Error('platform commission not shown')
})
await shot(`${OUT}/06-store-confirm.png`)

await step('Call, WhatsApp and maps links point at the right targets', async () => {
  const tel = await page.getByRole('link', { name: /6944123456/ }).getAttribute('href')
  // Phone numbers go out in E.164, so a bare Greek mobile picks up +30.
  if (tel !== 'tel:+306944123456') throw new Error(`tel link wrong: ${tel}`)
  const wa = await page.locator('a[href^="https://wa.me/"]').first().getAttribute('href')
  if (!wa.includes('6944123456')) throw new Error(`whatsapp link wrong: ${wa}`)
  const maps = await page.getByRole('link', { name: /χάρτη/ }).getAttribute('href')
  if (!maps.includes('35.26,25.722')) throw new Error(`maps link should use the coordinates: ${maps}`)
})

await step('Accepting sends the chosen preparation time', async () => {
  await page.getByRole('button', { name: '45′' }).click()
  await page.getByRole('button', { name: /Αποδοχή/ }).click()
  await page.waitForTimeout(900)
  const accept = actions.find(a => a.p_action === 'accept')
  if (!accept) throw new Error('accept never reached the server')
  if (accept.p_prep_minutes !== 45) throw new Error(`prep minutes wrong: ${accept.p_prep_minutes}`)
  if (accept.p_token !== TOKEN) throw new Error('token not sent')
})

await step('After accepting, the next step in the flow is offered', async () => {
  await page.waitForTimeout(600)
  const body = await page.locator('body').innerText()
  if (!body.includes('Επιβεβαιώθηκε')) throw new Error('status did not move to confirmed')
  await page.getByRole('button', { name: /Ξεκίνησε η προετοιμασία/ }).waitFor({ timeout: 5000 })
})
await shot(`${OUT}/07-store-accepted.png`)

await step('The print ticket is rendered for the thermal printer', async () => {
  const ticket = page.locator('.print-ticket')
  if (await ticket.count() === 0) throw new Error('print ticket not in the DOM')
  const html = await ticket.innerHTML()
  for (const needed of ['DLV-260824-0007', 'Villa Aegean Blue', 'DELIVERY', 'ΜΕΤΡΗΤΑ', 'χωρίς κρεμμύδι']) {
    if (!html.includes(needed)) throw new Error(`ticket missing: ${needed}`)
  }
  // Hidden on screen, visible only under the print stylesheet.
  if (await ticket.isVisible()) throw new Error('print ticket must not show on screen')
})

await step('Rejecting captures a reason', async () => {
  status = 'pending'
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Απόρριψη παραγγελίας/ }).click()
  await page.getByRole('button', { name: 'Πολύς φόρτος' }).click()
  await page.getByRole('button', { name: /^Απόρριψη$/ }).click()
  await page.waitForTimeout(900)
  const reject = actions.find(a => a.p_action === 'reject')
  if (!reject) throw new Error('reject never reached the server')
  if (reject.p_reason !== 'Πολύς φόρτος') throw new Error(`reason not sent: ${reject.p_reason}`)
})

await step('An unknown store token fails gracefully', async () => {
  await page.route('**/rpc/delivr_store_order', r => r.fulfill({
    status: 400, contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ message: 'ORDER_NOT_FOUND' }),
  }))
  await page.goto(`${BASE}/s/deadbeef`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  const body = await page.locator('body').innerText()
  if (!body.includes('δεν βρέθηκε')) throw new Error('no error message shown')
})

const realErrors = errors.filter(e =>
  !e.includes('WebSocket') && !e.includes('realtime') && !e.includes('Failed to load resource'))
console.log('\nConsole errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5), null, 1) : 'none')
if (realErrors.length) process.exitCode = 1

await browser.close()
