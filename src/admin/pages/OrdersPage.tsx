import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAdminOrders, useAdminStores, type AdminOrder } from '../hooks'
import { Card, StatusChip, Select, Modal, downloadFile, toCsv } from '../ui'
import { money, dateTime, num } from '@/lib/format'
import { notifyOrder, getStoreOrder, type StoreOrderView } from '@/lib/api'
import { Spinner } from '@/components/ui'
import { useQuery } from '@tanstack/react-query'

const STATUSES = [
  ['all', 'Όλες'], ['pending', 'Εκκρεμείς'], ['confirmed', 'Επιβεβαιωμένες'],
  ['preparing', 'Σε ετοιμασία'], ['ready', 'Έτοιμες'], ['on_the_way', 'Καθ’ οδόν'],
  ['delivered', 'Παραδομένες'], ['cancelled', 'Ακυρωμένες'],
]

function OrderDetail({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  const detailQ = useQuery({
    queryKey: ['store-order', order.store_token],
    queryFn: () => getStoreOrder(order.store_token!),
    enabled: !!order.store_token,
  })

  const storeLink = order.store_token ? `${window.location.origin}/s/${order.store_token}` : null
  const trackLink = order.public_token ? `${window.location.origin}/t/${order.public_token}` : null
  const d: StoreOrderView | undefined = detailQ.data

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text).then(() => toast.success(`${label} αντιγράφηκε`))
  }

  return (
    <Modal title={`Παραγγελία ${order.order_number ?? ''}`} onClose={onClose} wide>
      {detailQ.isLoading && <div className="py-8 flex justify-center"><Spinner /></div>}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <p className="input-label">Κατάσταση</p>
            <StatusChip status={order.status} />
          </div>
          <div className="text-sm space-y-1">
            <p><span className="text-ink-3">Κατάστημα:</span> <strong>{order.stores?.name}</strong></p>
            <p><span className="text-ink-3">Κατάλυμα:</span> {order.properties?.name ?? '—'} {order.properties?.code && `(${order.properties.code})`}</p>
            <p><span className="text-ink-3">Πελάτης:</span> {order.guest_name ?? '—'} · {order.guest_phone ?? '—'}</p>
            <p><span className="text-ink-3">Τύπος:</span> {order.delivery_type === 'delivery' ? 'Delivery' : 'Take away'} · {order.channel}</p>
            <p><span className="text-ink-3">Δημιουργήθηκε:</span> {dateTime(order.created_at)}</p>
          </div>

          {d && (
            <div className="border-t border-surface-4 pt-3">
              <p className="input-label">Προϊόντα</p>
              {d.items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm py-0.5">
                  <span>{it.quantity}× {it.name}</span>
                  <span>{money(it.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="bg-surface-2 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-ink-3">Υποσύνολο</span><span>{money(order.subtotal)}</span></div>
            {num(order.discount_amount) > 0 && <div className="flex justify-between text-success"><span>Έκπτωση</span><span>−{money(order.discount_amount)}</span></div>}
            {num(order.delivery_fee) > 0 && <div className="flex justify-between"><span className="text-ink-3">Μεταφορικά</span><span>{money(order.delivery_fee)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-1"><span>Σύνολο</span><span>{money(order.total)}</span></div>
            <div className="h-px bg-surface-4 my-1" />
            <div className="flex justify-between"><span className="text-ink-3">Προμήθεια καταστήματος</span><span>{money(order.platform_fee)}</span></div>
            <div className="flex justify-between"><span className="text-ink-3">Απόδοση καταλύματος</span><span>{money(order.property_fee)}</span></div>
          </div>

          <div className="space-y-2">
            {storeLink && (
              <div>
                <p className="input-label">Σύνδεσμος καταστήματος (επιβεβαίωση χωρίς login)</p>
                <div className="flex gap-2">
                  <input className="input-field font-mono text-[11px]" readOnly value={storeLink} />
                  <button className="btn btn-secondary btn-md" onClick={() => copy(storeLink, 'Ο σύνδεσμος')}>📋</button>
                  <a className="btn btn-secondary btn-md" href={storeLink} target="_blank" rel="noopener noreferrer">↗</a>
                </div>
              </div>
            )}
            {trackLink && (
              <div>
                <p className="input-label">Σύνδεσμος πελάτη</p>
                <div className="flex gap-2">
                  <input className="input-field font-mono text-[11px]" readOnly value={trackLink} />
                  <button className="btn btn-secondary btn-md" onClick={() => copy(trackLink, 'Ο σύνδεσμος')}>📋</button>
                  <a className="btn btn-secondary btn-md" href={trackLink} target="_blank" rel="noopener noreferrer">↗</a>
                </div>
              </div>
            )}
            <button
              className="btn btn-secondary btn-md w-full"
              onClick={async () => {
                const res = await notifyOrder(order.id, order.public_token ?? '')
                res.ok ? toast.success('Η ειδοποίηση στάλθηκε ξανά')
                       : toast.error(`Αποτυχία αποστολής: ${res.error ?? '—'}`)
              }}
            >
              ✉️ Επαναποστολή ειδοποίησης στο κατάστημα
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function OrdersPage() {
  const [status, setStatus] = useState('all')
  const [storeId, setStoreId] = useState('')
  const [days, setDays] = useState(7)
  const [selected, setSelected] = useState<AdminOrder | null>(null)

  const storesQ = useAdminStores()
  const ordersQ = useAdminOrders({ status, storeId: storeId || undefined, days })
  const orders = ordersQ.data ?? []

  const exportCsv = () => {
    downloadFile(`delivr-orders-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(orders.map(o => ({
      Αριθμός: o.order_number, Ημερομηνία: dateTime(o.created_at), Κατάστημα: o.stores?.name,
      Κατάλυμα: o.properties?.name, Κωδικός: o.properties?.code, Πελάτης: o.guest_name,
      Τηλέφωνο: o.guest_phone, Τύπος: o.delivery_type, Κανάλι: o.channel,
      Υποσύνολο: o.subtotal, Μεταφορικά: o.delivery_fee, Έκπτωση: o.discount_amount,
      Σύνολο: o.total, Προμήθεια: o.platform_fee, Απόδοση: o.property_fee,
      Πληρωμή: o.payment_method, Κατάσταση: o.status,
    }))), 'text/csv;charset=utf-8')
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[160px]">
            <span className="input-label">Κατάσταση</span>
            <Select value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <div className="min-w-[200px]">
            <span className="input-label">Κατάστημα</span>
            <Select value={storeId} onChange={e => setStoreId(e.target.value)}>
              <option value="">Όλα</option>
              {(storesQ.data ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div className="min-w-[130px]">
            <span className="input-label">Περίοδος</span>
            <Select value={days} onChange={e => setDays(Number(e.target.value))}>
              <option value={1}>Σήμερα</option>
              <option value={7}>7 ημέρες</option>
              <option value={30}>30 ημέρες</option>
              <option value={90}>90 ημέρες</option>
            </Select>
          </div>
          <button className="btn btn-secondary btn-md" onClick={exportCsv} disabled={orders.length === 0}>
            ⬇️ Εξαγωγή CSV
          </button>
          <span className="text-sm text-ink-3 ml-auto">{orders.length} παραγγελίες</span>
        </div>
      </Card>

      <Card>
        {ordersQ.isLoading ? (
          <div className="py-10 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Αριθμός</th><th>Ώρα</th><th>Κατάστημα</th><th>Κατάλυμα</th>
                  <th>Πελάτης</th><th>Τύπος</th><th>Σύνολο</th><th>Προμήθεια</th>
                  <th>Κατάσταση</th><th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="cursor-pointer" onClick={() => setSelected(o)}>
                    <td className="font-mono text-xs">{o.order_number ?? '—'}</td>
                    <td className="text-xs text-ink-3 whitespace-nowrap">{dateTime(o.created_at)}</td>
                    <td>{o.stores?.name ?? '—'}</td>
                    <td className="text-ink-2">{o.properties?.name ?? '—'}</td>
                    <td className="text-ink-2">{o.guest_name ?? '—'}</td>
                    <td>{o.delivery_type === 'delivery' ? '🏠' : '🥡'}</td>
                    <td className="font-semibold">{money(o.total)}</td>
                    <td className="text-ink-2">{money(o.platform_fee)}</td>
                    <td><StatusChip status={o.status} /></td>
                    <td className="text-ink-3">›</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-ink-3 py-8">Καμία παραγγελία στο διάστημα.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
