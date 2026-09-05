// מייצר את אייקוני ה-PWA (ש זהב על שחור). הרצה: node scripts/icongen.mjs
import fs from 'fs'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'

GlobalFonts.registerFromPath('C:/Windows/Fonts/arialbd.ttf', 'IconHeb')

const OUT = 'public/icons'
fs.mkdirSync(OUT, { recursive: true })

function make(size, frac, nudge) {
  const c = createCanvas(size, size)
  const x = c.getContext('2d')
  x.fillStyle = '#0E0E10'; x.fillRect(0, 0, size, size)
  x.fillStyle = '#EEC421'
  x.textAlign = 'center'; x.textBaseline = 'middle'
  x.font = `${Math.round(size * frac)}px IconHeb`
  x.fillText('ש', size / 2, size / 2 + size * nudge)
  return c.toBuffer('image/png')
}

const files = {
  'icon-192.png': make(192, 0.64, 0.0),
  'icon-512.png': make(512, 0.64, 0.0),
  'icon-maskable-512.png': make(512, 0.50, 0.0),
  'apple-touch-icon.png': make(180, 0.64, 0.0),
}
for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(`${OUT}/${name}`, buf)
  console.log(name, buf.length, 'bytes')
}
