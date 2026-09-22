import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import LandingPage from '@/pages/LandingPage'
import AuthPage    from '@/pages/AuthPage'
import TermsPage   from '@/pages/TermsPage'
import MerchantApp from '@/merchant/MerchantApp'
import DriverApp   from '@/driver/DriverApp'
import AdminApp    from '@/admin/AdminApp'
import GuestApp        from '@/guest/GuestApp'
import ShopApp         from '@/shop/ShopApp'
import GuestOrderPage  from '@/guest/pages/GuestOrderPage'
import StoreConfirmPage from '@/storefront/StoreConfirmPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return null
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

/** Phone-sized frame used by the guest-facing screens. */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center">
      <div className="app-shell">
        <div className="flex-1 relative overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

export default function App() {
  const { initialize } = useAuthStore()
  const location = useLocation()

  useEffect(() => { initialize() }, [initialize])

  // Dashboards and the store link need the full viewport, not the phone frame.
  const fullWidth = ['/admin', '/merchant', '/driver', '/s/'].some(p => location.pathname.startsWith(p))

  const dashboardRoutes = (
    <Routes>
      <Route path="/merchant/*" element={<AuthGuard><MerchantApp /></AuthGuard>} />
      <Route path="/driver/*"   element={<AuthGuard><DriverApp /></AuthGuard>} />
      <Route path="/admin/*"    element={<AuthGuard><AdminApp /></AuthGuard>} />
      <Route path="/s/:token"   element={<StoreConfirmPage />} />
    </Routes>
  )

  if (fullWidth) return <div className="dash-shell">{dashboardRoutes}</div>

  return (
    <PhoneFrame>
      <Routes>
        {/* Guest / QR flow — public, no account needed. This is the product. */}
        <Route path="/qr/:code/*" element={<GuestApp />} />
        <Route path="/t/:token"   element={<GuestOrderPage />} />

        {/* A store's own link — same ordering flow, customer-typed address. */}
        <Route path="/store/:slug/*" element={<ShopApp />} />

        {/* Public shell */}
        <Route path="/"      element={<LandingPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/auth"  element={<AuthPage />} />

        {/* An unknown URL is almost always a mistyped QR link, not a partner
            trying to sign in — send it to the landing, never to /auth. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PhoneFrame>
  )
}
