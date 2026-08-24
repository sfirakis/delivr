import { useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getOrderStatus } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { money, time, minutesUntil, phoneDigits } from '@/lib/format'
import { useI18n, LangToggle, type TKey } from '@/lib/i18n'
import { buildWhatsAppMessage, waLink } from '@/lib/whatsapp'
import { Spinner, EmptyState } from '@/components/ui'

const FLOW_DELIVERY = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered']
const FLOW_PICKUP   = ['pending', 'confirmed', 'preparing', 'ready', 'delivered']

const STATUS_EMOJI: Record<string, string> = {
  pending: '⏳', confirmed: '✅', preparing: '👨‍🍳', ready: '🥡',
  picked_up: '🛵', on_the_way: '🛵', delivered: '🎉', cancelled: '❌',
}

export default function GuestOrderPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const qc = useQueryClient()
  const isNew = params.get('new') === '1'

  const orderQ = useQuery({
    queryKey: ['order-status', token],
    queryFn: () => getOrderStatus(token),
    retry: false,
    refetchInterval: 20000,
  })

  // Live status updates straight from Postgres.
  useEffect(() => {
    const channel = supabase
      .channel(`guest-order-${token}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `public_token=eq.${token}` },
        () => qc.invalidateQueries({ queryKey: ['order-status', token] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [token, qc])

  const order = orderQ.data

  const waHref = useMemo(() => {
    if (!order) return null
    const addr = order.delivery_address as Record<string, string> | null
    const msg = buildWhatsAppMessage({
      orderNumber: order.order_number,
      service: order.service,
      storeName: order.store.name,
      guestName: order.guest_name ?? '',
      propertyName: addr?.label ?? null,
      address: addr?.street ?? null,
      addressExtra: [addr?.floor, addr?.doorbell].filter(Boolean).join(' · ') || null,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount_amount,
      deliveryFee: order.delivery_fee,
      total: order.total,
      paymentLabel: order.payment_method === 'cash'
        ? (order.service === 'delivery' ? t('checkout.cash') : t('checkout.cashPickup'))
        : order.payment_method,
      notes: order.customer_notes,
      trackUrl: `${window.location.origin}/t/${token}`,
    }, lang)
    return waLink(order.store.phone, msg)
  }, [order, lang, t, token])

  if (orderQ.isLoading) {
    return <div className="h-full flex items-center justify-center"><Spinner size={32} /></div>
  }
  if (orderQ.isError || !order) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <EmptyState emoji="🔍" title={t('err.ORDER_NOT_FOUND')} />
      </div>
    )
  }

  const cancelled = order.status === 'cancelled'
  const flow = order.service === 'delivery' ? FLOW_DELIVERY : FLOW_PICKUP
  const currentIdx = flow.indexOf(order.status === 'picked_up' ? 'on_the_way' : order.status)
  const etaIso = order.service === 'delivery' ? order.estimated_delivery_at : order.estimated_ready_at
  const etaMin = minutesUntil(etaIso)

  return (
    <div className="h-full flex flex-col bg-surface-2">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-1 border-b border-surface-4 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-lg leading-tight">{t('order.title')}</h2>
          <p className="text-[11px] text-ink-3">{t('order.number')} {order.order_number}</p>
        </div>
        <LangToggle />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Status hero */}
        <div className={`rounded-2xl p-5 text-center ${cancelled ? 'bg-red-50 border border-red-100' : 'bg-ink-1'}`}>
          <div className="text-5xl mb-2">{STATUS_EMOJI[order.status] ?? '📦'}</div>
          <p className={`font-display font-black text-xl ${cancelled ? 'text-danger' : 'text-white'}`}>
            {t(`order.status.${order.status}` as TKey)}
          </p>
          {cancelled ? (
            order.cancel_reason && <p className="text-sm text-danger/80 mt-1">{order.cancel_reason}</p>
          ) : order.status === 'pending' ? (
            <p className="text-sm text-white/70 mt-1">{t('order.pendingHint')}</p>
          ) : order.status !== 'delivered' && etaMin > 0 ? (
            <p className="text-sm text-white/70 mt-1">{t('order.readyIn', { min: etaMin })}</p>
          ) : null}
        </div>

        {/* Progress */}
        {!cancelled && (
          <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4">
            <div className="flex items-center">
              {flow.map((step, i) => (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0
                    ${i <= currentIdx ? 'bg-brand text-white' : 'bg-surface-3 text-ink-3'}`}>
                    {i < currentIdx ? '✓' : i + 1}
                  </div>
                  {i < flow.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 ${i < currentIdx ? 'bg-brand' : 'bg-surface-4'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              {order.events.map((e, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-ink-2">{t(`order.status.${e.status}` as TKey)}{e.note ? ` · ${e.note}` : ''}</span>
                  <span className="text-ink-3">{time(e.at, lang)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WhatsApp nudge while the store has not answered yet */}
        {order.status === 'pending' && waHref && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-xs text-green-900 mb-2">{t('order.whatsappHint')}</p>
            <a href={waHref} target="_blank" rel="noopener noreferrer"
               className="btn btn-lg w-full bg-[#25D366] text-white">
              💬 {t('order.sendWhatsapp')}
            </a>
          </div>
        )}

        {/* Store card */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4">
          <p className="font-display font-bold text-base">{order.store.name}</p>
          <p className="text-xs text-ink-2">{order.store.address}</p>
          {order.store.phone && (
            <a href={`tel:${phoneDigits(order.store.phone)}`}
               className="btn btn-secondary btn-md w-full mt-3">
              📞 {t('order.callStore')}
            </a>
          )}
        </div>

        {/* Items */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4 space-y-2">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between text-sm">
              <div className="min-w-0 pr-2">
                <p className="text-ink-1"><span className="font-bold">{it.quantity}×</span> {it.name}</p>
                {it.modifiers?.length > 0 && (
                  <p className="text-[11px] text-ink-3">+ {it.modifiers.map(m => m.name).join(', ')}</p>
                )}
                {it.notes && <p className="text-[11px] text-ink-3 italic">✏️ {it.notes}</p>}
              </div>
              <span className="font-semibold whitespace-nowrap">{money(it.subtotal, lang)}</span>
            </div>
          ))}
          <div className="h-px bg-surface-4" />
          <div className="flex justify-between text-sm">
            <span className="text-ink-2">{t('cart.subtotal')}</span>
            <span>{money(order.subtotal, lang)}</span>
          </div>
          {Number(order.discount_amount) > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>{t('cart.discount')}</span><span>−{money(order.discount_amount, lang)}</span>
            </div>
          )}
          {Number(order.delivery_fee) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-ink-2">{t('cart.deliveryFee')}</span>
              <span>{money(order.delivery_fee, lang)}</span>
            </div>
          )}
          <div className="flex justify-between text-base pt-1">
            <span className="font-display font-bold">{t('cart.total')}</span>
            <span className="font-display font-black text-brand">{money(order.total, lang)}</span>
          </div>
          <p className="text-[11px] text-ink-3 pt-1">
            💶 {order.payment_method === 'cash'
              ? (order.service === 'delivery' ? t('checkout.cash') : t('checkout.cashPickup'))
              : order.payment_method}
          </p>
        </div>

        {isNew && (
          <p className="text-[11px] text-ink-3 text-center px-4">{t('order.saveLink')}</p>
        )}

        {(cancelled || order.status === 'delivered') && (
          <button className="btn btn-secondary btn-lg w-full"
                  onClick={() => navigate(`/qr/${(order.delivery_address as Record<string, string> | null)?.property_code ?? ''}`)}>
            {t('order.trackAgain')}
          </button>
        )}
      </div>
    </div>
  )
}
