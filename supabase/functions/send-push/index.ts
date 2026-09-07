// ============================================================
// שילה — שליחת Push. מופעל מ-Database Webhook על notifications.
// מקבל { type:'INSERT', record:{...} }, מוצא את המכשירים
// הרלוונטיים ושולח. מנוי מת (410/404) נמחק אוטומטית.
// ============================================================

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:shai@shilo.app'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

const db = createClient(SUPABASE_URL, SERVICE_KEY)

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const rec = body?.record
    if (!rec?.id) return new Response('no record', { status: 200 })

    const { data: targets, error } = await db.rpc('push_targets', { p_notification: rec.id })
    if (error) return new Response('rpc: ' + error.message, { status: 500 })
    if (!targets?.length) return new Response('no devices', { status: 200 })

    const payload = JSON.stringify({
      title: rec.title,
      body: rec.body ?? '',
      tag: rec.id,
      url: './',
    })

    let sent = 0
    const dead: string[] = []

    await Promise.all(targets.map(async (t: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          payload,
        )
        sent++
      } catch (e: any) {
        // 410 Gone / 404 = המשתמש הסיר את האפליקציה או ניקה הרשאות
        if (e?.statusCode === 410 || e?.statusCode === 404) dead.push(t.endpoint)
      }
    }))

    if (dead.length) await db.from('push_subs').delete().in('endpoint', dead)

    return new Response(JSON.stringify({ sent, removed: dead.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response('error: ' + (e as Error).message, { status: 500 })
  }
})
