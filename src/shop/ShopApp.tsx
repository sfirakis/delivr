import { Routes, Route, Navigate } from 'react-router-dom'
import ShopMenuPage from './pages/ShopMenuPage'
import ShopCartPage from './pages/ShopCartPage'
import ShopCheckoutPage from './pages/ShopCheckoutPage'

/**
 * A store's own ordering link: /store/<slug>. No QR code, no property — the
 * customer types where they live. This is what a shop that is not one of our
 * partner properties' neighbours can be sold on its own.
 */
export default function ShopApp() {
  return (
    <Routes>
      <Route index element={<ShopMenuPage />} />
      <Route path="cart" element={<ShopCartPage />} />
      <Route path="checkout" element={<ShopCheckoutPage />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  )
}
