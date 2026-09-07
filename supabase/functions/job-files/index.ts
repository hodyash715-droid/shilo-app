// ============================================================
// שילה — קבצים בדף המפיקה.
// המפיקה אינה מחוברת לחשבון, ולכן כל גישה לאחסון עוברת כאן:
// הפונקציה מאמתת שהטוקן שלה שייך להזמנה, ורק אז פועלת.
// ============================================================

const env = (k: string) => (Deno.env.get(k) ?? '').trim()
const SUPABASE_URL = env('SUPABASE_URL')
const SERVICE_KEY  = env('SUPABASE_SERVICE_ROLE_KEY')
const BUCKET = 'job-files'
const MAX_BYTES = 10 * 1024 * 1024
const OK_MIME = /^(image\/|application\/pdf|application\/postscript|application\/illustrator|application\/zip|application\/vnd\.|text\/plain)/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const api = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(init.headers ?? {}),
    },
  })

// מאמת שההזמנה באמת שייכת לבעל הטוקן
async function owner(token: string, jobId: string) {
  const r = await api('/rest/v1/rpc/client_job_owner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_job: jobId }),
  })
  if (!r.ok) return null
  const rows = await r.json()
  return rows?.[0]?.ok ? rows[0] : null
}

const safeName = (s: string) =>
  (s || 'file').normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-80)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method === 'GET') return json({ alive: true, bucket: BUCKET })

  try {
    const ct = req.headers.get('content-type') || ''

    // ---------- העלאה ----------
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData()
      const token = String(form.get('token') || '')
      const jobId = String(form.get('job_id') || '')
      const file = form.get('file')
      if (!(file instanceof File)) return json({ error: 'no file' }, 400)

      const who = await owner(token, jobId)
      if (!who) return json({ error: 'unauthorized' }, 403)
      if (file.size > MAX_BYTES) return json({ error: 'too big', max: MAX_BYTES }, 413)
      if (!OK_MIME.test(file.type || '')) return json({ error: 'type not allowed', type: file.type }, 415)

      const path = `${jobId}/${crypto.randomUUID()}-${safeName(file.name)}`
      const up = await api(`/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: await file.arrayBuffer(),
      })
      if (!up.ok) return json({ error: 'upload failed', detail: (await up.text()).slice(0, 200) }, 500)

      const row = await api('/rest/v1/job_files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          job_id: jobId, from_client: true, author: who.client_name,
          path, name: file.name, size: file.size, mime: file.type,
        }),
      })
      if (!row.ok) return json({ error: 'record failed', detail: (await row.text()).slice(0, 200) }, 500)
      return json({ ok: true, file: (await row.json())[0] })
    }

    // ---------- רשימה / מחיקה ----------
    const body = await req.json()
    const { action, token, job_id: jobId, id } = body ?? {}
    const who = await owner(token, jobId)
    if (!who) return json({ error: 'unauthorized' }, 403)

    if (action === 'list') {
      const r = await api(`/rest/v1/job_files?job_id=eq.${jobId}&order=created_at.desc&select=*`)
      const rows = await r.json()
      // קישורי צפייה זמניים בלבד — הדלי עצמו סגור
      const signed = await Promise.all(rows.map(async (f: any) => {
        const s = await api(`/storage/v1/object/sign/${BUCKET}/${f.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresIn: 3600 }),
        })
        const j = s.ok ? await s.json() : null
        return { ...f, url: j?.signedURL ? `${SUPABASE_URL}/storage/v1${j.signedURL}` : null }
      }))
      return json({ files: signed })
    }

    if (action === 'delete') {
      // המפיקה מוחקת רק מה שהיא עצמה העלתה
      const r = await api(`/rest/v1/job_files?id=eq.${id}&job_id=eq.${jobId}&from_client=eq.true&select=*`)
      const rows = await r.json()
      if (!rows?.length) return json({ error: 'not found' }, 404)
      await api(`/storage/v1/object/${BUCKET}/${rows[0].path}`, { method: 'DELETE' })
      await api(`/rest/v1/job_files?id=eq.${id}`, { method: 'DELETE' })
      return json({ ok: true })
    }

    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500)
  }
})
