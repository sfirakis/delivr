import { createContext, useContext } from 'react'
import { useParams } from 'react-router-dom'

/**
 * The same shop flow serves two entry points:
 *   /store/<slug>   — the shop's own link (channel 'store', PR #5)
 *   /stores/<slug>  — reached from the Delivr Stores marketplace (channel 'app')
 * Only the URLs, the order channel and the way back differ.
 */
export interface ShopMode {
  market: boolean
  channel: 'store' | 'app'
  prefix: '/store' | '/stores'
}

const ShopModeContext = createContext<ShopMode>({ market: false, channel: 'store', prefix: '/store' })

export const ShopModeProvider = ShopModeContext.Provider

/** Mode plus the base URL of the current shop, e.g. "/stores/taverna-marina". */
export function useShopMode() {
  const mode = useContext(ShopModeContext)
  const { slug = '' } = useParams()
  return { ...mode, base: `${mode.prefix}/${slug}` }
}
