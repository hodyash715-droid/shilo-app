// ============================================================
// תבניות: הצורה מוכנה לפני שנכנסים לאולפן.
//
// שי מבקש מידה אחת ומקבל קיר מורכב — רוחבים, גבהים, וגם הסידור
// עצמו (כנפיים פתוחות, כותרת מורמת). משם רק מכוונים, לא בונים
// מאפס.
//
// כל תבנית מחזירה { rows, layout, height }:
//   rows   — [{ width, height }] לכל קוליסה. height ריק = גובה הקיר.
//   layout — { [k]: { deg, dy, dx, dz } }, בדיוק כמו סידור ידני.
// ============================================================

import { LIMITS, BALLAST } from './rules.js'
import { arrangeSymmetric } from './wall.js'

const r1 = n => Math.round(n * 10) / 10
const clampW = n => Math.max(1, Math.min(LIMITS.maxWidth, Math.round(n)))

// חלוקת מידה לקוליסות שוות ככל האפשר, כולן בתוך המקסימום.
// העודף מתחלק אחד־אחד ולא נערם על האחרונה, ואז מסודר סימטרית.
const split = (total) => {
  const t = Math.round(Number(total))
  if (!(t > 0)) return []
  const n = Math.max(1, Math.ceil(t / LIMITS.maxWidth))
  const base = Math.floor(t / n), extra = t - base * n
  return arrangeSymmetric(Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0)))
}

export const TEMPLATES = [
  {
    id: 'straight',
    name: 'קיר ישר',
    hint: 'מידה אחת, מחולקת לקוליסות שוות',
    fields: ['width', 'height'],
    build: ({ width, height }) => ({
      height,
      rows: split(width).map(w => ({ width: w })),
      layout: {},
    }),
  },

  {
    id: 'wings',
    name: 'קיר עם כנפיים',
    hint: 'קיר מרכזי, וקוליסה מקופלת ב-90° בכל צד',
    fields: ['width', 'height', 'wing'],
    build: ({ width, height, wing }) => {
      const w = clampW(wing || 60)
      const middle = split(Math.max(1, Math.round(width) - 2 * w))
      const rows = [{ width: w }, ...middle.map(x => ({ width: x })), { width: w }]
      // שתי הכנפיים מתקפלות לאותו צד — צורת ח, כמו בתצלום מהאתר.
      // הסימנים הפוכים בכוונה: כל כנף מסתובבת סביב הקצה הפנימי שלה,
      // ואותו סימן בשתיהן היה מקפל אותן לשני צדדים (צורת Z).
      const layout = { 1: { deg: 90 }, [rows.length]: { deg: -90 } }
      return { height, rows, layout }
    },
  },

  {
    id: 'gate',
    name: 'שער',
    hint: 'שתי רגליים וכותרת מורמת ביניהן',
    fields: ['width', 'height', 'leg', 'header'],
    build: ({ width, height, leg, header }) => {
      const L = clampW(leg || 60)
      const H = Math.max(10, Math.round(header || 60))
      const opening = Math.max(1, Math.round(width) - 2 * L)
      const middle = split(opening)
      const rows = [
        { width: L },
        ...middle.map(x => ({ width: x, height: H })),
        { width: L },
      ]
      // הכותרת עולה עד שראשה מתיישר עם ראש הרגליים.
      const dy = r1(Math.max(0, Number(height) - H))
      const layout = {}
      for (let i = 2; i < rows.length; i++) layout[i] = { dy }
      return { height, rows, layout }
    },
  },

  {
    id: 'gate-free',
    name: 'שער עצמאי',
    hint: 'שתי רגליים חלולות עם שקי חול בפנים — עומד בלי עיגון',
    fields: ['width', 'height', 'leg', 'depth', 'inner', 'header', 'bags'],
    // כל רגל היא תיבה סגורה של ארבע קוליסות:
    //   חזית (קבלת קהל) · גב (יציאה) · צלע חיצונית · צלע פנימית
    // הצלע הפנימית — זו שפונה אל הפתח — נמוכה יותר. שי, 16.9.2026.
    // מעל הפתח: חזית, גב, ועוד אחת שוכבת שסוגרת מלמעלה כדי שלא
    // ייראה עץ חשוף מלמעלה. בלעדיה רואים עץ — לפעמים מסתפקים בשתיים.
    build: ({ width, height, leg, depth, inner, header, bags }) => {
      // height הוא גובה השער כולו, כולל השוכבת שסוגרת מלמעלה.
      // "שער 3 מטר" צריך לצאת 3 מטר, ולא 3.04.
      // 6 = הגיבן של השוכבת (שתי לטות, 2 ס״מ) ועוד הפרופיל (4). נמדד.
      const capT = 6
      const TOTAL = Math.max(20, Math.round(height || 240))
      const H = Math.max(10, TOTAL - capT)    // גובה הרגליים
      // קוליסה אחת לא עוברת את המקסימום. רגל גבוהה יותר תיחסם, ולכן
      // אנחנו אומרים את זה כאן — ולא נותנים לשער לצאת חסר חלקים בשקט.
      const tooTall = H > LIMITS.maxHeight
      const L = clampW(leg || 60)
      const D = clampW(depth || 60)
      const IN = Math.max(10, Math.min(H, Math.round(inner || Math.round(H * 0.75))))
      const HD = Math.max(10, Math.round(header || 60))
      const opening = Math.max(1, Math.round(width) - 2 * L)
      const half = Math.round(width) / 2

      const rows = [], layout = {}
      const put = (row, place) => { rows.push(row); layout[rows.length] = place }

      // שתי רגליים. legX הוא מרכז הרגל; הצלעות יושבות על קצוותיה.
      for (const side of [-1, 1]) {
        const legX = side * (half - L / 2)
        put({ width: L }, { at: { x: legX, z: 0 } })                              // חזית
        put({ width: L }, { at: { x: legX, z: -D } })                             // גב
        put({ width: D }, { deg: 90, at: { x: legX + side * L / 2, z: -D / 2 } }) // צלע חיצונית
        put({ width: D, height: IN },
            { deg: 90, at: { x: legX - side * L / 2, z: -D / 2 } })               // צלע פנימית, נמוכה
      }

      // מעל הפתח. פתח רחב מ-150 מתפצל לכמה חתיכות, כמו כל קיר.
      let cursor = -opening / 2
      const spans = split(opening).map(w => {
        const c = r1(cursor + w / 2); cursor += w; return { w, c }
      })
      spans.forEach(sp => put({ width: sp.w, height: HD }, { at: { x: sp.c, y: H - HD / 2, z: 0 } }))
      spans.forEach(sp => put({ width: sp.w, height: HD }, { at: { x: sp.c, y: H - HD / 2, z: -D } }))
      // השוכבת שסוגרת מלמעלה. בלעדיה רואים עץ חשוף מלמעלה.
      // היא יושבת על ראש הרגליים, וראשה הוא גובה השער המלא.
      spans.forEach(sp => put({ width: sp.w, height: D },
        { flat: true, at: { x: sp.c, y: H + capT / 2, z: -D / 2 } }))

      // 0 הוא בקשה מפורשת, לא "לא נמסר" — הוא נחסם לטווח ולא נבלע.
      const asked = Math.round(Number(bags))
      const perLeg = Number.isFinite(asked)
        ? Math.max(BALLAST.perLegRange[0], Math.min(BALLAST.perLegRange[1], asked))
        : BALLAST.perLeg
      return {
        height: H, rows, layout,
        ballast: { perLeg, legs: 2, name: BALLAST.name },
        warning: tooTall
          ? `רגל בגובה ${H} חורגת מהמקסימום לקוליסה אחת (${LIMITS.maxHeight} ס״מ) — `
            + `שער כזה צריך רגל בנויה משתי קוליסות זו על זו, וזה עדיין לא נתמך`
          : null,
      }
    },
  },

  {
    id: 'booth',
    name: 'דוכן',
    hint: 'חזית נמוכה ושתי צלעות ב-90°',
    fields: ['width', 'height', 'side'],
    build: ({ width, height, side }) => {
      const s = clampW(side || 40)
      const front = split(Math.max(1, Math.round(width) - 2 * s))
      const rows = [{ width: s }, ...front.map(x => ({ width: x })), { width: s }]
      const layout = { 1: { deg: 90 }, [rows.length]: { deg: -90 } }
      return { height, rows, layout }
    },
  },
]

// ברירות מחדל לכל שדה, לפי התבנית
export const TEMPLATE_DEFAULTS = {
  straight: { width: 360, height: 240 },
  wings:    { width: 400, height: 240, wing: 60 },
  gate:     { width: 300, height: 240, leg: 60, header: 60 },
  booth:    { width: 200, height: 100, side: 40 },
  'gate-free': { width: 270, height: 240, leg: 60, depth: 60, inner: 180, header: 60, bags: 5 },
}

export const FIELD_LABELS = {
  width:  'רוחב כולל',
  height: 'גובה',
  wing:   'רוחב כנף',
  leg:    'רוחב רגל',
  header: 'גובה הכותרת',
  side:   'רוחב צלע',
  depth:  'עומק הרגל',
  inner:  'גובה הצלע הפנימית',
  bags:   'שקי חול לרגל',
}

export const templateById = (id) => TEMPLATES.find(t => t.id === id) || null
