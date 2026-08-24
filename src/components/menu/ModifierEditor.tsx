import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { Modal, Field, TextInput, CheckRow } from '@/admin/ui'
import { money, num } from '@/lib/format'
import { Spinner } from '@/components/ui'

export interface ModifierOption {
  id?: string
  group_id?: string
  name: string
  price: number
  is_default: boolean
  sort_order: number
}

export interface ModifierGroup {
  id?: string
  item_id: string
  name: string
  is_required: boolean
  min_select: number
  max_select: number
  sort_order: number
  modifiers: ModifierOption[]
}

/** Ready-made sets, because most stores want the same handful. */
const PRESETS: { label: string; group: Omit<ModifierGroup, 'item_id'> }[] = [
  {
    label: '🌯 Extras σουβλατζίδικου',
    group: {
      name: 'Extras', is_required: false, min_select: 0, max_select: 5, sort_order: 1,
      modifiers: [
        { name: 'Έξτρα τζατζίκι', price: 0.50, is_default: false, sort_order: 1 },
        { name: 'Έξτρα πατάτες', price: 0.70, is_default: false, sort_order: 2 },
        { name: 'Τυρί φέτα', price: 0.80, is_default: false, sort_order: 3 },
        { name: 'Χωρίς κρεμμύδι', price: 0, is_default: false, sort_order: 4 },
        { name: 'Καυτερή σως', price: 0.30, is_default: false, sort_order: 5 },
      ],
    },
  },
  {
    label: '🍕 Μέγεθος πίτσας',
    group: {
      name: 'Μέγεθος', is_required: true, min_select: 1, max_select: 1, sort_order: 1,
      modifiers: [
        { name: 'Μικρή 24cm', price: 0, is_default: true, sort_order: 1 },
        { name: 'Μεσαία 30cm', price: 3.00, is_default: false, sort_order: 2 },
        { name: 'Μεγάλη 38cm', price: 6.00, is_default: false, sort_order: 3 },
      ],
    },
  },
  {
    label: '☕ Επιλογές καφέ',
    group: {
      name: 'Γλυκύτητα', is_required: true, min_select: 1, max_select: 1, sort_order: 1,
      modifiers: [
        { name: 'Σκέτος', price: 0, is_default: false, sort_order: 1 },
        { name: 'Μέτριος', price: 0, is_default: true, sort_order: 2 },
        { name: 'Γλυκός', price: 0, is_default: false, sort_order: 3 },
      ],
    },
  },
  {
    label: '🥤 Συνοδευτικό ποτό',
    group: {
      name: 'Ποτό', is_required: false, min_select: 0, max_select: 1, sort_order: 2,
      modifiers: [
        { name: 'Coca-Cola 330ml', price: 1.80, is_default: false, sort_order: 1 },
        { name: 'Νερό 500ml', price: 0.60, is_default: false, sort_order: 2 },
        { name: 'Μπύρα 330ml', price: 3.00, is_default: false, sort_order: 3 },
      ],
    },
  },
]

const emptyGroup = (itemId: string, sort: number): ModifierGroup => ({
  item_id: itemId, name: '', is_required: false, min_select: 0, max_select: 5,
  sort_order: sort, modifiers: [{ name: '', price: 0, is_default: false, sort_order: 1 }],
})

export default function ModifierEditor({ itemId, itemName, storeId, onClose }: {
  itemId: string; itemName: string; storeId: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<ModifierGroup | null>(null)

  const groupsQ = useQuery({
    queryKey: ['item-modifiers', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_modifier_groups')
        .select('*, modifiers:item_modifiers(*)')
        .eq('item_id', itemId)
        .order('sort_order')
      if (error) throw new Error(error.message)
      return (data ?? []).map(g => ({
        ...g,
        modifiers: [...((g.modifiers ?? []) as ModifierOption[])].sort((a, b) => a.sort_order - b.sort_order),
      })) as ModifierGroup[]
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['item-modifiers', itemId] })
    void qc.invalidateQueries({ queryKey: ['merchant-menu', storeId] })
    void qc.invalidateQueries({ queryKey: ['store-menu', storeId] })
  }

  const save = useMutation({
    mutationFn: async (group: ModifierGroup) => {
      const options = group.modifiers
        .map((m, i) => ({ ...m, name: m.name.trim(), sort_order: i + 1 }))
        .filter(m => m.name)
      if (options.length === 0) throw new Error('Πρόσθεσε τουλάχιστον μία επιλογή')

      let groupId = group.id
      if (groupId) {
        const { error } = await supabase.from('item_modifier_groups').update({
          name: group.name.trim(), is_required: group.is_required,
          min_select: group.min_select, max_select: group.max_select, sort_order: group.sort_order,
        }).eq('id', groupId)
        if (error) throw new Error(error.message)

        const keep = options.filter(o => o.id).map(o => o.id as string)
        const del = supabase.from('item_modifiers').delete().eq('group_id', groupId)
        const { error: dErr } = keep.length
          ? await del.not('id', 'in', `(${keep.join(',')})`)
          : await del
        if (dErr) throw new Error(dErr.message)
      } else {
        const { data, error } = await supabase.from('item_modifier_groups').insert({
          item_id: itemId, name: group.name.trim(), is_required: group.is_required,
          min_select: group.min_select, max_select: group.max_select, sort_order: group.sort_order,
        }).select('id').single()
        if (error) throw new Error(error.message)
        groupId = data.id
      }

      for (const o of options) {
        const payload = {
          group_id: groupId, name: o.name, price: Number(o.price) || 0,
          is_default: o.is_default, sort_order: o.sort_order,
        }
        const { error } = o.id
          ? await supabase.from('item_modifiers').update(payload).eq('id', o.id)
          : await supabase.from('item_modifiers').insert(payload)
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => { toast.success('Αποθηκεύτηκε'); setDraft(null); invalidate() },
    onError: (e) => toast.error((e as Error).message),
  })

  const remove = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from('item_modifier_groups').delete().eq('id', groupId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { toast.success('Διαγράφηκε'); invalidate() },
    onError: (e) => toast.error((e as Error).message),
  })

  const groups = groupsQ.data ?? []
  const setDraftField = (patch: Partial<ModifierGroup>) => setDraft(d => d ? { ...d, ...patch } : d)
  const setOption = (i: number, patch: Partial<ModifierOption>) =>
    setDraft(d => d ? { ...d, modifiers: d.modifiers.map((m, x) => x === i ? { ...m, ...patch } : m) } : d)

  return (
    <Modal title={`Extras & επιλογές — ${itemName}`} onClose={onClose} wide>
      {groupsQ.isLoading && <div className="py-8 flex justify-center"><Spinner /></div>}

      {!draft && (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            Οι ομάδες επιλογών εμφανίζονται στον πελάτη όταν ανοίγει το προϊόν. Η τιμή κάθε
            επιλογής προστίθεται στην τιμή του προϊόντος και υπολογίζεται ξανά στον server,
            ώστε να μην μπορεί να αλλοιωθεί.
          </p>

          {groups.length === 0 && (
            <p className="text-sm text-ink-3 border border-dashed border-surface-4 rounded-xl p-5 text-center">
              Το προϊόν δεν έχει επιλογές ακόμη.
            </p>
          )}

          {groups.map(g => (
            <div key={g.id} className="border border-surface-4 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-sm text-ink-1">{g.name}</p>
                  <p className="text-[11px] text-ink-3">
                    {g.is_required ? 'Υποχρεωτική' : 'Προαιρετική'} ·{' '}
                    {g.max_select === 1 ? 'μία επιλογή' : `έως ${g.max_select} επιλογές`} ·{' '}
                    {g.modifiers.length} επιλογές
                  </p>
                </div>
                <div className="flex gap-1">
                  <button className="btn-icon" onClick={() => setDraft(g)}>✏️</button>
                  <button className="btn-icon text-danger"
                          onClick={() => { if (confirm(`Διαγραφή ομάδας «${g.name}»;`)) remove.mutate(g.id!) }}>
                    🗑
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {g.modifiers.map(m => (
                  <span key={m.id ?? m.name} className="badge badge-gray">
                    {m.name}{num(m.price) > 0 ? ` +${money(m.price)}` : ''}{m.is_default ? ' ✓' : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t border-surface-4 pt-4">
            <p className="input-label">Γρήγορη προσθήκη</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {PRESETS.map(p => (
                <button key={p.label} className="btn btn-secondary btn-sm"
                        onClick={() => setDraft({ ...p.group, item_id: itemId,
                                                  sort_order: groups.length + 1,
                                                  modifiers: p.group.modifiers.map(m => ({ ...m })) })}>
                  {p.label}
                </button>
              ))}
              <button className="btn btn-primary btn-sm"
                      onClick={() => setDraft(emptyGroup(itemId, groups.length + 1))}>
                + Νέα ομάδα
              </button>
            </div>
          </div>
        </div>
      )}

      {draft && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Όνομα ομάδας *" hint="π.χ. Extras, Μέγεθος, Ψήσιμο">
              <TextInput value={draft.name} onChange={e => setDraftField({ name: e.target.value })} />
            </Field>
            <Field label="Μέγιστες επιλογές" hint="1 = ο πελάτης διαλέγει μία μόνο (radio)">
              <TextInput type="number" min={1} value={draft.max_select}
                         onChange={e => setDraftField({ max_select: Math.max(1, Number(e.target.value)) })} />
            </Field>
          </div>
          <CheckRow label="Υποχρεωτική επιλογή"
                    hint="Ο πελάτης πρέπει να διαλέξει πριν προσθέσει το προϊόν"
                    checked={draft.is_required}
                    onChange={v => setDraftField({ is_required: v, min_select: v ? 1 : 0 })} />

          <div>
            <p className="input-label">Επιλογές</p>
            <div className="space-y-2">
              {draft.modifiers.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <TextInput className="flex-1" placeholder="Όνομα επιλογής" value={m.name}
                             onChange={e => setOption(i, { name: e.target.value })} />
                  <TextInput className="w-28" type="number" step="0.10" placeholder="0.00" value={m.price}
                             onChange={e => setOption(i, { price: Number(e.target.value) })} />
                  <label className="flex items-center gap-1 text-[11px] text-ink-2 whitespace-nowrap">
                    <input type="checkbox" className="accent-brand w-4 h-4" checked={m.is_default}
                           onChange={e => setOption(i, { is_default: e.target.checked })} />
                    προεπιλογή
                  </label>
                  <button className="btn-icon text-danger"
                          onClick={() => setDraft(d => d ? {
                            ...d, modifiers: d.modifiers.filter((_, x) => x !== i),
                          } : d)}>✕</button>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm mt-2"
                    onClick={() => setDraft(d => d ? {
                      ...d,
                      modifiers: [...d.modifiers, { name: '', price: 0, is_default: false, sort_order: d.modifiers.length + 1 }],
                    } : d)}>
              + Επιλογή
            </button>
          </div>

          <div className="flex justify-end gap-2 border-t border-surface-4 pt-4">
            <button className="btn btn-secondary btn-md" onClick={() => setDraft(null)}>Άκυρο</button>
            <button className="btn btn-primary btn-md" disabled={!draft.name.trim() || save.isPending}
                    onClick={() => save.mutate(draft)}>
              {save.isPending ? 'Αποθήκευση…' : 'Αποθήκευση ομάδας'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
