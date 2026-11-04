// ============================================================
// כניסה בשם העובד.
//
// שם המשתמש של עובד הוא השם שבכרטיס שלו — "אדם" או "אדם כהן".
// מאחורי הקלעים החשבון עדיין <קוד>@shilo.app (כך נוצר בהצטרפות),
// והפונקציה login_email במסד מתרגמת שם לחשבון. אותו כלל בדיוק
// כתוב כאן וב-supabase/login-name.sql — הבדיקות שומרות שהם זהים.
//
//   1. שם מלא תואם לעובד מחובר אחד → הוא
//   2. אחרת שם פרטי (המילה הראשונה) תואם לעובד מחובר אחד → הוא
//   3. אחרת (אין, או שניים באותו שם) → אין התאמה, ונופלים לקוד
// ============================================================

// רווחים מיותרים ואותיות גדולות/קטנות לא משנים
export const normName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
export const firstName = (s) => normName(s).split(' ')[0] || ''

// העובד שהשם הזה מכניס, או null. רק עובדים שכבר הצטרפו (user_id).
export function resolveLogin(employees, input) {
  const q = normName(input)
  if (!q) return null
  const linked = (employees || []).filter(e => e.user_id)
  const full = linked.filter(e => normName(e.name) === q)
  if (full.length === 1) return full[0]
  if (full.length > 1) return null
  const first = linked.filter(e => firstName(e.name) === q)
  return first.length === 1 ? first[0] : null
}

// מה להציג בכרטיס: באיזה שם העובד נכנס, והאם יש התנגשות.
// others = כל העובדים (כולל העובד עצמו או בלעדיו — לא משנה).
export function loginHint(emp, others) {
  const rest = (others || []).filter(e => e.id !== emp.id && e.user_id)
  const me = { ...emp, user_id: emp.user_id || 'self' }
  const all = [...rest, me]
  const fullTaken = rest.some(e => normName(e.name) === normName(emp.name))
  const byFirst = resolveLogin(all, firstName(emp.name))
  return {
    full: emp.name.trim().replace(/\s+/g, ' '),
    // "אדם" לבד מספיק רק אם אין עוד אדם, ואם השם לא כבר מילה אחת
    first: byFirst?.id === emp.id && firstName(emp.name) !== normName(emp.name)
      ? emp.name.trim().split(/\s+/)[0] : null,
    clash: fullTaken,
  }
}
