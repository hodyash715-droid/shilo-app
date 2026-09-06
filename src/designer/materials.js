// ============================================================
// חומרי גלם סטנדרטיים לבניית קוליסה. משמשים כברירת מחדל
// כשאין במלאי פריטים בקטגוריה "חומר גלם".
// השם מכיל את החתך ("2×3") — ממנו נגזרת התצוגה התלת-ממדית.
// ============================================================

export const STOCK_MATERIALS = [
  { id: 'std:lata-2x3',   name: 'לטה 2×3',      stock_len: 300, category: 'material' },
  { id: 'std:lata-3x3',   name: 'לטה 3×3',      stock_len: 300, category: 'material' },
  { id: 'std:kora-5x5',   name: 'קורה 5×5',     stock_len: 300, category: 'material' },
  { id: 'std:kora-5x10',  name: 'קורה 5×10',    stock_len: 400, category: 'material' },
  { id: 'std:profil-3x3', name: 'פרופיל 3×3',   stock_len: 600, category: 'material' },
  { id: 'std:profil-4x4', name: 'פרופיל 4×4',   stock_len: 600, category: 'material' },
  { id: 'std:diket-9',    name: 'דיקט 9 מ״מ',   stock_len: 244, category: 'material' },
  { id: 'std:mdf-16',     name: 'לוח MDF 16',   stock_len: 280, category: 'material' },
]

// מיזוג: חומרי גלם מהמלאי של שי קודם, ואחריהם הסטנדרטיים שלא כפולים
export function materialsFor(inventory = []) {
  const mine = inventory.filter(x => x.category === 'material')
  const names = new Set(mine.map(x => (x.name || '').trim()))
  return [...mine, ...STOCK_MATERIALS.filter(x => !names.has(x.name))]
}
