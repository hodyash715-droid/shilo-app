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

import { LIMITS } from './rules.js'
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
}

export const FIELD_LABELS = {
  width:  'רוחב כולל',
  height: 'גובה',
  wing:   'רוחב כנף',
  leg:    'רוחב רגל',
  header: 'גובה הכותרת',
  side:   'רוחב צלע',
}

export const templateById = (id) => TEMPLATES.find(t => t.id === id) || null
