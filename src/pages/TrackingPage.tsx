import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useOrder, useOrderRealtime } from '@/hooks/useDelivr'
import { BackHeader, OrderStatusBadge, Divider, Spinner } from '@/components/ui'
import type { OrderStatus } from '@/types'

const STEPS: { status: OrderStatus; icon: string; label: string }[] = [
  { status:'confirmed',  icon:'✓',  label:'Επιβεβαιώθηκε' },
  { status:'preparing',  icon:'👨‍🍳', label:'Ετοιμάζεται'   },
  { status:'on_the_way', icon:'🛵',  label:'Στο δρόμο'     },
  { status:'delivered',  icon:'📦',  label:'Παραδόθηκε'    },
]

const STATUS_INDEX: Record<string, number> = {
  pending:0, confirmed:0, preparing:1, ready:2, picked_up:2, on_the_way:2, delivered:3
}

export default function TrackingPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate    = useNavigate()
  const { data: order, isLoading } = useOrder(orderId === 'active' ? '' : orderId!)
  const [stepIdx, setStepIdx]       = useState(2) // demo: on_the_way

  // Real-time updates
  useOrderRealtime(orderId!, (updated) => {
    setStepIdx(STATUS_INDEX[updated.status] ?? 2)
  })

  // Demo: auto-advance for "active" orders
  useEffect(() => {
    if (orderId !== 'active') return
    if (stepIdx >= 3) return
    const t = setTimeout(() => setStepIdx(s => Math.min(s+1, 3)), 8000)
    return () => clearTimeout(t)
  }, [stepIdx, orderId])

  const currentStep = STEPS[stepIdx]
  const eta = stepIdx < 3 ? `~${Math.max(2, 12 - stepIdx * 4)} λεπτά` : 'Παραδόθηκε! 🎉'

  return (
    <div className="screen">
      <BackHeader title="Παρακολούθηση" onBack={() => navigate(-1)}
        right={<span className="font-display font-bold text-brand text-sm">
          {orderId === 'active' ? '#ORD-8831' : `#${orderId?.slice(0,8).toUpperCase()}`}
        </span>}
      />

      <div className="scroll-area">
        {/* ── Map ── */}
        <div className="map-bg relative overflow-hidden" style={{ height: 240 }}>
          {/* Grid */}
          <div className="absolute inset-0 opacity-40"
               style={{ backgroundImage:'linear-gradient(#d4d0ca 1px,transparent 1px),linear-gradient(90deg,#d4d0ca 1px,transparent 1px)', backgroundSize:'32px 32px' }} />
          {/* Roads */}
          <div className="absolute bg-white rounded-sm" style={{top:'38%',left:0,right:0,height:4}} />
          <div className="absolute bg-white rounded-sm" style={{top:'64%',left:0,right:0,height:4}} />
          <div className="absolute bg-white rounded-sm" style={{left:'28%',top:0,bottom:0,width:4}} />
          <div className="absolute bg-white rounded-sm" style={{left:'70%',top:0,bottom:0,width:4}} />
          {/* Destination marker */}
          <div className="absolute" style={{bottom:'30%',left:'68%'}}>
            <div className="w-6 h-6 bg-info rounded-tl-full rounded-tr-full rounded-br-full rotate-45 shadow-lg" />
          </div>
          {/* Driver (animated) */}
          <div className="absolute top-[36%] w-10 h-10 bg-brand rounded-full flex items-center justify-center
                          text-xl shadow-brand"
               style={{ animation: stepIdx===2 ? 'driverMove 4s ease-in-out infinite' : 'none',
                        left: stepIdx===2 ? undefined : '38%' }}>
            🛵
          </div>
          {/* ETA pill */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-full
                          px-5 py-2 font-display font-bold text-sm shadow-card whitespace-nowrap">
            {eta}
          </div>
        </div>

        {/* ── Progress steps ── */}
        <div className="px-6 py-5">
          <div className="flex items-center">
            {STEPS.map((step, i) => (
              <div key={step.status} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    transition-all duration-500
                    ${i <  stepIdx ? 'progress-dot-done'
                    : i === stepIdx ? 'progress-dot-active'
                    : 'progress-dot-pending'}`}>
                    {i < stepIdx ? '✓' : step.icon}
                  </div>
                  <span className={`text-[10px] font-semibold mt-1.5 text-center
                    ${i <= stepIdx ? 'text-ink-1' : 'text-ink-3'}`}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-5 transition-all duration-500
                    ${i < stepIdx ? 'progress-line-done' : 'progress-line-pending'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Driver card ── */}
        {stepIdx === 2 && (
          <div className="px-5 pb-4 animate-fade-in-up">
            <div className="bg-surface-2 rounded-2xl p-4">
              <p className="text-xs font-bold text-ink-3 uppercase tracking-wider mb-3">Ο ΟΔΗΓΟΣ ΣΟΥ</p>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center text-2xl flex-shrink-0">
                  🛵
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-base">Δημήτρης Π.</p>
                  <div className="flex items-center gap-2 text-xs text-ink-2">
                    <span className="text-amber-400">★</span><span>4.9</span>
                    <span>·</span><span>ΑΒΓ-1234</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-icon bg-success/10 text-success text-lg">📞</button>
                  <button className="btn-icon bg-info/10 text-info text-lg">💬</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Order summary ── */}
        <div className="px-5 pb-4">
          <div className="border border-surface-4 rounded-2xl p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-display font-bold text-base">Green & Fresh</p>
                <p className="text-xs text-ink-2 mt-0.5">Power Bowl · Green Smoothie</p>
              </div>
              <span className="text-2xl">🥗</span>
            </div>
            <Divider className="mb-3" />
            <div className="flex justify-between text-sm">
              <span className="text-ink-2">Σύνολο</span>
              <span className="font-bold">15.00€</span>
            </div>
          </div>
        </div>

        {/* ── Rate (if delivered) ── */}
        {stepIdx === 3 && (
          <div className="px-5 pb-8 animate-fade-in-up">
            <div className="bg-surface-2 rounded-2xl p-5 text-center">
              <div className="text-3xl mb-2">⭐</div>
              <h3 className="font-display font-bold text-base mb-1">Πώς ήταν η παραγγελία;</h3>
              <p className="text-xs text-ink-2 mb-4">Η γνώμη σου μετράει!</p>
              <div className="flex justify-center gap-2 mb-4">
                {[1,2,3,4,5].map(s => (
                  <span key={s} className="text-3xl cursor-pointer">⭐</span>
                ))}
              </div>
              <button className="btn btn-primary btn-md w-full">Αποστολή αξιολόγησης</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
