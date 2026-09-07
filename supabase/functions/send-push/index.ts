// ============================================================
// שילה — שליחת Push. מופעל מ-Database Webhook על notifications.
// אפס תלויות: הצפנת RFC 8291 וחתימת VAPID ממומשות כאן ב-WebCrypto,
// כי ספריות npm של Node לא עולות באמינות ב-Deno.
// ============================================================

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:shai@shilo.app'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// ---------- base64url ----------
const b64uToBytes = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(b, c => c.charCodeAt(0))
}
const bytesToB64u = (b: ArrayBuffer | Uint8Array): string => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b)
  let s = ''
  for (const x of u) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const utf8 = (s: string) => new TextEncoder().encode(s)
const concat = (...arrs: Uint8Array[]) => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0))
  let o = 0
  for (const a of arrs) { out.set(a, o); o += a.length }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8)
  return new Uint8Array(bits)
}

// ---------- חתימת VAPID (JWT ES256) ----------
async function vapidAuth(endpoint: string) {
  const aud = new URL(endpoint).origin
  const header = bytesToB64u(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = bytesToB64u(utf8(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT,
  })))
  const signingInput = `${header}.${payload}`

  const pub = b64uToBytes(VAPID_PUBLIC)          // 65 בתים, נקודה לא דחוסה
  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256',
    x: bytesToB64u(pub.slice(1, 33)),
    y: bytesToB64u(pub.slice(33, 65)),
    d: VAPID_PRIVATE,
    ext: true,
  }
  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(signingInput))
  return `vapid t=${signingInput}.${bytesToB64u(sig)}, k=${VAPID_PUBLIC}`
}

// ---------- הצפנת המטען (aes128gcm, RFC 8291) ----------
async function encrypt(p256dh: string, auth: string, payload: string) {
  const uaPublic = b64uToBytes(p256dh)
  const authSecret = b64uToBytes(auth)

  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256))

  const keyInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, shared, keyInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12)

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const plaintext = concat(utf8(payload), new Uint8Array([2]))   // 0x02 = סוף רשומה
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, aes, plaintext))

  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ct)
}

async function sendOne(t: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const body = await encrypt(t.p256dh, t.auth, payload)
  return await fetch(t.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuth(t.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
    },
    body,
  })
}

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  // בדיקת חיים
  if (req.method === 'GET') {
    return json({
      alive: true,
      env: {
        url: !!SUPABASE_URL, service: !!SERVICE_KEY,
        vapidPublic: !!VAPID_PUBLIC, vapidPrivate: !!VAPID_PRIVATE, subject: VAPID_SUBJECT,
      },
    })
  }

  try {
    const rec = (await req.json())?.record
    if (!rec?.id) return json({ skipped: 'no record' })

    const r = await rest('rpc/push_targets', { method: 'POST', body: JSON.stringify({ p_notification: rec.id }) })
    if (!r.ok) return json({ error: 'push_targets', detail: await r.text() }, 500)
    const targets = await r.json()
    if (!targets?.length) return json({ sent: 0, note: 'no devices' })

    const payload = JSON.stringify({ title: rec.title, body: rec.body ?? '', tag: rec.id, url: './' })

    let sent = 0
    const dead: string[] = []
    const errors: string[] = []

    await Promise.all(targets.map(async (t: any) => {
      try {
        const res = await sendOne(t, payload)
        if (res.ok) sent++
        else if (res.status === 404 || res.status === 410) dead.push(t.endpoint)
        else errors.push(`${res.status}: ${(await res.text()).slice(0, 120)}`)
      } catch (e) { errors.push(String(e).slice(0, 160)) }
    }))

    for (const ep of dead) {
      await rest(`push_subs?endpoint=eq.${encodeURIComponent(ep)}`, { method: 'DELETE' })
    }

    return json({ sent, removed: dead.length, errors })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
