import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'el' | 'en'

// ── Dictionaries ─────────────────────────────────────────────
const dict = {
  el: {
    // generic
    'app.name': 'Delivr',
    'common.back': 'Πίσω',
    'common.close': 'Κλείσιμο',
    'common.cancel': 'Άκυρο',
    'common.save': 'Αποθήκευση',
    'common.saving': 'Αποθήκευση…',
    'common.saved': 'Αποθηκεύτηκε',
    'common.delete': 'Διαγραφή',
    'common.edit': 'Επεξεργασία',
    'common.add': 'Προσθήκη',
    'common.search': 'Αναζήτηση',
    'common.loading': 'Φόρτωση…',
    'common.retry': 'Δοκιμάστε ξανά',
    'common.error': 'Παρουσιάστηκε σφάλμα',
    'common.yes': 'Ναι',
    'common.no': 'Όχι',
    'common.all': 'Όλα',
    'common.min': 'λεπτά',
    'common.free': 'Δωρεάν',
    'common.optional': 'προαιρετικό',
    'common.required': 'υποχρεωτικό',
    'common.copy': 'Αντιγραφή',
    'common.copied': 'Αντιγράφηκε',
    'common.print': 'Εκτύπωση',
    'common.total': 'Σύνολο',

    // guest landing
    'guest.deliverTo': 'Παράδοση σε',
    'guest.delivery': 'Delivery',
    'guest.takeaway': 'Take away',
    'guest.noStores': 'Δεν βρέθηκαν καταστήματα που εξυπηρετούν αυτή τη διεύθυνση.',
    'guest.noStoresHint': 'Δοκιμάστε την άλλη κατηγορία ή επικοινωνήστε με τον οικοδεσπότη.',
    'guest.searchStores': 'Αναζήτηση καταστήματος ή φαγητού',
    'guest.closed': 'Κλειστό',
    'guest.open': 'Ανοιχτό',
    'guest.minOrder': 'Ελάχιστη παραγγελία',
    'guest.deliveryFee': 'Μεταφορικά',
    'guest.freeOver': 'Δωρεάν άνω των',
    'guest.pickupHere': 'Παραλαβή από το κατάστημα',
    'guest.eta': 'Χρόνος',
    'guest.propertyNotFound': 'Το QR δεν αντιστοιχεί σε ενεργό κατάλυμα.',
    'guest.poweredBy': 'με την υποστήριξη του',

    // store / menu
    'store.menu': 'Μενού',
    'store.info': 'Πληροφορίες',
    'store.popular': 'Δημοφιλή',
    'store.unavailable': 'Μη διαθέσιμο',
    'store.addToCart': 'Προσθήκη',
    'store.extras': 'Extras',
    'store.itemNotes': 'Σχόλια για το προϊόν',
    'store.itemNotesPh': 'π.χ. χωρίς κρεμμύδι',
    'store.closedNow': 'Το κατάστημα είναι κλειστό αυτή τη στιγμή',
    'store.takeawayDiscount': 'Έκπτωση take away',

    // cart
    'cart.title': 'Το καλάθι σου',
    'cart.empty': 'Το καλάθι είναι άδειο',
    'cart.subtotal': 'Υποσύνολο',
    'cart.discount': 'Έκπτωση',
    'cart.deliveryFee': 'Μεταφορικά',
    'cart.total': 'Σύνολο',
    'cart.checkout': 'Ολοκλήρωση παραγγελίας',
    'cart.addMore': 'Πρόσθεσε ακόμη',
    'cart.minOrderWarn': 'Ελάχιστη παραγγελία {amount}. Λείπουν {missing}.',
    'cart.clear': 'Άδειασμα καλαθιού',

    // checkout
    'checkout.title': 'Στοιχεία παραγγελίας',
    'checkout.name': 'Ονοματεπώνυμο',
    'checkout.namePh': 'Το όνομά σου',
    'checkout.phone': 'Τηλέφωνο',
    'checkout.phonePh': 'π.χ. 6944123456',
    'checkout.email': 'Email',
    'checkout.emailPh': 'για επιβεβαίωση (προαιρετικό)',
    'checkout.notes': 'Σχόλια προς το κατάστημα',
    'checkout.notesPh': 'π.χ. να χτυπήσετε το κουδούνι',
    'checkout.address': 'Διεύθυνση παράδοσης',
    'checkout.payment': 'Τρόπος πληρωμής',
    'checkout.cash': 'Μετρητά κατά την παράδοση',
    'checkout.cashPickup': 'Μετρητά κατά την παραλαβή',
    'checkout.card': 'Κάρτα online',
    'checkout.cardSoon': 'Σύντομα διαθέσιμο',
    'checkout.place': 'Αποστολή παραγγελίας',
    'checkout.placing': 'Αποστολή…',
    'checkout.schedule': 'Προγραμματισμός',
    'checkout.asap': 'Το συντομότερο',
    'checkout.later': 'Για αργότερα',
    'checkout.terms': 'Στέλνοντας την παραγγελία, το κατάστημα λαμβάνει τα στοιχεία σου για να την εκτελέσει.',

    // order status
    'order.title': 'Η παραγγελία σου',
    'order.number': 'Αρ. παραγγελίας',
    'order.status.pending': 'Αναμονή επιβεβαίωσης',
    'order.status.confirmed': 'Επιβεβαιώθηκε',
    'order.status.preparing': 'Ετοιμάζεται',
    'order.status.ready': 'Έτοιμη',
    'order.status.picked_up': 'Παραλήφθηκε',
    'order.status.on_the_way': 'Καθ’ οδόν',
    'order.status.delivered': 'Παραδόθηκε',
    'order.status.cancelled': 'Ακυρώθηκε',
    'order.pendingHint': 'Περιμένουμε το κατάστημα να επιβεβαιώσει.',
    'order.readyIn': 'Έτοιμη σε ~{min} λεπτά',
    'order.callStore': 'Κλήση καταστήματος',
    'order.sendWhatsapp': 'Αποστολή στο WhatsApp',
    'order.whatsappHint': 'Στείλε την παραγγελία και στο WhatsApp του καταστήματος για ταχύτερη επιβεβαίωση.',
    'order.rejected': 'Η παραγγελία απορρίφθηκε',
    'order.trackAgain': 'Νέα παραγγελία',
    'order.saveLink': 'Αποθήκευσε αυτόν τον σύνδεσμο για να βλέπεις την πορεία.',

    // errors from RPC
    'err.STORE_CLOSED': 'Το κατάστημα είναι κλειστό.',
    'err.OUT_OF_RANGE': 'Το κατάστημα δεν παραδίδει στη διεύθυνσή σου.',
    'err.MIN_ORDER': 'Δεν καλύπτεται η ελάχιστη παραγγελία.',
    'err.EMPTY_CART': 'Το καλάθι είναι άδειο.',
    'err.NAME_REQUIRED': 'Συμπλήρωσε το όνομά σου.',
    'err.PHONE_REQUIRED': 'Συμπλήρωσε έγκυρο τηλέφωνο.',
    'err.EMAIL_REQUIRED': 'Συμπλήρωσε email.',
    'err.ITEM_UNAVAILABLE': 'Κάποιο προϊόν δεν είναι πλέον διαθέσιμο.',
    'err.RATE_LIMIT': 'Πολλές παραγγελίες σε σύντομο διάστημα. Δοκίμασε σε λίγο.',
    'err.PROPERTY_NOT_FOUND': 'Το κατάλυμα δεν βρέθηκε.',
    'err.STORE_NOT_FOUND': 'Το κατάστημα δεν βρέθηκε.',
    'err.ORDER_NOT_FOUND': 'Η παραγγελία δεν βρέθηκε.',
    'err.ORDER_CLOSED': 'Η παραγγελία έχει ήδη κλείσει.',
    'err.STORE_NO_CASH': 'Το κατάστημα δεν δέχεται μετρητά.',
    'err.generic': 'Κάτι πήγε στραβά. Δοκίμασε ξανά.',
  },
  en: {
    'app.name': 'Delivr',
    'common.back': 'Back',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.saving': 'Saving…',
    'common.saved': 'Saved',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.loading': 'Loading…',
    'common.retry': 'Try again',
    'common.error': 'An error occurred',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.all': 'All',
    'common.min': 'min',
    'common.free': 'Free',
    'common.optional': 'optional',
    'common.required': 'required',
    'common.copy': 'Copy',
    'common.copied': 'Copied',
    'common.print': 'Print',
    'common.total': 'Total',

    'guest.deliverTo': 'Delivering to',
    'guest.delivery': 'Delivery',
    'guest.takeaway': 'Take away',
    'guest.noStores': 'No places deliver to this address yet.',
    'guest.noStoresHint': 'Try the other tab or ask your host.',
    'guest.searchStores': 'Search for a place or dish',
    'guest.closed': 'Closed',
    'guest.open': 'Open',
    'guest.minOrder': 'Min. order',
    'guest.deliveryFee': 'Delivery',
    'guest.freeOver': 'Free over',
    'guest.pickupHere': 'Pick up at the store',
    'guest.eta': 'ETA',
    'guest.propertyNotFound': 'This QR code is not linked to an active property.',
    'guest.poweredBy': 'powered by',

    'store.menu': 'Menu',
    'store.info': 'Info',
    'store.popular': 'Popular',
    'store.unavailable': 'Unavailable',
    'store.addToCart': 'Add',
    'store.extras': 'Extras',
    'store.itemNotes': 'Item notes',
    'store.itemNotesPh': 'e.g. no onions',
    'store.closedNow': 'This place is closed right now',
    'store.takeawayDiscount': 'Take away discount',

    'cart.title': 'Your cart',
    'cart.empty': 'Your cart is empty',
    'cart.subtotal': 'Subtotal',
    'cart.discount': 'Discount',
    'cart.deliveryFee': 'Delivery fee',
    'cart.total': 'Total',
    'cart.checkout': 'Continue to checkout',
    'cart.addMore': 'Add more items',
    'cart.minOrderWarn': 'Minimum order {amount}. Add {missing} more.',
    'cart.clear': 'Clear cart',

    'checkout.title': 'Order details',
    'checkout.name': 'Full name',
    'checkout.namePh': 'Your name',
    'checkout.phone': 'Phone',
    'checkout.phonePh': 'e.g. +30 694 412 3456',
    'checkout.email': 'Email',
    'checkout.emailPh': 'for confirmation (optional)',
    'checkout.notes': 'Notes for the store',
    'checkout.notesPh': 'e.g. please ring the bell',
    'checkout.address': 'Delivery address',
    'checkout.payment': 'Payment method',
    'checkout.cash': 'Cash on delivery',
    'checkout.cashPickup': 'Cash on pickup',
    'checkout.card': 'Card online',
    'checkout.cardSoon': 'Coming soon',
    'checkout.place': 'Send order',
    'checkout.placing': 'Sending…',
    'checkout.schedule': 'Timing',
    'checkout.asap': 'As soon as possible',
    'checkout.later': 'Schedule for later',
    'checkout.terms': 'By sending this order the store receives your details in order to fulfil it.',

    'order.title': 'Your order',
    'order.number': 'Order no.',
    'order.status.pending': 'Waiting for confirmation',
    'order.status.confirmed': 'Confirmed',
    'order.status.preparing': 'Being prepared',
    'order.status.ready': 'Ready',
    'order.status.picked_up': 'Picked up',
    'order.status.on_the_way': 'On the way',
    'order.status.delivered': 'Delivered',
    'order.status.cancelled': 'Cancelled',
    'order.pendingHint': 'Waiting for the store to confirm.',
    'order.readyIn': 'Ready in ~{min} min',
    'order.callStore': 'Call the store',
    'order.sendWhatsapp': 'Send on WhatsApp',
    'order.whatsappHint': 'Send the order on WhatsApp too for a faster confirmation.',
    'order.rejected': 'The order was rejected',
    'order.trackAgain': 'New order',
    'order.saveLink': 'Keep this link to follow your order.',

    'err.STORE_CLOSED': 'The store is closed.',
    'err.OUT_OF_RANGE': 'This store does not deliver to your address.',
    'err.MIN_ORDER': 'Minimum order not reached.',
    'err.EMPTY_CART': 'Your cart is empty.',
    'err.NAME_REQUIRED': 'Please enter your name.',
    'err.PHONE_REQUIRED': 'Please enter a valid phone number.',
    'err.EMAIL_REQUIRED': 'Please enter your email.',
    'err.ITEM_UNAVAILABLE': 'An item is no longer available.',
    'err.RATE_LIMIT': 'Too many orders in a short time. Please wait a moment.',
    'err.PROPERTY_NOT_FOUND': 'Property not found.',
    'err.STORE_NOT_FOUND': 'Store not found.',
    'err.ORDER_NOT_FOUND': 'Order not found.',
    'err.ORDER_CLOSED': 'This order is already closed.',
    'err.STORE_NO_CASH': 'This store does not accept cash.',
    'err.generic': 'Something went wrong. Please try again.',
  },
} as const

export type TKey = keyof typeof dict.el

const STORAGE_KEY = 'delivr_lang'

export function detectLang(preferred?: string | null): Lang {
  if (preferred === 'el' || preferred === 'en') return preferred
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'el' || saved === 'en') return saved
  } catch { /* private mode */ }
  return navigator.language?.toLowerCase().startsWith('el') ? 'el' : 'en'
}

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue>({
  lang: 'el',
  setLang: () => {},
  t: (k) => dict.el[k] ?? String(k),
})

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initial ?? detectLang())

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* private mode */ }
  }

  const t = (key: TKey, vars?: Record<string, string | number>) => {
    let out: string = (dict[lang] as Record<string, string>)[key] ?? (dict.el as Record<string, string>)[key] ?? String(key)
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v))
    return out
  }

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)

/** Visible EN/ΕΛ switcher. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n()
  return (
    <div className={`inline-flex rounded-full border border-surface-4 bg-surface-1 p-0.5 ${className}`}>
      {(['el', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition
            ${lang === l ? 'bg-ink-1 text-white' : 'text-ink-2'}`}
        >
          {l === 'el' ? 'ΕΛ' : 'EN'}
        </button>
      ))}
    </div>
  )
}
