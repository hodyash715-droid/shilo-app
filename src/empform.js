// ============================================================
// נרמול כרטיס עובד בין המסד לטופס.
//
// המסד מחזיר null בשדות ריקים, והטופס מצפה למחרוזת. בלי הנרמול:
//   · value={null} מוציא את השדה משליטת React
//   · שכר ריק נשמר חזרה כ-0 במקום "לא נקבע"
//   · role/phone ריקים הפילו את השמירה על null.trim()
//
// מופרד מהרכיב כדי שיהיה אפשר לבדוק אותו — אותה סיבה כמו jobmap.js.
// ============================================================

export const blankEmp = () => ({
  name: '', role: '', phone: '', rate: '', active: true, is_manager: false,
})

export const toForm = (emp) => ({
  ...blankEmp(),
  ...emp,
  name: emp?.name ?? '',
  role: emp?.role ?? '',
  phone: emp?.phone ?? '',
  rate: emp?.rate ?? '',
})

// '' או null = לא נקבע. 0 הוא שכר אמיתי ונשמר כמו שהוא.
export const rateOf = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// ---------- איפוס סיסמה ----------
// אותו כלל כמו בהצטרפות וכמו ב-supabase/reset-password.sql.
// מחזיר הודעת שגיאה, או '' כשהסיסמה בסדר.
export const passwordProblem = (p) => {
  const s = String(p ?? '')
  if (!s.trim()) return 'צריך להקליד סיסמה חדשה'
  if (s.length < 6) return 'הסיסמה חייבת להיות לפחות 6 תווים'
  return ''
}

// שגיאה מהשרת → משפט שאפשר לפעול לפיו
export const resetErrorText = (e) => {
  const m = String(e?.message || e || '')
  if (/manager_set_password|function .* does not exist|PGRST202/i.test(m))
    return 'האיפוס עוד לא הופעל. צריך להריץ פעם אחת את supabase/reset-password.sql ב-Supabase.'
  if (/fetch|network|Failed to/i.test(m)) return 'אין חיבור לשרת. נסה שוב.'
  return m || 'האיפוס נכשל'
}
