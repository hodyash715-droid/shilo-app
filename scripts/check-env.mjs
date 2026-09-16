// ============================================================
// שומר סף לבנייה.
//
// 16.9.2026: בנייה שנעשתה בלי .env.local פורסמה לאתר החי, והאפליקציה
// עלתה עם המסך "המערכת עדיין לא מחוברת". הקוד היה תקין לגמרי — רק
// פרטי החיבור לא נכנסו לחבילה, ושום בדיקה לא תפסה את זה כי הבדיקות
// רצות על המקור ולא על מה שנבנה.
//
// מי שבונה בלי המפתחות יעצר כאן, לפני שהוא מספיק להעלות.
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const NEEDED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
const ROOT = path.resolve(import.meta.dirname, '..')

// Vite טוען .env.local, .env.production.local, .env וכו'. מספיק שהמשתנה
// מוגדר באחד מהם או בסביבה עצמה (כמו ב-CI).
const fromFiles = {}
for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  const p = path.join(ROOT, name)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && m[2].trim()) fromFiles[m[1]] = true
  }
}

const missing = NEEDED.filter(k => !process.env[k] && !fromFiles[k])

if (missing.length) {
  console.error('')
  console.error('  ✖ הבנייה נעצרה: חסרים פרטי החיבור ל-Supabase')
  console.error('')
  console.error(`    ${missing.join('\n    ')}`)
  console.error('')
  console.error('    בלי אלה האפליקציה תעלה עם "המערכת עדיין לא מחוברת",')
  console.error('    גם אם כל הבדיקות עוברות — הן בודקות את המקור, לא את החבילה.')
  console.error('')
  console.error('    התיקון: צור shilo-app/.env.local עם שתי השורות האלה')
  console.error('    (הערכים נמצאים ב-Supabase ← Project Settings ← API):')
  console.error('')
  console.error('      VITE_SUPABASE_URL=https://<project>.supabase.co')
  console.error('      VITE_SUPABASE_ANON_KEY=<publishable key>')
  console.error('')
  console.error('    הקובץ ב-.gitignore ולא נדחף — הוא מקומי לכל מכונה.')
  console.error('')
  process.exit(1)
}
