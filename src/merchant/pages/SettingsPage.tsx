import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { Card, Field, TextInput, TextArea, CheckRow } from '@/admin/ui'
import { useZones } from '@/admin/hooks'
import type { AdminStore } from '@/admin/hooks'
import { money } from '@/lib/format'
import { Spinner } from '@/components/ui'

const DAYS = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο']

interface Hours { day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }

export default function MerchantSettingsPage({ store }: { store: AdminStore }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<AdminStore>>(store)
  const [saving, setSaving] = useState(false)
  const [hours, setHours] = useState<Hours[]>([])
  const zonesQ = useZones(store.id)

  useEffect(() => { setForm(store) }, [store])

  const hoursQ = useQuery({
    queryKey: ['store-hours', store.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('store_hours')
        .select('day_of_week, open_time, close_time, is_closed')
        .eq('store_id', store.id)
      if (error) throw new Error(error.message)
      return (data ?? []) as Hours[]
    },
  })

  useEffect(() => {
    const rows = hoursQ.data ?? []
    setHours(DAYS.map((_, i) => rows.find(r => r.day_of_week === i)
      ?? { day_of_week: i, open_time: '09:00', close_time: '23:00', is_closed: false }))
  }, [hoursQ.data])

  const set = (patch: Partial<AdminStore>) => setForm(f => ({ ...f, ...patch }))

  const save = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('stores').update({
        name: form.name, description: form.description || null,
        phone: form.phone || null, email: form.email || null,
        order_email: form.order_email || null, order_whatsapp: form.order_whatsapp || null,
        notify_email: form.notify_email, notify_whatsapp: form.notify_whatsapp,
        delivery_fee: form.delivery_fee, min_order_amount: form.min_order_amount,
        free_delivery_above: form.free_delivery_above, avg_delivery_time: form.avg_delivery_time,
        delivery_radius_km: form.delivery_radius_km, pickup_radius_km: form.pickup_radius_km,
        pickup_discount_pct: form.pickup_discount_pct, prep_time_min: form.prep_time_min,
        supports_delivery: form.supports_delivery, supports_takeaway: form.supports_takeaway,
        accepts_cash: form.accepts_cash, auto_accept: form.auto_accept,
        is_open: form.is_open,
        updated_at: new Date().toISOString(),
      }).eq('id', store.id)
      if (error) throw new Error(error.message)

      const { error: hErr } = await supabase.from('store_hours')
        .upsert(hours.map(h => ({ ...h, store_id: store.id })), { onConflict: 'store_id,day_of_week' })
      if (hErr) throw new Error(hErr.message)

      toast.success('Οι ρυθμίσεις αποθηκεύτηκαν')
      void qc.invalidateQueries({ queryKey: ['my-stores'] })
      void qc.invalidateQueries({ queryKey: ['store-hours', store.id] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (hoursQ.isLoading) return <div className="py-16 flex justify-center"><Spinner size={30} /></div>

  return (
    <div className="space-y-4 max-w-4xl">
      <Card title="Κατάσταση καταστήματος">
        <div className="grid md:grid-cols-3 gap-1">
          <CheckRow label="Ανοιχτό τώρα" hint="Κλειστό = δεν δέχεται παραγγελίες"
                    checked={form.is_open ?? true} onChange={v => set({ is_open: v })} />
          <CheckRow label="Delivery" checked={form.supports_delivery ?? true}
                    onChange={v => set({ supports_delivery: v })} />
          <CheckRow label="Take away" checked={form.supports_takeaway ?? true}
                    onChange={v => set({ supports_takeaway: v })} />
        </div>
      </Card>

      <Card title="Βασικά στοιχεία">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Όνομα"><TextInput value={form.name ?? ''} onChange={e => set({ name: e.target.value })} /></Field>
          <Field label="Τηλέφωνο"><TextInput value={form.phone ?? ''} onChange={e => set({ phone: e.target.value })} /></Field>
          <Field label="Email"><TextInput type="email" value={form.email ?? ''} onChange={e => set({ email: e.target.value })} /></Field>
          <Field label="Email παραγγελιών" hint="Εκεί φτάνει το email με τον σύνδεσμο επιβεβαίωσης">
            <TextInput type="email" value={form.order_email ?? ''} onChange={e => set({ order_email: e.target.value })} />
          </Field>
          <Field label="WhatsApp παραγγελιών" hint="Διεθνής μορφή, π.χ. +306900000000">
            <TextInput value={form.order_whatsapp ?? ''} onChange={e => set({ order_whatsapp: e.target.value })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Περιγραφή">
              <TextArea rows={2} value={form.description ?? ''} onChange={e => set({ description: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-x-6 mt-1">
          <CheckRow label="Ειδοποίηση email σε κάθε παραγγελία"
                    checked={form.notify_email ?? true} onChange={v => set({ notify_email: v })} />
          <CheckRow label="Κουμπί WhatsApp στον πελάτη"
                    checked={form.notify_whatsapp ?? true} onChange={v => set({ notify_whatsapp: v })} />
        </div>
      </Card>

      <Card title="Παράδοση & παραλαβή">
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Μεταφορικά (€)">
            <TextInput type="number" step="0.10" value={form.delivery_fee ?? 0}
                       onChange={e => set({ delivery_fee: Number(e.target.value) })} />
          </Field>
          <Field label="Ελάχιστη παραγγελία (€)">
            <TextInput type="number" step="0.50" value={form.min_order_amount ?? 0}
                       onChange={e => set({ min_order_amount: Number(e.target.value) })} />
          </Field>
          <Field label="Δωρεάν άνω των (€)">
            <TextInput type="number" step="1" value={form.free_delivery_above ?? ''}
                       onChange={e => set({ free_delivery_above: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Ακτίνα delivery (km)">
            <TextInput type="number" step="0.5" value={form.delivery_radius_km ?? 5}
                       onChange={e => set({ delivery_radius_km: Number(e.target.value) })} />
          </Field>
          <Field label="Ακτίνα take away (km)">
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
        </div>
        <div className="grid md:grid-cols-2 gap-x-6 mt-1">
          <CheckRow label="Δέχεται μετρητά" checked={form.accepts_cash ?? true}
                    onChange={v => set({ accepts_cash: v })} />
          <CheckRow label="Αυτόματη αποδοχή παραγγελιών"
                    hint="Οι παραγγελίες επιβεβαιώνονται χωρίς ενέργεια από εσάς"
                    checked={form.auto_accept ?? false} onChange={v => set({ auto_accept: v })} />
        </div>
      </Card>

      <Card title="Ώρες λειτουργίας">
        <div className="space-y-2">
          {hours.map((h, i) => (
            <div key={h.day_of_week} className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold w-24">{DAYS[h.day_of_week]}</span>
              <input type="time" className="input-field max-w-[130px]" disabled={h.is_closed}
                     value={h.open_time?.slice(0, 5) ?? '09:00'}
                     onChange={e => setHours(prev => prev.map((x, xi) => xi === i ? { ...x, open_time: e.target.value } : x))} />
              <span className="text-ink-3">—</span>
              <input type="time" className="input-field max-w-[130px]" disabled={h.is_closed}
                     value={h.close_time?.slice(0, 5) ?? '23:00'}
                     onChange={e => setHours(prev => prev.map((x, xi) => xi === i ? { ...x, close_time: e.target.value } : x))} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-brand w-4 h-4" checked={h.is_closed}
                       onChange={e => setHours(prev => prev.map((x, xi) => xi === i ? { ...x, is_closed: e.target.checked } : x))} />
                Κλειστά
              </label>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-ink-3 mt-3">
          Εκτός ωραρίου το κατάστημα εμφανίζεται ως κλειστό και δεν δέχεται παραγγελίες.
        </p>
      </Card>

      <Card title="Ζώνες παράδοσης">
        {(zonesQ.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-3">
            Δεν έχουν οριστεί ζώνες — χρησιμοποιείται η ακτίνα των {form.delivery_radius_km} km.
            Οι ζώνες ορίζονται από τον διαχειριστή της πλατφόρμας.
          </p>
        ) : (
          <table className="dash-table">
            <thead><tr><th>Ζώνη</th><th>Περιοχή</th><th>Τ.Κ.</th><th>Μεταφορικά</th><th>Ελάχιστο</th></tr></thead>
            <tbody>
              {(zonesQ.data ?? []).map(z => (
                <tr key={z.id}>
                  <td className="font-semibold">{z.name}</td>
                  <td>{z.area ?? '—'}</td>
                  <td>{z.postal_code ?? '—'}</td>
                  <td>{money(z.delivery_fee)}</td>
                  <td>{money(z.min_order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="flex justify-end pb-6">
        <button className="btn btn-primary btn-lg" disabled={saving} onClick={save}>
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση αλλαγών'}
        </button>
      </div>
    </div>
  )
}
