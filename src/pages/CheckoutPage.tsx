// Full CheckoutPage with Stripe + Edge Functions
// See src/hooks/useStripe.ts for payment logic
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useCreateOrder, useAddresses } from '@/hooks/useDelivr'
import { useStripePayment } from '@/hooks/useStripe'
import { Spinner, Divider } from '@/components/ui'
import { Address } from '@/types'
import toast from 'react-hot-toast'

type PayMethod = 'card_saved' | 'card_new' | 'cash' | 'apple_pay' | 'google_pay'

const PAY_METHODS: { id: PayMethod; icon: string; label: string; sub?: string }[] = [
  { id:'card_saved', icon:'💳', label:'Visa •••• 4832',       sub:'Αποθηκευμένη κάρτα' },
  { id:'apple_pay',  icon:'🍎', label:'Apple Pay',             sub:'Touch / Face ID'    },
  { id:'google_pay', icon:'🔵', label:'Google Pay',            sub:'Γρήγορη πληρωμή'   },
  { id:'card_new',   icon:'➕', label:'Νέα κάρτα',             sub:'Stripe Elements'    },
  { id:'cash',       icon:'💵', label:'Μετρητά στην παράδοση', sub:'Έχε ρέστα'          },
]

export default function CheckoutPage() {
  const navigate    = useNavigate()
  const { user }    = useAuthStore()
  const cart        = useCartStore()
  const createOrder = useCreateOrder()
  const { pay, loading: payLoading, error: payError } = useStripePayment()
  const [payMethod, setPayMethod] = useState<PayMethod>('card_saved')
  const [loading, setLoading]     = useState(false)
  const [step, setStep]           = useState<'review'|'processing'|'success'>('review')
  const [orderId, setOrderId]     = useState<string|null>(null)
  const { data: addresses } = useAddresses(user?.id ?? '')
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)

  useEffect(() => {
    if (addresses?.length && !selectedAddress) {
      setSelectedAddress(addresses.find(a => a.is_default) ?? addresses[0])
    }
  }, [addresses, selectedAddress])

  const subtotal = cart.subtotal()
  const deliveryFee = cart.storeDeliveryFee
  const total = cart.total()

  const handlePlaceOrder = async () => {
    if (!user) { navigate('/auth'); return }
    setLoading(true); setStep('processing')
    try {
      const orderItems = cart.items.map(ci => ({
        menu_item_id: ci.menuItem.id, name: ci.menuItem.name,
        price: ci.menuItem.price, quantity: ci.quantity,
        modifiers: ci.selectedModifiers.map(m => ({ name: m.name, price: m.price })),
        notes: ci.notes, subtotal: ci.lineTotal,
      }))
      const order = await createOrder.mutateAsync({
        userId: user.id,
        payload: {
          store_id: cart.storeId!, delivery_type: 'delivery',
          delivery_address: selectedAddress ? { street: selectedAddress.street, city: selectedAddress.city, postal_code: selectedAddress.postal_code, floor: selectedAddress.floor } : undefined,
          items: orderItems, subtotal, delivery_fee: deliveryFee,
          discount_amount: 0, total, payment_method: payMethod === 'cash' ? 'cash' : 'card',
        }
      })
      if (payMethod !== 'cash') {
        const result = await pay({ amount: total, storeId: cart.storeId!, orderId: order.id,
          orderItems: orderItems.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })) })
        if (!result.success) throw new Error(result.error ?? 'Αποτυχία πληρωμής')
      }
      cart.clearCart(); setOrderId(order.id); setStep('success')
      toast.success('🎉 Παραγγελία ελήφθη!')
    } catch (err: any) {
      toast.error(err.message ?? 'Σφάλμα'); setStep('review')
    } finally { setLoading(false) }
  }

  if (step === 'processing') return (
    <div className="screen flex flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="relative"><Spinner size={64} />
        <span className="absolute inset-0 flex items-center justify-center text-2xl">
          {payMethod === 'cash' ? '💵' : '💳'}
        </span>
      </div>
      <div><h2 className="font-display font-bold text-xl mb-2">Επεξεργασία πληρωμής</h2>
        <p className="text-sm text-ink-2">Παρακαλώ μην κλείσεις την εφαρμογή...</p></div>
    </div>
  )

  if (step === 'success') return (
    <div className="screen flex flex-col items-center justify-center px-10 text-center gap-5">
      <div className="text-7xl animate-scale-in">🎉</div>
      <div><h1 className="font-display font-black text-3xl leading-tight mb-2">Παραγγελία<br/>ελήφθη!</h1>
        <p className="text-ink-2 text-sm">{payMethod === 'cash' ? 'Θα πληρώσεις με μετρητά.' : 'Η πληρωμή ολοκληρώθηκε επιτυχώς.'}</p></div>
      <div className="bg-surface-2 rounded-2xl px-8 py-4 w-full">
        <p className="text-xs text-ink-2 mb-1">Αριθμός παραγγελίας</p>
        <p className="font-display font-black text-2xl text-brand">#{orderId?.slice(0,8).toUpperCase()}</p>
      </div>
      <div className="w-full space-y-2">
        <button className="btn btn-primary btn-lg" onClick={() => navigate(`/track/${orderId}`)}>📍 Παρακολούθηση</button>
        <button className="btn btn-secondary btn-lg" onClick={() => navigate('/home')}>← Επιστροφή</button>
      </div>
    </div>
  )

  return (
    <div className="screen">
      <div className="h-11 flex-shrink-0" />
      <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-4 flex-shrink-0">
        <button className="btn-icon" onClick={() => navigate(-1)}>←</button>
        <h2 className="font-display font-bold text-xl">Ολοκλήρωση παραγγελίας</h2>
      </div>
      <div className="scroll-area">
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-ink-3 uppercase tracking-wider mb-3">{cart.storeName} · {cart.items.length} προϊόντα</p>
          {cart.items.map(ci => (
            <div key={ci.menuItem.id} className="flex justify-between text-sm py-1.5">
              <span className="text-ink-2"><span className="font-bold text-brand mr-1.5">{ci.quantity}×</span>{ci.menuItem.name}</span>
              <span className="font-medium">{ci.lineTotal.toFixed(2)}€</span>
            </div>
          ))}
        </div>
        <Divider className="mx-5" />
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-ink-3 uppercase tracking-wider mb-3">ΔΙΕΥΘΥΝΣΗ ΠΑΡΑΔΟΣΗΣ</p>
          {addresses?.length ? (
            <div className="space-y-2">
              {addresses.map(addr => (
                <button key={addr.id} onClick={() => setSelectedAddress(addr)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left
                    ${selectedAddress?.id === addr.id ? 'border-brand bg-brand-50' : 'border-surface-4 bg-surface-1'}`}>
                  <span className="text-2xl flex-shrink-0">📍</span>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${selectedAddress?.id === addr.id ? 'text-brand' : ''}`}>{addr.label}</p>
                    <p className="text-xs text-ink-2">{addr.street}, {addr.city}{addr.floor ? ` · Όροφος ${addr.floor}` : ''}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    ${selectedAddress?.id === addr.id ? 'border-brand bg-brand' : 'border-surface-4'}`}>
                    {selectedAddress?.id === addr.id && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-2">Δεν έχεις αποθηκευμένες διευθύνσεις</p>
          )}
        </div>
        <Divider className="mx-5" />
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-ink-3 uppercase tracking-wider mb-3">ΠΛΗΡΩΜΗ</p>
          <div className="space-y-2">
            {PAY_METHODS.map(m => (
              <button key={m.id} onClick={() => setPayMethod(m.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left
                  ${payMethod === m.id ? 'border-brand bg-brand-50' : 'border-surface-4 bg-surface-1'}`}>
                <span className="text-2xl flex-shrink-0">{m.icon}</span>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${payMethod === m.id ? 'text-brand' : ''}`}>{m.label}</p>
                  {m.sub && <p className="text-xs text-ink-2">{m.sub}</p>}
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                  ${payMethod === m.id ? 'border-brand bg-brand' : 'border-surface-4'}`}>
                  {payMethod === m.id && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            ))}
          </div>
        </div>
        <Divider className="mx-5" />
        <div className="px-5 py-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-ink-2">Υποσύνολο</span><span>{subtotal.toFixed(2)}€</span></div>
          <div className="flex justify-between"><span className="text-ink-2">Delivery</span>
            <span className={deliveryFee === 0 ? 'text-success font-medium' : ''}>{deliveryFee === 0 ? 'Δωρεάν' : `${deliveryFee.toFixed(2)}€`}</span></div>
          <Divider className="my-1" />
          <div className="flex justify-between font-display font-bold text-lg"><span>Σύνολο</span><span className="text-brand">{total.toFixed(2)}€</span></div>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-surface-4 flex-shrink-0 space-y-2">
        {payError && <p className="text-xs text-danger text-center">{payError}</p>}
        <button className="btn btn-primary btn-lg" onClick={handlePlaceOrder} disabled={loading || payLoading}>
          {loading || payLoading ? <><Spinner size={20} color="white" /> Επεξεργασία...</>
            : payMethod === 'cash' ? `💵 Παραγγελία · ${total.toFixed(2)}€`
            : `🔒 Πληρωμή · ${total.toFixed(2)}€`}
        </button>
        <p className="text-[11px] text-ink-3 text-center">🔒 Ασφαλής πληρωμή μέσω Stripe · PCI DSS Level 1</p>
      </div>
    </div>
  )
}
