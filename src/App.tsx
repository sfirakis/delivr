import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { BottomNav } from '@/components/layout/AppShell'
import SplashPage    from '@/pages/SplashPage'
import AuthPage      from '@/pages/AuthPage'
import HomePage      from '@/pages/HomePage'
import StorePage     from '@/pages/StorePage'
import CartPage      from '@/pages/CartPage'
import CheckoutPage  from '@/pages/CheckoutPage'
import TrackingPage  from '@/pages/TrackingPage'
import OrdersPage    from '@/pages/OrdersPage'
import { ProfilePage, FavoritesPage } from '@/pages/OtherPages'
import MerchantApp from '@/merchant/MerchantApp'
import DriverApp   from '@/driver/DriverApp'
import AdminApp    from '@/admin/AdminApp'
import GuestApp        from '@/guest/GuestApp'
import GuestOrderPage  from '@/guest/pages/GuestOrderPage'
import StoreConfirmPage from '@/storefront/StoreConfirmPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return null
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

/** Phone-sized frame used by the customer-facing screens. */
function PhoneFrame({ children, nav }: { children: React.ReactNode; nav?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center">
      <div className="app-shell">
        <div className="flex-1 relative overflow-hidden">{children}</div>
        {nav}
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
    <PhoneFrame nav={<BottomNavIfNeeded />}>
      <Routes>
        {/* Guest / QR flow — public, no account needed */}
        <Route path="/qr/:code/*" element={<GuestApp />} />
        <Route path="/t/:token"   element={<GuestOrderPage />} />

        {/* Registered customer app */}
        <Route path="/"          element={<SplashPage />} />
        <Route path="/auth"      element={<AuthPage />} />
        <Route path="/home"      element={<AuthGuard><HomePage /></AuthGuard>} />
        <Route path="/store/:storeId" element={<AuthGuard><StorePage /></AuthGuard>} />
        <Route path="/cart"      element={<AuthGuard><CartPage /></AuthGuard>} />
        <Route path="/checkout"  element={<AuthGuard><CheckoutPage /></AuthGuard>} />
        <Route path="/track/:orderId" element={<AuthGuard><TrackingPage /></AuthGuard>} />
        <Route path="/orders"    element={<AuthGuard><OrdersPage /></AuthGuard>} />
        <Route path="/profile"   element={<AuthGuard><ProfilePage /></AuthGuard>} />
        <Route path="/favorites" element={<AuthGuard><FavoritesPage /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </PhoneFrame>
  )
}

/** The bottom nav belongs to the registered-customer app only. */
function BottomNavIfNeeded() {
  const location = useLocation()
  const isCustomerApp = ['/home', '/orders', '/favorites', '/profile'].includes(location.pathname)
  if (!isCustomerApp) return null
  return <BottomNav />
}
