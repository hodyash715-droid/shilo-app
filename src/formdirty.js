// ============================================================
// האם בטופס יש שינויים שלא נשמרו.
//
// נגיעה בטעות באזור הכהה סביב חלון העבודה סגרה אותו, וכל מה
// שהוקלד נעלם. עכשיו סוגרים בלי לשאול רק כשאין מה לאבד.
// ריק, null ו-undefined נחשבים אותו דבר — שדה שנפתח ונסגר
// בלי שהוקלד בו כלום אינו שינוי.
// ============================================================

const norm = (v) => {
  if (v === undefined || v === null || v === '') return null
  if (Array.isArray(v)) return v.map(norm)
  if (typeof v === 'object') {
    const o = {}
    for (const k of Object.keys(v).sort()) {
      const n = norm(v[k])
      if (n !== null) o[k] = n
    }
    return o
  }
  return v
}

export const isDirty = (initial, current) =>
  JSON.stringify(norm(initial)) !== JSON.stringify(norm(current))
