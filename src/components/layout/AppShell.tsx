import { useLocation, useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'

const NAV_ITEMS = [
  { path: '/home',      icon: '🏠', label: 'Αρχικό'      },
  { path: '/orders',    icon: '📦', label: 'Παραγγελίες' },
  { path: '/favorites', icon: '♡',  label: 'Αγαπημένα'   },
  { path: '/profile',   icon: '👤', label: 'Προφίλ'      },
]

/** Bottom tab bar for the registered-customer app. */
export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const itemCount = useCartStore((s) => s.itemCount())

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map((item) => {
        const active = location.pathname === item.path
        return (
          <button
            key={item.path}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <div className="nav-item-icon relative">
              {item.icon}
              {item.path === '/home' && itemCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-brand text-white
                  text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </div>
            <span className="nav-item-label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNav
