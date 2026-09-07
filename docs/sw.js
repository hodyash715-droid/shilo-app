// ============================================================
// שילה — Service Worker להתראות בלבד.
// אין כאן שום קאש ואין מטפל fetch, בכוונה: האפליקציה תמיד
// נטענת מהרשת, ואי אפשר להיתקע עם גרסה ישנה.
// ============================================================

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = { title: event.data?.text() || 'שילה' } }
  const title = d.title || 'שילה'
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: d.tag || undefined,
    dir: 'rtl',
    lang: 'he',
    data: { url: d.url || './' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = event.notification.data?.url || './'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if (c.url.includes('/shilo-app') && 'focus' in c) return c.focus()
    }
    if (self.clients.openWindow) return self.clients.openWindow(target)
  })())
})
