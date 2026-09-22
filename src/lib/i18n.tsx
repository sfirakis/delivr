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
    'guest.pickupHeader': 'Παραλαβή από το κατάστημα',
    'guest.youAreAt': 'Βρίσκεσαι σε',
    'guest.needHelp': 'Χρειάζεσαι βοήθεια;',
    'guest.helpHint': 'Επικοινώνησε μαζί μας και θα σε εξυπηρετήσουμε.',
    'guest.callSupport': 'Κλήση',
    'guest.emailSupport': 'Email',
    'guest.whatsappSupport': 'WhatsApp',

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
    'cart.items': 'Τα προϊόντα σου',
    'cart.minProgress': 'Πρόσθεσε {missing} για να φτάσεις την ελάχιστη παραγγελία ({amount}).',
    'cart.minReached': 'Καλύπτεις την ελάχιστη παραγγελία ✓',
    'cart.freeDeliveryProgress': 'Πρόσθεσε {missing} και τα μεταφορικά γίνονται δωρεάν.',
    'cart.freeDeliveryReached': 'Κέρδισες δωρεάν μεταφορικά 🎉',

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
    'checkout.items': 'Η παραγγελία σου',
    'checkout.promo': 'Κωδικός έκπτωσης',
    'checkout.promoPh': 'π.χ. WELCOME10',
    'checkout.promoHint': 'Ο κωδικός ελέγχεται όταν σταλεί η παραγγελία.',
    'checkout.promoInvalid': 'Ο κωδικός δεν έγινε δεκτός. Δοκίμασε άλλον ή συνέχισε χωρίς.',

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
    'err.PROMO_INVALID': 'Ο κωδικός έκπτωσης δεν είναι έγκυρος.',
    'err.PROMO_EXPIRED': 'Ο κωδικός έκπτωσης έχει λήξει.',
    'err.PROMO_MIN_ORDER': 'Ο κωδικός απαιτεί μεγαλύτερη παραγγελία.',
    'err.PROMO_LIMIT': 'Ο κωδικός έχει εξαντληθεί.',
    'err.generic': 'Κάτι πήγε στραβά. Δοκίμασε ξανά.',
    'err.STANDALONE_DISABLED': 'Το κατάστημα δεν δέχεται παραγγελίες από αυτόν τον σύνδεσμο.',
    'err.ADDRESS_REQUIRED': 'Συμπλήρωσε τη διεύθυνση παράδοσης.',
    'err.AREA_REQUIRED': 'Διάλεξε περιοχή παράδοσης.',
    'err.PROPERTY_REQUIRED': 'Η παραγγελία χρειάζεται διεύθυνση παράδοσης.',

    // terms / privacy
    'terms.title': 'Όροι χρήσης & απόρρητο',
    'terms.link': 'Όροι χρήσης & απόρρητο',
    'terms.service.h': '1. Τι είναι το Delivr',
    'terms.service.p': 'Το Delivr συνδέει τους επισκέπτες ενός καταλύματος με τοπικά καταστήματα. Την παραγγελία την εκτελεί και την τιμολογεί το κατάστημα· το Delivr παρέχει μόνο την πλατφόρμα.',
    'terms.orders.h': '2. Παραγγελίες',
    'terms.orders.p': 'Η παραγγελία θεωρείται οριστική όταν την επιβεβαιώσει το κατάστημα. Το κατάστημα μπορεί να την απορρίψει (π.χ. εκτός ωραρίου, εξαντλημένο προϊόν) και ενημερώνεσαι στη σελίδα παρακολούθησης.',
    'terms.prices.h': '3. Τιμές & πληρωμή',
    'terms.prices.p': 'Οι τιμές, τα μεταφορικά και η ελάχιστη παραγγελία ορίζονται από το κατάστημα και εμφανίζονται πριν την αποστολή. Η πληρωμή γίνεται με μετρητά κατά την παράδοση ή την παραλαβή.',
    'terms.cancel.h': '4. Ακύρωση',
    'terms.cancel.p': 'Για ακύρωση ή αλλαγή, επικοινώνησε απευθείας με το κατάστημα από τη σελίδα της παραγγελίας, το συντομότερο δυνατό.',
    'terms.data.h': '5. Προσωπικά δεδομένα (GDPR)',
    'terms.data.p': 'Για κάθε παραγγελία συλλέγουμε όνομα, τηλέφωνο, προαιρετικά email, τα προϊόντα και τη διεύθυνση του καταλύματος. Τα στοιχεία αυτά διαβιβάζονται στο κατάστημα (και στον διανομέα, όπου υπάρχει) αποκλειστικά για την εκτέλεση της παραγγελίας — ποτέ για διαφήμιση και ποτέ σε τρίτους. Διατηρούνται όσο απαιτείται για λογιστικούς λόγους. Έχεις δικαίωμα πρόσβασης, διόρθωσης και διαγραφής: γράψε μας και το τακτοποιούμε.',
    'terms.contact.h': '6. Επικοινωνία',
    'terms.contact.p': 'Για οτιδήποτε αφορά τους όρους ή τα δεδομένα σου, χρησιμοποίησε τα στοιχεία επικοινωνίας που εμφανίζονται στην παραγγελία σου.',

    // landing
    'landing.partner': 'Είσαι συνεργάτης; Σύνδεση',

    // store's own link (no QR, no property)
    'shop.orderDirect': 'Παραγγελία απευθείας από το κατάστημα',
    'shop.chooseArea': 'Περιοχή παράδοσης',
    'shop.chooseAreaPh': 'Διάλεξε περιοχή',
    'shop.areaFree': 'Περιοχή / συνοικία',
    'shop.areaFreePh': 'π.χ. Ελούντα',
    'shop.notServed': 'Δεν παραδίδουμε ακόμη σε αυτή την περιοχή. Διάλεξε take away ή κάλεσέ μας.',
    'shop.street': 'Διεύθυνση & αριθμός',
    'shop.streetPh': 'π.χ. Οδός Σχίσμα 14',
    'shop.postal': 'Τ.Κ.',
    'shop.city': 'Πόλη',
    'shop.floor': 'Όροφος',
    'shop.floorPh': 'π.χ. 2ος',
    'shop.doorbell': 'Κουδούνι',
    'shop.doorbellPh': 'π.χ. Παπαδάκης',
    'shop.addressNotes': 'Οδηγίες για τον διανομέα',
    'shop.addressNotesPh': 'π.χ. μπλε πόρτα, δίπλα στο φαρμακείο',
    'shop.addressSaved': 'Η διεύθυνση αποθηκεύεται σε αυτή τη συσκευή για την επόμενη φορά.',
    'shop.deliverHere': 'Παράδοση εδώ',
    'shop.pickUpHere': 'Παραλαβή από το κατάστημα',
    'shop.noDelivery': 'Το κατάστημα κάνει μόνο take away.',
    'shop.noTakeaway': 'Το κατάστημα κάνει μόνο delivery.',
    'shop.notFound': 'Ο σύνδεσμος δεν αντιστοιχεί σε ενεργό κατάστημα.',
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
    'guest.pickupHeader': 'Pick up at the store',
    'guest.youAreAt': 'You are at',
    'guest.needHelp': 'Need a hand?',
    'guest.helpHint': 'Get in touch and we will sort it out.',
    'guest.callSupport': 'Call',
    'guest.emailSupport': 'Email',
    'guest.whatsappSupport': 'WhatsApp',

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
    'cart.items': 'Your items',
    'cart.minProgress': 'Add {missing} more to reach the {amount} minimum order.',
    'cart.minReached': 'Minimum order reached ✓',
    'cart.freeDeliveryProgress': 'Add {missing} more and delivery is free.',
    'cart.freeDeliveryReached': 'You got free delivery 🎉',

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
    'checkout.items': 'Your order',
    'checkout.promo': 'Promo code',
    'checkout.promoPh': 'e.g. WELCOME10',
    'checkout.promoHint': 'The code is checked when the order is sent.',
    'checkout.promoInvalid': 'That code was not accepted. Try another one or carry on without it.',

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
    'err.PROMO_INVALID': 'That promo code is not valid.',
    'err.PROMO_EXPIRED': 'That promo code has expired.',
    'err.PROMO_MIN_ORDER': 'That promo code needs a larger order.',
    'err.PROMO_LIMIT': 'That promo code has been used up.',
    'err.generic': 'Something went wrong. Please try again.',
    'err.STANDALONE_DISABLED': 'This store does not take orders from this link.',
    'err.ADDRESS_REQUIRED': 'Please fill in the delivery address.',
    'err.AREA_REQUIRED': 'Please pick a delivery area.',
    'err.PROPERTY_REQUIRED': 'This order needs a delivery address.',

    'terms.title': 'Terms & privacy',
    'terms.link': 'Terms & privacy',
    'terms.service.h': '1. What Delivr is',
    'terms.service.p': 'Delivr connects guests staying at a property with local stores. The order is fulfilled and invoiced by the store; Delivr only provides the platform.',
    'terms.orders.h': '2. Orders',
    'terms.orders.p': 'An order is final once the store confirms it. The store may decline it (for example outside opening hours, or an item that ran out) and you are told on the tracking page.',
    'terms.prices.h': '3. Prices & payment',
    'terms.prices.p': 'Prices, delivery fees and the minimum order are set by the store and shown before you send the order. Payment is cash on delivery or on pickup.',
    'terms.cancel.h': '4. Cancellation',
    'terms.cancel.p': 'To cancel or change an order, contact the store directly from your order page as soon as possible.',
    'terms.data.h': '5. Personal data (GDPR)',
    'terms.data.p': 'For each order we collect your name, phone, optional email, the items and the address of the property. These details are passed to the store (and to the courier, where there is one) solely to fulfil the order — never for marketing and never to third parties. They are kept for as long as accounting rules require. You have the right to access, correct and delete them: write to us and we will take care of it.',
    'terms.contact.h': '6. Contact',
    'terms.contact.p': 'For anything about these terms or your data, use the contact details shown on your order.',

    'landing.partner': 'Are you a partner? Sign in',

    'shop.orderDirect': 'Order directly from the store',
    'shop.chooseArea': 'Delivery area',
    'shop.chooseAreaPh': 'Pick an area',
    'shop.areaFree': 'Area / neighbourhood',
    'shop.areaFreePh': 'e.g. Elounda',
    'shop.notServed': 'We do not deliver to that area yet. Choose takeaway or give us a call.',
    'shop.street': 'Street & number',
    'shop.streetPh': 'e.g. Schisma street 14',
    'shop.postal': 'Postcode',
    'shop.city': 'City',
    'shop.floor': 'Floor',
    'shop.floorPh': 'e.g. 2nd',
    'shop.doorbell': 'Doorbell',
    'shop.doorbellPh': 'e.g. Papadakis',
    'shop.addressNotes': 'Directions for the driver',
    'shop.addressNotesPh': 'e.g. blue door, next to the pharmacy',
    'shop.addressSaved': 'Your address is kept on this device for next time.',
    'shop.deliverHere': 'Deliver here',
    'shop.pickUpHere': 'Pick up at the store',
    'shop.noDelivery': 'This store is takeaway only.',
    'shop.noTakeaway': 'This store is delivery only.',
    'shop.notFound': 'This link does not match an active store.',
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
          // 44px is the minimum comfortable touch target on a phone.
          className={`min-w-[44px] min-h-[44px] px-3 inline-flex items-center justify-center
            text-xs font-bold rounded-full transition
            ${lang === l ? 'bg-ink-1 text-white' : 'text-ink-2'}`}
        >
          {l === 'el' ? 'ΕΛ' : 'EN'}
        </button>
      ))}
    </div>
  )
}
