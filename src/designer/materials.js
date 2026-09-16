// ============================================================
// חומרי גלם סטנדרטיים לבניית קוליסה. משמשים כברירת מחדל
// כשאין במלאי פריטים בקטגוריה "חומר גלם".
// השם מכיל את החתך ("2×3") — ממנו נגזרת התצוגה התלת-ממדית.
// ============================================================

export const STOCK_MATERIALS = [
  // הלטה של שי. אושר 16.9.2026: כל הלטות הן 4×2, והצלע 2 פונה לחזית.
  { id: 'std:lata-4x2',   name: 'לטה 4×2',      stock_len: 300, category: 'material' },
  { id: 'std:kora-5x5',   name: 'קורה 5×5',     stock_len: 300, category: 'material' },
  { id: 'std:kora-5x10',  name: 'קורה 5×10',    stock_len: 400, category: 'material' },
  { id: 'std:profil-3x3', name: 'פרופיל 3×3',   stock_len: 600, category: 'material' },
  { id: 'std:profil-4x4', name: 'פרופיל 4×4',   stock_len: 600, category: 'material' },
  { id: 'std:diket-9',    name: 'דיקט 9 מ״מ',   stock_len: 244, category: 'material' },
  { id: 'std:mdf-16',     name: 'לוח MDF 16',   stock_len: 280, category: 'material' },

  // ---- ישנים ----
  // לא מוצעים לבחירה יותר (legacy), אבל חייבים להישאר ברשימה:
  // קוליסות שנשמרו בעבר מצביעות עליהם ב-invId. בלעדיהם החתך נופל
  // ל-[4,4] ושם החומר ברשימת החיתוך הופך לשם החלק ('אנכית ימין').
  { id: 'std:lata-2x3',   name: 'לטה 2×3',      stock_len: 300, category: 'material', legacy: true },
  { id: 'std:lata-3x3',   name: 'לטה 3×3',      stock_len: 300, category: 'material', legacy: true },
]

// מיזוג: חומרי גלם מהמלאי של שי קודם, ואחריהם הסטנדרטיים שלא כפולים
// החומרים שמוצעים לבחירה. חומרים ישנים נשארים לחיפוש בלבד.
export const pickable = (materials = []) => materials.filter(m => !m.legacy)

export function materialsFor(inventory = []) {
  const mine = inventory.filter(x => x.category === 'material')
  const names = new Set(mine.map(x => (x.name || '').trim()))
  return [...mine, ...STOCK_MATERIALS.filter(x => !names.has(x.name))]
}
