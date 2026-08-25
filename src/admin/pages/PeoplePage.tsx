import { useState } from 'react'
import toast from 'react-hot-toast'
import { useProfiles, useUpdateProfileRole, useAdminStores, useStoreUsers } from '../hooks'
import { Card, Select, Modal, TextInput } from '../ui'
import { dateTime } from '@/lib/format'
import { Spinner } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

const ROLES = [
  ['customer', 'Πελάτης'], ['store', 'Κατάστημα'], ['driver', 'Διανομέας'], ['admin', 'Διαχειριστής'],
]

function LinkStoreModal({ userId, userName, onClose }: { userId: string; userName: string; onClose: () => void }) {
  const storesQ = useAdminStores()
  const qc = useQueryClient()
  const [storeId, setStoreId] = useState('')
  const [role, setRole] = useState('owner')
  const [saving, setSaving] = useState(false)

  const link = async () => {
    if (!storeId) return
    setSaving(true)
    const { error } = await supabase.from('store_users').insert({ store_id: storeId, user_id: userId, role })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Ο χρήστης συνδέθηκε με το κατάστημα')
    void qc.invalidateQueries({ queryKey: ['store-users'] })
    onClose()
  }

  return (
    <Modal title={`Σύνδεση «${userName}» με κατάστημα`} onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="input-label">Κατάστημα</span>
          <Select value={storeId} onChange={e => setStoreId(e.target.value)}>
            <option value="">— Επιλογή —</option>
            {(storesQ.data ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </label>
        <label className="block">
          <span className="input-label">Ρόλος στο κατάστημα</span>
          <Select value={role} onChange={e => setRole(e.target.value)}>
            <option value="owner">Ιδιοκτήτης</option>
            <option value="manager">Υπεύθυνος</option>
            <option value="staff">Προσωπικό</option>
          </Select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-secondary btn-md" onClick={onClose}>Άκυρο</button>
          <button className="btn btn-primary btn-md" disabled={!storeId || saving} onClick={link}>
            {saving ? 'Σύνδεση…' : 'Σύνδεση'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function StoreStaff() {
  const storesQ = useAdminStores()
  const [storeId, setStoreId] = useState('')
  const usersQ = useStoreUsers(storeId || null)

  return (
    <Card title="Προσωπικό καταστήματος">
      <Select className="max-w-sm mb-3" value={storeId} onChange={e => setStoreId(e.target.value)}>
        <option value="">— Επιλογή καταστήματος —</option>
        {(storesQ.data ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
      {storeId && (
        <table className="dash-table">
          <thead><tr><th>Όνομα</th><th>Email</th><th>Τηλέφωνο</th><th>Ρόλος</th></tr></thead>
          <tbody>
            {(usersQ.data ?? []).map(u => (
              <tr key={u.id}>
                <td>{u.profiles?.full_name ?? '—'}</td>
                <td className="text-ink-2">{u.profiles?.email ?? '—'}</td>
                <td className="text-ink-2">{u.profiles?.phone ?? '—'}</td>
                <td>{u.role}</td>
              </tr>
            ))}
            {(usersQ.data ?? []).length === 0 && (
              <tr><td colSpan={4} className="text-center text-ink-3 py-4">Κανένας συνδεδεμένος χρήστης.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </Card>
  )
}

export default function PeoplePage() {
  const [role, setRole] = useState('all')
  const [search, setSearch] = useState('')
  const [linking, setLinking] = useState<{ id: string; name: string } | null>(null)
  const profilesQ = useProfiles(role)
  const updateRole = useUpdateProfileRole()

  const people = (profilesQ.data ?? []).filter(p =>
    !search || (p.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.email ?? '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[160px]">
            <span className="input-label">Ρόλος</span>
            <Select value={role} onChange={e => setRole(e.target.value)}>
              <option value="all">Όλοι</option>
              {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <TextInput className="max-w-xs" placeholder="Αναζήτηση ονόματος ή email"
                     value={search} onChange={e => setSearch(e.target.value)} />
          <span className="text-sm text-ink-3 ml-auto">{people.length} χρήστες</span>
        </div>
      </Card>

      <Card title="Χρήστες">
        {profilesQ.isLoading ? (
          <div className="py-10 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead>
                <tr><th>Όνομα</th><th>Email</th><th>Τηλέφωνο</th><th>Ρόλος</th><th>Εγγραφή</th><th></th></tr>
              </thead>
              <tbody>
                {people.map(p => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.full_name || '—'}</td>
                    <td className="text-ink-2">{p.email ?? '—'}</td>
                    <td className="text-ink-2">{p.phone ?? '—'}</td>
                    <td>
                      <Select className="!py-1.5 !text-xs max-w-[150px]" value={p.role}
                              onChange={e => updateRole.mutate({ id: p.id, role: e.target.value }, {
                                onSuccess: () => toast.success('Ο ρόλος ενημερώθηκε'),
                                onError: (err) => toast.error((err as Error).message),
                              })}>
                        {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    </td>
                    <td className="text-xs text-ink-3">{dateTime(p.created_at)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm"
                              onClick={() => setLinking({ id: p.id, name: p.full_name || p.email || '' })}>
                        🔗 Κατάστημα
                      </button>
                    </td>
                  </tr>
                ))}
                {people.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-ink-3 py-8">Κανένας χρήστης.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <StoreStaff />

      {linking && <LinkStoreModal userId={linking.id} userName={linking.name} onClose={() => setLinking(null)} />}
    </div>
  )
}
