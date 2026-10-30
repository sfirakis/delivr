import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getPublicPlans, registerStore, ApiError, type StoreSignup, type PublicPlan } from '@/lib/api'
import { money, num } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui'
import DelivrLogo from '@/components/brand/DelivrLogo'
import { CATEGORY_EMOJI } from './MarketStoreCard'

/**
 * Delivr Stores — a shop signs itself up (product line A, the SaaS side).
 *
 * One screen: what you get → plan → your shop → your account. The shop is
 * created by delivr_register_store() as *pending*; the platform admin approves
 * it (Διαχείριση → Καταστήματα) and only then does it show in the marketplace
 * and accept orders. Nothing is charged here: the chosen plan is stored as a
 * request and turned into a subscription by the admin.
 *
 * If Supabase asks the new account to confirm its email first, the form is
 * kept on this device and finished automatically after the first sign-in.
 */

const DRAFT_KEY = 'delivr_join_draft'

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'restaurant', label: 'Εστιατόριο / ταβέρνα' },
  { id: 'cafe', label: 'Καφέ' },
  { id: 'burger', label: 'Burger / σουβλάκι' },
  { id: 'pizza', label: 'Πίτσα' },
  { id: 'sushi', label: 'Sushi / ασιατικό' },
  { id: 'healthy', label: 'Healthy / salad bar' },
  { id: 'supermarket', label: 'Μίνι μάρκετ / κάβα' },
  { id: 'pharmacy', label: 'Φαρμακείο' },
  { id: 'other', label: 'Άλλο' },
]

const emptyShop: StoreSignup = {
  name: '', category: 'restaurant', phone: '', address: '', city: '', area: '', postal_code: '',
  description: '', supports_delivery: true, supports_takeaway: true, delivery_fee: 1.5, min_order: 8,
}

interface Draft { shop: StoreSignup; planId: string | null }

function loadDraft(): Draft | null {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') } catch { return null }
}
function saveDraft(d: Draft | null) {
  try { d ? localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) : localStorage.removeItem(DRAFT_KEY) } catch { /* private mode */ }
}

const ERRORS: Record<string, string> = {
  ALREADY_REGISTERED: 'Αυτός ο λογαριασμός έχει ήδη κατάστημα. Μπες στον πίνακά σου.',
  NAME_REQUIRED: 'Γράψε το όνομα του καταστήματος.',
  PHONE_REQUIRED: 'Γράψε ένα τηλέφωνο (τουλάχιστον 8 ψηφία).',
  ADDRESS_REQUIRED: 'Γράψε τη διεύθυνση του καταστήματος.',
  CITY_REQUIRED: 'Γράψε την πόλη.',
  SERVICE_REQUIRED: 'Διάλεξε delivery, take away ή και τα δύο.',
  RATE_LIMIT: 'Πολλές εγγραφές αυτή την ώρα — δοκίμασε ξανά σε λίγο.',
  AUTH_REQUIRED: 'Χρειάζεται σύνδεση.',
}

function planPrice(p: PublicPlan) {
  if (num(p.price) === 0) return 'Δωρεάν'
  return `${money(p.price)}/${p.billing_cycle === 'year' ? 'έτος' : 'μήνα'}`
}

export default function JoinPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const authLoading = useAuthStore(s => s.loading)
  const fetchProfile = useAuthStore(s => s.fetchProfile)
  useDocumentTitle('Γίνε συνεργάτης')

  const plansQ = useQuery({ queryKey: ['public-plans'], queryFn: getPublicPlans })
  const draft = loadDraft()
  const [shop, setShop] = useState<StoreSignup>(draft?.shop ?? emptyShop)
  const [planId, setPlanId] = useState<string | null>(draft?.planId ?? null)
  const [account, setAccount] = useState({ fullName: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [waitingEmail, setWaitingEmail] = useState(false)
  const [done, setDone] = useState<{ slug: string; onboarding_status: string } | null>(null)

  const set = (patch: Partial<StoreSignup>) => setShop(s => ({ ...s, ...patch }))

  // Keep the form on this device while the owner confirms their email.
  useEffect(() => { if (!done) saveDraft({ shop, planId }) }, [shop, planId, done])

  const plans = useMemo(() => plansQ.data?.plans ?? [], [plansQ.data])
  useEffect(() => {
    if (!planId && plans.length > 0) setPlanId(plans[0].id)
  }, [plans, planId])

  const shopOk = shop.name.trim().length >= 2 && shop.phone.replace(/\D/g, '').length >= 8
    && shop.address.trim() !== '' && shop.city.trim() !== ''
    && (shop.supports_delivery || shop.supports_takeaway)
    && (!shop.supports_delivery || shop.area.trim() !== '' || shop.postal_code.trim() !== '')
  const accountOk = !!user || (account.email.includes('@') && account.password.length >= 6 && account.fullName.trim().length >= 2)

  async function finish() {
    const res = await registerStore({ ...shop, name: shop.name.trim() }, planId)
    saveDraft(null)
    await fetchProfile()
    setDone(res)
  }

  async function submit() {
    setBusy(true)
    try {
      if (!user) {
        const { data, error } = await supabase.auth.signUp({
          email: account.email.trim(), password: account.password,
          options: { data: { full_name: account.fullName.trim() } },
        })
        if (error) throw error
        if (!data.session) {
          // Email confirmation is on: finish after the first sign-in.
          setWaitingEmail(true)
          return
        }
      }
      await finish()
    } catch (err) {
      const e = err as ApiError & { message?: string }
      toast.error(ERRORS[e.code] ?? e.message ?? 'Κάτι πήγε στραβά')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading) return <div className="h-full flex items-center justify-center"><Spinner size={30} /></div>

  if (done) {
    const pending = done.onboarding_status !== 'active'
    return (
      <div className="h-full overflow-y-auto bg-surface-2 px-5 py-8 text-center">
        <DelivrLogo size="sm" />
        <p className="text-5xl mt-8">{pending ? '⏳' : '🎉'}</p>
        <h1 className="font-display font-black text-2xl mt-3">Το κατάστημα δημιουργήθηκε</h1>
        <p className="text-sm text-ink-2 mt-2">
          {pending
            ? 'Θα το ελέγξουμε και θα το ενεργοποιήσουμε σύντομα. Στο μεταξύ βάλε μενού, ωράριο και περιοχές παράδοσης.'
            : 'Είναι ήδη ενεργό. Βάλε μενού και ωράριο και είσαι έτοιμος.'}
        </p>
        <div className="mt-5 bg-surface-1 border border-surface-4 rounded-2xl p-4 text-left text-sm space-y-1">
          <p><span className="text-ink-3">Κατάσταση:</span> <strong>{pending ? 'Σε αναμονή έγκρισης' : 'Ενεργό'}</strong></p>
          <p className="break-all"><span className="text-ink-3">Δικός σου σύνδεσμος:</span> <code>{window.location.origin}/store/{done.slug}</code></p>
        </div>
        <button className="btn btn-primary btn-lg mt-6" onClick={() => navigate('/merchant')}>Πήγαινε στον πίνακά σου →</button>
      </div>
    )
  }

  if (waitingEmail) {
    return (
      <div className="h-full overflow-y-auto bg-surface-2 px-5 py-8 text-center">
        <DelivrLogo size="sm" />
        <p className="text-5xl mt-8">✉️</p>
        <h1 className="font-display font-black text-2xl mt-3">Επιβεβαίωσε το email σου</h1>
        <p className="text-sm text-ink-2 mt-2">
          Σου στείλαμε σύνδεσμο στο <strong>{account.email}</strong>. Μετά συνδέσου — τα στοιχεία του
          καταστήματος κρατήθηκαν σε αυτή τη συσκευή και η εγγραφή ολοκληρώνεται με ένα κλικ.
        </p>
        <Link to="/auth" state={{ from: { pathname: '/join' } }} className="btn btn-primary btn-lg mt-6">Σύνδεση</Link>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-2">
      {/* ── What you get ── */}
      <div className="bg-ink-1 text-white px-5 pt-5 pb-6">
        <div className="flex items-center justify-between">
          <DelivrLogo tone="dark" size="sm" />
          <Link to="/" className="text-xs text-white/60 underline underline-offset-4">Αρχική</Link>
        </div>
        <h1 className="font-display font-black text-[26px] leading-tight mt-5">Βάλε το κατάστημά σου στο Delivr</h1>
        <ul className="text-sm text-white/80 mt-3 space-y-1.5">
          <li>🛵 Delivery & 🥡 take away από το δικό σου μενού</li>
          <li>🗺️ Εμφανίζεσαι στους πελάτες των περιοχών που εξυπηρετείς</li>
          <li>🔗 Δικός σου σύνδεσμος + QR για Instagram, βιτρίνα, flyer</li>
          <li>🔔 Οθόνη παραγγελιών με ήχο, εκτύπωση 80mm, στατιστικά</li>
          <li>💶 Μετρητά στην παράδοση· online πληρωμή έρχεται σύντομα</li>
        </ul>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* ── Plan ── */}
        <section>
          <h2 className="font-display font-bold text-lg mb-2">1. Πακέτο</h2>
          {plansQ.isLoading && <Spinner size={24} />}
          {plans.length === 0 && !plansQ.isLoading && (
            <div className="bg-surface-1 border-2 border-brand rounded-2xl p-4">
              <p className="font-semibold">Χωρίς πάγιο</p>
              <p className="text-sm text-ink-2">
                Οι όροι συμφωνούνται με την ομάδα μας
              </p>
            </div>
          )}
          <div className="grid gap-2">
            {plans.map(p => (
              <button key={p.id} type="button" onClick={() => setPlanId(p.id)} aria-pressed={planId === p.id}
                      className={`text-left bg-surface-1 rounded-2xl p-4 border-2 transition
                        ${planId === p.id ? 'border-brand' : 'border-surface-4'}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{p.name}</p>
                  <p className="font-display font-black text-brand whitespace-nowrap">{planPrice(p)}</p>
                </div>
                <p className="text-xs text-ink-2 mt-1">
                  {[p.trial_days > 0 ? `${p.trial_days} μέρες δωρεάν δοκιμή` : null,
                    p.description].filter(Boolean).join(' · ')}
                </p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-3 mt-2">Δεν χρεώνεται τίποτα τώρα. Το πακέτο ενεργοποιείται μαζί με το κατάστημα.</p>
        </section>

        {/* ── Shop ── */}
        <section className="bg-surface-1 border border-surface-4 rounded-2xl p-4 space-y-3">
          <h2 className="font-display font-bold text-lg">2. Το κατάστημα</h2>
          <div>
            <label className="input-label" htmlFor="j-name">Όνομα καταστήματος</label>
            <input id="j-name" className="input-field" value={shop.name} placeholder="π.χ. Σουβλάκι του Γιώργου"
                   onChange={e => set({ name: e.target.value })} />
          </div>
          <div>
            <label className="input-label" htmlFor="j-cat">Κατηγορία</label>
            <select id="j-cat" className="input-field" value={shop.category} onChange={e => set({ category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{CATEGORY_EMOJI[c.id]} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label" htmlFor="j-phone">Τηλέφωνο</label>
            <input id="j-phone" className="input-field" inputMode="tel" value={shop.phone} placeholder="π.χ. 2841012345"
                   onChange={e => set({ phone: e.target.value })} />
          </div>
          <div>
            <label className="input-label" htmlFor="j-address">Διεύθυνση</label>
            <input id="j-address" className="input-field" value={shop.address} placeholder="Οδός & αριθμός"
                   onChange={e => set({ address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="input-label" htmlFor="j-city">Πόλη</label>
              <input id="j-city" className="input-field" value={shop.city} placeholder="π.χ. Ηράκλειο"
                     onChange={e => set({ city: e.target.value })} />
            </div>
            <div>
              <label className="input-label" htmlFor="j-postal">Τ.Κ.</label>
              <input id="j-postal" className="input-field" inputMode="numeric" value={shop.postal_code}
                     onChange={e => set({ postal_code: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-sm font-semibold bg-surface-2 rounded-xl px-3 py-2.5">
              <input type="checkbox" className="accent-brand w-4 h-4" checked={shop.supports_delivery}
                     onChange={e => set({ supports_delivery: e.target.checked })} /> 🛵 Delivery
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold bg-surface-2 rounded-xl px-3 py-2.5">
              <input type="checkbox" className="accent-brand w-4 h-4" checked={shop.supports_takeaway}
                     onChange={e => set({ supports_takeaway: e.target.checked })} /> 🥡 Take away
            </label>
          </div>
          {shop.supports_delivery && (
            <>
              <div>
                <label className="input-label" htmlFor="j-area">Περιοχή που κάνεις delivery</label>
                <input id="j-area" className="input-field" value={shop.area} placeholder="π.χ. Αμμουδάρα"
                       onChange={e => set({ area: e.target.value })} />
                <p className="text-[11px] text-ink-3 mt-1">Η πρώτη σου ζώνη. Προσθέτεις κι άλλες μετά, η καθεμία με δικά της μεταφορικά.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="input-label" htmlFor="j-fee">Μεταφορικά (€)</label>
                  <input id="j-fee" className="input-field" type="number" step="0.5" min="0" value={shop.delivery_fee}
                         onChange={e => set({ delivery_fee: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="input-label" htmlFor="j-min">Ελάχιστη παραγγελία (€)</label>
                  <input id="j-min" className="input-field" type="number" step="1" min="0" value={shop.min_order}
                         onChange={e => set({ min_order: Number(e.target.value) })} />
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── Account ── */}
        <section className="bg-surface-1 border border-surface-4 rounded-2xl p-4 space-y-3">
          <h2 className="font-display font-bold text-lg">3. Ο λογαριασμός σου</h2>
          {user ? (
            <p className="text-sm text-ink-2">Συνδεδεμένος ως <strong>{user.email}</strong>. Το κατάστημα θα ανήκει σε αυτόν τον λογαριασμό.</p>
          ) : (
            <>
              <div>
                <label className="input-label" htmlFor="j-fullname">Ονοματεπώνυμο</label>
                <input id="j-fullname" className="input-field" autoComplete="name" value={account.fullName}
                       onChange={e => setAccount(a => ({ ...a, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="input-label" htmlFor="j-email">Email</label>
                <input id="j-email" className="input-field" type="email" autoComplete="email" value={account.email}
                       onChange={e => setAccount(a => ({ ...a, email: e.target.value }))} />
              </div>
              <div>
                <label className="input-label" htmlFor="j-password">Κωδικός</label>
                <input id="j-password" className="input-field" type="password" autoComplete="new-password"
                       placeholder="Τουλάχιστον 6 χαρακτήρες" value={account.password}
                       onChange={e => setAccount(a => ({ ...a, password: e.target.value }))} />
              </div>
              <p className="text-[11px] text-ink-3">
                Έχεις ήδη λογαριασμό; <Link to="/auth" state={{ from: { pathname: '/join' } }} className="text-brand underline">Σύνδεση</Link>
              </p>
            </>
          )}
        </section>

        <button className="btn btn-primary btn-lg" disabled={!shopOk || !accountOk || busy} onClick={submit}>
          {busy ? <Spinner size={20} color="white" /> : 'Δημιουργία καταστήματος'}
        </button>
        <p className="text-[11px] text-ink-3 text-center pb-6">
          Με την εγγραφή αποδέχεσαι τους <Link to="/terms" className="text-brand underline">Όρους χρήσης</Link>.
        </p>
      </div>
    </div>
  )
}
