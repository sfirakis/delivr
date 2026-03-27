import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Toggle, Divider } from '@/components/ui'
import type { Store } from '@/types'
import toast from 'react-hot-toast'

const DAYS = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο']

export default function MerchantSettingsPage({ store }: { store: Store }) {
  const [form, setForm] = useState({
    name:              store.name,
    description:       store.description ?? '',
    phone:             store.phone ?? '',
    email:             store.email ?? '',
    delivery_fee:      store.delivery_fee.toString(),
    free_delivery_above: store.free_delivery_above?.toString() ?? '',
    min_order_amount:  store.min_order_amount.toString(),
    avg_delivery_time: store.avg_delivery_time.toString(),
    delivery_radius_km:store.delivery_radius_km.toString(),
  })
  const [saving, setSaving] = useState(false)

  const u = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('stores').update({
        name:              form.name,
        description:       form.description || null,
        phone:             form.phone || null,
        email:             form.email || null,
        delivery_fee:      parseFloat(form.delivery_fee),
        free_delivery_above: form.free_delivery_above ? parseFloat(form.free_delivery_above) : null,
        min_order_amount:  parseFloat(form.min_order_amount),
        avg_delivery_time: parseInt(form.avg_delivery_time),
        delivery_radius_km:parseFloat(form.delivery_radius_km),
        updated_at:        new Date().toISOString(),
      }).eq('id', store.id)
      if (error) throw error
      toast.success('✓ Αποθηκεύτηκε!')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <p className="text-[11px] font-bold text-ink-3 uppercase tracking-wider mb-3 px-5">{title}</p>
      <div className="bg-surface-1 border-y border-surface-4 px-5 py-4 space-y-4">{children}</div>
    </div>
  )

  const Field = ({ label, placeholder, value, onChange, type='text', hint }: any) => (
    <div>
      <label className="text-xs font-medium text-ink-2 mb-1.5 block">{label}</label>
      <input type={type}
             className="w-full border border-surface-4 rounded-xl px-4 py-2.5 text-sm font-body outline-none focus:border-brand transition-colors"
             placeholder={placeholder} value={value} onChange={onChange} />
      {hint && <p className="text-[11px] text-ink-3 mt-1">{hint}</p>}
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-32">
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <h2 className="font-display font-black text-xl">Ρυθμίσεις καταστήματος</h2>
      </div>

      <Section title="Βασικά στοιχεία">
        <Field label="Όνομα καταστήματος" placeholder="Avra Souvlaki" value={form.name} onChange={u('name')} />
        <div>
          <label className="text-xs font-medium text-ink-2 mb-1.5 block">Περιγραφή</label>
          <textarea className="w-full border border-surface-4 rounded-xl px-4 py-2.5 text-sm font-body outline-none focus:border-brand resize-none"
                    rows={2} placeholder="Σύντομη περιγραφή..." value={form.description} onChange={u('description')} />
        </div>
        <Field label="Τηλέφωνο" placeholder="+30 210 1234567" value={form.phone} onChange={u('phone')} />
        <Field label="Email επικοινωνίας" type="email" placeholder="info@store.gr" value={form.email} onChange={u('email')} />
      </Section>

      <Section title="Παράδοση">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Χρέωση delivery (€)" type="number" placeholder="1.50" value={form.delivery_fee} onChange={u('delivery_fee')} />
          <Field label="Δωρεάν πάνω από (€)" type="number" placeholder="25.00" value={form.free_delivery_above} onChange={u('free_delivery_above')} hint="Προαιρετικό" />
          <Field label="Ελάχιστη παραγγελία (€)" type="number" placeholder="5.00" value={form.min_order_amount} onChange={u('min_order_amount')} />
          <Field label="Χρόνος παράδοσης (λεπτά)" type="number" placeholder="30" value={form.avg_delivery_time} onChange={u('avg_delivery_time')} />
        </div>
        <Field label="Ακτίνα παράδοσης (km)" type="number" step="0.5" placeholder="5.0" value={form.delivery_radius_km} onChange={u('delivery_radius_km')} />
      </Section>

      <Section title="Ώρες λειτουργίας">
        {DAYS.map((day, idx) => (
          <div key={day} className="flex items-center gap-3">
            <span className="text-sm font-medium w-24 text-ink-1">{day}</span>
            <input type="time" defaultValue="09:00"
                   className="flex-1 border border-surface-4 rounded-lg px-3 py-2 text-sm font-body outline-none focus:border-brand" />
            <span className="text-ink-3">—</span>
            <input type="time" defaultValue="22:00"
                   className="flex-1 border border-surface-4 rounded-lg px-3 py-2 text-sm font-body outline-none focus:border-brand" />
            <Toggle checked={idx !== 0} onChange={() => {}} />
          </div>
        ))}
      </Section>

      <Section title="Ειδοποιήσεις">
        {[
          { label:'Νέα παραγγελία (sound)', val:true },
          { label:'Ειδοποίηση SMS', val:false },
          { label:'Email για κάθε παραγγελία', val:false },
          { label:'Ημερήσια αναφορά email', val:true },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-sm font-medium">{item.label}</span>
            <Toggle checked={item.val} onChange={() => {}} />
          </div>
        ))}
      </Section>

      {/* Save button */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto px-5 py-4 bg-surface-1 border-t border-surface-4">
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? 'Αποθήκευση...' : '✓ Αποθήκευση αλλαγών'}
        </button>
      </div>
    </div>
  )
}
