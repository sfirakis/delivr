import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  usePlans, useUpsertPlan, useDeletePlan,
  useSubscriptions, useUpsertSubscription, useBillSubscriptions,
  useAdminStores, useAdminProperties,
  type SubscriptionPlan, type Subscription,
} from '../hooks'
import { Card, Field, TextInput, TextArea, Select, CheckRow, Modal, StatCard, StatusChip } from '../ui'
import { money, dateOnly, num } from '@/lib/format'
import { Spinner } from '@/components/ui'
import { Composition, CHART_COLORS } from '../charts'

const STATUS_LABEL: Record<string, string> = {
  trial: 'Δοκιμή', active: 'Ενεργή', past_due: 'Ληξιπρόθεσμη',
  paused: 'Σε παύση', cancelled: 'Ακυρωμένη',
}

const emptyPlan: Partial<SubscriptionPlan> = {
  name: '', audience: 'store', price: 0, billing_cycle: 'month', trial_days: 0,
  commission_mode: null, commission_value: 0, features: [], is_active: true, sort_order: 0,
}

function PlanEditor({ plan, onClose }: { plan: Partial<SubscriptionPlan>; onClose: () => void }) {
  const [form, setForm] = useState<Partial<SubscriptionPlan>>(plan)
  const upsert = useUpsertPlan()
  const set = (patch: Partial<SubscriptionPlan>) => setForm(f => ({ ...f, ...patch }))

  return (
    <Modal title={form.id ? `Πακέτο — ${form.name}` : 'Νέο πακέτο'} onClose={onClose}>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Όνομα *">
          <TextInput value={form.name ?? ''} onChange={e => set({ name: e.target.value })} />
        </Field>
        <Field label="Αφορά">
          <Select value={form.audience ?? 'store'}
                  onChange={e => set({ audience: e.target.value as SubscriptionPlan['audience'] })}>
            <option value="store">Καταστήματα</option>
            <option value="property">Καταλύματα</option>
          </Select>
        </Field>
        <Field label="Τιμή (€)" hint="0 = δωρεάν πακέτο">
          <TextInput type="number" step="0.01" value={form.price ?? 0}
                     onChange={e => set({ price: Number(e.target.value) })} />
        </Field>
        <Field label="Χρέωση">
          <Select value={form.billing_cycle ?? 'month'}
                  onChange={e => set({ billing_cycle: e.target.value as SubscriptionPlan['billing_cycle'] })}>
            <option value="month">Μηνιαία</option>
            <option value="year">Ετήσια</option>
          </Select>
        </Field>
        <Field label="Ημέρες δοκιμής">
          <TextInput type="number" value={form.trial_days ?? 0}
                     onChange={e => set({ trial_days: Number(e.target.value) })} />
        </Field>
        <Field label="Προμήθεια πακέτου"
               hint="Υπερισχύει της προεπιλογής πλατφόρμας, αλλά όχι ατομικής ρύθμισης">
          <Select value={form.commission_mode ?? ''}
                  onChange={e => set({ commission_mode: (e.target.value || null) as SubscriptionPlan['commission_mode'] })}>
            <option value="">— Δεν αλλάζει —</option>
            <option value="none">Καμία προμήθεια</option>
            <option value="commission">Ποσοστό ανά παραγγελία</option>
            <option value="flat">Σταθερό ποσό ανά παραγγελία</option>
          </Select>
        </Field>
        <Field label={form.commission_mode === 'flat' ? 'Ποσό (€)' : 'Ποσοστό (%)'}>
          <TextInput type="number" step="0.01" value={form.commission_value ?? 0}
                     disabled={!form.commission_mode || form.commission_mode === 'none'}
                     onChange={e => set({ commission_value: Number(e.target.value) })} />
        </Field>
        <Field label="Σειρά εμφάνισης">
          <TextInput type="number" value={form.sort_order ?? 0}
                     onChange={e => set({ sort_order: Number(e.target.value) })} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Περιγραφή">
            <TextArea rows={2} value={form.description ?? ''}
                      onChange={e => set({ description: e.target.value })} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Παροχές" hint="Μία ανά γραμμή">
            <TextArea rows={3} value={(form.features ?? []).join('\n')}
                      onChange={e => set({ features: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} />
          </Field>
        </div>
        <CheckRow label="Ενεργό πακέτο" checked={form.is_active ?? true}
                  onChange={v => set({ is_active: v })} />
      </div>

      <div className="flex justify-end gap-2 mt-5 border-t border-surface-4 pt-4">
        <button className="btn btn-secondary btn-md" onClick={onClose}>Άκυρο</button>
        <button className="btn btn-primary btn-md" disabled={!form.name || upsert.isPending}
                onClick={() => upsert.mutate(form, {
                  onSuccess: () => { toast.success('Αποθηκεύτηκε'); onClose() },
                  onError: (e) => toast.error((e as Error).message),
                })}>
          {upsert.isPending ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
      </div>
    </Modal>
  )
}

function SubscribeModal({ sub, onClose }: { sub: Partial<Subscription>; onClose: () => void }) {
  const [form, setForm] = useState<Partial<Subscription>>(sub)
  const plansQ = usePlans()
  const storesQ = useAdminStores()
  const propsQ = useAdminProperties()
  const upsert = useUpsertSubscription()
  const set = (patch: Partial<Subscription>) => setForm(f => ({ ...f, ...patch }))

  const plans = (plansQ.data ?? []).filter(p => p.is_active && p.audience === (form.party_type ?? 'store'))
  const parties = form.party_type === 'property'
    ? (propsQ.data ?? []).map(p => ({ id: p.id, name: `${p.name} (${p.code})` }))
    : (storesQ.data ?? []).map(s => ({ id: s.id, name: s.name }))

  const choosePlan = (planId: string) => {
    const p = plans.find(x => x.id === planId)
    set({
      plan_id: planId,
      price: p?.price ?? 0,
      billing_cycle: p?.billing_cycle ?? 'month',
      status: (p?.trial_days ?? 0) > 0 ? 'trial' : 'active',
      trial_ends_on: (p?.trial_days ?? 0) > 0
        ? new Date(Date.now() + (p!.trial_days) * 86400000).toISOString().slice(0, 10)
        : null,
    })
  }

  return (
    <Modal title={form.id ? 'Επεξεργασία συνδρομής' : 'Νέα συνδρομή'} onClose={onClose}>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Τύπος συνδρομητή">
          <Select value={form.party_type ?? 'store'} disabled={!!form.id}
                  onChange={e => set({ party_type: e.target.value as Subscription['party_type'], party_id: undefined, plan_id: undefined })}>
            <option value="store">Κατάστημα</option>
            <option value="property">Κατάλυμα</option>
          </Select>
        </Field>
        <Field label="Συνδρομητής *">
          <Select value={form.party_id ?? ''} disabled={!!form.id}
                  onChange={e => set({ party_id: e.target.value })}>
            <option value="">— Επιλογή —</option>
            {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Πακέτο *">
          <Select value={form.plan_id ?? ''} onChange={e => choosePlan(e.target.value)}>
            <option value="">— Επιλογή —</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.price > 0 ? `${p.price}€/${p.billing_cycle === 'year' ? 'έτος' : 'μήνα'}` : 'δωρεάν'}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Τιμή (€)" hint="Κλειδώνεται τώρα — αλλαγή τιμής πακέτου δεν την επηρεάζει">
          <TextInput type="number" step="0.01" value={form.price ?? 0}
                     onChange={e => set({ price: Number(e.target.value) })} />
        </Field>
        <Field label="Κατάσταση">
          <Select value={form.status ?? 'active'}
                  onChange={e => set({ status: e.target.value as Subscription['status'] })}>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Λήξη δοκιμής">
          <TextInput type="date" value={form.trial_ends_on ?? ''}
                     onChange={e => set({ trial_ends_on: e.target.value || null })} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Σημειώσεις">
            <TextArea rows={2} value={form.notes ?? ''} onChange={e => set({ notes: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-5 border-t border-surface-4 pt-4">
        <button className="btn btn-secondary btn-md" onClick={onClose}>Άκυρο</button>
        <button className="btn btn-primary btn-md"
                disabled={!form.party_id || !form.plan_id || upsert.isPending}
                onClick={() => upsert.mutate(form, {
                  onSuccess: () => { toast.success('Αποθηκεύτηκε'); onClose() },
                  onError: (e) => toast.error((e as Error).message),
                })}>
          {upsert.isPending ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
      </div>
    </Modal>
  )
}

export default function SubscriptionsPage() {
  const plansQ = usePlans()
  const subsQ = useSubscriptions()
  const storesQ = useAdminStores()
  const propsQ = useAdminProperties()
  const deletePlan = useDeletePlan()
  const bill = useBillSubscriptions()

  const [planEdit, setPlanEdit] = useState<Partial<SubscriptionPlan> | null>(null)
  const [subEdit, setSubEdit] = useState<Partial<Subscription> | null>(null)
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))

  const nameOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of storesQ.data ?? []) m.set(s.id, s.name)
    for (const p of propsQ.data ?? []) m.set(p.id, `${p.name} (${p.code})`)
    return m
  }, [storesQ.data, propsQ.data])

  const subs = subsQ.data ?? []
  const live = subs.filter(s => s.status !== 'cancelled')

  const mrr = live
    .filter(s => s.status === 'active' || s.status === 'past_due')
    .reduce((t, s) => t + (s.billing_cycle === 'year' ? num(s.price) / 12 : num(s.price)), 0)

  const byPlan = useMemo(() => {
    const map = new Map<string, { label: string; value: number }>()
    for (const s of live) {
      if (s.status !== 'active' && s.status !== 'past_due') continue
      const label = s.subscription_plans?.name ?? '—'
      const monthly = s.billing_cycle === 'year' ? num(s.price) / 12 : num(s.price)
      const cur = map.get(label) ?? { label, value: 0 }
      cur.value += monthly
      map.set(label, cur)
    }
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .map((x, i) => ({ ...x, color: CHART_COLORS[i % CHART_COLORS.length] }))
  }, [live])

  if (plansQ.isLoading || subsQ.isLoading) {
    return <div className="py-16 flex justify-center"><Spinner size={30} /></div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🔁" label="MRR" value={money(mrr)} sub="μηνιαίο επαναλαμβανόμενο έσοδο" tone="brand" />
        <StatCard icon="✅" label="Ενεργές συνδρομές" value={live.filter(s => s.status === 'active').length} />
        <StatCard icon="🧪" label="Σε δοκιμή" value={live.filter(s => s.status === 'trial').length} />
        <StatCard icon="⚠️" label="Ληξιπρόθεσμες" value={live.filter(s => s.status === 'past_due').length}
                  tone={live.some(s => s.status === 'past_due') ? 'warning' : 'default'} />
      </div>

      {byPlan.length > 0 && (
        <Card title="Σύνθεση MRR ανά πακέτο">
          <Composition segments={byPlan} format={v => money(v)} />
        </Card>
      )}

      <Card title="Μηνιαία τιμολόγηση"
            action={<span className="text-xs text-ink-3">Γράφει τις συνδρομές στις Χρεώσεις</span>}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <span className="input-label">Περίοδος</span>
            <TextInput type="month" value={period} onChange={e => setPeriod(e.target.value)} className="max-w-[180px]" />
          </div>
          <button className="btn btn-primary btn-md" disabled={bill.isPending}
                  onClick={() => bill.mutate(`${period}-01`, {
                    onSuccess: (r) => toast.success(
                      r.created > 0
                        ? `Δημιουργήθηκαν ${r.created} χρεώσεις · ${money(r.total)}`
                        : 'Δεν υπήρχαν νέες χρεώσεις για την περίοδο'),
                    onError: (e) => toast.error((e as Error).message),
                  })}>
            {bill.isPending ? 'Τιμολόγηση…' : 'Έκδοση χρεώσεων περιόδου'}
          </button>
          <p className="text-xs text-ink-3 flex-1 min-w-[240px]">
            Ασφαλές να τρέξει πολλές φορές — κάθε συνδρομητής χρεώνεται μία φορά ανά μήνα.
            Οι συνδρομές σε δοκιμή δεν χρεώνονται μέχρι να λήξει η δοκιμή.
          </p>
        </div>
      </Card>

      <Card title="Πακέτα"
            action={<button className="btn btn-primary btn-sm" onClick={() => setPlanEdit(emptyPlan)}>+ Νέο πακέτο</button>}>
        <div className="overflow-x-auto">
          <table className="dash-table">
            <thead>
              <tr><th>Πακέτο</th><th>Αφορά</th><th>Τιμή</th><th>Δοκιμή</th>
                  <th>Προμήθεια</th><th>Συνδρομητές</th><th>Ενεργό</th><th></th></tr>
            </thead>
            <tbody>
              {(plansQ.data ?? []).map(p => (
                <tr key={p.id}>
                  <td>
                    <button className="font-semibold text-ink-1 hover:text-brand text-left"
                            onClick={() => setPlanEdit(p)}>{p.name}</button>
                    {p.description && <p className="text-[11px] text-ink-3">{p.description}</p>}
                  </td>
                  <td className="text-ink-2">{p.audience === 'store' ? 'Κατάστημα' : 'Κατάλυμα'}</td>
                  <td className="font-semibold">
                    {num(p.price) > 0 ? `${money(p.price)}/${p.billing_cycle === 'year' ? 'έτος' : 'μήνα'}` : '—'}
                  </td>
                  <td className="text-ink-2">{p.trial_days > 0 ? `${p.trial_days} ημ.` : '—'}</td>
                  <td className="text-xs">
                    {!p.commission_mode ? <span className="text-ink-3">ως πλατφόρμα</span>
                      : p.commission_mode === 'none' ? '0%'
                      : p.commission_mode === 'commission' ? `${num(p.commission_value)}%`
                      : money(p.commission_value ?? 0)}
                  </td>
                  <td>{live.filter(s => s.plan_id === p.id).length}</td>
                  <td>{p.is_active ? '✓' : '✗'}</td>
                  <td className="whitespace-nowrap">
                    <button className="btn-icon" onClick={() => setPlanEdit(p)}>✏️</button>
                    <button className="btn-icon text-danger" onClick={() => {
                      if (live.some(s => s.plan_id === p.id)) {
                        toast.error('Το πακέτο έχει ενεργούς συνδρομητές')
                        return
                      }
                      if (confirm(`Διαγραφή πακέτου «${p.name}»;`)) {
                        deletePlan.mutate(p.id, {
                          onSuccess: () => toast.success('Διαγράφηκε'),
                          onError: (e) => toast.error((e as Error).message),
                        })
                      }
                    }}>🗑</button>
                  </td>
                </tr>
              ))}
              {(plansQ.data ?? []).length === 0 && (
                <tr><td colSpan={8} className="text-center text-ink-3 py-6">Κανένα πακέτο ακόμη.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Συνδρομές"
            action={<button className="btn btn-primary btn-sm"
                            onClick={() => setSubEdit({ party_type: 'store', status: 'active' })}>
                      + Νέα συνδρομή
                    </button>}>
        <div className="overflow-x-auto">
          <table className="dash-table">
            <thead>
              <tr><th>Συνδρομητής</th><th>Τύπος</th><th>Πακέτο</th><th>Τιμή</th>
                  <th>Κατάσταση</th><th>Έναρξη</th><th>Επόμενη χρέωση</th><th></th></tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id}>
                  <td className="font-semibold">{nameOf.get(s.party_id) ?? s.party_id.slice(0, 8)}</td>
                  <td className="text-ink-2">{s.party_type === 'store' ? 'Κατάστημα' : 'Κατάλυμα'}</td>
                  <td>{s.subscription_plans?.name ?? '—'}</td>
                  <td className="font-semibold">
                    {num(s.price) > 0 ? `${money(s.price)}/${s.billing_cycle === 'year' ? 'έτος' : 'μήνα'}` : '—'}
                  </td>
                  <td><StatusChip status={s.status === 'active' ? 'delivered' : s.status === 'cancelled' ? 'cancelled' : 'pending'}
                                  label={STATUS_LABEL[s.status]} /></td>
                  <td className="text-xs text-ink-3">{dateOnly(s.started_on)}</td>
                  <td className="text-xs text-ink-3">
                    {s.status === 'trial' && s.trial_ends_on
                      ? `μετά τη δοκιμή (${dateOnly(s.trial_ends_on)})`
                      : s.next_charge_on ? dateOnly(s.next_charge_on) : '—'}
                  </td>
                  <td><button className="btn-icon" onClick={() => setSubEdit(s)}>✏️</button></td>
                </tr>
              ))}
              {subs.length === 0 && (
                <tr><td colSpan={8} className="text-center text-ink-3 py-6">
                  Καμία συνδρομή — τα καταστήματα λειτουργούν με την προεπιλεγμένη προμήθεια.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {planEdit && <PlanEditor plan={planEdit} onClose={() => setPlanEdit(null)} />}
      {subEdit && <SubscribeModal sub={subEdit} onClose={() => setSubEdit(null)} />}
    </div>
  )
}
