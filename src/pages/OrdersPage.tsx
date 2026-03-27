// ═══════════════════════════════════════════════════════════
// OrdersPage.tsx
// ═══════════════════════════════════════════════════════════
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore }  from '@/store/authStore'
import { useOrders }     from '@/hooks/useDelivr'
import { OrderStatusBadge, Divider, EmptyState, Skeleton } from '@/components/ui'
import { format } from 'date-fns'
import { el } from 'date-fns/locale'

export function OrdersPage() {
  const navigate   = useNavigate()
  const { user }   = useAuthStore()
  const [tab, setTab] = useState<'active'|'history'>('active')
  const { data: orders, isLoading } = useOrders(user?.id ?? '')

  const activeOrders  = orders?.filter(o => !['delivered','cancelled'].includes(o.status)) ?? []
  const historyOrders = orders?.filter(o =>  ['delivered','cancelled'].includes(o.status)) ?? []

  return (
    <div className="screen">
      <div className="h-11 flex-shrink-0" />
      <div className="px-5 pt-2 pb-0 flex-shrink-0">
        <h1 className="font-display font-black text-2xl mb-4">Παραγγελίες</h1>
        <div className="flex bg-surface-2 rounded-full p-1 gap-1 mb-4">
          {([['active','Ενεργές'],['history','Ιστορικό']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all
                ${tab===k ? 'bg-brand text-white' : 'text-ink-2'}`}>{l}</button>
          ))}
        </div>
        <Divider />
      </div>

      <div className="scroll-area px-5 py-4 pb-24 space-y-3">
        {isLoading && [1,2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}

        {/* Active */}
        {tab === 'active' && !isLoading && (
          activeOrders.length === 0
            ? <EmptyState emoji="📭" title="Καμία ενεργή παραγγελία" subtitle="Οι παραγγελίες σου εμφανίζονται εδώ"
                action="Παράγγειλε τώρα" onAction={() => navigate('/home')} />
            : activeOrders.map(order => (
                <div key={order.id} className="border-[1.5px] border-brand bg-brand-50 rounded-2xl p-4 cursor-pointer animate-fade-in-up"
                     onClick={() => navigate(`/track/${order.id}`)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{(order.store as any)?.emoji ?? '🏪'}</span>
                      <div>
                        <p className="font-display font-bold text-sm">{(order.store as any)?.name}</p>
                        <p className="text-xs text-ink-2">{order.order_items?.map(i=>i.name).join(' · ')}</p>
                      </div>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <Divider className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-ink-2">⏱ ~15 λεπτά</span>
                    <span className="font-bold text-brand">{order.total.toFixed(2)}€</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="btn btn-primary btn-sm flex-1"
                            onClick={e => { e.stopPropagation(); navigate(`/track/${order.id}`) }}>
                      📍 Παρακολούθηση
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>
                      Επικοινωνία
                    </button>
                  </div>
                </div>
              ))
        )}

        {/* History */}
        {tab === 'history' && !isLoading && (
          historyOrders.length === 0
            ? <EmptyState emoji="📜" title="Δεν υπάρχει ιστορικό" subtitle="Κάνε την πρώτη σου παραγγελία!" />
            : historyOrders.map((order, i) => (
                <div key={order.id} className={`border border-surface-4 rounded-2xl p-4 animate-fade-in-up stagger-${Math.min(i+1,5)}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{(order.store as any)?.emoji ?? '🏪'}</span>
                      <div>
                        <p className="font-display font-bold text-sm">{(order.store as any)?.name}</p>
                        <p className="text-xs text-ink-2">{order.order_items?.slice(0,2).map(i=>i.name).join(' · ')}</p>
                      </div>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <Divider className="my-2" />
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-ink-3">
                      {format(new Date(order.created_at), 'd MMM, HH:mm', { locale: el })}
                    </span>
                    <span className="font-bold">{order.total.toFixed(2)}€</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm flex-1">🔄 Επανάληψη</button>
                    <button className="btn btn-secondary btn-sm">Αξιολόγηση</button>
                  </div>
                </div>
              ))
        )}
      </div>
    </div>
  )
}

export default OrdersPage
