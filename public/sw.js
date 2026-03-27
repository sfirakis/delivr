// public/sw.js
// Service Worker for PWA + Push Notifications
// Handles: background sync, push events, notification clicks

const CACHE_NAME = 'delivr-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// ── Install: cache static assets ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: network-first for API, cache-first for assets ──────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin (Supabase API)
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      })
      return cached ?? networkFetch
    })
  )
})

// ── Push notification received ─────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Delivr', body: event.data.text() }
  }

  const { title, body, icon, badge, data = {} } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  icon  ?? '/icon-192.png',
      badge: badge ?? '/badge-72.png',
      tag:   data.orderId ?? 'delivr-notif',
      renotify: true,
      vibrate: [200, 100, 200],
      data: {
        url: data.orderId
          ? `/track/${data.orderId}`
          : '/',
        ...data,
      },
      actions: data.type === 'new_order'
        ? [
            { action: 'accept', title: '✓ Αποδοχή' },
            { action: 'reject', title: '✗ Απόρριψη' },
          ]
        : data.type === 'order_update' && data.status === 'on_the_way'
          ? [{ action: 'track', title: '📍 Tracking' }]
          : [],
    })
  )
})

// ── Notification click ────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const { action, notification } = event
  const url = notification.data?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', action, data: notification.data })
          return client.focus()
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url)
    })
  )
})

// ── Background sync for offline orders ────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-orders') {
    event.waitUntil(syncPendingOrders())
  }
})

async function syncPendingOrders() {
  // Read pending orders from IndexedDB and retry
  // This runs when connection is restored
  const db = await openDB()
  const pending = await db.getAll('pending-orders')

  for (const order of pending) {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      })
      if (res.ok) {
        await db.delete('pending-orders', order.id)
      }
    } catch (e) {
      console.log('Sync failed for order:', order.id, e)
    }
  }
}

// Simple IndexedDB helper
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('delivr-offline', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('pending-orders', { keyPath: 'id' })
    req.onsuccess = () => {
      const db = req.result
      resolve({
        getAll: (store) => new Promise(r => {
          const t = db.transaction(store, 'readonly')
          t.objectStore(store).getAll().onsuccess = e => r(e.target.result)
        }),
        delete: (store, key) => new Promise(r => {
          const t = db.transaction(store, 'readwrite')
          t.objectStore(store).delete(key).onsuccess = r
        }),
      })
    }
    req.onerror = reject
  })
}
