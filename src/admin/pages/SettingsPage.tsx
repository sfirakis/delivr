import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { usePlatformSettings, useUpdateSettings, type PlatformSettings } from '../hooks'
import { Card, Field, TextInput, Select, CheckRow } from '../ui'
import { Spinner } from '@/components/ui'

export default function SettingsPage() {
  const settingsQ = usePlatformSettings()
  const update = useUpdateSettings()
  const [form, setForm] = useState<Partial<PlatformSettings>>({})

  useEffect(() => { if (settingsQ.data) setForm(settingsQ.data) }, [settingsQ.data])

  if (settingsQ.isLoading) return <div className="py-16 flex justify-center"><Spinner size={30} /></div>

  const set = (patch: Partial<PlatformSettings>) => setForm(f => ({ ...f, ...patch }))
  const save = () => update.mutate(form, {
    onSuccess: () => toast.success('Οι ρυθμίσεις αποθηκεύτηκαν'),
    onError: (e) => toast.error((e as Error).message),
  })

  return (
    <div className="space-y-4 max-w-4xl">
      <Card title="Πλατφόρμα">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Όνομα πλατφόρμας">
            <TextInput value={form.platform_name ?? ''} onChange={e => set({ platform_name: e.target.value })} />
          </Field>
          <Field label="Διεύθυνση εφαρμογής (app URL)" hint="Χρησιμοποιείται στα QR και στα emails">
            <TextInput value={form.app_url ?? ''} onChange={e => set({ app_url: e.target.value })}
                       placeholder="https://delivr.example.com" />
          </Field>
          <Field label="Νόμισμα">
            <TextInput value={form.currency ?? 'EUR'} onChange={e => set({ currency: e.target.value })} />
          </Field>
          <Field label="Ζώνη ώρας">
            <TextInput value={form.timezone ?? 'Europe/Athens'} onChange={e => set({ timezone: e.target.value })} />
          </Field>
          <Field label="Πρόθεμα αριθμού παραγγελίας">
            <TextInput value={form.order_prefix ?? 'DLV'} onChange={e => set({ order_prefix: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Χρώμα brand">
            <div className="flex gap-2">
              <input type="color" className="h-11 w-14 rounded-xl border border-surface-4"
                     value={form.brand_color ?? '#FF6B35'} onChange={e => set({ brand_color: e.target.value })} />
              <TextInput value={form.brand_color ?? ''} onChange={e => set({ brand_color: e.target.value })} />
            </div>
          </Field>
          <Field label="Τηλέφωνο υποστήριξης">
            <TextInput value={form.support_phone ?? ''} onChange={e => set({ support_phone: e.target.value })} />
          </Field>
          <Field label="Email υποστήριξης" hint="Λαμβάνει και τα αντίγραφα ειδοποιήσεων">
            <TextInput type="email" value={form.support_email ?? ''} onChange={e => set({ support_email: e.target.value })} />
          </Field>
          <Field label="WhatsApp υποστήριξης">
            <TextInput value={form.support_whatsapp ?? ''} onChange={e => set({ support_whatsapp: e.target.value })} />
          </Field>
          <Field label="Σύνδεσμος όρων χρήσης">
            <TextInput value={form.terms_url ?? ''} onChange={e => set({ terms_url: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card title="Χρεώσεις — προεπιλογές">
        <p className="text-sm text-ink-2 mb-3">
          Ισχύουν για κάθε κατάστημα ή κατάλυμα που είναι ρυθμισμένο σε «Κληρονομεί».
          Οι ατομικές ρυθμίσεις υπερισχύουν πάντα.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Χρέωση καταστήματος">
            <Select value={form.store_billing_mode ?? 'commission'}
                    onChange={e => set({ store_billing_mode: e.target.value as PlatformSettings['store_billing_mode'] })}>
              <option value="none">Καμία</option>
              <option value="commission">Ποσοστό ανά παραγγελία</option>
              <option value="flat">Σταθερό ποσό ανά παραγγελία</option>
            </Select>
          </Field>
          <Field label={form.store_billing_mode === 'flat' ? 'Ποσό (€)' : 'Ποσοστό (%)'}>
            <TextInput type="number" step="0.01" value={form.store_billing_value ?? 0}
                       disabled={form.store_billing_mode === 'none'}
                       onChange={e => set({ store_billing_value: Number(e.target.value) })} />
          </Field>
          <Field label="Βάση υπολογισμού">
            <Select value={form.commission_base ?? 'subtotal'}
                    onChange={e => set({ commission_base: e.target.value as PlatformSettings['commission_base'] })}>
              <option value="subtotal">Αξία προϊόντων</option>
              <option value="total">Τελικό σύνολο (με μεταφορικά)</option>
            </Select>
          </Field>

          <Field label="Κίνηση καταλύματος">
            <Select value={form.property_billing_mode ?? 'none'}
                    onChange={e => set({ property_billing_mode: e.target.value as PlatformSettings['property_billing_mode'] })}>
              <option value="none">Καμία</option>
              <option value="commission">Ποσοστό ανά παραγγελία</option>
              <option value="flat">Σταθερό ποσό ανά παραγγελία</option>
            </Select>
          </Field>
          <Field label={form.property_billing_mode === 'flat' ? 'Ποσό (€)' : 'Ποσοστό (%)'}>
            <TextInput type="number" step="0.01" value={form.property_billing_value ?? 0}
                       disabled={form.property_billing_mode === 'none'}
                       onChange={e => set({ property_billing_value: Number(e.target.value) })} />
          </Field>
          <Field label="Κατεύθυνση" hint="Απόδοση = εισπράττει το κατάλυμα">
            <Select value={form.property_billing_direction ?? 'payout'}
                    disabled={form.property_billing_mode === 'none'}
                    onChange={e => set({ property_billing_direction: e.target.value as PlatformSettings['property_billing_direction'] })}>
              <option value="payout">Απόδοση προς το κατάλυμα</option>
              <option value="charge">Χρέωση του καταλύματος</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card title="Παραγγελίες">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Προεπιλεγμένος χρόνος ετοιμασίας (λεπτά)">
            <TextInput type="number" value={form.default_prep_time ?? 20}
                       onChange={e => set({ default_prep_time: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="grid md:grid-cols-2 gap-x-6 mt-2">
          <CheckRow label="Απαιτείται τηλέφωνο πελάτη" checked={form.guest_requires_phone ?? true}
                    onChange={v => set({ guest_requires_phone: v })} />
          <CheckRow label="Απαιτείται email πελάτη" checked={form.guest_requires_email ?? false}
                    onChange={v => set({ guest_requires_email: v })} />
          <CheckRow label="Μετρητά κατά την παράδοση" checked={form.allow_cash ?? true}
                    onChange={v => set({ allow_cash: v })} />
          <CheckRow label="Online πληρωμή" hint="Απαιτεί ρύθμιση παρόχου πληρωμών — δείτε το roadmap"
                    checked={form.allow_online_payment ?? false}
                    onChange={v => set({ allow_online_payment: v })} />
          <CheckRow label="Προγραμματισμένες παραγγελίες" checked={form.allow_scheduled_orders ?? true}
                    onChange={v => set({ allow_scheduled_orders: v })} />
        </div>
      </Card>

      <Card title="Ειδοποιήσεις">
        <div className="grid md:grid-cols-2 gap-x-6">
          <CheckRow label="Email στο κατάστημα σε κάθε παραγγελία"
                    hint="Περιλαμβάνει σύνδεσμο επιβεβαίωσης χωρίς λογαριασμό"
                    checked={form.notify_store_email ?? true} onChange={v => set({ notify_store_email: v })} />
          <CheckRow label="Κουμπί WhatsApp προς το κατάστημα"
                    hint="Εμφανίζεται στον πελάτη μετά την παραγγελία"
                    checked={form.notify_store_whatsapp ?? true} onChange={v => set({ notify_store_whatsapp: v })} />
          <CheckRow label="Αντίγραφο email στο κατάλυμα"
                    checked={form.notify_property_email ?? false} onChange={v => set({ notify_property_email: v })} />
        </div>
      </Card>

      <div className="flex justify-end gap-2 pb-6">
        <button className="btn btn-primary btn-lg" disabled={update.isPending} onClick={save}>
          {update.isPending ? 'Αποθήκευση…' : 'Αποθήκευση ρυθμίσεων'}
        </button>
      </div>
    </div>
  )
}
