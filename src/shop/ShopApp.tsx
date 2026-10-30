import { Routes, Route, Navigate } from 'react-router-dom'
import ShopMenuPage from './pages/ShopMenuPage'
import ShopCartPage from './pages/ShopCartPage'
import ShopCheckoutPage from './pages/ShopCheckoutPage'
import { ShopModeProvider } from './shopMode'

/**
 * A store's ordering flow. Mounted twice:
 *   /store/<slug>   — the store's own link (no QR, no property; the customer
 *                     types where they live). Orders carry channel 'store'.
 *   /stores/<slug>  — the same store reached from the Delivr Stores
 *                     marketplace home. Orders carry channel 'app'.
 */
export default function ShopApp({ market = false }: { market?: boolean }) {
  return (
    <ShopModeProvider value={market
      ? { market: true, channel: 'app', prefix: '/stores' }
      : { market: false, channel: 'store', prefix: '/store' }}>
      <Routes>
        <Route index element={<ShopMenuPage />} />
        <Route path="cart" element={<ShopCartPage />} />
        <Route path="checkout" element={<ShopCheckoutPage />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </ShopModeProvider>
  )
}
