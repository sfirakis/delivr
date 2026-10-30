/**
 * Delivr Stores — a shop signs itself up (/join), and the platform side
 * (admin approval, merchant onboarding) sees it. Supabase is mocked: auth
 * sign-up, delivr_public_plans, delivr_register_store and the table reads
 * the dashboards make. Nothing reaches the live project, no email is sent.
 *
 *   BASE_URL=http://localhost:5174 E2E_SUPABASE_REF=<ref of VITE_SUPABASE_URL> node e2e/join-flow.mjs
 */
import { launchChromium } from './browser.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const REF = process.env.E2E_SUPABASE_REF || 'ifgzciraogohycuvujip'
const SHOTS = process.env.SHOTS_DIR || null
const USER_ID = '22222222-3333-4444-5555-666666666666'
const ADMIN_ID = '11111111-2222-3333-4444-555555555555'
const STORE_ID = '7a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

const PLANS = {
  default: { mode: 'commission', value: 10, auto_approve: false },
  plans: [
    { id: 'p-basic', name: 'Basic', description: null, price: 0, billing_cycle: 'month', trial_days: 0,
      commission_mode: 'commission', commission_value: 12, features: [] },
    { id: 'p-pro', name: 'Pro', description: 'Για μαγαζιά με σταθερό τζίρο', price: 29, billing_cycle: 'month',
      trial_days: 30, commission_mode: 'commission', commission_value: 6, features: [] },
  ],
}

const PENDING_STORE = {
  id: STORE_ID, name: 'Καφέ Θάλασσα', slug: 'kafe-thalassa', description: null,
  category: 'cafe', cuisine_tags: [], address: 'Παραλία 9', city: 'Ηράκλειο',
  lat: 0, lng: 0, phone: '6912345678', email: 'owner@kafe.test', order_email: 'owner@kafe.test', order_whatsapp: null,
  notify_email: true, notify_whatsapp: true, delivery_fee: 1.5, min_order_amount: 6,
  free_delivery_above: null, avg_delivery_time: 30, delivery_radius_km: 5, pickup_radius_km: 15,
  pickup_discount_pct: 0, prep_time_min: 20, supports_delivery: true, supports_takeaway: true,
  accepts_cash: true, accepts_online: false, auto_accept: false, billing_mode: 'inherit',
  billing_value: 0, onboarding_status: 'pending', is_open: true, is_active: true,
  is_promoted: false, rating: 0, review_count: 0, notes: null, created_at: new Date().toISOString(),
  standalone_enabled: true, standalone_intro: null,
  marketplace_listed: true, self_registered_at: new Date().toISOString(), requested_plan_id: 'p-pro',
}
const ZONES = [{ id: 'z1', store_id: STORE_ID, name: 'Αμμουδάρα', area: 'Αμμουδάρα', postal_code: '71414',
  city: 'Ηράκλειο', delivery_fee: 1.5, min_order: 6, extra_minutes: 0, free_above: null, is_active: true, sort_order: 0 }]

const session = (uid, email) => ({
  access_token: 'stub-access-token', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'stub-refresh',
  user: { id: uid, aud: 'authenticated', role: 'authenticated', email,
          app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
})

const errors = []
const browser = await launchChromium()

let failed = 0
const results = []
const step = async (page, name, fn) => {
  try { await fn(); console.log(`✅ ${name}`) }
  catch (e) {
    failed++
    console.log(`❌ ${name} — ${e.message.split('\n').slice(0, 3).join(' | ')}`)
    try { console.log('   page:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300)) } catch { /* gone */ }
  }
}

/** A phone-sized page with every Supabase call mocked. */
async function newPage({ signedIn = null, autoconfirm = true, role = 'customer', width = 390 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, locale: 'el-GR' })
  await ctx.addInitScript(([ref, s, first]) => {
    try {
      if (!sessionStorage.getItem('e2e_init')) {
        if (first) localStorage.clear()
        localStorage.setItem('delivr_lang', 'el')
        if (s) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
        sessionStorage.setItem('e2e_init', '1')
      }
    } catch { /* private mode */ }
  }, [REF, signedIn, !signedIn])
  ctx.setDefaultTimeout(8000)
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
  const cap = { signup: null, register: null, writes: [] }
  const json = (route, body, status = 200) => route.fulfill({
    status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body),
  })
  const wantsSingle = (req) => (req.headers()['accept'] || '').includes('pgrst.object')
  await page.route('**/*.supabase.co/**', async route => {
    const req = route.request(); const url = req.url(); const method = req.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } })
    const body = (() => { try { return JSON.parse(req.postData() || '{}') } catch { return {} } })()

    if (url.includes('/auth/v1/signup')) {
      cap.signup = body
      const s = session(USER_ID, body.email)
      return json(route, autoconfirm ? s : { ...s.user, confirmation_sent_at: new Date().toISOString() })
    }
    if (url.includes('/auth/v1/user')) return json(route, session(signedIn?.user.id ?? USER_ID, 'x@test').user)
    if (url.includes('/auth/v1/')) return json(route, {})
    if (url.includes('/rpc/delivr_public_plans')) return json(route, PLANS)
    if (url.includes('/rpc/delivr_register_store')) {
      cap.register = body
      return json(route, { id: STORE_ID, slug: 'kafe-thalassa', onboarding_status: 'pending' })
    }
    if (url.includes('/rpc/')) return json(route, [])
    if (method !== 'GET') { cap.writes.push({ url, method, body }); return json(route, [{ ...PENDING_STORE, ...body }]) }
    if (url.includes('/profiles')) {
      const row = { id: signedIn?.user.id ?? USER_ID, full_name: 'Test', email: 'x@test', phone: null, role,
        is_active: true, loyalty_points: 0, avatar_url: null, created_at: '', updated_at: '' }
      return json(route, wantsSingle(req) ? row : [row])
    }
    if (url.includes('/subscription_plans')) return json(route, PLANS.plans.map(p => ({ ...p, audience: 'store', is_active: true, sort_order: 0 })))
    if (url.includes('/store_zones')) return json(route, ZONES)
    if (url.includes('/store_users')) return json(route, [{ store_id: STORE_ID, role: 'owner', stores: PENDING_STORE }])
    if (url.includes('/store_hours')) return json(route, [])
    if (url.includes('/stores')) return json(route, [PENDING_STORE])
    return json(route, [])
  })
  return { page, cap }
}

const shot = async (page, name, fullPage = false) => {
  if (!SHOTS) return
  try { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage, timeout: 8000 }) } catch { /* people only */ }
}

// ── 1. Sign-up with an auto-confirmed account ──────────────────────────────
{
  const { page, cap } = await newPage()
  await step(page, 'The join page explains the offer and lists the plans', async () => {
    await page.goto(`${BASE}/join`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Βάλε το κατάστημά σου στο Delivr').waitFor()
    await page.getByText('Pro').first().waitFor()
    const b = await page.locator('body').innerText()
    if (!/29,00\s€\/μήνα/.test(b)) throw new Error('Pro price missing')
    for (const s of ['by ActionWeb', 'Basic', '6% ανά παραγγελία', '30 μέρες δωρεάν δοκιμή', 'online πληρωμή έρχεται σύντομα']) {
      if (!b.includes(s)) throw new Error(`missing "${s}"`)
    }
    if (/Visa|PCI/.test(b)) throw new Error('fake payment claims are back')
  })
  await shot(page, 'join-m-01-offer')

  await step(page, 'Submit stays disabled until shop and account are complete', async () => {
    const btn = page.getByRole('button', { name: 'Δημιουργία καταστήματος' })
    if (!(await btn.isDisabled())) throw new Error('enabled on an empty form')
    await page.getByRole('button', { name: /Pro/ }).click()
    await page.locator('#j-name').fill('Καφέ Θάλασσα')
    await page.locator('#j-cat').selectOption('cafe')
    await page.locator('#j-phone').fill('6912345678')
    await page.locator('#j-address').fill('Παραλία 9')
    await page.locator('#j-city').fill('Ηράκλειο')
    await page.locator('#j-postal').fill('71414')
    await page.locator('#j-area').fill('Αμμουδάρα')
    await page.locator('#j-fee').fill('1.5')
    await page.locator('#j-min').fill('6')
    if (!(await btn.isDisabled())) throw new Error('enabled without an account')
    await page.locator('#j-fullname').fill('Ελένη Π.')
    await page.locator('#j-email').fill('owner@kafe.test')
    await page.locator('#j-password').fill('secret123')
    await page.waitForTimeout(150)
    if (await btn.isDisabled()) throw new Error('still disabled with a complete form')
  })
  await page.locator('#j-name').scrollIntoViewIfNeeded().catch(() => {})
  await shot(page, 'join-m-02-form')

  await step(page, 'It creates the account, then the shop — pending, with the plan as a request', async () => {
    await page.getByRole('button', { name: 'Δημιουργία καταστήματος' }).click()
    await page.getByText('Το κατάστημα δημιουργήθηκε').waitFor()
    if (cap.signup?.email !== 'owner@kafe.test') throw new Error('sign-up not called')
    const r = cap.register
    if (!r) throw new Error('register RPC not called')
    if (r.p_plan_id !== 'p-pro') throw new Error(`plan ${r.p_plan_id}`)
    const s = r.p_store
    if (s.name !== 'Καφέ Θάλασσα' || s.category !== 'cafe' || s.area !== 'Αμμουδάρα' || s.city !== 'Ηράκλειο')
      throw new Error(JSON.stringify(s))
    if (s.delivery_fee !== 1.5 || s.min_order !== 6) throw new Error(`fee/min ${s.delivery_fee}/${s.min_order}`)
    const b = await page.locator('body').innerText()
    if (!b.includes('Σε αναμονή έγκρισης') || !b.includes('/store/kafe-thalassa')) throw new Error('success screen')
    const draft = await page.evaluate(() => localStorage.getItem('delivr_join_draft'))
    if (draft) throw new Error('draft not cleared')
  })
  await shot(page, 'join-m-03-done')
  await page.context().close()
}

// ── 2. Email confirmation required → finish after sign-in ──────────────────
{
  const { page } = await newPage({ autoconfirm: false })
  await step(page, 'With email confirmation on, the form is kept and the owner is told what to do', async () => {
    await page.goto(`${BASE}/join`, { waitUntil: 'domcontentloaded' })
    await page.locator('#j-name').fill('Pizza Νίκος')
    await page.locator('#j-cat').selectOption('pizza')
    await page.locator('#j-phone').fill('2810123456')
    await page.locator('#j-address').fill('Οδός 1')
    await page.locator('#j-city').fill('Ηράκλειο')
    await page.locator('#j-area').fill('Πόρος')
    await page.locator('#j-fullname').fill('Νίκος')
    await page.locator('#j-email').fill('nikos@pizza.test')
    await page.locator('#j-password').fill('secret123')
    await page.getByRole('button', { name: 'Δημιουργία καταστήματος' }).click()
    await page.getByText('Επιβεβαίωσε το email σου').waitFor()
    const draft = JSON.parse(await page.evaluate(() => localStorage.getItem('delivr_join_draft')) || '{}')
    if (draft.shop?.name !== 'Pizza Νίκος') throw new Error('draft not kept')
  })
  await shot(page, 'join-m-04-confirm-email')
  const draft = await page.evaluate(() => localStorage.getItem('delivr_join_draft'))
  await page.context().close()

  const { page: p2, cap } = await newPage({ signedIn: session(USER_ID, 'nikos@pizza.test') })
  await p2.addInitScript(d => { try { if (!localStorage.getItem('delivr_join_draft')) localStorage.setItem('delivr_join_draft', d) } catch { /* */ } }, draft)
  await step(p2, 'After sign-in the saved form finishes with one click', async () => {
    await p2.goto(`${BASE}/join`, { waitUntil: 'domcontentloaded' })
    await p2.getByText(/Συνδεδεμένος ως/).waitFor()
    if (await p2.locator('#j-name').inputValue() !== 'Pizza Νίκος') throw new Error('draft not restored')
    await p2.getByRole('button', { name: 'Δημιουργία καταστήματος' }).click()
    await p2.getByText('Το κατάστημα δημιουργήθηκε').waitFor()
    if (cap.register?.p_store?.category !== 'pizza') throw new Error('register payload')
  })
  await p2.context().close()
}

// ── 3. Merchant: the new shop's owner sees what to do next ──────────────────
{
  const { page, cap } = await newPage({ signedIn: session(USER_ID, 'owner@kafe.test'), role: 'store' })
  await step(page, 'Merchant dashboard: pending banner, sales channels and an editable zone list', async () => {
    await page.goto(`${BASE}/merchant`, { waitUntil: 'domcontentloaded' })
    await page.getByText('περιμένει έγκριση').waitFor()
    if (!(await page.locator('body').innerText()).includes('by ActionWeb')) throw new Error('logo missing')
    await shot(page, 'merchant-m-01-pending')
    await page.getByRole('button', { name: /Ρυθμίσεις/ }).first().click()
    await page.getByText('Πού πουλάς').waitFor()
    await page.getByText('Αμμουδάρα').first().waitFor()
    if (!(await page.getByRole('button', { name: '+ Νέα ζώνη' }).isVisible())) throw new Error('zones not editable')
    await page.getByText('Πού πουλάς').scrollIntoViewIfNeeded()
    await shot(page, 'merchant-m-02-channels')
    await page.getByRole('button', { name: 'Αποθήκευση αλλαγών' }).click()
    await page.waitForTimeout(500)
    const w = cap.writes.find(x => x.url.includes('/stores'))
    if (!w) throw new Error('settings not saved')
    if ('onboarding_status' in w.body || 'billing_mode' in w.body) throw new Error('merchant sent admin-only fields')
    if (w.body.marketplace_listed !== true) throw new Error('channel flag not saved')
  })
  await page.context().close()
}

// ── 4. Admin: approve the shop ─────────────────────────────────────────────
{
  const { page, cap } = await newPage({ signedIn: session(ADMIN_ID, 'admin@delivr.gr'), role: 'admin', width: 1100 })
  await step(page, 'Admin sees the shop waiting, with its requested plan, and approves it', async () => {
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Καταστήματα/ }).first().click()
    await page.getByText(/Περιμένουν έγκριση \(1\)/).waitFor()
    const b = await page.locator('body').innerText()
    if (!b.includes('ζήτησε πακέτο «Pro»')) throw new Error('requested plan not shown')
    if (!b.includes('Market')) throw new Error('channel badge missing')
    await shot(page, 'admin-01-pending-approval')
    await page.getByRole('button', { name: '✅ Έγκριση' }).click()
    await page.waitForTimeout(500)
    const w = cap.writes.find(x => x.url.includes('/stores') && x.method === 'PATCH')
    if (!w || w.body.onboarding_status !== 'active') throw new Error(`approve write ${JSON.stringify(w)}`)
  })
  await page.context().close()
}

const realErrors = errors.filter(e =>
  !e.includes('WebSocket') && !e.includes('realtime') && !e.includes('Failed to load resource'))
console.log('\nConsole errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5), null, 1) : 'none')
if (realErrors.length || failed) process.exitCode = 1
await browser.close()
