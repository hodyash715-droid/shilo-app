// ============================================================
// רענון נתונים בלי לאבד את מה שעל המסך.
//
// האפליקציה מתרעננת לבד כל דקה. קודם, כל בקשה שנכשלה (אין קליטה
// באולם, במחסן, במעלית) הוחלפה ברשימה ריקה — הלוח של שי התרוקן,
// ועובד ראה "החשבון לא מקושר לעובד" עד הרענון הבא.
//
// הכלל עכשיו: בקשה שנכשלה משאירה את מה שהיה. רק תשובה אמיתית
// מהשרת מחליפה את הנתונים.
// ============================================================

// עוטף בקשה: { ok: true, value } או { ok: false }
export const settle = (p) => Promise.resolve(p).then(
  value => ({ ok: true, value }),
  () => ({ ok: false }),
)

// results — אובייקט של תוצאות settle. מחזיר { updates, failed }:
// רק מה שבאמת הגיע מהשרת (מה שלא מופיע ב-updates נשאר כמו שהוא),
// ורשימת מה שנכשל.
export function mergeLoad(results) {
  const next = {}
  const failed = []
  for (const [key, r] of Object.entries(results)) {
    if (key === 'jobs' || key === 'myJobs') continue
    if (r?.ok) next[key] = Array.isArray(r.value) ? r.value : []
    else failed.push(key)
  }

  // עבודות: מנהל מקבל את הכל; עובד חסום מהטבלה ומקבל רק את
  // שמות האירועים שלו (myJobs). אם שתיהן נכשלו — משאירים.
  const j = results.jobs, mj = results.myJobs
  const jobs = j?.ok && Array.isArray(j.value) ? j.value : null
  const mine = mj?.ok && Array.isArray(mj.value) ? mj.value : null
  if (jobs && jobs.length) next.jobs = jobs
  else if (mine && mine.length) next.jobs = mine
  else if (jobs) next.jobs = mine || jobs          // תשובה אמיתית וריקה
  else failed.push('jobs')

  return { updates: next, failed }
}
