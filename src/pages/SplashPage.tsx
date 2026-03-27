// SplashPage.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function SplashPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuthStore()

  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => navigate(user ? '/home' : '/auth'), 1800)
    return () => clearTimeout(t)
  }, [loading, user, navigate])

  return (
    <div className="screen flex flex-col items-center justify-center gap-2 bg-ink-1">
      <h1 className="font-display font-black text-[64px] tracking-tighter text-brand leading-none"
          style={{ animation: 'scaleIn 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
        delivr
      </h1>
      <p className="text-ink-3 text-base font-light tracking-wide">φαγητό · καφέ · market</p>
      <div className="mt-12 flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand opacity-0"
               style={{ animation: `fadeIn 0.3s ease ${0.8 + i*0.15}s both` }} />
        ))}
      </div>
    </div>
  )
}

export default SplashPage
