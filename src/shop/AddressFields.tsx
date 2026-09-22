import { useI18n } from '@/lib/i18n'
import { type CustomerAddress } from '@/guest/guestCart'
import type { StandaloneStore } from '@/lib/api'

/**
 * Where a walk-up customer says they live. With zones drawn the area is a
 * dropdown — picking from the list is the only way to be sure the order can
 * actually be priced and delivered; without zones it is a free text field.
 */
export default function AddressFields({ store, value, onChange }: {
  store: StandaloneStore
  value: CustomerAddress
  onChange: (next: CustomerAddress) => void
}) {
  const { t } = useI18n()
  const set = (patch: Partial<CustomerAddress>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-3">
      {store.zones_required ? (
        <div>
          <label className="input-label" htmlFor="a-area">{t('shop.chooseArea')} *</label>
          <select
            id="a-area"
            className="input-field"
            value={value.area}
            onChange={e => {
              const zone = store.zones.find(z => z.area === e.target.value)
              set({
                area: e.target.value,
                city: zone?.city ?? value.city,
                postal_code: zone?.postal_code ?? value.postal_code,
              })
            }}
          >
            <option value="">{t('shop.chooseAreaPh')}</option>
            {store.zones.map(z => (
              <option key={z.id} value={z.area ?? z.name}>{z.area ?? z.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="input-label" htmlFor="a-area">{t('shop.areaFree')} *</label>
          <input id="a-area" className="input-field" value={value.area}
                 onChange={e => set({ area: e.target.value })} placeholder={t('shop.areaFreePh')} />
        </div>
      )}

      <div>
        <label className="input-label" htmlFor="a-street">{t('shop.street')} *</label>
        <input id="a-street" className="input-field" value={value.street} autoComplete="street-address"
               onChange={e => set({ street: e.target.value })} placeholder={t('shop.streetPh')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="input-label" htmlFor="a-floor">{t('shop.floor')}</label>
          <input id="a-floor" className="input-field" value={value.floor}
                 onChange={e => set({ floor: e.target.value })} placeholder={t('shop.floorPh')} />
        </div>
        <div>
          <label className="input-label" htmlFor="a-bell">{t('shop.doorbell')}</label>
          <input id="a-bell" className="input-field" value={value.doorbell}
                 onChange={e => set({ doorbell: e.target.value })} placeholder={t('shop.doorbellPh')} />
        </div>
      </div>

      <div>
        <label className="input-label" htmlFor="a-notes">{t('shop.addressNotes')}</label>
        <input id="a-notes" className="input-field" value={value.notes} maxLength={200}
               onChange={e => set({ notes: e.target.value })} placeholder={t('shop.addressNotesPh')} />
      </div>

      <p className="text-[11px] text-ink-3">{t('shop.addressSaved')}</p>
    </div>
  )
}
