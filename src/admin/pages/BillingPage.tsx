import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useCharges, useUpdateChargeStatus, useAdminStores, useAdminProperties } from '../hooks'
import { Card, Select, StatCard, StatusChip, downloadFile, toCsv } from '../ui'
import { money, dateTime, num } from '@/lib/format'
import { Spinner } from '@/components/ui'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Εκκρεμεί', invoiced: 'Τιμολογημένο', paid: 'Εξοφλημένο', void: 'Άκυρο',
}

export default function BillingPage() {
  const [status, setStatus] = useState('all')
  const [party, setParty] = useState('all')
  const [days, setDays] = useState(30)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const chargesQ = useCharges({ status, party, days })
  const storesQ = useAdminStores()
  const propsQ = useAdminProperties()
  const update = useUpdateChargeStatus()

  const nameOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of storesQ.data ?? []) map.set(s.id, s.name)
    for (const p of propsQ.data ?? []) map.set(p.id, p.name)
    return map
  }, [storesQ.data, propsQ.data])

  const charges = useMemo(() => chargesQ.data ?? [], [chargesQ.data])

  const totals = useMemo(() => {
    const active = charges.filter(c => c.status !== 'void')
    const income = active.filter(c => c.direction === 'charge').reduce((s, c) => s + num(c.amount), 0)
    const payout = active.filter(c => c.direction === 'payout').reduce((s, c) => s + num(c.amount), 0)
    const pending = active.filter(c => c.status === 'pending').reduce((s, c) => s + num(c.amount), 0)
    const paid = active.filter(c => c.status === 'paid').reduce((s, c) => s + num(c.amount), 0)
    return { income, payout, pending, paid, net: income - payout }
  }, [charges])

  // One row per counterparty, so an invoice run is a copy-paste away.
  const byParty = useMemo(() => {
    const map = new Map<string, { name: string; type: string; direction: string; count: number; amount: number; pending: number }>()
    for (const c of charges) {
      if (c.status === 'void') continue
      const key = `${c.party_type}:${c.party_id}:${c.direction}`
      const entry = map.get(key) ?? {
        name: nameOf.get(c.party_id) ?? c.party_id.slice(0, 8),
        type: c.party_type, direction: c.direction, count: 0, amount: 0, pending: 0,
      }
      entry.count++
      entry.amount += num(c.amount)
      if (c.status === 'pending') entry.pending += num(c.amount)
      map.set(key, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
  }, [charges, nameOf])

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const applyStatus = (newStatus: string) => {
    if (selected.size === 0) return
    update.mutate({ ids: Array.from(selected), status: newStatus }, {
      onSuccess: () => { toast.success(`${selected.size} εγγραφές → ${STATUS_LABEL[newStatus]}`); setSelected(new Set()) },
      onError: (e) => toast.error((e as Error).message),
    })
  }

  const exportCsv = () => downloadFile(
    `delivr-billing-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(charges.map(c => ({
      Ημερομηνία: dateTime(c.created_at),
      Παραγγελία: c.orders?.order_number ?? '',
      Τύπος: c.party_type === 'store' ? 'Κατάστημα' : 'Κατάλυμα',
      Επωνυμία: nameOf.get(c.party_id) ?? c.party_id,
      Κατεύθυνση: c.direction === 'charge' ? 'Χρέωση' : 'Απόδοση',
      Μέθοδος: c.mode === 'commission' ? 'Ποσοστό' : 'Σταθερό',
      Συντελεστής: c.rate, Βάση: c.base_amount, Ποσό: c.amount,
      Κατάσταση: STATUS_LABEL[c.status] ?? c.status,
    }))), 'text/csv;charset=utf-8')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon="🏦" label="Έσοδα προμηθειών" value={money(totals.income)} sub={`${days} ημέρες`} tone="success" />
        <StatCard icon="🏠" label="Αποδόσεις καταλυμάτων" value={money(totals.payout)} />
        <StatCard icon="📊" label="Καθαρό αποτέλεσμα" value={money(totals.net)} tone="brand" />
        <StatCard icon="⏳" label="Εκκρεμή" value={money(totals.pending)} tone={totals.pending > 0 ? 'warning' : 'default'} />
        <StatCard icon="✅" label="Εξοφλημένα" value={money(totals.paid)} />
      </div>

      <Card title="Ανά συμβαλλόμενο">
        <div className="overflow-x-auto">
          <table className="dash-table">
            <thead>
              <tr><th>Επωνυμία</th><th>Τύπος</th><th>Κίνηση</th><th>Παραγγελίες</th><th>Σύνολο</th><th>Εκκρεμεί</th></tr>
            </thead>
            <tbody>
              {byParty.map((p, i) => (
                <tr key={i}>
                  <td className="font-semibold">{p.name}</td>
                  <td className="text-ink-2">{p.type === 'store' ? 'Κατάστημα' : 'Κατάλυμα'}</td>
                  <td>
                    <span className={`badge ${p.direction === 'charge' ? 'badge-green' : 'badge-brand'}`}>
                      {p.direction === 'charge' ? 'Μας χρωστά' : 'Του χρωστάμε'}
                    </span>
                  </td>
                  <td>{p.count}</td>
                  <td className="font-bold">{money(p.amount)}</td>
                  <td className={p.pending > 0 ? 'text-amber-700 font-semibold' : 'text-ink-3'}>{money(p.pending)}</td>
                </tr>
              ))}
              {byParty.length === 0 && (
                <tr><td colSpan={6} className="text-center text-ink-3 py-6">Καμία χρέωση στο διάστημα.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Αναλυτικές κινήσεις">
        <div className="flex flex-wrap gap-3 items-end mb-3">
          <div className="min-w-[150px]">
            <span className="input-label">Κατάσταση</span>
            <Select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">Όλες</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <div className="min-w-[150px]">
            <span className="input-label">Συμβαλλόμενος</span>
            <Select value={party} onChange={e => setParty(e.target.value)}>
              <option value="all">Όλοι</option>
              <option value="store">Καταστήματα</option>
              <option value="property">Καταλύματα</option>
            </Select>
          </div>
          <div className="min-w-[130px]">
            <span className="input-label">Περίοδος</span>
            <Select value={days} onChange={e => setDays(Number(e.target.value))}>
              <option value={7}>7 ημέρες</option>
              <option value={30}>30 ημέρες</option>
              <option value={90}>90 ημέρες</option>
              <option value={365}>1 έτος</option>
            </Select>
          </div>
          <button className="btn btn-secondary btn-md" onClick={exportCsv} disabled={charges.length === 0}>
            ⬇️ Εξαγωγή CSV
          </button>
          {selected.size > 0 && (
            <div className="flex gap-2 ml-auto items-center">
              <span className="text-sm text-ink-2">{selected.size} επιλεγμένα</span>
              <button className="btn btn-secondary btn-sm" onClick={() => applyStatus('invoiced')}>Τιμολογήθηκαν</button>
              <button className="btn btn-primary btn-sm" onClick={() => applyStatus('paid')}>Εξοφλήθηκαν</button>
              <button className="btn btn-ghost btn-sm text-danger" onClick={() => applyStatus('void')}>Ακύρωση</button>
            </div>
          )}
        </div>

        {chargesQ.isLoading ? (
          <div className="py-10 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr>
                  <th className="w-8"></th><th>Ημερομηνία</th><th>Παραγγελία</th><th>Συμβαλλόμενος</th>
                  <th>Κίνηση</th><th>Μέθοδος</th><th>Βάση</th><th>Ποσό</th><th>Κατάσταση</th>
                </tr>
              </thead>
              <tbody>
                {charges.map(c => (
                  <tr key={c.id}>
                    <td>
                      <input type="checkbox" className="accent-brand w-4 h-4"
                             checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    </td>
                    <td className="text-xs text-ink-3 whitespace-nowrap">{dateTime(c.created_at)}</td>
                    <td className="font-mono text-xs">{c.orders?.order_number ?? '—'}</td>
                    <td>
                      <span className="font-semibold">{nameOf.get(c.party_id) ?? '—'}</span>
                      <p className="text-[11px] text-ink-3">{c.party_type === 'store' ? 'Κατάστημα' : 'Κατάλυμα'}</p>
                    </td>
                    <td>
                      <span className={`badge ${c.direction === 'charge' ? 'badge-green' : 'badge-brand'}`}>
                        {c.direction === 'charge' ? 'Χρέωση' : 'Απόδοση'}
                      </span>
                    </td>
                    <td className="text-xs">{c.mode === 'commission' ? `${num(c.rate)}%` : 'σταθερό'}</td>
                    <td className="text-ink-2">{money(c.base_amount)}</td>
                    <td className="font-bold">{money(c.amount)}</td>
                    <td><StatusChip status={c.status} label={STATUS_LABEL[c.status]} /></td>
                  </tr>
                ))}
                {charges.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-ink-3 py-8">Καμία κίνηση.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
