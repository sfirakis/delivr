/** A build with no Supabase credentials must say so, not paint a white page. */
import { launchChromium } from './browser.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const browser = await launchChromium({
  executablePath: '/opt/pw-browsers/chromium',
  proxy: { server: process.env.HTTPS_PROXY || 'http://127.0.0.1:35779', bypass: 'localhost,127.0.0.1,::1' },
})
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
page.setDefaultTimeout(8000)
await page.route('**://fonts.googleapis.com/**', r => r.abort())
await page.route('**://fonts.gstatic.com/**', r => r.abort())

await page.goto(`${BASE}/qr/AEGEAN1`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()

let bad = 0
const need = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
for (const n of need) {
  if (!text.includes(n)) { console.log(`❌ missing "${n}" in the message`); bad++ }
}
if (text.length < 40) { console.log(`❌ page is effectively blank: "${text}"`); bad++ }
if (bad === 0) console.log(`✅ Unconfigured build explains itself instead of showing a blank page`)
console.log(`   shown: ${text.slice(0, 150)}`)

await browser.close()
process.exitCode = bad ? 1 : 0
