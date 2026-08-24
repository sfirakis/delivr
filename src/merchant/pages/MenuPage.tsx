import { useState } from 'react'
import { useMerchantMenu, useToggleItemAvailability, useUpsertMenuItem, useDeleteMenuItem } from '@/merchant/hooks'
import { Skeleton, Toggle } from '@/components/ui'
import type { MenuItem } from '@/types'
import toast from 'react-hot-toast'
import MenuImport from '@/components/menu/MenuImport'

// ─── Item edit sheet ──────────────────────────────────────────
function ItemEditSheet({ item, storeId, categoryId, onClose }: {
  item?: MenuItem; storeId: string; categoryId?: string; onClose: () => void
}) {
  const upsert = useUpsertMenuItem(storeId)
  const [form, setForm] = useState({
    name:         item?.name ?? '',
    description:  item?.description ?? '',
    price:        item?.price?.toString() ?? '',
    emoji:        item?.emoji ?? '',
    category_id:  item?.category_id ?? categoryId ?? '',
    is_popular:   item?.is_popular ?? false,
    is_vegan:     item?.is_vegan ?? false,
    is_gluten_free: item?.is_gluten_free ?? false,
    calories:     item?.calories?.toString() ?? '',
    allergens:    item?.allergens?.join(', ') ?? '',
  })

  const u = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))
  const toggle = (k: string) => setForm(f => ({ ...f, [k]: !(f as any)[k] }))

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error('Συμπλήρωσε όνομα & τιμή'); return }
    try {
      await upsert.mutateAsync({
        ...(item?.id ? { id: item.id } : {}),
        store_id: storeId,
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        emoji: form.emoji || null,
        category_id: form.category_id || null,
        is_popular: form.is_popular,
        is_vegan: form.is_vegan,
        is_gluten_free: form.is_gluten_free,
        calories: form.calories ? parseInt(form.calories) : null,
        allergens: form.allergens ? form.allergens.split(',').map(s => s.trim()) : [],
      } as any)
      toast.success(item ? 'Αποθηκεύτηκε!' : 'Προστέθηκε!')
      onClose()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="px-5 pb-2">
          <h3 className="font-display font-bold text-xl mb-5">
            {item ? 'Επεξεργασία' : 'Νέο προϊόν'}
          </h3>

          <div className="space-y-4">
            {/* Name + Emoji row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-1.5 block">Όνομα *</label>
                <input className="w-full border border-surface-4 rounded-xl px-4 py-2.5 text-sm font-body outline-none focus:border-brand"
                       placeholder="π.χ. Σουβλάκι Χοιρινό" value={form.name} onChange={u('name')} />
              </div>
              <div className="w-20">
                <label className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-1.5 block">Emoji</label>
                <input className="w-full border border-surface-4 rounded-xl px-3 py-2.5 text-lg text-center font-body outline-none focus:border-brand"
                       placeholder="🍔" value={form.emoji} onChange={u('emoji')} maxLength={2} />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-1.5 block">Περιγραφή</label>
              <textarea className="w-full border border-surface-4 rounded-xl px-4 py-2.5 text-sm font-body outline-none focus:border-brand resize-none"
                        rows={2} placeholder="Σύντομη περιγραφή..." value={form.description} onChange={u('description')} />
            </div>

            {/* Price + Calories */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-1.5 block">Τιμή (€) *</label>
                <input type="number" step="0.10" min="0"
                       className="w-full border border-surface-4 rounded-xl px-4 py-2.5 text-sm font-body outline-none focus:border-brand"
                       placeholder="0.00" value={form.price} onChange={u('price')} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-1.5 block">Θερμίδες</label>
                <input type="number" min="0"
                       className="w-full border border-surface-4 rounded-xl px-4 py-2.5 text-sm font-body outline-none focus:border-brand"
                       placeholder="kcal" value={form.calories} onChange={u('calories')} />
              </div>
            </div>

            {/* Allergens */}
            <div>
              <label className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-1.5 block">Αλλεργιογόνα</label>
              <input className="w-full border border-surface-4 rounded-xl px-4 py-2.5 text-sm font-body outline-none focus:border-brand"
                     placeholder="Γλουτένη, Γάλα, Αυγά..." value={form.allergens} onChange={u('allergens')} />
              <p className="text-[11px] text-ink-3 mt-1">Χώρισε με κόμμα</p>
            </div>

            {/* Flags */}
            <div className="space-y-3">
              {[
                { key:'is_popular',    label:'🔥 Δημοφιλές item' },
                { key:'is_vegan',      label:'🌱 Vegan' },
                { key:'is_gluten_free',label:'🌾 Χωρίς γλουτένη' },
              ].map(f => (
                <div key={f.key} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{f.label}</span>
                  <Toggle checked={(form as any)[f.key]} onChange={() => toggle(f.key)} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-6 pb-6">
            <button className="btn btn-secondary btn-md flex-1" onClick={onClose}>Ακύρωση</button>
            <button className="btn btn-primary btn-md flex-1" onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? '...' : item ? 'Αποθήκευση' : 'Προσθήκη'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Menu Management page ────────────────────────────────
export default function MerchantMenuPage({ storeId, storeName = '' }: { storeId: string; storeName?: string }) {
  const { data: menu, isLoading } = useMerchantMenu(storeId)
  const toggleAvail   = useToggleItemAvailability(storeId)
  const deleteItem    = useDeleteMenuItem(storeId)
  const [editItem, setEditItem]     = useState<MenuItem | null | 'new'>(null)
  const [filterCat, setFilterCat]   = useState('all')
  const [search, setSearch]         = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const allItems = menu?.items ?? []
  const filtered = allItems.filter(i => {
    const matchCat = filterCat === 'all' || i.category_id === filterCat
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`Διαγραφή "${item.name}";`)) return
    await deleteItem.mutateAsync(item.id)
    toast.success('Διαγράφηκε')
  }

  if (isLoading) return (
    <div className="p-5 space-y-3">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-surface-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-black text-xl">Μενού</h2>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm gap-1.5" onClick={() => setImportOpen(true)}>
              📋 Εισαγωγή μενού
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setEditItem('new')}>
              + Νέο προϊόν
            </button>
          </div>
        </div>
        {/* Search */}
        <div className="flex items-center gap-2 bg-surface-2 rounded-full px-4 py-2.5 mb-3">
          <span className="text-ink-3">🔍</span>
          <input className="flex-1 bg-transparent text-sm outline-none font-body placeholder:text-ink-3"
                 placeholder="Αναζήτηση προϊόντος..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className={`chip text-xs py-1.5 ${filterCat==='all' ? 'chip-active' : ''}`}
                  onClick={() => setFilterCat('all')}>Όλα ({allItems.length})</button>
          {menu?.categories.map(cat => (
            <button key={cat.id}
                    className={`chip text-xs py-1.5 ${filterCat===cat.id ? 'chip-active' : ''}`}
                    onClick={() => setFilterCat(cat.id)}>
              {cat.name} ({allItems.filter(i=>i.category_id===cat.id).length})
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 pb-24">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-ink-3">
            <div className="text-4xl mb-2">🍽️</div>
            <p>Δεν βρέθηκαν προϊόντα</p>
          </div>
        )}
        {filtered.map(item => (
          <div key={item.id} className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all
            ${item.is_available ? 'border-surface-4 bg-surface-1' : 'border-surface-4 bg-surface-2 opacity-60'}`}>
            {/* Emoji */}
            <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-2xl flex-shrink-0">
              {item.emoji ?? '🍽️'}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm truncate">{item.name}</p>
                {item.is_popular && <span className="text-xs">🔥</span>}
                {item.is_vegan   && <span className="text-xs">🌱</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-display font-bold text-sm text-brand">{item.price.toFixed(2)}€</span>
                {!item.is_available && <span className="badge badge-amber text-[10px]">Μη διαθέσιμο</span>}
              </div>
            </div>
            {/* Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Toggle
                checked={item.is_available}
                onChange={(v) => toggleAvail.mutate({ itemId: item.id, available: v })}
              />
              <button className="btn-icon w-9 h-9 text-sm" onClick={() => setEditItem(item)}>✏️</button>
              <button className="btn-icon w-9 h-9 text-sm text-danger" onClick={() => handleDelete(item)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Add sheet */}
      {editItem && (
        <ItemEditSheet
          item={editItem === 'new' ? undefined : editItem}
          storeId={storeId}
          categoryId={filterCat !== 'all' ? filterCat : undefined}
          onClose={() => setEditItem(null)}
        />
      )}
      {importOpen && (
        <MenuImport storeId={storeId} storeName={storeName} onClose={() => setImportOpen(false)} />
      )}
    </div>
  )
}
