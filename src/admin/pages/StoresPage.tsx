import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import {
  useAdminStores, useUpsertStore, useDeleteStore,
  useZones, useUpsertZone, useDeleteZone,
  type AdminStore, type AdminZone,
} from '../hooks'
import { Card, Field, TextInput, TextArea, Select, CheckRow, Modal, StatusChip } from '../ui'
import { money, num } from '@/lib/format'
import { Spinner } from '@/components/ui'
import MenuImport from '@/components/menu/MenuImport'

const CATEGORIES = [
  ['restaurant', 'Εστιατόριο'], ['cafe', 'Καφέ'], ['burger', 'Burger'], ['pizza', 'Πιτσαρία'],
  ['sushi', 'Sushi'], ['healthy', 'Healthy'], ['supermarket', 'Σούπερ μάρκετ'],
  ['pharmacy', 'Φαρμακείο'], ['other', 'Άλλο'],
]

const emptyStore: Partial<AdminStore> = {
  name: '', slug: '', category: 'restaurant', address: '', city: '',
  delivery_fee: 2, min_order_amount: 10, avg_delivery_time: 30, delivery_radius_km: 5,
  pickup_radius_km: 15, pickup_discount_pct: 0, prep_time_min: 20,
  supports_delivery: true, supports_takeaway: true, accepts_cash: true, accepts_online: false,
  auto_accept: false, notify_email: true, notify_whatsapp: true,
  billing_mode: 'inherit', billing_value: 0, onboarding_status: 'active',
  is_open: true, is_active: true, is_promoted: false, standalone_enabled: false,
}

const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[άΆ]/g, 'a').replace(/[έΈ]/g, 'e').replace(/[ήΉ]/g, 'i').replace(/[ίΊϊΐ]/g, 'i')
    .replace(/[όΌ]/g, 'o').replace(/[ύΎϋΰ]/g, 'y').replace(/[ώΏ]/g, 'o')
    .replace(/[^a-z0-9α-ω]+/gi, '-').replace(/^-|-$/g, '')

// ── Delivery zones editor ────────────────────────────────────
function ZonesEditor({ storeId }: { storeId: string }) {
  const zonesQ = useZones(storeId)
  const upsert = useUpsertZone(storeId)
  const remove = useDeleteZone(storeId)
  const [draft, setDraft] = useState<Partial<AdminZone> | null>(null)

  const zones = zonesQ.data ?? []

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        Οι ζώνες καθορίζουν πού παραδίδει το κατάστημα και με ποια χρέωση. Ένα κατάλυμα ταιριάζει
        με ζώνη όταν συμπίπτει ο <strong>Τ.Κ.</strong> ή η <strong>περιοχή</strong>. Αν δεν ταιριάξει καμία
        ζώνη, χρησιμοποιείται η ακτίνα σε χιλιόμετρα.
      </p>

      <div className="overflow-x-auto">
        <table className="dash-table">
          <thead>
            <tr><th>Ζώνη</th><th>Περιοχή</th><th>Τ.Κ.</th><th>Μεταφορικά</th><th>Ελάχ. παραγγελία</th>
                <th>Δωρεάν άνω</th><th>+ λεπτά</th><th>Ενεργή</th><th></th></tr>
          </thead>
          <tbody>
            {zones.map(z => (
              <tr key={z.id}>
                <td className="font-semibold">{z.name}</td>
                <td>{z.area ?? '—'}</td>
                <td>{z.postal_code ?? '—'}</td>
                <td>{money(z.delivery_fee)}</td>
                <td>{money(z.min_order)}</td>
                <td>{z.free_above ? money(z.free_above) : '—'}</td>
                <td>{z.extra_minutes}′</td>
                <td>{z.is_active ? '✓' : '✗'}</td>
                <td className="whitespace-nowrap">
                  <button className="btn-icon" onClick={() => setDraft(z)}>✏️</button>
                  <button className="btn-icon text-danger" onClick={() => {
                    if (confirm(`Διαγραφή ζώνης «${z.name}»;`)) remove.mutate(z.id)
                  }}>🗑</button>
                </td>
              </tr>
            ))}
            {zones.length === 0 && (
              <tr><td colSpan={9} className="text-center text-ink-3 py-4">
                Καμία ζώνη — χρησιμοποιείται μόνο η ακτίνα km.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <button className="btn btn-secondary btn-md" onClick={() => setDraft({
        name: '', area: '', postal_code: '', delivery_fee: 2, min_order: 0,
        extra_minutes: 0, is_active: true, sort_order: zones.length + 1,
      })}>+ Νέα ζώνη</button>

      {draft && (
        <Modal title={draft.id ? 'Επεξεργασία ζώνης' : 'Νέα ζώνη'} onClose={() => setDraft(null)}>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Όνομα ζώνης *">
              <TextInput value={draft.name ?? ''} onChange={e => setDraft({ ...draft, name: e.target.value })}
                         placeholder="π.χ. Ελούντα" />
            </Field>
            <Field label="Περιοχή" hint="Πρέπει να ταιριάζει με την «Περιοχή» του καταλύματος">
              <TextInput value={draft.area ?? ''} onChange={e => setDraft({ ...draft, area: e.target.value })} />
            </Field>
            <Field label="Ταχυδρομικός κώδικας" hint="Εναλλακτικός τρόπος αντιστοίχισης">
              <TextInput value={draft.postal_code ?? ''} onChange={e => setDraft({ ...draft, postal_code: e.target.value })} />
            </Field>
            <Field label="Πόλη">
              <TextInput value={draft.city ?? ''} onChange={e => setDraft({ ...draft, city: e.target.value })} />
            </Field>
            <Field label="Μεταφορικά (€)">
              <TextInput type="number" step="0.10" value={draft.delivery_fee ?? 0}
                         onChange={e => setDraft({ ...draft, delivery_fee: Number(e.target.value) })} />
            </Field>
            <Field label="Ελάχιστη παραγγελία (€)" hint="0 = χρησιμοποιείται το ελάχιστο του καταστήματος">
              <TextInput type="number" step="0.50" value={draft.min_order ?? 0}
                         onChange={e => setDraft({ ...draft, min_order: Number(e.target.value) })} />
            </Field>
            <Field label="Δωρεάν μεταφορικά άνω των (€)">
              <TextInput type="number" step="1" value={draft.free_above ?? ''}
                         onChange={e => setDraft({ ...draft, free_above: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Επιπλέον λεπτά παράδοσης">
              <TextInput type="number" value={draft.extra_minutes ?? 0}
                         onChange={e => setDraft({ ...draft, extra_minutes: Number(e.target.value) })} />
            </Field>
          </div>
          <CheckRow label="Ενεργή ζώνη" checked={draft.is_active ?? true}
                    onChange={v => setDraft({ ...draft, is_active: v })} />
          <div className="flex gap-2 justify-end mt-4">
            <button className="btn btn-secondary btn-md" onClick={() => setDraft(null)}>Άκυρο</button>
            <button className="btn btn-primary btn-md" disabled={!draft.name}
                    onClick={() => {
                      upsert.mutate(draft, {
                        onSuccess: () => { toast.success('Αποθηκεύτηκε'); setDraft(null) },
                        onError: (e) => toast.error((e as Error).message),
                      })
                    }}>Αποθήκευση</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── A store's own ordering link ──────────────────────────────
function StandaloneTab({ form, set }: {
  form: Partial<AdminStore>; set: (patch: Partial<AdminStore>) => void
}) {
  const [qr, setQr] = useState('')
  const slug = form.slug || slugify(form.name ?? '')
  const url = `${(import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '')}/store/${slug}`

  useEffect(() => {
    if (!form.standalone_enabled) { setQr(''); return }
    void QRCode.toDataURL(url, { width: 900, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQr).catch(() => setQr(''))
  }, [url, form.standalone_enabled])

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        Με αυτό ενεργό, το κατάστημα δέχεται παραγγελίες και <strong>χωρίς QR καταλύματος</strong>:
        ο πελάτης ανοίγει τον σύνδεσμο, γράφει μόνος του τη διεύθυνσή του και η ζώνη ελέγχεται
        από την περιοχή που θα διαλέξει. Έτσι πουλάμε την πλατφόρμα σε μαγαζιά που δεν
        γειτονεύουν με δικά μας ακίνητα — η προμήθεια χρεώνεται κανονικά.
      </p>

      <CheckRow label="Ενεργός δικός του σύνδεσμος παραγγελιών"
                hint="Χωρίς αυτό, ο σύνδεσμος επιστρέφει «μη διαθέσιμο»"
                checked={form.standalone_enabled ?? false}
                onChange={v => set({ standalone_enabled: v })} />

      <Field label="Μήνυμα καλωσορίσματος" hint="Εμφανίζεται κάτω από το όνομα στη σελίδα του καταστήματος">
        <TextArea rows={2} value={form.standalone_intro ?? ''}
                  onChange={e => set({ standalone_intro: e.target.value })} />
      </Field>

      {form.standalone_enabled && (
        <div className="border border-surface-4 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center">
          {qr
            ? <img src={qr} alt={`QR ${slug}`} className="w-40 h-40" />
            : <div className="w-40 h-40 flex items-center justify-center"><Spinner /></div>}
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-xs text-ink-3 break-all">{url}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary btn-md"
                      onClick={() => { void navigator.clipboard.writeText(url); toast.success('Ο σύνδεσμος αντιγράφηκε') }}>
                📋 Αντιγραφή συνδέσμου
              </button>
              <a className="btn btn-secondary btn-md" href={url} target="_blank" rel="noreferrer">
                ↗ Άνοιγμα
              </a>
              {qr && (
                <a className="btn btn-secondary btn-md" href={qr} download={`qr-${slug}.png`}>
                  ⬇ Λήψη QR
                </a>
              )}
            </div>
            <p className="text-[11px] text-ink-3">
              Ο σύνδεσμος δουλεύει αφού πατηθεί «Αποθήκευση».
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Store editor ─────────────────────────────────────────────
function StoreEditor({ store, onClose }: { store: Partial<AdminStore>; onClose: () => void }) {
  const [form, setForm] = useState<Partial<AdminStore>>(store)
  const [tab, setTab] = useState<'basic' | 'delivery' | 'billing' | 'zones' | 'link'>('basic')
  const [menuOpen, setMenuOpen] = useState(false)
  const upsert = useUpsertStore()
  const set = (patch: Partial<AdminStore>) => setForm(f => ({ ...f, ...patch }))

  const save = () => {
    const payload = { ...form, slug: form.slug || slugify(form.name ?? '') }
    upsert.mutate(payload, {
      onSuccess: () => { toast.success('Το κατάστημα αποθηκεύτηκε'); onClose() },
      onError: (e) => toast.error((e as Error).message),
    })
  }

  const tabs = [
    ['basic', 'Στοιχεία'], ['delivery', 'Delivery & Take away'],
    ['billing', 'Χρέωση & ειδοποιήσεις'], ['zones', 'Ζώνες'],
    ['link', 'Δικός του σύνδεσμος'],
  ] as const

  return (
    <Modal title={form.id ? `Επεξεργασία — ${form.name}` : 'Νέο κατάστημα'} onClose={onClose} wide>
      <div className="flex gap-1 border-b border-surface-4 mb-4 overflow-x-auto">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            disabled={(id === 'zones' || id === 'link') && !form.id}
            className={`px-3.5 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition disabled:opacity-40
              ${tab === id ? 'border-brand text-brand' : 'border-transparent text-ink-2'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'basic' && (
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Όνομα *">
            <TextInput value={form.name ?? ''} onChange={e => set({ name: e.target.value })} />
          </Field>
          <Field label="Slug" hint="Αν μείνει κενό, δημιουργείται αυτόματα">
            <TextInput value={form.slug ?? ''} onChange={e => set({ slug: e.target.value })}
                       placeholder={slugify(form.name ?? '')} />
          </Field>
          <Field label="Κατηγορία">
            <Select value={form.category ?? 'restaurant'} onChange={e => set({ category: e.target.value })}>
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Κουζίνες / ετικέτες" hint="Χωρισμένες με κόμμα">
            <TextInput value={(form.cuisine_tags ?? []).join(', ')}
                       onChange={e => set({ cuisine_tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
          </Field>
          <Field label="Διεύθυνση *">
            <TextInput value={form.address ?? ''} onChange={e => set({ address: e.target.value })} />
          </Field>
          <Field label="Πόλη">
            <TextInput value={form.city ?? ''} onChange={e => set({ city: e.target.value })} />
          </Field>
          <Field label="Γεωγραφικό πλάτος (lat)" hint="Χρειάζεται για την αντιστοίχιση με ακτίνα km">
            <TextInput type="number" step="0.000001" value={form.lat ?? ''}
                       onChange={e => set({ lat: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Γεωγραφικό μήκος (lng)">
            <TextInput type="number" step="0.000001" value={form.lng ?? ''}
                       onChange={e => set({ lng: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Τηλέφωνο">
            <TextInput value={form.phone ?? ''} onChange={e => set({ phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <TextInput type="email" value={form.email ?? ''} onChange={e => set({ email: e.target.value })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Περιγραφή">
              <TextArea rows={2} value={form.description ?? ''} onChange={e => set({ description: e.target.value })} />
            </Field>
          </div>
          <div className="md:col-span-2 grid md:grid-cols-3 gap-1">
            <CheckRow label="Ενεργό" checked={form.is_active ?? true} onChange={v => set({ is_active: v })} />
            <CheckRow label="Ανοιχτό τώρα" checked={form.is_open ?? true} onChange={v => set({ is_open: v })} />
            <CheckRow label="Προβεβλημένο" checked={form.is_promoted ?? false} onChange={v => set({ is_promoted: v })} />
          </div>
          <Field label="Κατάσταση ένταξης">
            <Select value={form.onboarding_status ?? 'active'}
                    onChange={e => set({ onboarding_status: e.target.value as AdminStore['onboarding_status'] })}>
              <option value="pending">Σε αναμονή</option>
              <option value="active">Ενεργό</option>
              <option value="suspended">Σε αναστολή</option>
            </Select>
          </Field>
          {form.id && (
            <div className="flex items-end">
              <button className="btn btn-secondary btn-md w-full" onClick={() => setMenuOpen(true)}>
                📋 Εισαγωγή μενού
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'delivery' && (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2 grid md:grid-cols-2 gap-1">
            <CheckRow label="Υποστηρίζει delivery" checked={form.supports_delivery ?? true}
                      onChange={v => set({ supports_delivery: v })} />
            <CheckRow label="Υποστηρίζει take away" checked={form.supports_takeaway ?? true}
                      onChange={v => set({ supports_takeaway: v })} />
          </div>
          <Field label="Μεταφορικά (€)" hint="Προεπιλογή όταν δεν ταιριάξει ζώνη">
            <TextInput type="number" step="0.10" value={form.delivery_fee ?? 0}
                       onChange={e => set({ delivery_fee: Number(e.target.value) })} />
          </Field>
          <Field label="Ελάχιστη παραγγελία (€)">
            <TextInput type="number" step="0.50" value={form.min_order_amount ?? 0}
                       onChange={e => set({ min_order_amount: Number(e.target.value) })} />
          </Field>
          <Field label="Δωρεάν μεταφορικά άνω των (€)">
            <TextInput type="number" step="1" value={form.free_delivery_above ?? ''}
                       onChange={e => set({ free_delivery_above: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Ακτίνα delivery (km)" hint="Χρησιμοποιείται όταν δεν υπάρχει ζώνη που ταιριάζει">
            <TextInput type="number" step="0.5" value={form.delivery_radius_km ?? 5}
                       onChange={e => set({ delivery_radius_km: Number(e.target.value) })} />
          </Field>
          <Field label="Ακτίνα take away (km)" hint="Σε ποια απόσταση εμφανίζεται για παραλαβή">
            <TextInput type="number" step="0.5" value={form.pickup_radius_km ?? 15}
                       onChange={e => set({ pickup_radius_km: Number(e.target.value) })} />
          </Field>
          <Field label="Έκπτωση take away (%)">
            <TextInput type="number" step="1" value={form.pickup_discount_pct ?? 0}
                       onChange={e => set({ pickup_discount_pct: Number(e.target.value) })} />
          </Field>
          <Field label="Χρόνος ετοιμασίας (λεπτά)">
            <TextInput type="number" value={form.prep_time_min ?? 20}
                       onChange={e => set({ prep_time_min: Number(e.target.value) })} />
          </Field>
          <Field label="Μέσος χρόνος παράδοσης (λεπτά)">
            <TextInput type="number" value={form.avg_delivery_time ?? 30}
                       onChange={e => set({ avg_delivery_time: Number(e.target.value) })} />
          </Field>
          <div className="md:col-span-2 grid md:grid-cols-3 gap-1 border-t border-surface-4 pt-2">
            <CheckRow label="Δέχεται μετρητά" checked={form.accepts_cash ?? true}
                      onChange={v => set({ accepts_cash: v })} />
            <CheckRow label="Δέχεται online πληρωμή" hint="Απαιτεί ενεργοποίηση στις ρυθμίσεις πλατφόρμας"
                      checked={form.accepts_online ?? false} onChange={v => set({ accepts_online: v })} />
            <CheckRow label="Αυτόματη αποδοχή" hint="Οι παραγγελίες επιβεβαιώνονται χωρίς ενέργεια"
                      checked={form.auto_accept ?? false} onChange={v => set({ auto_accept: v })} />
          </div>
        </div>
      )}

      {tab === 'billing' && (
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Τρόπος χρέωσης" hint="«Κληρονομεί» = ό,τι ορίζεται στις ρυθμίσεις πλατφόρμας">
            <Select value={form.billing_mode ?? 'inherit'}
                    onChange={e => set({ billing_mode: e.target.value as AdminStore['billing_mode'] })}>
              <option value="inherit">Κληρονομεί από την πλατφόρμα</option>
              <option value="none">Καμία χρέωση</option>
              <option value="commission">Ποσοστό ανά παραγγελία</option>
              <option value="flat">Σταθερό ποσό ανά παραγγελία</option>
            </Select>
          </Field>
          <Field label={form.billing_mode === 'flat' ? 'Ποσό ανά παραγγελία (€)' : 'Ποσοστό (%)'}>
            <TextInput type="number" step="0.01" value={form.billing_value ?? 0}
                       disabled={form.billing_mode === 'inherit' || form.billing_mode === 'none'}
                       onChange={e => set({ billing_value: Number(e.target.value) })} />
          </Field>

          <div className="md:col-span-2 border-t border-surface-4 pt-3">
            <p className="input-label">Πού στέλνονται οι παραγγελίες</p>
          </div>
          <Field label="Email παραγγελιών" hint="Αν μείνει κενό, χρησιμοποιείται το κύριο email">
            <TextInput type="email" value={form.order_email ?? ''}
                       onChange={e => set({ order_email: e.target.value })} />
          </Field>
          <Field label="WhatsApp παραγγελιών" hint="Διεθνής μορφή, π.χ. +306900000000">
            <TextInput value={form.order_whatsapp ?? ''}
                       onChange={e => set({ order_whatsapp: e.target.value })} />
          </Field>
          <div className="md:col-span-2 grid md:grid-cols-2 gap-1">
            <CheckRow label="Ειδοποίηση με email" checked={form.notify_email ?? true}
                      onChange={v => set({ notify_email: v })} />
            <CheckRow label="Κουμπί WhatsApp στον πελάτη" checked={form.notify_whatsapp ?? true}
                      onChange={v => set({ notify_whatsapp: v })} />
          </div>
          <div className="md:col-span-2">
            <Field label="Εσωτερικές σημειώσεις">
              <TextArea rows={2} value={form.notes ?? ''} onChange={e => set({ notes: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {tab === 'zones' && form.id && <ZonesEditor storeId={form.id} />}

      {tab === 'link' && form.id && (
        <StandaloneTab form={form} set={set} />
      )}

      <div className="flex gap-2 justify-end mt-5 border-t border-surface-4 pt-4">
        <button className="btn btn-secondary btn-md" onClick={onClose}>Άκυρο</button>
        <button className="btn btn-primary btn-md" disabled={!form.name || !form.address || upsert.isPending}
                onClick={save}>
          {upsert.isPending ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
      </div>

      {menuOpen && form.id && (
        <MenuImport storeId={form.id} storeName={form.name ?? ''} onClose={() => setMenuOpen(false)} />
      )}
    </Modal>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function StoresPage() {
  const storesQ = useAdminStores()
  const remove = useDeleteStore()
  const [editing, setEditing] = useState<Partial<AdminStore> | null>(null)
  const [search, setSearch] = useState('')

  const stores = (storesQ.data ?? []).filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.city ?? '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-3 items-center">
          <TextInput className="max-w-xs" placeholder="Αναζήτηση καταστήματος"
                     value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary btn-md ml-auto" onClick={() => setEditing(emptyStore)}>
            + Νέο κατάστημα
          </button>
        </div>
      </Card>

      <Card>
        {storesQ.isLoading ? (
          <div className="py-10 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Κατάστημα</th><th>Κατηγορία</th><th>Πόλη</th><th>Delivery</th>
                  <th>Take away</th><th>Μεταφ.</th><th>Ελάχ.</th><th>Χρέωση</th>
                  <th>Κατάσταση</th><th></th>
                </tr>
              </thead>
              <tbody>
                {stores.map(s => (
                  <tr key={s.id}>
                    <td>
                      <button className="font-semibold text-ink-1 hover:text-brand text-left"
                              onClick={() => setEditing(s)}>{s.name}</button>
                      <p className="text-[11px] text-ink-3">{s.address}</p>
                    </td>
                    <td className="text-ink-2">{CATEGORIES.find(c => c[0] === s.category)?.[1] ?? s.category}</td>
                    <td className="text-ink-2">{s.city ?? '—'}</td>
                    <td>{s.supports_delivery ? `✓ ${num(s.delivery_radius_km)}km` : '—'}</td>
                    <td>{s.supports_takeaway ? '✓' : '—'}</td>
                    <td>{money(s.delivery_fee)}</td>
                    <td>{money(s.min_order_amount)}</td>
                    <td className="text-xs">
                      {s.billing_mode === 'inherit' ? <span className="text-ink-3">πλατφόρμα</span>
                        : s.billing_mode === 'none' ? '—'
                        : s.billing_mode === 'commission' ? `${num(s.billing_value)}%`
                        : money(s.billing_value)}
                    </td>
                    <td>
                      <StatusChip status={s.is_active && s.onboarding_status === 'active' ? 'delivered' : 'pending'}
                                  label={s.onboarding_status === 'active' ? (s.is_active ? 'Ενεργό' : 'Ανενεργό') : s.onboarding_status} />
                    </td>
                    <td className="whitespace-nowrap">
                      <button className="btn-icon" onClick={() => setEditing(s)}>✏️</button>
                      <button className="btn-icon text-danger" onClick={() => {
                        if (confirm(`Οριστική διαγραφή «${s.name}» και όλου του μενού του;`)) {
                          remove.mutate(s.id, {
                            onSuccess: () => toast.success('Διαγράφηκε'),
                            onError: (e) => toast.error((e as Error).message),
                          })
                        }
                      }}>🗑</button>
                    </td>
                  </tr>
                ))}
                {stores.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-ink-3 py-8">Κανένα κατάστημα.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <StoreEditor store={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
