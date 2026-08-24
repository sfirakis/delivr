import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MenuItem, MenuCategory } from '@/types'

// ─── Store menu management ────────────────────────────────────
export function useMerchantMenu(storeId: string) {
  return useQuery({
    queryKey: ['merchant-menu', storeId],
    queryFn: async () => {
      const [{ data: cats }, { data: items }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('store_id', storeId).order('sort_order'),
        supabase.from('menu_items').select('*, modifier_groups:item_modifier_groups(*, modifiers:item_modifiers(*))').eq('store_id', storeId).order('sort_order'),
      ])
      return { categories: (cats ?? []) as MenuCategory[], items: (items ?? []) as MenuItem[] }
    },
    enabled: !!storeId,
  })
}

export function useToggleItemAvailability(storeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, available }: { itemId: string; available: boolean }) => {
      await supabase.from('menu_items').update({ is_available: available }).eq('id', itemId)
    },
    onMutate: async ({ itemId, available }) => {
      await qc.cancelQueries({ queryKey: ['merchant-menu', storeId] })
      qc.setQueryData(['merchant-menu', storeId], (old: any) => ({
        ...old,
        items: old?.items.map((i: MenuItem) => i.id === itemId ? { ...i, is_available: available } : i),
      }))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['merchant-menu', storeId] }),
  })
}

export function useUpsertMenuItem(storeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (item: Partial<MenuItem> & { store_id: string }) => {
      if (item.id) {
        const { data, error } = await supabase.from('menu_items').update(item).eq('id', item.id).select().single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase.from('menu_items').insert(item).select().single()
        if (error) throw error
        return data
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-menu', storeId] }),
  })
}

export function useDeleteMenuItem(storeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      await supabase.from('menu_items').delete().eq('id', itemId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-menu', storeId] }),
  })
}

// ─── Analytics ───────────────────────────────────────────────
export function useMerchantAnalytics(storeId: string, days = 7) {
  return useQuery({
    queryKey: ['merchant-analytics', storeId, days],
    queryFn: async () => {
      const from = new Date(Date.now() - days * 86400000).toISOString()
      const { data } = await supabase
        .from('orders')
        .select('id, total, status, created_at, order_items(name, quantity, subtotal)')
        .eq('store_id', storeId)
        .eq('status', 'delivered')
        .gte('created_at', from)
        .order('created_at')

      const orders = data ?? []
      const revenue = orders.reduce((s, o) => s + Number(o.total), 0)
      const avgOrder = orders.length ? revenue / orders.length : 0

      // Daily revenue for chart
      const byDay: Record<string, number> = {}
      orders.forEach(o => {
        const day = o.created_at.slice(0, 10)
        byDay[day] = (byDay[day] ?? 0) + Number(o.total)
      })

      // Top items
      const itemCounts: Record<string, { name: string; count: number; revenue: number }> = {}
      orders.forEach(o => {
        o.order_items?.forEach((i: any) => {
          if (!itemCounts[i.name]) itemCounts[i.name] = { name: i.name, count: 0, revenue: 0 }
          itemCounts[i.name].count += i.quantity
          itemCounts[i.name].revenue += Number(i.subtotal)
        })
      })
      const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 5)

      return {
        totalOrders: orders.length,
        revenue,
        avgOrder,
        dailyRevenue: Object.entries(byDay).map(([date, rev]) => ({ date, revenue: rev })),
        topItems,
      }
    },
    enabled: !!storeId,
  })
}
