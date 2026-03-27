import { useNavigate } from 'react-router-dom'
import { StarRating } from '@/components/ui'
import type { Store } from '@/types'

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: '🍴', cafe: '☕', burger: '🍔', pizza: '🍕',
  sushi: '🍣', healthy: '🥗', supermarket: '🛒', pharmacy: '💊', other: '🏪'
}

interface StoreCardProps {
  store: Store
  variant?: 'default' | 'compact'
}

export default function StoreCard({ store, variant = 'default' }: StoreCardProps) {
  const navigate = useNavigate()
  const emoji = store.emoji ?? CATEGORY_EMOJI[store.category] ?? '🏪'

  if (variant === 'compact') {
    return (
      <div className="store-card flex gap-3 p-3 min-w-[200px]" onClick={() => navigate(`/store/${store.id}`)}>
        <div className="w-16 h-16 rounded-xl bg-surface-2 flex items-center justify-center text-3xl flex-shrink-0">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm truncate">{store.name}</p>
          <StarRating rating={store.rating} />
          <p className="text-xs text-ink-3 mt-0.5">⏱ {store.avg_delivery_time}'</p>
        </div>
      </div>
    )
  }

  return (
    <div className="store-card animate-fade-in-up" onClick={() => navigate(`/store/${store.id}`)}>
      {/* Cover */}
      <div className="relative h-36 bg-surface-2 flex items-center justify-center text-6xl overflow-hidden">
        {store.cover_url
          ? <img src={store.cover_url} alt={store.name} className="absolute inset-0 w-full h-full object-cover" />
          : <span>{emoji}</span>
        }
        {/* Overlays */}
        {store.is_promoted && (
          <span className="badge badge-brand absolute top-2.5 left-3">⚡ Promoted</span>
        )}
        {store.discount_pct && (
          <span className="badge bg-brand text-white absolute top-2.5 left-3">
            -{store.discount_pct}% OFF
          </span>
        )}
        {!store.is_open && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-display font-bold text-lg">Κλειστό</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5">
        <div className="flex items-start justify-between mb-1.5">
          <div>
            <h3 className="font-display font-bold text-base leading-tight">{store.name}</h3>
            <p className="text-xs text-ink-2 mt-0.5">{store.cuisine_tags.join(' · ')}</p>
          </div>
          <StarRating rating={store.rating} count={store.review_count} />
        </div>

        <div className="flex items-center gap-3 text-xs text-ink-2 mt-2">
          <span>⏱ {store.avg_delivery_time}'</span>
          <span className="text-ink-4">·</span>
          {store.delivery_fee === 0
            ? <span className="text-success font-semibold">✓ Δωρεάν παράδοση</span>
            : <span>{store.delivery_fee.toFixed(2)}€ delivery</span>
          }
          <span className="text-ink-4">·</span>
          <span>Min {store.min_order_amount}€</span>
        </div>

        {store.cuisine_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {store.cuisine_tags.slice(0,3).map(tag => (
              <span key={tag} className="badge badge-gray">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
