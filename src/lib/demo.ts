/**
 * Demo data that lives in the live database (seed of 24/08/2026), kept so
 * the QR / store flows can be shown and tested end to end. None of it is a
 * real business: the stores, their ratings and review counts are examples.
 *
 * Honesty rule (HQ 18/11/2026): anything shown from these rows carries a
 * clear «Demo» label and never shows the made-up stars as if they were real
 * reviews. The rows are NOT deleted (they back the e2e and the sales demo).
 * When a real store or property replaces one, drop it from these lists.
 */
export const DEMO_PROPERTY_CODES: readonly string[] = ['SUNSET2A', 'OLIVE3', 'AEGEAN1']

export const DEMO_STORE_SLUGS: readonly string[] = [
  // Agios Nikolaos demo zone (QR demo)
  'taverna-marina', 'pizza-napoli', 'souvlaki-corner', 'blue-bay-cafe', 'mini-market-kritikos',
  // old Athens seed (inactive today, listed in case someone turns it on)
  'ab-vasilopoulos', 'avra-souvlaki', 'brew-and-co', 'burger-house', 'green-fresh', 'tokyo-ramen',
]

const norm = (v: string | null | undefined) => (v ?? '').trim().toUpperCase().replace(/[\s-]+/g, '')

export function isDemoProperty(code: string | null | undefined): boolean {
  const c = norm(code)
  return c !== '' && DEMO_PROPERTY_CODES.some(d => norm(d) === c)
}

export function isDemoStore(slug: string | null | undefined): boolean {
  const s = (slug ?? '').trim().toLowerCase()
  return s !== '' && DEMO_STORE_SLUGS.includes(s)
}
