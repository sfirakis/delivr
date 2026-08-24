import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { AdminStore } from '@/admin/hooks'

/**
 * Resolves which store the signed-in user manages.
 * Staff get their linked store; admins can work on any store.
 */
export function useMyStores() {
  const user = useAuthStore(s => s.user)
  const profile = useAuthStore(s => s.profile)
  const isAdmin = profile?.role === 'admin'

  return useQuery({
    queryKey: ['my-stores', user?.id, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      if (isAdmin) {
        const { data, error } = await supabase.from('stores').select('*').order('name')
        if (error) throw new Error(error.message)
        return (data ?? []) as AdminStore[]
      }
      const { data, error } = await supabase
        .from('store_users')
        .select('store_id, role, stores(*)')
        .eq('user_id', user!.id)
      if (error) throw new Error(error.message)
      return (data ?? [])
        .map(r => r.stores as unknown as AdminStore)
        .filter(Boolean)
    },
  })
}
