// ==========================================================================
// נתוני דמו + הגדרות. בשלב ב׳ זה יוחלף בקריאות Supabase.
// ==========================================================================

// צינור הסטטוסים של עבודה. הסדר קובע את התקדמות ה"קדימה".
export const STATUSES = [
  { id: 'inquiry',    label: 'פנייה',       tone: 'neutral' },
  { id: 'design',     label: 'עיצוב',       tone: 'neutral' },
  { id: 'approval',   label: 'אישור לקוח',  tone: 'signal'  }, // ממתין ללקoח = דורש תשומת לב
  { id: 'production', label: 'בהפקה',        tone: 'neutral' },
  { id: 'ready',      label: 'מוכן',         tone: 'go'      },
  { id: 'installed',  label: 'הותקן',        tone: 'go'      },
];

export const statusById = Object.fromEntries(STATUSES.map(s => [s.id, s]));
export const statusIndex = id => STATUSES.findIndex(s => s.id === id);

// קטגוריות פריטים (סוגי מוצר חוזרים)
export const CATEGORIES = {
  backdrop: 'קוליסה',
  carpet:   'שטיח',
  sign:     'שלט כאפות',
  print:    'הדפסה',
  other:    'אחר',
};

// "היום" קבוע לצורך הדמו כדי שהתאריכים היחסיים יהיו יציבים
export const TODAY = new Date(2026, 7, 31); // 31.8.2026

const pad = n => String(n).padStart(2, '0');
export const isoLocal = t => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
const d = (offsetDays) => {
  const t = new Date(TODAY);
  t.setDate(t.getDate() + offsetDays);
  return isoLocal(t); // רכיבים מקומיים — נמנע מהיסט UTC של toISOString
};

let _id = 0;
const uid = () => `job_${++_id}`;

export const JOBS = [
  {
    id: uid(), client: 'משפחת לוי', contact: '052-4418290',
    title: 'בר מצווה — אולם הגן',
    eventDate: d(2), status: 'production', price: 4200,
    items: [
      { cat: 'backdrop', name: 'קוליסת כניסה 3×2.4מ׳', qty: 1, price: 2200 },
      { cat: 'sign', name: 'שלט כאפות "אורי" — גדול', qty: 1, price: 1400 },
      { cat: 'carpet', name: 'שטיח כניסה אדום', qty: 1, price: 600 },
    ],
    team: ['רן', 'מאור'], note: 'התקנה יום לפני, 08:00',
  },
  {
    id: uid(), client: 'אולמי הדר', contact: '03-5567120',
    title: 'כנס חברה — במה ראשית',
    eventDate: d(5), status: 'approval', price: 7800,
    items: [
      { cat: 'backdrop', name: 'קוליסת במה 6×3מ׳ ממותגת', qty: 1, price: 5200 },
      { cat: 'print', name: 'רולאפים ממותגים', qty: 4, price: 1600 },
      { cat: 'carpet', name: 'שטיח שחור מקצועי', qty: 2, price: 1000 },
    ],
    team: [], note: 'ממתין לאישור מקדמה',
  },
  {
    id: uid(), client: 'טליה כהן', contact: '054-8830021',
    title: 'חתונה — גן האירועים',
    eventDate: d(9), status: 'design', price: 9600,
    items: [
      { cat: 'sign', name: 'שלט כאפות "T ♥ D" — ענק', qty: 1, price: 3800 },
      { cat: 'backdrop', name: 'קיר פרחים 4×2.4מ׳', qty: 1, price: 4200 },
      { cat: 'carpet', name: 'שטיח לבן חופה', qty: 1, price: 900 },
    ],
    team: [], note: 'סקיצה ראשונה נשלחה',
  },
  {
    id: uid(), client: 'עמותת יד־ביד', contact: '050-2214477',
    title: 'ערב התרמה',
    eventDate: d(-1), status: 'installed', price: 3100,
    items: [
      { cat: 'backdrop', name: 'קוליסת צילום 3×2.4מ׳', qty: 1, price: 2200 },
      { cat: 'print', name: 'פוסטרים A1', qty: 6, price: 900 },
    ],
    team: ['רן'], note: 'הוחזר למחסן ✓',
  },
  {
    id: uid(), client: 'משפחת אזולאי', contact: '052-9014410',
    title: 'ברית — בית פרטי',
    eventDate: d(1), status: 'ready', price: 1900,
    items: [
      { cat: 'sign', name: 'שלט כאפות "יוסף" — בינוני', qty: 1, price: 1200 },
      { cat: 'carpet', name: 'שטיח כניסה כחול', qty: 1, price: 700 },
    ],
    team: ['מאור'], note: 'ארוז ומוכן לאיסוף',
  },
  {
    id: uid(), client: 'חברת נובה', contact: '073-2299010',
    title: 'השקת מוצר',
    eventDate: d(14), status: 'inquiry', price: 0,
    items: [], team: [], note: 'פנייה טלפונית — לחזור עם הצעה',
  },
  {
    id: uid(), client: 'משפחת פרץ', contact: '053-7781234',
    title: 'בת מצווה — גג עירוני',
    eventDate: d(3), status: 'production', price: 5400,
    items: [
      { cat: 'sign', name: 'שלט כאפות "נועה" — גדול', qty: 1, price: 1400 },
      { cat: 'backdrop', name: 'קוליסת ניאון מותאמת', qty: 1, price: 3200 },
      { cat: 'carpet', name: 'שטיח ורוד', qty: 1, price: 800 },
    ],
    team: ['רן', 'מאור', 'שיר'], note: 'ניאון בייצור אצל ספק',
  },
  {
    id: uid(), client: 'מלון סברינה', contact: '04-6612000',
    title: 'כנס רפואי',
    eventDate: d(21), status: 'approval', price: 6200,
    items: [
      { cat: 'backdrop', name: 'קיר לוגואים 5×2.4מ׳', qty: 1, price: 4400 },
      { cat: 'print', name: 'שילוט כיווני', qty: 8, price: 1800 },
    ],
    team: [], note: 'ממתין לחתימת הסכם',
  },
  {
    id: uid(), client: 'דנה ואורן', contact: '058-4433221',
    title: 'אירוסין — חצר',
    eventDate: d(7), status: 'design', price: 3300,
    items: [
      { cat: 'sign', name: 'שלט כאפות "❤" — בינוני', qty: 2, price: 1800 },
      { cat: 'carpet', name: 'שטיח שמפניה', qty: 1, price: 750 },
    ],
    team: [], note: '',
  },
  {
    id: uid(), client: 'עיריית רמת־גן', contact: '03-6720000',
    title: 'טקס יום העצמאות',
    eventDate: d(-3), status: 'installed', price: 12400,
    items: [
      { cat: 'backdrop', name: 'במה מרכזית 8×4מ׳', qty: 1, price: 8800 },
      { cat: 'print', name: 'דגלים ושילוט', qty: 20, price: 3600 },
    ],
    team: ['רן', 'מאור', 'שיר'], note: 'הסתיים בהצלחה',
  },
];

// ---- עזרי תאריך ----
export const parseDate = s => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
export const daysUntil = s => Math.round((parseDate(s) - TODAY) / 86400000);

export function fmtDate(s) {
  const dt = parseDate(s);
  const days = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'][dt.getDay()];
  return `יום ${days}׳ ${dt.getDate()}.${dt.getMonth() + 1}`.replace('׳׳','׳');
}

export function relLabel(s) {
  const n = daysUntil(s);
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  if (n === -1) return 'אתמול';
  if (n < 0) return `לפני ${-n} ימים`;
  return `בעוד ${n} ימים`;
}

// עבודה "דחופה": בתוך 7 ימים ועדיין לא מוכנה/הותקנה
export function isUrgent(job) {
  const n = daysUntil(job.eventDate);
  return n >= 0 && n <= 7 && job.status !== 'ready' && job.status !== 'installed';
}

export const ils = n => `${(n || 0).toLocaleString('en-US')}₪`;
