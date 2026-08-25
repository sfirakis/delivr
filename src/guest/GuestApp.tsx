import { Routes, Route, Navigate } from 'react-router-dom'
import PropertyHomePage from './pages/PropertyHomePage'
import GuestStorePage from './pages/GuestStorePage'
import GuestCartPage from './pages/GuestCartPage'
import GuestCheckoutPage from './pages/GuestCheckoutPage'

/** Guest flow reached by scanning the QR code inside a property. No login. */
export default function GuestApp() {
  return (
    <Routes>
      <Route index element={<PropertyHomePage />} />
      <Route path="store/:storeId" element={<GuestStorePage />} />
      <Route path="cart" element={<GuestCartPage />} />
      <Route path="checkout" element={<GuestCheckoutPage />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  )
}
