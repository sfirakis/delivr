/**
 * Turns a menu that a store already has (pasted text, a PDF copy-paste, or a CSV
 * export) into categories + items ready to import.
 *
 * Handles the shapes Greek delivery menus actually come in:
 *   ΣΟΥΒΛΑΚΙΑ                    → category heading
 *   Πίτα γύρο χοιρινό .... 4,20  → item with dot leaders
 *   Πίτα γύρο κοτόπουλο 4.40 €   → item with trailing currency
 *   Μπύρα 330ml - 3,50           → item with a dash
 *   (a plain line under an item)  → description of the previous item
 */

export interface ParsedItem {
  name: string
  description: string | null
  price: number
  category: string
}

export interface ParseResult {
  items: ParsedItem[]
  categories: string[]
  skipped: string[]
}

const PRICE_RE = /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|eur|ευρώ)?\s*$/i
const LEADER_RE = /[.…·\-–—_\s]{2,}$/

function toNumber(raw: string): number {
  const n = parseFloat(raw.replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function looksLikeCategory(line: string): boolean {
  if (PRICE_RE.test(line)) return false
  const clean = line.replace(/[:：]$/, '').trim()
  if (clean.length === 0 || clean.length > 45) return false
  // ALL CAPS (Greek or Latin), or a short line ending with a colon
  const upper = clean.toUpperCase()
  const isUpper = clean === upper && /[Α-ΩA-Z]/.test(clean)
  return isUpper || /[:：]$/.test(line.trim())
}

export function parseMenuText(text: string, fallbackCategory = 'Μενού'): ParseResult {
  const lines = text.split(/\r?\n/).map(l => l.trim())
  const items: ParsedItem[] = []
  const categories: string[] = []
  const skipped: string[] = []
  let current = fallbackCategory

  for (const line of lines) {
    if (!line) continue

    if (looksLikeCategory(line)) {
      current = line.replace(/[:：]$/, '').trim()
      if (!categories.includes(current)) categories.push(current)
      continue
    }

    const m = line.match(PRICE_RE)
    if (m) {
      let name = line.slice(0, m.index).trim()
      name = name.replace(LEADER_RE, '').replace(/[-–—:]\s*$/, '').trim()
      const price = toNumber(m[1])
      if (!name || price <= 0) { skipped.push(line); continue }

      // "Name (description)" → split the parenthetical into the description
      let description: string | null = null
      const paren = name.match(/^(.*?)\s*[（(]([^)）]+)[)）]\s*$/)
      if (paren) { name = paren[1].trim(); description = paren[2].trim() }

      if (!categories.includes(current)) categories.push(current)
      items.push({ name, description, price, category: current })
      continue
    }

    // A price-less line right after an item is that item's description.
    if (items.length > 0 && line.length > 3 && line.length < 160) {
      const last = items[items.length - 1]
      last.description = last.description ? `${last.description} ${line}` : line
    } else {
      skipped.push(line)
    }
  }

  return { items, categories, skipped }
}

/** CSV/TSV with a header row: category,name,description,price (order-independent). */
export function parseMenuCsv(text: string, fallbackCategory = 'Μενού'): ParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { items: [], categories: [], skipped: [] }

  const delimiter = (() => {
    const head = lines[0]
    const counts: [string, number][] = [[';', (head.match(/;/g) ?? []).length],
                                       [',', (head.match(/,/g) ?? []).length],
                                       ['\t', (head.match(/\t/g) ?? []).length]]
    return counts.sort((a, b) => b[1] - a[1])[0][0]
  })()

  const splitRow = (row: string): string[] => {
    const out: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (ch === '"') {
        if (quoted && row[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted
      } else if (ch === delimiter && !quoted) { out.push(cur); cur = '' } else cur += ch
    }
    out.push(cur)
    return out.map(s => s.trim())
  }

  const header = splitRow(lines[0]).map(h => h.toLowerCase())
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.findIndex(h => h === n || h.includes(n))
      if (i >= 0) return i
    }
    return -1
  }

  const iName = idx('name', 'όνομα', 'ονομα', 'προϊόν', 'προιον', 'είδος', 'ειδος')
  const iPrice = idx('price', 'τιμή', 'τιμη', 'αξία', 'αξια')
  const iCat = idx('category', 'κατηγορία', 'κατηγορια')
  const iDesc = idx('description', 'περιγραφή', 'περιγραφη')

  // No usable header → treat the whole payload as free text.
  if (iName < 0 || iPrice < 0) return parseMenuText(text, fallbackCategory)

  const items: ParsedItem[] = []
  const categories: string[] = []
  const skipped: string[] = []

  for (const row of lines.slice(1)) {
    const cells = splitRow(row)
    const name = (cells[iName] ?? '').trim()
    const price = toNumber((cells[iPrice] ?? '').replace(/[^\d.,]/g, ''))
    if (!name || price <= 0) { skipped.push(row); continue }
    const category = (iCat >= 0 ? cells[iCat] : '')?.trim() || fallbackCategory
    if (!categories.includes(category)) categories.push(category)
    items.push({
      name,
      description: (iDesc >= 0 ? cells[iDesc] : '')?.trim() || null,
      price,
      category,
    })
  }

  return { items, categories, skipped }
}

/** Picks the right parser: JSON array → CSV header → free text. */
export function parseMenu(text: string, fallbackCategory = 'Μενού'): ParseResult {
  const trimmed = text.trim()
  if (!trimmed) return { items: [], categories: [], skipped: [] }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const raw = JSON.parse(trimmed)
      const arr: Record<string, unknown>[] = Array.isArray(raw) ? raw : (raw.items as Record<string, unknown>[] ?? [])
      const items: ParsedItem[] = []
      const categories: string[] = []
      for (const r of arr) {
        const name = String(r.name ?? r.title ?? '').trim()
        const price = toNumber(String(r.price ?? r.amount ?? '0'))
        if (!name || price <= 0) continue
        const category = String(r.category ?? r.group ?? fallbackCategory).trim() || fallbackCategory
        if (!categories.includes(category)) categories.push(category)
        items.push({ name, description: r.description ? String(r.description) : null, price, category })
      }
      return { items, categories, skipped: [] }
    } catch {
      // fall through to the text parser
    }
  }

  const firstLine = trimmed.split(/\r?\n/)[0] ?? ''
  const looksCsv = /[;,\t]/.test(firstLine) &&
    /(name|price|τιμή|τιμη|όνομα|ονομα|κατηγορία|κατηγορια)/i.test(firstLine)

  return looksCsv ? parseMenuCsv(trimmed, fallbackCategory) : parseMenuText(trimmed, fallbackCategory)
}
