import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import AppShell from '@/components/layout/AppShell'
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

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return null
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

export default function App() {
  const { initialize } = useAuthStore()
  useEffect(() => { initialize() }, [initialize])
  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center">
      <AppShell>
        <Routes>
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
          <Route path="/merchant/*" element={<AuthGuard><MerchantApp /></AuthGuard>} />
          <Route path="/driver/*"   element={<AuthGuard><DriverApp /></AuthGuard>} />
          <Route path="/admin/*"    element={<AuthGuard><AdminApp /></AuthGuard>} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AppShell>
    </div>
  )
}
