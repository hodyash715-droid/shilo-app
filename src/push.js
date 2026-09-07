// ============================================================
// הרשמה להתראות Push. הכל "רך": אם משהו לא נתמך או נכשל,
// האפליקציה ממשיכה לעבוד והפעמון הפנימי לא מושפע.
// ============================================================

import { supabase } from './supabase.js'

// המפתח הציבורי של VAPID — ציבורי במהות, מותר שיהיה בקוד.
export const VAPID_PUBLIC = 'BBsG6eGyuEQIm6oNVmesbqErPqPcfmGrNYpoUuCU2Cr5vwy-mb2DlbcVB0SOx4ddmQdjBbVW5S1ugGIBiKLoVF0'

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

// באייפון Push עובד רק כשהאפליקציה מותקנת למסך הבית
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent || '')
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
export const iosNeedsInstall = () => isIOS() && !isStandalone()

const b64ToU8 = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
const u8ToB64 = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function registerSW() {
  if (!pushSupported()) return null
  try { return await navigator.serviceWorker.register('./sw.js') }
  catch { return null }
}

// נרשמים ושומרים בשרת. מחזיר { ok } או { ok:false, reason }
export async function subscribePush({ employeeId = null, isManager = false } = {}) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }
  if (iosNeedsInstall()) return { ok: false, reason: 'ios-install' }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: perm }

  const reg = await registerSW()
  if (!reg) return { ok: false, reason: 'sw-failed' }
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToU8(VAPID_PUBLIC),
    })
  }

  const json = sub.toJSON()
  const row = {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh || u8ToB64(sub.getKey('p256dh')),
    auth: json.keys?.auth || u8ToB64(sub.getKey('auth')),
    employee_id: employeeId,
    is_manager: isManager,
  }
  const { error } = await supabase.from('push_subs').upsert(row, { onConflict: 'endpoint' })
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}

export async function unsubscribePush() {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  try { await supabase.from('push_subs').delete().eq('endpoint', sub.endpoint) } catch {}
  try { await sub.unsubscribe() } catch {}
}

export async function pushState() {
  if (!pushSupported()) return 'unsupported'
  if (iosNeedsInstall()) return 'ios-install'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub && Notification.permission === 'granted') return 'on'
  return 'off'
}
