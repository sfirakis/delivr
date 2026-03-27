// ═══════════════════════════════════════════════════════════
// ProfilePage.tsx
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { LoyaltyBar, Toggle, Divider, EmptyState, Skeleton } from '@/components/ui'
import { useFavorites } from '@/hooks/useDelivr'
import StoreCard from '@/components/store/StoreCard'
import toast from 'react-hot-toast'

export function ProfilePage() {
  const { profile, signOut } = useAuthStore()
  const [notifs, setNotifs]   = useState(true)
  const [dark, setDark]       = useState(false)
  const name = profile?.full_name ?? 'Χρήστης'
  const initial = name[0]?.toUpperCase() ?? 'Α'

  const sections = [
    { title:'ΛΟΓΑΡΙΑΣΜΟΣ', items:[
      { icon:'👤', label:'Προσωπικά στοιχεία' },
      { icon:'📍', label:'Αποθηκευμένες διευθύνσεις' },
      { icon:'💳', label:'Μέθοδοι πληρωμής' },
    ]},
    { title:'ΠΡΟΤΙΜΗΣΕΙΣ', items:[
      { icon:'🔔', label:'Ειδοποιήσεις', toggle:true, val:notifs, set:setNotifs },
      { icon:'🌙', label:'Dark Mode',    toggle:true, val:dark,   set:setDark },
      { icon:'🌍', label:'Γλώσσα',       sub:'Ελληνικά' },
    ]},
    { title:'ΥΠΟΣΤΗΡΙΞΗ', items:[
      { icon:'❓', label:'Βοήθεια & Υποστήριξη' },
      { icon:'⭐', label:'Αξιολόγησε την εφαρμογή' },
      { icon:'📜', label:'Όροι & Πολιτική' },
    ]},
  ] as any[]

  return (
    <div className="screen">
      <div className="scroll-area pb-24">
        {/* Dark hero */}
        <div className="bg-ink-1 px-5 pt-14 pb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center
                            font-display font-black text-2xl text-white flex-shrink-0">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                : initial
              }
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-white">{name}</h2>
              <p className="text-ink-3 text-sm mt-0.5">
                {useAuthStore.getState().user?.email}
              </p>
              <span className="badge bg-brand-50 text-brand mt-1.5">⚡ Delivr Pro</span>
            </div>
          </div>
          <LoyaltyBar points={profile?.loyalty_points ?? 340} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 border-b border-surface-4">
          {[
            { val:'24',   label:'Παραγγελίες' },
            { val:'182€', label:'Σύνολο'       },
            { val:'4.9★', label:'Rating'       },
          ].map(s => (
            <div key={s.label} className="py-4 text-center border-r border-surface-4 last:border-0">
              <p className="font-display font-black text-xl text-brand">{s.val}</p>
              <p className="text-[11px] text-ink-2 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Menu sections */}
        {sections.map((sec: any) => (
          <div key={sec.title} className="mt-5">
            <p className="px-5 text-[11px] font-bold text-ink-3 tracking-wider mb-2">{sec.title}</p>
            <div className="bg-surface-1 border-y border-surface-4">
              {sec.items.map((item: any, i: number) => (
                <React.Fragment key={item.label}>
                  {i > 0 && <Divider className="ml-14" />}
                  <div className="flex items-center gap-4 px-5 py-3.5 cursor-pointer">
                    <span className="text-xl w-8 text-center">{item.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium text-[15px]">{item.label}</p>
                      {item.sub && <p className="text-xs text-ink-2 mt-0.5">{item.sub}</p>}
                    </div>
                    {item.toggle
                      ? <Toggle checked={item.val} onChange={item.set} />
                      : <span className="text-ink-3 text-lg">›</span>
                    }
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}

        <div className="px-5 mt-6">
          <button className="btn btn-lg border-[1.5px] border-brand bg-brand-50 text-brand"
                  onClick={() => { signOut(); toast('Αποσυνδέθηκες') }}>
            Αποσύνδεση
          </button>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════
// FavoritesPage.tsx
// ═══════════════════════════════════════════════════════════

export function FavoritesPage() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const { data: favs, isLoading } = useFavorites(user?.id ?? '')

  return (
    <div className="screen">
      <div className="h-11 flex-shrink-0" />
      <div className="px-5 pt-2 pb-4 flex-shrink-0">
        <h1 className="font-display font-black text-2xl">Αγαπημένα ❤️</h1>
      </div>

      <div className="scroll-area px-5 pb-24 space-y-4">
        {isLoading && [1,2].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        {!isLoading && (!favs || favs.length === 0) && (
          <EmptyState emoji="♡" title="Δεν έχεις αγαπημένα ακόμα"
            subtitle="Πάτησε ♡ σε ένα κατάστημα για να το αποθηκεύσεις"
            action="Εξερεύνησε καταστήματα" onAction={() => nav('/home')} />
        )}
        {favs?.map(store => <StoreCard key={store.id} store={store} />)}
      </div>
    </div>
  )
}
