import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import {
  useAdminProperties, useUpsertProperty, useDeleteProperty, useBulkCreateProperties,
  usePlatformSettings, type AdminProperty,
} from '../hooks'
import { Card, Field, TextInput, TextArea, Select, CheckRow, Modal, downloadFile, toCsv } from '../ui'
import { num } from '@/lib/format'
import { Spinner } from '@/components/ui'

const TYPES = [
  ['villa', 'Βίλα'], ['apartment', 'Διαμέρισμα'], ['hotel_room', 'Δωμάτιο ξενοδοχείου'],
  ['house', 'Κατοικία'], ['office', 'Γραφείο'], ['other', 'Άλλο'],
]

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'   // no I/O/0/1 — easier to read on a printed card

function randomCode(len = 6) {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

function qrUrl(appUrl: string, code: string) {
  return `${(appUrl || window.location.origin).replace(/\/$/, '')}/qr/${code}`
}

// ── QR card: shown on screen, printed as a table tent ────────
function QrCard({ property, appUrl, onClose }: {
  property: AdminProperty; appUrl: string; onClose: () => void
}) {
  const [dataUrl, setDataUrl] = useState('')
  const url = qrUrl(appUrl, property.code)

  useEffect(() => {
    void QRCode.toDataURL(url, { width: 900, margin: 1, errorCorrectionLevel: 'M' })
      .then(setDataUrl)
      .catch(() => toast.error('Αποτυχία δημιουργίας QR'))
  }, [url])

  return (
    <Modal title={`QR — ${property.name}`} onClose={onClose}>
      <div className="qr-print flex flex-col items-center text-center gap-3 py-4">
        <p className="font-display font-black text-2xl text-ink-1">{property.name}</p>
        <p className="text-sm text-ink-2">Φαγητό & market στην πόρτα σου</p>
        {dataUrl
          ? <img src={dataUrl} alt={`QR ${property.code}`} className="w-56 h-56" />
          : <div className="w-56 h-56 flex items-center justify-center"><Spinner /></div>}
        <p className="font-mono font-bold text-lg tracking-widest">{property.code}</p>
        <p className="text-xs text-ink-3 break-all">{url}</p>
        <p className="text-xs text-ink-2 max-w-xs">
          Σκάναρε τον κωδικό με την κάμερα του κινητού σου και δες τι παραδίδει στη διεύθυνσή μας.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-end border-t border-surface-4 pt-4 no-print">
        <button className="btn btn-secondary btn-md"
                onClick={() => { void navigator.clipboard.writeText(url); toast.success('Ο σύνδεσμος αντιγράφηκε') }}>
          📋 Αντιγραφή συνδέσμου
        </button>
        <a className="btn btn-secondary btn-md" href={dataUrl} download={`qr-${property.code}.png`}>
          ⬇️ Λήψη PNG
        </a>
        <a className="btn btn-secondary btn-md" href={url} target="_blank" rel="noopener noreferrer">↗ Άνοιγμα</a>
        <button className="btn btn-primary btn-md" onClick={() => window.print()}>🖨️ Εκτύπωση κάρτας</button>
      </div>
    </Modal>
  )
}

// ── Bulk import ──────────────────────────────────────────────
interface ImportRow extends Partial<AdminProperty> { _error?: string }

function normaliseImportRow(r: Record<string, unknown>, existingCodes: Set<string>): ImportRow {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(r).find(rk => rk.toLowerCase().trim() === k)
      if (found && r[found] !== undefined && r[found] !== null && String(r[found]).trim() !== '') {
        return String(r[found]).trim()
      }
    }
    return ''
  }

  const name = pick('name', 'όνομα', 'ονομα', 'property', 'title', 'public_name')
  const address = pick('address', 'διεύθυνση', 'διευθυνση', 'display')
  let code = pick('code', 'κωδικός', 'κωδικος').toUpperCase()

  if (!code) {
    do { code = randomCode() } while (existingCodes.has(code))
  }
  existingCodes.add(code)

  const latRaw = pick('lat', 'latitude', 'πλάτος')
  const lngRaw = pick('lng', 'lon', 'longitude', 'μήκος')

  return {
    code,
    name,
    address,
    type: (pick('type', 'τύπος', 'τυπος') || 'villa').toLowerCase(),
    city: pick('city', 'πόλη', 'πολη') || null,
    area: pick('area', 'περιοχή', 'περιοχη', 'region') || null,
    postal_code: pick('postal_code', 'postcode', 'zip', 'τκ', 'τ.κ.') || null,
    lat: latRaw ? Number(latRaw.replace(',', '.')) : null,
    lng: lngRaw ? Number(lngRaw.replace(',', '.')) : null,
    owner_name: pick('owner', 'owner_name', 'ιδιοκτήτης') || null,
    contact_phone: pick('phone', 'τηλέφωνο', 'τηλεφωνο') || null,
    contact_email: pick('email') || null,
    whatsapp: pick('whatsapp') || null,
    floor: pick('floor', 'όροφος', 'οροφος') || null,
    doorbell: pick('doorbell', 'κουδούνι', 'κουδουνι') || null,
    access_notes: pick('notes', 'access_notes', 'σημειώσεις') || null,
    external_source: pick('source', 'external_source') || null,
    external_ref: pick('external_ref', 'uuid', 'id') || null,
    is_active: true,
    _error: !name ? 'Λείπει το όνομα' : !address ? 'Λείπει η διεύθυνση' : undefined,
  }
}

function splitCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const delim = [';', ',', '\t'].sort((a, b) =>
    (lines[0].split(b).length - 1) - (lines[0].split(a).length - 1))[0]
  const row = (line: string) => {
    const out: string[] = []
    let cur = '', quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted }
      else if (ch === delim && !quoted) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out.map(s => s.trim())
  }
  const headers = row(lines[0])
  return lines.slice(1).map(l => {
    const cells = row(l)
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']))
  })
}

function ImportModal({ existing, onClose }: { existing: AdminProperty[]; onClose: () => void }) {
  const bulk = useBulkCreateProperties()
  const fileRef = useRef<HTMLInputElement>(null)
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])

  const analyse = (text: string) => {
    const codes = new Set(existing.map(p => p.code.toUpperCase()))
    let records: Record<string, unknown>[] = []
    const trimmed = text.trim()
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed)
        records = Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.properties ?? parsed.items ?? [])
      } catch {
        toast.error('Μη έγκυρο JSON')
        return
      }
    } else {
      records = splitCsv(trimmed)
    }
    if (records.length === 0) { toast.error('Δεν βρέθηκαν γραμμές'); return }
    setRows(records.map(r => normaliseImportRow(r, codes)))
  }

  const valid = rows.filter(r => !r._error)

  return (
    <Modal title="Μαζική εισαγωγή καταλυμάτων" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-ink-2">
          Επικόλλησε CSV ή JSON. Αναγνωρίζονται οι στήλες <code className="text-xs">name, address, city, area,
          postal_code, lat, lng, phone, email, whatsapp, code, floor, doorbell, notes</code> (και τα ελληνικά
          αντίστοιχα). Όπου λείπει κωδικός, δημιουργείται αυτόματα μοναδικός κωδικός QR.
        </p>

        <textarea className="input-field font-mono text-xs min-h-[180px] resize-y"
                  placeholder={'name;address;area;postal_code;lat;lng\nVilla Sunrise;Σχίσμα 14;Ελούντα;72053;35.26;25.72'}
                  value={raw} onChange={e => setRaw(e.target.value)} />

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary btn-md" disabled={!raw.trim()} onClick={() => analyse(raw)}>
            Ανάλυση
          </button>
          <button className="btn btn-secondary btn-md" onClick={() => fileRef.current?.click()}>
            📄 Επιλογή αρχείου
          </button>
          <input ref={fileRef} type="file" accept=".csv,.json,.txt,.tsv" className="hidden"
                 onChange={async e => {
                   const f = e.target.files?.[0]
                   if (!f) return
                   const text = await f.text()
                   setRaw(text); analyse(text)
                 }} />
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex gap-2 items-center">
              <span className="badge badge-green">{valid.length} έτοιμα</span>
              {rows.length - valid.length > 0 && (
                <span className="badge bg-red-100 text-danger">{rows.length - valid.length} με σφάλμα</span>
              )}
            </div>
            <div className="max-h-[40vh] overflow-y-auto border border-surface-4 rounded-xl">
              <table className="dash-table">
                <thead className="sticky top-0 bg-surface-1">
                  <tr><th>Κωδικός</th><th>Όνομα</th><th>Διεύθυνση</th><th>Περιοχή</th><th>Τ.Κ.</th><th>Συντ/νες</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={r._error ? 'bg-red-50' : ''}>
                      <td className="font-mono text-xs">{r.code}</td>
                      <td>{r.name || <span className="text-danger">—</span>}</td>
                      <td className="text-ink-2">{r.address || <span className="text-danger">—</span>}</td>
                      <td className="text-ink-2">{r.area ?? '—'}</td>
                      <td className="text-ink-2">{r.postal_code ?? '—'}</td>
                      <td className="text-xs text-ink-3">
                        {r.lat && r.lng ? `${num(r.lat).toFixed(4)}, ${num(r.lng).toFixed(4)}` : '—'}
                      </td>
                      <td className="text-xs text-danger">{r._error ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t border-surface-4 pt-4">
              <button className="btn btn-secondary btn-md" onClick={onClose}>Άκυρο</button>
              <button className="btn btn-primary btn-md" disabled={valid.length === 0 || bulk.isPending}
                      onClick={() => bulk.mutate(
                        valid.map(({ _error, ...rest }) => { void _error; return rest }),
                        {
                          onSuccess: (created) => { toast.success(`Εισήχθησαν ${created.length} καταλύματα`); onClose() },
                          onError: (e) => toast.error((e as Error).message),
                        })}>
                {bulk.isPending ? 'Εισαγωγή…' : `Εισαγωγή ${valid.length}`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── Property editor ──────────────────────────────────────────
function PropertyEditor({ property, onClose }: { property: Partial<AdminProperty>; onClose: () => void }) {
  const [form, setForm] = useState<Partial<AdminProperty>>(property)
  const upsert = useUpsertProperty()
  const set = (patch: Partial<AdminProperty>) => setForm(f => ({ ...f, ...patch }))

  return (
    <Modal title={form.id ? `Επεξεργασία — ${form.name}` : 'Νέο κατάλυμα'} onClose={onClose} wide>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Όνομα *">
          <TextInput value={form.name ?? ''} onChange={e => set({ name: e.target.value })} />
        </Field>
        <Field label="Κωδικός QR *" hint="Εμφανίζεται στην κάρτα και στο URL /qr/ΚΩΔΙΚΟΣ">
          <div className="flex gap-2">
            <TextInput value={form.code ?? ''} className="font-mono uppercase"
                       onChange={e => set({ code: e.target.value.toUpperCase() })} />
            <button className="btn btn-secondary btn-md" onClick={() => set({ code: randomCode() })}>🎲</button>
          </div>
        </Field>
        <Field label="Τύπος">
          <Select value={form.type ?? 'villa'} onChange={e => set({ type: e.target.value })}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Γλώσσα guest">
          <Select value={form.default_language ?? 'el'} onChange={e => set({ default_language: e.target.value })}>
            <option value="el">Ελληνικά</option>
            <option value="en">English</option>
          </Select>
        </Field>

        <div className="md:col-span-2 border-t border-surface-4 pt-2">
          <p className="input-label">Διεύθυνση — καθορίζει ποια καταστήματα βλέπει ο επισκέπτης</p>
        </div>
        <Field label="Διεύθυνση *">
          <TextInput value={form.address ?? ''} onChange={e => set({ address: e.target.value })} />
        </Field>
        <Field label="Περιοχή" hint="Πρέπει να ταιριάζει με τις ζώνες των καταστημάτων">
          <TextInput value={form.area ?? ''} onChange={e => set({ area: e.target.value })} />
        </Field>
        <Field label="Πόλη">
          <TextInput value={form.city ?? ''} onChange={e => set({ city: e.target.value })} />
        </Field>
        <Field label="Ταχυδρομικός κώδικας">
          <TextInput value={form.postal_code ?? ''} onChange={e => set({ postal_code: e.target.value })} />
        </Field>
        <Field label="Γεωγραφικό πλάτος (lat)" hint="Για αντιστοίχιση με ακτίνα km">
          <TextInput type="number" step="0.000001" value={form.lat ?? ''}
                     onChange={e => set({ lat: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Γεωγραφικό μήκος (lng)">
          <TextInput type="number" step="0.000001" value={form.lng ?? ''}
                     onChange={e => set({ lng: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Όροφος"><TextInput value={form.floor ?? ''} onChange={e => set({ floor: e.target.value })} /></Field>
        <Field label="Κουδούνι"><TextInput value={form.doorbell ?? ''} onChange={e => set({ doorbell: e.target.value })} /></Field>
        <div className="md:col-span-2">
          <Field label="Οδηγίες πρόσβασης" hint="Εμφανίζονται στον διανομέα και στο δελτίο εκτύπωσης">
            <TextArea rows={2} value={form.access_notes ?? ''} onChange={e => set({ access_notes: e.target.value })} />
          </Field>
        </div>

        <div className="md:col-span-2 border-t border-surface-4 pt-2">
          <p className="input-label">Ιδιοκτήτης / διαχειριστής</p>
        </div>
        <Field label="Όνομα ιδιοκτήτη">
          <TextInput value={form.owner_name ?? ''} onChange={e => set({ owner_name: e.target.value })} />
        </Field>
        <Field label="Τηλέφωνο">
          <TextInput value={form.contact_phone ?? ''} onChange={e => set({ contact_phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={form.contact_email ?? ''} onChange={e => set({ contact_email: e.target.value })} />
        </Field>
        <Field label="WhatsApp">
          <TextInput value={form.whatsapp ?? ''} onChange={e => set({ whatsapp: e.target.value })} />
        </Field>

        <div className="md:col-span-2 border-t border-surface-4 pt-2">
          <p className="input-label">Οικονομικά καταλύματος</p>
        </div>
        <Field label="Τρόπος" hint="«Απόδοση» = εισπράττει το κατάλυμα · «Χρέωση» = πληρώνει το κατάλυμα">
          <Select value={form.billing_mode ?? 'inherit'}
                  onChange={e => set({ billing_mode: e.target.value as AdminProperty['billing_mode'] })}>
            <option value="inherit">Κληρονομεί από την πλατφόρμα</option>
            <option value="none">Καμία κίνηση</option>
            <option value="commission">Ποσοστό ανά παραγγελία</option>
            <option value="flat">Σταθερό ποσό ανά παραγγελία</option>
          </Select>
        </Field>
        <Field label={form.billing_mode === 'flat' ? 'Ποσό (€)' : 'Ποσοστό (%)'}>
          <TextInput type="number" step="0.01" value={form.billing_value ?? 0}
                     disabled={form.billing_mode === 'inherit' || form.billing_mode === 'none'}
                     onChange={e => set({ billing_value: Number(e.target.value) })} />
        </Field>
        <Field label="Κατεύθυνση">
          <Select value={form.billing_direction ?? 'inherit'}
                  disabled={form.billing_mode === 'inherit' || form.billing_mode === 'none'}
                  onChange={e => set({ billing_direction: e.target.value as AdminProperty['billing_direction'] })}>
            <option value="inherit">Κληρονομεί</option>
            <option value="payout">Απόδοση προς το κατάλυμα</option>
            <option value="charge">Χρέωση του καταλύματος</option>
          </Select>
        </Field>

        <div className="md:col-span-2">
          <Field label="Μήνυμα καλωσορίσματος" hint="Εμφανίζεται στον επισκέπτη μόλις σκανάρει">
            <TextArea rows={2} value={form.welcome_message ?? ''}
                      onChange={e => set({ welcome_message: e.target.value })} />
          </Field>
        </div>
        <CheckRow label="Ενεργό" hint="Ανενεργό = το QR δεν λειτουργεί"
                  checked={form.is_active ?? true} onChange={v => set({ is_active: v })} />
      </div>

      <div className="flex gap-2 justify-end mt-5 border-t border-surface-4 pt-4">
        <button className="btn btn-secondary btn-md" onClick={onClose}>Άκυρο</button>
        <button className="btn btn-primary btn-md"
                disabled={!form.name || !form.address || !form.code || upsert.isPending}
                onClick={() => upsert.mutate(form, {
                  onSuccess: () => { toast.success('Αποθηκεύτηκε'); onClose() },
                  onError: (e) => toast.error((e as Error).message),
                })}>
          {upsert.isPending ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
      </div>
    </Modal>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function PropertiesPage() {
  const propsQ = useAdminProperties()
  const settingsQ = usePlatformSettings()
  const remove = useDeleteProperty()
  const [editing, setEditing] = useState<Partial<AdminProperty> | null>(null)
  const [qrFor, setQrFor] = useState<AdminProperty | null>(null)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')

  const all = propsQ.data ?? []
  const appUrl = settingsQ.data?.app_url ?? window.location.origin
  const list = all.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    (p.area ?? '').toLowerCase().includes(search.toLowerCase()))

  const exportCsv = () => downloadFile(
    `delivr-properties-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(all.map(p => ({
      code: p.code, name: p.name, type: p.type, address: p.address, area: p.area,
      city: p.city, postal_code: p.postal_code, lat: p.lat, lng: p.lng,
      phone: p.contact_phone, email: p.contact_email, whatsapp: p.whatsapp,
      qr_url: qrUrl(appUrl, p.code), scans: p.scan_count, active: p.is_active,
    }))), 'text/csv;charset=utf-8')

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-3 items-center">
          <TextInput className="max-w-xs" placeholder="Αναζήτηση ονόματος, κωδικού ή περιοχής"
                     value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-2 ml-auto">
            <button className="btn btn-secondary btn-md" onClick={exportCsv} disabled={all.length === 0}>⬇️ CSV</button>
            <button className="btn btn-secondary btn-md" onClick={() => setImporting(true)}>📥 Μαζική εισαγωγή</button>
            <button className="btn btn-primary btn-md"
                    onClick={() => setEditing({
                      code: randomCode(), name: '', address: '', type: 'villa',
                      default_language: 'el', billing_mode: 'inherit', billing_direction: 'inherit',
                      billing_value: 0, is_active: true,
                    })}>
              + Νέο κατάλυμα
            </button>
          </div>
        </div>
      </Card>

      <Card>
        {propsQ.isLoading ? (
          <div className="py-10 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Κωδικός</th><th>Κατάλυμα</th><th>Διεύθυνση</th><th>Περιοχή</th>
                  <th>Τ.Κ.</th><th>Συντ/νες</th><th>Σαρώσεις</th><th>Οικονομικά</th><th>Ενεργό</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map(p => (
                  <tr key={p.id}>
                    <td><span className="font-mono font-bold">{p.code}</span></td>
                    <td>
                      <button className="font-semibold text-ink-1 hover:text-brand text-left"
                              onClick={() => setEditing(p)}>{p.name}</button>
                      <p className="text-[11px] text-ink-3">{TYPES.find(t => t[0] === p.type)?.[1] ?? p.type}</p>
                    </td>
                    <td className="text-ink-2">{p.address}</td>
                    <td className="text-ink-2">{p.area ?? '—'}</td>
                    <td className="text-ink-2">{p.postal_code ?? '—'}</td>
                    <td className="text-xs text-ink-3">
                      {p.lat && p.lng ? `${num(p.lat).toFixed(3)}, ${num(p.lng).toFixed(3)}` :
                        <span className="text-amber-600">λείπουν</span>}
                    </td>
                    <td>{p.scan_count}</td>
                    <td className="text-xs">
                      {p.billing_mode === 'inherit' ? <span className="text-ink-3">πλατφόρμα</span>
                        : p.billing_mode === 'none' ? '—'
                        : `${p.billing_direction === 'charge' ? '−' : '+'}${num(p.billing_value)}${p.billing_mode === 'commission' ? '%' : '€'}`}
                    </td>
                    <td>{p.is_active ? '✓' : '✗'}</td>
                    <td className="whitespace-nowrap">
                      <button className="btn-icon" title="QR" onClick={() => setQrFor(p)}>🔳</button>
                      <button className="btn-icon" onClick={() => setEditing(p)}>✏️</button>
                      <button className="btn-icon text-danger" onClick={() => {
                        if (confirm(`Διαγραφή «${p.name}»; Το QR θα πάψει να λειτουργεί.`)) {
                          remove.mutate(p.id, {
                            onSuccess: () => toast.success('Διαγράφηκε'),
                            onError: (e) => toast.error((e as Error).message),
                          })
                        }
                      }}>🗑</button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-ink-3 py-8">
                    Κανένα κατάλυμα ακόμη — πρόσθεσε ένα ή κάνε μαζική εισαγωγή.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <PropertyEditor property={editing} onClose={() => setEditing(null)} />}
      {qrFor && <QrCard property={qrFor} appUrl={appUrl} onClose={() => setQrFor(null)} />}
      {importing && <ImportModal existing={all} onClose={() => setImporting(false)} />}
    </div>
  )
}
