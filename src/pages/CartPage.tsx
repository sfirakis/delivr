// ═══════════════════════════════════════════════════════════
// CartPage.tsx
// ═══════════════════════════════════════════════════════════
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { BackHeader, QtyStepper, Divider, EmptyState } from '@/components/ui'

export function CartPage() {
  const navigate = useNavigate()
  const { items, storeName, storeEmoji, storeDeliveryFee,
          updateQuantity, clearCart: _clearCart, subtotal } = useCartStore()

  const [deliveryType, setDeliveryType] = useState<'delivery'|'pickup'>('delivery')
  const [promoCode, setPromoCode]       = useState('')
  const [discount, setDiscount]         = useState(0)
  const [promoMsg, setPromoMsg]         = useState<{ok:boolean; text:string}|null>(null)

  const fee       = deliveryType === 'delivery' ? storeDeliveryFee : 0
  const sub       = subtotal()
  const discAmt   = sub * discount
  const total     = sub + fee - discAmt

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase()
    if (code === 'WELCOME20') {
      setDiscount(0.20); setPromoMsg({ ok:true, text:'✓ -20% εφαρμόστηκε!' })
    } else if (code === 'DELIVR10') {
      setDiscount(0.10); setPromoMsg({ ok:true, text:'✓ -10% εφαρμόστηκε!' })
    } else {
      setDiscount(0); setPromoMsg({ ok:false, text:'✗ Μη έγκυρος κωδικός' })
    }
  }

  if (items.length === 0) return (
    <div className="screen">
      <BackHeader title="Καλάθι" onBack={() => navigate(-1)} />
      <EmptyState emoji="🛒" title="Το καλάθι σου είναι άδειο"
        subtitle="Ανακάλυψε καταστήματα κοντά σου"
        action="Αναζήτηση" onAction={() => navigate('/home')} />
    </div>
  )

  return (
    <div className="screen">
      <BackHeader title="Καλάθι"
        onBack={() => navigate(-1)}
        right={<span className="text-sm text-ink-2">{storeEmoji} {storeName}</span>}
      />

      <div className="scroll-area">
        {/* Delivery / Pickup */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex bg-surface-2 rounded-full p-1 gap-1">
            {([['delivery','🛵 Delivery'],['pickup','🏪 Παραλαβή']] as const).map(([k,l]) => (
              <button key={k} onClick={() => setDeliveryType(k)}
                className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all
                  ${deliveryType===k ? 'bg-brand text-white' : 'text-ink-2'}`}>{l}</button>
            ))}
          </div>
        </div>

        {/* Delivery address */}
        {deliveryType === 'delivery' && (
          <div className="px-5 py-3">
            <div className="bg-surface-2 rounded-2xl p-4 flex items-center gap-3 cursor-pointer"
                 onClick={() => navigate('/profile')}>
              <span className="text-xl">📍</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Ερμού 45, Σύνταγμα</p>
                <p className="text-xs text-ink-2">Όροφος 2 · Κουδούνι Παπαδόπουλος</p>
              </div>
              <span className="text-brand text-sm font-semibold">Αλλαγή</span>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="px-5 py-2">
          <p className="font-display font-bold text-sm text-ink-2 mb-3">ΠΡΟΪΟΝΤΑ</p>
          {items.map(ci => (
            <div key={ci.menuItem.id} className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-xl bg-surface-2 flex items-center justify-center text-2xl flex-shrink-0">
                {ci.menuItem.emoji ?? '🍽️'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight truncate">{ci.menuItem.name}</p>
                <p className="text-brand font-bold text-sm mt-0.5">{ci.lineTotal.toFixed(2)}€</p>
              </div>
              <QtyStepper value={ci.quantity} onChange={v => updateQuantity(ci.menuItem.id, v)} />
            </div>
          ))}
        </div>

        <Divider className="mx-5" />

        {/* Promo */}
        <div className="px-5 py-4">
          <div className="flex gap-2">
            <div className="input-wrapper flex-1 py-2.5">
              <span>🏷️</span>
              <input className="input-field" placeholder="Κωδικός έκπτωσης"
                value={promoCode} onChange={e => setPromoCode(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-md px-4" onClick={applyPromo}>Εφαρμογή</button>
          </div>
          {promoMsg && (
            <p className={`text-xs mt-1.5 font-medium ${promoMsg.ok ? 'text-success' : 'text-danger'}`}>
              {promoMsg.text}
            </p>
          )}
        </div>

        <Divider className="mx-5" />

        {/* Summary */}
        <div className="px-5 py-4 space-y-2.5">
          {[
            { label:'Υποσύνολο', val:`${sub.toFixed(2)}€` },
            { label:'Delivery', val: fee===0 ? '✓ Δωρεάν' : `${fee.toFixed(2)}€`, green: fee===0 },
            ...(discount>0 ? [{ label:`Έκπτωση (${discount*100}%)`, val:`-${discAmt.toFixed(2)}€`, green:true }] : []),
          ].map(r => (
            <div key={r.label} className="flex justify-between text-sm">
              <span className="text-ink-2">{r.label}</span>
              <span className={`font-medium ${(r as any).green ? 'text-success' : ''}`}>{r.val}</span>
            </div>
          ))}
          <Divider />
          <div className="flex justify-between font-display font-bold text-lg">
            <span>Σύνολο</span>
            <span className="text-brand">{total.toFixed(2)}€</span>
          </div>
        </div>

        {/* Payment */}
        <div className="px-5 pb-4">
          <Divider className="mb-4" />
          <div className="bg-surface-2 rounded-2xl p-4 flex items-center gap-3 cursor-pointer">
            <span className="text-xl">💳</span>
            <div className="flex-1">
              <p className="font-semibold text-sm">Visa •••• 4832</p>
              <p className="text-xs text-ink-2">Προεπιλεγμένη κάρτα</p>
            </div>
            <span className="text-brand text-sm font-semibold">Αλλαγή</span>
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 pb-6">
          <label className="input-label">Σημειώσεις</label>
          <textarea placeholder="π.χ. χωρίς κρεμμύδι, ορόφος 3..." rows={2}
            className="w-full border border-surface-4 rounded-2xl px-4 py-3 text-sm resize-none outline-none
                       focus:border-brand font-body text-ink-1 bg-surface-1" />
        </div>
      </div>

      {/* Checkout btn */}
      <div className="px-5 py-3 border-t border-surface-4 flex-shrink-0">
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/checkout')}>
          🛵 Ολοκλήρωση παραγγελίας · {total.toFixed(2)}€
        </button>
      </div>
    </div>
  )
}

export default CartPage
