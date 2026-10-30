/**
 * "My orders" without an account: the tracking links of orders placed from
 * this device, kept in localStorage. Nothing personal goes to the server, and
 * the tracking page itself is already public by its unguessable token.
 */
export interface MyOrder {
  token: string
  number: string
  store: string
  total: number
  at: string
}

const KEY = 'delivr_my_orders'
const MAX = 30

export function listMyOrders(): MyOrder[] {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(rows) ? rows.filter(r => r && typeof r.token === 'string') : []
  } catch { return [] }
}

export function rememberOrder(order: MyOrder) {
  try {
    const rows = [order, ...listMyOrders().filter(r => r.token !== order.token)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(rows))
  } catch { /* private mode: the order still went through */ }
}
