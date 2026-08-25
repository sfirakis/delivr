import type { StoreOrderView } from '@/lib/api'
import { money, dateTime } from '@/lib/format'
import type { Lang } from '@/lib/i18n'

/**
 * 80mm thermal receipt. Hidden on screen, laid out for print only.
 * Works with any printer the store already has (browser print dialog).
 */
export default function PrintTicket({ order, lang = 'el' }: { order: StoreOrderView; lang?: Lang }) {
  const el = lang === 'el'
  const addr = order.address as Record<string, string> | null

  return (
    <div className="print-ticket" aria-hidden="true">
      <div className="pt-center pt-big pt-bold">{order.store.name}</div>
      <div className="pt-center pt-small">{order.store.address}</div>
      {order.store.phone && <div className="pt-center pt-small">{order.store.phone}</div>}
      <div className="pt-sep" />

      <div className="pt-row"><span>{el ? 'Παραγγελία' : 'Order'}</span><span className="pt-bold">{order.order_number}</span></div>
      <div className="pt-row"><span>{el ? 'Ώρα' : 'Time'}</span><span>{dateTime(order.created_at, lang)}</span></div>
      <div className="pt-row">
        <span>{el ? 'Τύπος' : 'Type'}</span>
        <span className="pt-bold">{order.service === 'delivery' ? 'DELIVERY' : 'TAKE AWAY'}</span>
      </div>
      {order.scheduled_for && (
        <div className="pt-row"><span>{el ? 'Για' : 'For'}</span><span className="pt-bold">{dateTime(order.scheduled_for, lang)}</span></div>
      )}
      <div className="pt-sep" />

      <div className="pt-bold">{el ? 'ΠΕΛΑΤΗΣ' : 'CUSTOMER'}</div>
      <div>{order.guest.name}</div>
      {order.guest.phone && <div>{order.guest.phone}</div>}

      {order.service === 'delivery' && (
        <>
          <div className="pt-sep" />
          <div className="pt-bold">{el ? 'ΔΙΕΥΘΥΝΣΗ' : 'ADDRESS'}</div>
          {order.property?.name && <div>{order.property.name}</div>}
          <div>{addr?.street ?? order.property?.address}</div>
          {(addr?.floor || addr?.doorbell) && (
            <div>{[addr?.floor, addr?.doorbell].filter(Boolean).join(' · ')}</div>
          )}
          {order.property?.access_notes && <div className="pt-small">{order.property.access_notes}</div>}
        </>
      )}

      <div className="pt-sep" />
      {order.items.map((it, i) => (
        <div key={i} className="pt-item">
          <div className="pt-row">
            <span className="pt-bold">{it.quantity}× {it.name}</span>
            <span>{money(it.subtotal, lang)}</span>
          </div>
          {it.modifiers?.length > 0 && (
            <div className="pt-small">  + {it.modifiers.map(m => m.name).join(', ')}</div>
          )}
          {it.notes && <div className="pt-small pt-bold">  ** {it.notes}</div>}
        </div>
      ))}

      <div className="pt-sep" />
      <div className="pt-row"><span>{el ? 'Υποσύνολο' : 'Subtotal'}</span><span>{money(order.subtotal, lang)}</span></div>
      {Number(order.discount_amount) > 0 && (
        <div className="pt-row"><span>{el ? 'Έκπτωση' : 'Discount'}</span><span>-{money(order.discount_amount, lang)}</span></div>
      )}
      {Number(order.delivery_fee) > 0 && (
        <div className="pt-row"><span>{el ? 'Μεταφορικά' : 'Delivery'}</span><span>{money(order.delivery_fee, lang)}</span></div>
      )}
      <div className="pt-row pt-big pt-bold">
        <span>{el ? 'ΣΥΝΟΛΟ' : 'TOTAL'}</span><span>{money(order.total, lang)}</span>
      </div>
      <div className="pt-row pt-bold">
        <span>{el ? 'Πληρωμή' : 'Payment'}</span>
        <span>{order.payment_method === 'cash' ? (el ? 'ΜΕΤΡΗΤΑ' : 'CASH') : order.payment_method.toUpperCase()}</span>
      </div>

      {(order.customer_notes || order.delivery_notes) && (
        <>
          <div className="pt-sep" />
          <div className="pt-bold">{el ? 'ΣΗΜΕΙΩΣΕΙΣ' : 'NOTES'}</div>
          {order.customer_notes && <div>{order.customer_notes}</div>}
          {order.delivery_notes && <div>{order.delivery_notes}</div>}
        </>
      )}

      <div className="pt-sep" />
      <div className="pt-center pt-small">{order.settings.platform_name}</div>
      <div className="pt-center pt-small">{el ? 'Καλή σας όρεξη!' : 'Enjoy your meal!'}</div>
    </div>
  )
}
