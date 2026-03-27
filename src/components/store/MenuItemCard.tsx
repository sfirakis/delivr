import { useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { QtyStepper } from '@/components/ui'
import type { MenuItem, Store } from '@/types'

interface MenuItemCardProps {
  item: MenuItem
  store: Store
}

export default function MenuItemCard({ item, store }: MenuItemCardProps) {
  const [showSheet, setShowSheet] = useState(false)
  const { items: cartItems, addItem, updateQuantity } = useCartStore()

  const cartEntry = cartItems.find(ci => ci.menuItem.id === item.id)
  const qty = cartEntry?.quantity ?? 0

  const handleAdd = () => {
    if (item.modifier_groups && item.modifier_groups.length > 0) {
      setShowSheet(true)
    } else {
      addItem(item, store)
    }
  }

  return (
    <>
      <div className="flex gap-3 py-3.5 border-b border-surface-4 last:border-0">
        {/* Image / Emoji */}
        <div className="w-[88px] h-[88px] rounded-xl bg-surface-2 flex items-center justify-center
                        text-[36px] flex-shrink-0 overflow-hidden">
          {item.image_url
            ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
            : <span>{item.emoji ?? '🍽️'}</span>
          }
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[15px] leading-tight">{item.name}</span>
              {item.is_popular && <span className="badge badge-brand text-[10px]">🔥</span>}
              {item.is_new     && <span className="badge bg-blue-100 text-blue-600 text-[10px]">Νέο</span>}
              {item.is_vegan   && <span className="badge badge-green text-[10px]">🌱</span>}
            </div>
            {item.description && (
              <p className="text-xs text-ink-2 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
            )}
            {item.allergens.length > 0 && (
              <p className="text-[11px] text-warning mt-1">⚠️ {item.allergens.join(', ')}</p>
            )}
            {item.calories && (
              <p className="text-[11px] text-ink-3 mt-0.5">🔥 {item.calories} kcal</p>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="font-display font-bold text-base text-brand">
              {item.price.toFixed(2)}€
              {item.is_weight_based && <span className="text-xs font-normal text-ink-3">/{item.unit}</span>}
            </span>

            {qty === 0 ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAdd}
                disabled={!item.is_available}
              >
                {item.is_available ? '+ Προσθήκη' : 'Μη διαθέσιμο'}
              </button>
            ) : (
              <QtyStepper
                value={qty}
                onChange={(v) => updateQuantity(item.id, v)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modifiers sheet (simplified) */}
      {showSheet && (
        <div className="sheet-overlay" onClick={() => setShowSheet(false)}>
          <div className="sheet p-5" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="font-display font-bold text-lg mb-4">{item.name}</h3>
            {item.modifier_groups?.map(group => (
              <div key={group.id} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm">{group.name}</p>
                  {group.is_required && <span className="badge badge-brand">Υποχρεωτικό</span>}
                </div>
                {group.modifiers.map(mod => (
                  <label key={mod.id} className="flex items-center justify-between py-2.5 border-b border-surface-4 last:border-0 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input type={group.max_select > 1 ? 'checkbox' : 'radio'} name={group.id} className="accent-brand" />
                      <span className="text-sm">{mod.name}</span>
                    </div>
                    {mod.price > 0 && <span className="text-sm text-brand font-semibold">+{mod.price.toFixed(2)}€</span>}
                  </label>
                ))}
              </div>
            ))}
            <button className="btn btn-primary btn-lg mt-4" onClick={() => { addItem(item, store); setShowSheet(false) }}>
              Προσθήκη στο καλάθι — {item.price.toFixed(2)}€
            </button>
          </div>
        </div>
      )}
    </>
  )
}
