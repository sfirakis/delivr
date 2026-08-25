import { useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { parseMenu, type ParsedItem } from '@/lib/menuParser'
import { Modal, TextInput, Card } from '@/admin/ui'
import { money } from '@/lib/format'

const SAMPLE = `ΣΟΥΒΛΑΚΙΑ
Πίτα γύρο χοιρινό ........ 4,20
Πίτα γύρο κοτόπουλο ...... 4,40
με πατάτες, ντομάτα, τζατζίκι

ΜΕΡΙΔΕΣ
Μερίδα γύρο 450γρ 11,50 €

Αναψυκτικά:
Coca-Cola 330ml 1,80`

/**
 * Imports a menu a store already has: pasted text, a CSV export, or JSON.
 * Everything is editable in the preview before a single row hits the database.
 */
export default function MenuImport({ storeId, storeName, onClose }: {
  storeId: string; storeName: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState<ParsedItem[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'paste' | 'preview'>('paste')

  const categories = useMemo(
    () => Array.from(new Set(rows.map(r => r.category))),
    [rows],
  )

  const analyse = (text: string) => {
    const result = parseMenu(text)
    if (result.items.length === 0) {
      toast.error('Δεν εντοπίστηκαν προϊόντα με τιμή. Έλεγξε τη μορφή.')
      return
    }
    setRows(result.items)
    setSkipped(result.skipped)
    setStep('preview')
  }

  const onFile = async (file: File) => {
    const text = await file.text()
    setRaw(text)
    analyse(text)
  }

  const updateRow = (i: number, patch: Partial<ParsedItem>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i))

  async function save() {
    if (rows.length === 0) return
    setSaving(true)
    try {
      if (replaceExisting) {
        const { error } = await supabase.from('menu_items').delete().eq('store_id', storeId)
        if (error) throw new Error(error.message)
      }

      // Reuse existing categories, create only the missing ones.
      const { data: existingCats, error: catErr } = await supabase
        .from('menu_categories').select('id,name').eq('store_id', storeId)
      if (catErr) throw new Error(catErr.message)

      const byName = new Map((existingCats ?? []).map(c => [c.name.trim().toLowerCase(), c.id]))
      const missing = categories.filter(c => !byName.has(c.trim().toLowerCase()))

      if (missing.length > 0) {
        const { data: created, error } = await supabase.from('menu_categories')
          .insert(missing.map((name, i) => ({
            store_id: storeId, name, sort_order: (existingCats?.length ?? 0) + i + 1,
          })))
          .select('id,name')
        if (error) throw new Error(error.message)
        for (const c of created ?? []) byName.set(c.name.trim().toLowerCase(), c.id)
      }

      const payload = rows.map((r, i) => ({
        store_id: storeId,
        category_id: byName.get(r.category.trim().toLowerCase()) ?? null,
        name: r.name,
        description: r.description,
        price: r.price,
        sort_order: i + 1,
        is_available: true,
      }))

      const { error } = await supabase.from('menu_items').insert(payload)
      if (error) throw new Error(error.message)

      toast.success(`Εισήχθησαν ${payload.length} προϊόντα σε ${categories.length} κατηγορίες`)
      void qc.invalidateQueries({ queryKey: ['merchant-menu', storeId] })
      void qc.invalidateQueries({ queryKey: ['store-menu', storeId] })
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Εισαγωγή μενού — ${storeName}`} onClose={onClose} wide>
      {step === 'paste' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            Επικόλλησε το μενού του καταστήματος (από PDF, Word, Excel ή απλό κείμενο).
            Αναγνωρίζονται αυτόματα κατηγορίες, ονόματα, περιγραφές και τιμές.
            Δέχεται επίσης CSV με στήλες <code className="text-xs">category;name;description;price</code> ή JSON.
          </p>

          <textarea
            className="input-field font-mono text-xs min-h-[280px] resize-y"
            placeholder={SAMPLE}
            value={raw}
            onChange={e => setRaw(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-md" disabled={!raw.trim()} onClick={() => analyse(raw)}>
              Ανάλυση μενού
            </button>
            <button className="btn btn-secondary btn-md" onClick={() => fileRef.current?.click()}>
              📄 Επιλογή αρχείου (.csv / .txt / .json)
            </button>
            <button className="btn btn-ghost btn-md" onClick={() => { setRaw(SAMPLE); }}>
              Δείγμα
            </button>
            <input
              ref={fileRef} type="file" accept=".csv,.txt,.json,.tsv,text/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f) }}
            />
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge badge-green">{rows.length} προϊόντα</span>
            <span className="badge badge-gray">{categories.length} κατηγορίες</span>
            {skipped.length > 0 && <span className="badge badge-amber">{skipped.length} γραμμές αγνοήθηκαν</span>}
            <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setStep('paste')}>← Πίσω στο κείμενο</button>
          </div>

          <div className="max-h-[45vh] overflow-y-auto border border-surface-4 rounded-xl">
            <table className="dash-table">
              <thead className="sticky top-0 bg-surface-1 z-10">
                <tr><th>Κατηγορία</th><th>Προϊόν</th><th>Περιγραφή</th><th className="w-28">Τιμή</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <TextInput className="!py-1.5 !text-xs" value={r.category}
                                 onChange={e => updateRow(i, { category: e.target.value })} />
                    </td>
                    <td>
                      <TextInput className="!py-1.5 !text-xs" value={r.name}
                                 onChange={e => updateRow(i, { name: e.target.value })} />
                    </td>
                    <td>
                      <TextInput className="!py-1.5 !text-xs" value={r.description ?? ''}
                                 onChange={e => updateRow(i, { description: e.target.value || null })} />
                    </td>
                    <td>
                      <TextInput className="!py-1.5 !text-xs" type="number" step="0.01" value={r.price}
                                 onChange={e => updateRow(i, { price: Number(e.target.value) })} />
                    </td>
                    <td>
                      <button className="btn-icon text-danger" onClick={() => removeRow(i)} aria-label="Διαγραφή">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {skipped.length > 0 && (
            <Card title="Γραμμές που αγνοήθηκαν">
              <div className="max-h-32 overflow-y-auto text-xs text-ink-3 font-mono space-y-0.5">
                {skipped.map((s, i) => <div key={i}>{s}</div>)}
              </div>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-4 justify-between border-t border-surface-4 pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={replaceExisting} className="accent-brand w-4 h-4"
                     onChange={e => setReplaceExisting(e.target.checked)} />
              <span>Αντικατάσταση υπάρχοντος μενού (διαγράφει τα τρέχοντα προϊόντα)</span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-3">
                Σύνολο αξίας καταλόγου: {money(rows.reduce((s, r) => s + r.price, 0))}
              </span>
              <button className="btn btn-primary btn-md" disabled={saving || rows.length === 0} onClick={save}>
                {saving ? 'Εισαγωγή…' : `Εισαγωγή ${rows.length} προϊόντων`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
