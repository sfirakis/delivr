import { useState } from 'react'
import { useNotificationBell } from '@/hooks/useNotifications'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { el } from 'date-fns/locale'
import type { Notification } from '@/types'

const TYPE_ICON: Record<string, string> = {
  order_update:   '📦',
  promo:          '🏷️',
  loyalty:        '🏆',
  system:         '📢',
  new_order:      '🔔',
  new_assignment: '🛵',
}

function NotifItem({ notif, onRead, onNavigate }: {
  notif: Notification
  onRead: (id: string) => void
  onNavigate: () => void
}) {
  const handleClick = () => {
    onRead(notif.id)
    if (notif.data?.orderId) {
      onNavigate()
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`flex gap-3 px-5 py-4 cursor-pointer transition-colors
        ${notif.is_read ? 'bg-surface-1' : 'bg-brand-50'}`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0
        ${notif.is_read ? 'bg-surface-2' : 'bg-white shadow-sm'}`}>
        {TYPE_ICON[notif.type] ?? '📬'}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${notif.is_read ? 'font-normal' : 'font-semibold'}`}>
          {notif.title}
        </p>
        <p className="text-xs text-ink-2 mt-0.5 line-clamp-2">{notif.body}</p>
        <p className="text-[11px] text-ink-3 mt-1">
          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: el })}
        </p>
      </div>
      {!notif.is_read && (
        <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0 mt-2" />
      )}
    </div>
  )
}

export default function NotificationBell() {
  const { user }  = useAuthStore()
  const navigate  = useNavigate()
  const [open, setOpen] = useState(false)

  const { notifications, unreadCount, hasUnread, markAllRead, markOneRead } =
    useNotificationBell(user?.id ?? '')

  if (!user) return null

  return (
    <>
      {/* Bell button */}
      <button
        className="relative btn-icon"
        onClick={() => setOpen(o => !o)}
        aria-label="Ειδοποιήσεις"
      >
        <span className="text-xl">🔔</span>
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-brand
                           text-white text-[10px] font-bold rounded-full flex items-center
                           justify-center px-1 animate-scale-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel overlay */}
      {open && (
        <div className="absolute inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute top-0 left-0 right-0 bg-surface-1 shadow-float
                          rounded-b-3xl overflow-hidden animate-slide-up max-h-[75vh] flex flex-col"
               onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-4 flex-shrink-0">
              <h3 className="font-display font-bold text-lg">Ειδοποιήσεις</h3>
              <div className="flex items-center gap-3">
                {hasUnread && (
                  <button className="text-xs font-semibold text-brand" onClick={markAllRead}>
                    Όλα ως αναγνωσμένα
                  </button>
                )}
                <button className="btn-icon w-8 h-8 text-sm" onClick={() => setOpen(false)}>✕</button>
              </div>
            </div>

            {/* Notifications list */}
            <div className="overflow-y-auto flex-1 divide-y divide-surface-4">
              {notifications.length === 0 && (
                <div className="flex flex-col items-center py-12 gap-3 text-ink-3">
                  <span className="text-4xl">🔕</span>
                  <p className="text-sm font-medium">Δεν υπάρχουν ειδοποιήσεις</p>
                </div>
              )}
              {notifications.map(notif => (
                <NotifItem
                  key={notif.id}
                  notif={notif}
                  onRead={markOneRead}
                  onNavigate={() => {
                    setOpen(false)
                    if (notif.data?.orderId) navigate(`/track/${notif.data.orderId}`)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
