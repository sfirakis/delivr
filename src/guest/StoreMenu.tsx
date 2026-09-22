import { useMemo, useState } from 'react'
import { money, num } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useGuestCart } from '@/guest/guestCart'
import { QtyStepper } from '@/components/ui'
import type { PublicMenuItem } from '@/lib/api'

// The menu is the same screen whether the guest arrived from a house QR code
// or from the store's own link, so it lives here and both flows render it.

export interface MenuGroup {
  cat: { id: string; name: string; description: string | null; sort_order: number }
  items: PublicMenuItem[]
}

interface MenuData {
  categories: { id: string; name: string; description: string | null; sort_order: number }[]
  items: PublicMenuItem[]
}

/** Items bucketed under their category, empty categories dropped. */
export function useGroupedMenu(menu: MenuData | undefined): MenuGroup[] {
  const { t } = useI18n()
  return useMemo(() => {
    const cats = menu?.categories ?? []
    const items = menu?.items ?? []
    const out: MenuGroup[] = cats.map(c => ({ cat: c, items: items.filter(i => i.category_id === c.id) }))
    const uncategorised = items.filter(i => !i.category_id)
    if (uncategorised.length) {
      out.push({ cat: { id: '__none', name: t('store.menu'), description: null, sort_order: 999 }, items: uncategorised })
    }
    return out.filter(g => g.items.length > 0)
  }, [menu, t])
}

export function CategoryChips({ grouped }: { grouped: MenuGroup[] }) {
  const [active, setActive] = useState<string | null>(null)
  if (grouped.length <= 1) return null

  return (
    <div className="flex gap-2 px-4 pb-3 pt-1 overflow-x-auto">
      {grouped.map(g => (
        <button
          key={g.cat.id}
          onClick={() => {
            setActive(g.cat.id)
            document.getElementById(`cat-${g.cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className={`chip flex-shrink-0 ${active === g.cat.id ? 'chip-active' : ''}`}
        >
          {g.cat.name}
        </button>
      ))}
    </div>
  )
}

export function MenuSections({ grouped, onOpen }: { grouped: MenuGroup[]; onOpen: (i: PublicMenuItem) => void }) {
  const { t, lang } = useI18n()
  return (
    <>
      {grouped.map(g => (
        <section key={g.cat.id} id={`cat-${g.cat.id}`} className="mb-6 scroll-mt-4">
          <h3 className="font-display font-black text-lg text-ink-1 mb-2">{g.cat.name}</h3>
          <div className="space-y-2">
            {g.items.map(item => {
              const disabled = !item.is_available
              return (
                <button
                  key={item.id}
                  disabled={disabled}
                  onClick={() => onOpen(item)}
                  className={`w-full text-left bg-surface-1 border border-surface-4 rounded-2xl p-3
                    flex gap-3 items-center transition active:scale-[0.99]
                    ${disabled ? 'opacity-50' : ''}`}
                >
                  <div className="w-14 h-14 rounded-xl bg-surface-3 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                    {item.image_url
                      ? <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                      : (item.emoji ?? '🍽️')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm text-ink-1 truncate">{item.name}</p>
                      {item.is_popular && <span className="badge badge-brand flex-shrink-0">🔥</span>}
                      {item.is_vegan && <span className="badge badge-green flex-shrink-0">🌱</span>}
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-ink-3 line-clamp-2 mt-0.5">{item.description}</p>
                    )}
                    <p className="font-display font-bold text-sm text-ink-1 mt-1">{money(item.price, lang)}</p>
                  </div>
                  {disabled
                    ? <span className="badge badge-gray flex-shrink-0">{t('store.unavailable')}</span>
                    : <span className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-lg font-bold flex-shrink-0">+</span>}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}

/** Bottom sheet for one item: extras, notes, quantity. */
export function ItemSheet({ item, storeId, storeName, onClose }: {
  item: PublicMenuItem; storeId: string; storeName: string; onClose: () => void
}) {
  const { t, lang } = useI18n()
  const addItem = useGuestCart(s => s.addItem)
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const g of item.modifier_groups ?? [])
      for (const m of g.modifiers) if (m.is_default) init[m.id] = true
    return init
  })

  const chosen = useMemo(() => {
    const out: { id: string; name: string; price: number }[] = []
    for (const g of item.modifier_groups ?? [])
      for (const m of g.modifiers)
        if (selected[m.id]) out.push({ id: m.id, name: m.name, price: num(m.price) })
    return out
  }, [selected, item])

  const unit = num(item.price) + chosen.reduce((s, m) => s + m.price, 0)

  const toggle = (groupId: string, modId: string, maxSelect: number) => {
    setSelected(prev => {
      const next = { ...prev }
      if (next[modId]) { delete next[modId]; return next }
      if (maxSelect === 1) {
        const group = (item.modifier_groups ?? []).find(g => g.id === groupId)
        for (const m of group?.modifiers ?? []) delete next[m.id]
      }
      next[modId] = true
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[430px] bg-surface-1 rounded-t-3xl max-h-[88%] flex flex-col">
        <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-surface-4" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <div className="text-5xl mb-2">{item.emoji ?? '🍽️'}</div>
          <h3 className="font-display font-black text-xl text-ink-1">{item.name}</h3>
          {item.description && <p className="text-sm text-ink-2 mt-1">{item.description}</p>}
          <p className="font-display font-bold text-lg text-brand mt-2">{money(item.price, lang)}</p>

          {(item.modifier_groups ?? []).map(group => (
            <div key={group.id} className="mt-5">
              <div className="flex items-baseline justify-between">
                <p className="font-bold text-sm text-ink-1">{group.name}</p>
                <span className="text-[11px] text-ink-3">
                  {group.is_required ? t('common.required') : t('common.optional')}
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                {group.modifiers.map(m => (
                  <label key={m.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition
                      ${selected[m.id] ? 'border-brand bg-brand-50' : 'border-surface-4 bg-surface-1'}`}>
                    <input
                      type={group.max_select === 1 ? 'radio' : 'checkbox'}
                      name={group.id}
                      checked={!!selected[m.id]}
                      onChange={() => toggle(group.id, m.id, group.max_select)}
                      className="accent-brand w-4 h-4"
                    />
                    <span className="flex-1 text-sm text-ink-1">{m.name}</span>
                    {num(m.price) > 0 && (
                      <span className="text-sm font-semibold text-ink-2">+{money(m.price, lang)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-5">
            <label className="input-label" htmlFor="item-notes">{t('store.itemNotes')}</label>
            <input id="item-notes" className="input-field" placeholder={t('store.itemNotesPh')}
                   value={notes} onChange={e => setNotes(e.target.value)} maxLength={140} />
          </div>
        </div>

        <div className="flex-shrink-0 p-4 border-t border-surface-4 flex items-center gap-3">
          <QtyStepper value={qty} onChange={v => setQty(Math.max(1, v))} min={1} />
          <button
            className="btn btn-primary btn-lg flex-1"
            onClick={() => {
              addItem(storeId, storeName, item, chosen, qty, notes.trim() || null)
              onClose()
            }}
          >
            {t('store.addToCart')} · {money(unit * qty, lang)}
          </button>
        </div>
      </div>
    </div>
  )
}
