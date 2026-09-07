// ============================================================
// קבצים בצד המפיקה. היא אינה מחוברת, ולכן הכל עובר דרך
// פונקציית השרת שמאמתת את הטוקן שלה.
// ============================================================

// הכתובת של הפונקציה שנפרסה ב-Supabase (Edge Functions).
// ריק = טרם הוגדר, וממשק הקבצים פשוט לא יוצג.
export const FILES_FN = ''

export const filesEnabled = () => Boolean(FILES_FN)

async function call(body) {
  const res = await fetch(FILES_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || `שגיאה ${res.status}`)
  return j
}

export const listClientFiles = (token, jobId) =>
  call({ action: 'list', token, job_id: jobId }).then(r => r.files || [])

export const deleteClientFile = (token, jobId, id) =>
  call({ action: 'delete', token, job_id: jobId, id })

export async function uploadClientFile(token, jobId, file) {
  const fd = new FormData()
  fd.append('token', token)
  fd.append('job_id', jobId)
  fd.append('file', file)
  const res = await fetch(FILES_FN, { method: 'POST', body: fd })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 413) throw new Error('הקובץ גדול מדי (עד 10MB)')
    if (res.status === 415) throw new Error('סוג קובץ לא נתמך')
    throw new Error(j.error || `שגיאה ${res.status}`)
  }
  return j.file
}
