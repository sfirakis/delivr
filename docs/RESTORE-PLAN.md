# Delivr — Επαναφορά ως ανοιχτή πλατφόρμα (σαν το efood) + QR

> **Απόφαση George, 30/10/2026:** «ΠΡΕΠΕΙ να μπορεί να γίνει ελεύθερο για όποιο
> μαγαζί θέλει τέτοιο σύστημα, σαν το efood στην Ελλάδα… Να χωριστεί σε 2
> κατηγορίες… αλλά να παραμείνει και η λειτουργία με QR code.»
>
> Branch: `feat/open-marketplace` · τίποτα δεν έχει πάει ακόμα στο live.

## Με δυο λόγια

Το Delivr είναι πλέον **δύο γραμμές προϊόντος σε μία πλατφόρμα**:

| | **A. Delivr Stores** (νέο / επαναφορά) | **B. Delivr QR** (όπως ήταν) |
|---|---|---|
| Για ποιον | Οποιονδήποτε πελάτη, οποιοδήποτε μαγαζί | Επισκέπτες καταλυμάτων |
| Πώς μπαίνει | `delivr-ten.vercel.app/` → διαλέγει περιοχή | Σκανάρει το QR του δωματίου → `/qr/<κωδικός>` |
| Τι βλέπει | Όλα τα μαγαζιά που φέρνουν στην περιοχή του ή κάνουν take away | Τα μαγαζιά της ζώνης του καταλύματος |
| Πληρωμή | Μετρητά (online πληρωμές αργότερα) | Μετρητά |
| Μαγαζί | Γράφεται μόνο του στο `/join`, διαλέγει πακέτο, εσύ εγκρίνεις | Το βάζεις εσύ από το admin |

Και οι δύο γράφουν παραγγελίες από τον ίδιο ασφαλή δρόμο
(`delivr_place_order`), τις ίδιες προμήθειες και τα ίδια στατιστικά.

## 1. Τι χάθηκε

Μέχρι τον Σεπτέμβριο υπήρχε μια «εφαρμογή πελάτη» τύπου efood (commit
`d75de27`). Στις 12/9 (commit `527fd8b`, QA) **αφαιρέθηκε ολόκληρη**, γιατί
ήταν βιτρίνα και όχι λειτουργική εφαρμογή:

- Αρχική με κατηγορίες, αναζήτηση και προβεβλημένα μαγαζιά, σελίδα
  καταστήματος, καλάθι, checkout, παρακολούθηση, «οι παραγγελίες μου»,
  προφίλ, αγαπημένα, splash.
- **Τα προβλήματά της:** ήθελε υποχρεωτικά login. Είχε ψεύτικη τοποθεσία,
  ψεύτικα promo και ψεύτικη αποθηκευμένη κάρτα Visa με ένδειξη «PCI DSS».
  Το Stripe δεν ήταν συνδεδεμένο. Έγραφε κατευθείαν στον πίνακα
  παραγγελιών, κάτι που η βάση πλέον μπλοκάρει για λόγους ασφαλείας.
  Δεν υπήρχε τρόπος να γραφτεί μαγαζί μόνο του.

Μετά από αυτό η αρχική σελίδα έλεγε μόνο «σκανάρετε το QR του δωματίου σας»,
δηλαδή το προϊόν στένεψε σε «μόνο για καταλύματα».

## 2. Τι υπάρχει ακόμη (και δεν πειράχτηκε)

- **QR flow** `/qr/<κωδικός>` — ίδιο ακριβώς (τα tests του περνάνε 12/12).
- **Σύνδεσμος καταστήματος** `/store/<slug>` — ίδιο, παραγγελίες με κανάλι «store».
- **Επιβεβαίωση από το μαγαζί** `/s/<token>` και **παρακολούθηση** `/t/<token>`.
- **Merchant** (POS, μενού, στατιστικά, ρυθμίσεις), **Admin** (καταστήματα,
  ζώνες, καταλύματα, χρεώσεις, συνδρομές, στατιστικά), **Driver**.
- Ειδοποίηση παραγγελίας `notify-order` (email, όταν μπουν τα κλειδιά Resend).
- Ζώνες, ελάχιστα, κόστος αποστολής, ωράρια, ad-hoc διευθύνσεις (migration 013).

## 3. Τι φτιάχτηκε (φάσεις)

**Φάση 1 — Βάση (μόνο προσθήκες, τίποτα δεν σβήνεται)**
- `014_open_marketplace.sql`:
  - νέες στήλες στο κατάστημα: «εμφανίζεται στο marketplace», «γράφτηκε
    μόνο του», «ζήτησε πακέτο»·
  - δημόσιες λίστες περιοχών, καταστημάτων ανά περιοχή και πακέτων·
  - εγγραφή καταστήματος. Το νέο μαγαζί μπαίνει **σε αναμονή έγκρισης**.
    Ένα μαγαζί ανά λογαριασμό και όριο κατά των spam εγγραφών.
- `015_guard_store_admin_fields.sql`: το μαγαζί **δεν** μπορεί να αλλάξει
  μόνο του έγκριση, προμήθεια, προβολή ή βαθμολογία. Αυτά τα αλλάζει μόνο
  ο admin.
- Δοκιμασμένα σε **πεταχτή βάση** (PGlite, στη μνήμη), όχι στο live: 23 έλεγχοι ✅.

**Φάση 2 — Marketplace για τον πελάτη**
- Η αρχική `/` είναι πλέον το marketplace:
  - περιοχή, Delivery/Take away, αναζήτηση, κατηγορίες, κάρτες καταστημάτων
    με κόστος αποστολής, ελάχιστη παραγγελία και χρόνο της ζώνης του.
- Η σελίδα καταστήματος `/stores/<slug>` καλύπτει μενού → καλάθι → checkout
  με μετρητά → παρακολούθηση.
  - **Χωρίς λογαριασμό**: η παραγγελία γίνεται ως guest.
- Η σελίδα `/orders` κρατά «οι παραγγελίες μου» στη συσκευή.
- Η παλιά αρχική για τα καταλύματα μεταφέρθηκε στο `/qr`, με σύνδεσμο από
  την αρχική.
- **Καμία** ψεύτικη κάρτα, Visa ή PCI.

**Φάση 3 — Μαγαζιά που γράφονται μόνα τους**
- Στο `/join` το μαγαζί:
  - βλέπει τα πακέτα;
  - συμπληρώνει τα στοιχεία του;
  - φτιάχνει λογαριασμό.
  Μετά περιμένει την έγκρισή σου.
- Στο admin: κάρτα «⏳ Περιμένουν έγκριση» με το πακέτο που ζήτησε το
  μαγαζί και κουμπί ✅ Έγκριση. Η στήλη «Πωλεί από» δείχνει Market, Link
  και QR.
- Στο merchant:
  - μπάρα «σε αναμονή έγκρισης»;
  - ρύθμιση «Πού πουλάς» (marketplace / σύνδεσμος);
  - επεξεργασία ζωνών από το ίδιο το μαγαζί.

**Φάση 4 — Λογότυπο** «delivr · by ActionWeb» παντού (QR, marketplace,
merchant, admin, login, όροι). Το favicon και η εικόνα κοινοποίησης έμειναν
ίδια.

**Αργότερα (θέλει δική σου απόφαση):**
- λογαριασμοί πελατών και αγαπημένα;
- online πληρωμές (Stripe/Viva);
- χάρτης/geocoding διευθύνσεων;
- κριτικές;
- μετάφραση μενού.

Screenshots (πλάτος κινητού) στο `docs/screenshots/`:
- `market-m-01…09` — ο πελάτης;
- `join-m-01…04` — η εγγραφή μαγαζιού;
- `merchant-m-01/02` — το μαγαζί σε αναμονή;
- `admin-01-pending-approval` — η έγκριση;
- `guest-m-01-qr-store-list-logo` — το QR με το νέο λογότυπο.

## 4. Τι θέλει το OK σου για να βγει live

1. **Εφαρμογή των migrations 014 + 015 στη live βάση.** Πρέπει να γίνει
   **πριν** το deploy, αλλιώς η νέα αρχική θα δείχνει «δεν υπάρχουν
   καταστήματα ακόμα». Είναι μόνο προσθήκες, οπότε το QR δεν επηρεάζεται.
2. **Έγκριση νέων μαγαζιών:** χειροκίνητη από σένα (προεπιλογή) ή αυτόματη
   (`marketplace_auto_approve`).
3. **Ποια από τα υπάρχοντα μαγαζιά να μπουν στο marketplace.** Προεπιλογή:
   κανένα, μέχρι να το ανοίξεις από το admin («Σύνδεσμος & Marketplace»).
4. **Η βασική προμήθεια φαίνεται δημόσια** στη σελίδα `/join`, μαζί με τα
   πακέτα. Είναι ΟΚ;
5. **Supabase Auth:** να ζητά επιβεβαίωση email στην εγγραφή μαγαζιού ή όχι;
   Η φόρμα δουλεύει και με τα δύο.
6. **Η αρχική αλλάζει:** το `/` γίνεται marketplace και η σελίδα για
   καταλύματα πάει στο `/qr`. Τα QR των δωματίων (`/qr/<κωδικός>`) δεν
   αλλάζουν.
7. **Merge του PR και deploy στο Vercel.**

## 5. Γνωστό θέμα που βρέθηκε (υπήρχε από πριν)

Το POS στο `/merchant` αλλάζει την κατάσταση της παραγγελίας γράφοντας
κατευθείαν στον πίνακα. Από τις 12/9 (011a) η βάση το απαγορεύει, οπότε
πιθανότατα **η αλλαγή κατάστασης από το merchant POS δεν δουλεύει** στο live.

Η επιβεβαίωση από τον σύνδεσμο `/s/<token>` δουλεύει κανονικά. Δεν το
άγγιξα (εκτός scope). Θέλει μικρό RPC σε επόμενο βήμα.

---

## Τεχνικό παράρτημα

### Routes
| Route | Τι | Γραμμή |
|---|---|---|
| `/` | `MarketHomePage` | A |
| `/stores/:slug/*` | `ShopApp market` (channel `app`) | A |
| `/orders` | `MyOrdersPage` (localStorage `delivr_my_orders`) | A |
| `/join` | `JoinPage` (signUp → `delivr_register_store`, draft σε `delivr_join_draft`) | A |
| `/store/:slug/*` | `ShopApp` (channel `store`) — αμετάβλητο | A (link) |
| `/qr` | `LandingPage` (παλιά αρχική) | B |
| `/qr/:code/*`, `/t/:token`, `/s/:token` | αμετάβλητα | B |
| `/merchant`, `/admin`, `/driver`, `/auth`, `/terms` | αμετάβλητα (+ νέα UI) | — |

Τα `ShopApp`/`ShopMenuPage`/`Cart`/`Checkout` είναι κοινά. Το
`src/shop/shopMode.tsx` δίνει `{market, channel, prefix}`. Το guest cart
(`delivr_guest_cart`) είναι κοινό και κρατά την περιοχή.

### Κανάλια παραγγελίας (`orders.channel`)
- `qr`: Delivr QR.
- `store`: σύνδεσμος καταστήματος.
- **`app`**: marketplace. Η τιμή υπήρχε ήδη στο CHECK, άρα δεν χρειάζεται
  αλλαγή constraint.

### RPCs (migration 014)
- `delivr_marketplace_areas()` → `[{area, city, stores}]` (anon).
- `delivr_marketplace_stores(p_area, p_postal, p_city)` (anon):
  - Επιστρέφει τα καταστήματα με `delivr_is_marketplace_store`, δηλαδή
    active + onboarding `active` + `standalone_enabled` + `marketplace_listed`.
  - Ανά κατάστημα δίνει `delivers` / `pickup`, και fee / min / free / ETA της
    ζώνης που ταιριάζει (`delivr_match_address`).
  - Κατάστημα χωρίς ζώνες ταιριάζει μόνο στη δική του πόλη.
  - ETA = `avg_delivery_time` + extra της ζώνης, όπως και στη σελίδα
    καταστήματος.
- `delivr_public_plans()` → `{default:{mode,value,auto_approve}, plans}` (anon).
- `delivr_register_store(p_store jsonb, p_plan_id uuid)`:
  - Μόνο για authenticated.
  - Σφάλματα: `AUTH_REQUIRED`, `ALREADY_REGISTERED`, `RATE_LIMIT` (30/ώρα),
    `NAME_/PHONE_/ADDRESS_/CITY_/SERVICE_REQUIRED`.
  - Τι δημιουργεί:
    - το κατάστημα: pending (ή active με auto-approve), `standalone_enabled`,
      `marketplace_listed`, lat/lng 0/0, ώστε να **μη** μπαίνει στην ακτίνα
      των QR καταλυμάτων;
    - τον owner στο `store_users`;
    - ωράρια 09–23;
    - πρώτη ζώνη;
    - `profiles.role` customer→store.
- Όλες οι νέες functions έχουν `REVOKE … FROM PUBLIC, anon` και μετά ρητά GRANT.
- 015: trigger `BEFORE UPDATE` στο `stores`. Οι μη-admin παίρνουν
  `ADMIN_ONLY_FIELD` στα πεδία: `onboarding_status`, `is_active`,
  `billing_mode`, `billing_value`, `is_promoted`, `rating`, `review_count`,
  `slug`, `self_registered_at`.

### Tests
```bash
npm run lint && npx tsc --noEmit && npm run build
npm run test:db          # PGlite: 001→015 + 014/015 ξανά (idempotent), 23 έλεγχοι

# e2e: dev server με ψεύτικο Supabase (όλα τα *.supabase.co γίνονται mock)
VITE_SUPABASE_URL=https://e2etest.supabase.co VITE_SUPABASE_ANON_KEY=x \
  VITE_APP_URL=http://localhost:5174 npx vite --port 5174 --strictPort
BASE_URL=http://localhost:5174 E2E_SUPABASE_REF=e2etest E2E_CHANNEL=msedge \
  SHOTS_DIR=docs/screenshots npm run e2e   # όλα τα suites (guest, shop, store-confirm, admin, market, join)
```
- Το `E2E_CHANNEL=msedge` χρειάζεται σε Windows, όπου το bundled chromium
  δεν ξεκινά.
- Το `E2E_SUPABASE_REF` πρέπει να ταιριάζει με το host του
  `VITE_SUPABASE_URL` (κλειδί του session στο localStorage).

Αποτελέσματα στο branch:

| Suite | Αποτέλεσμα |
|---|---|
| guest-flow | 12/12 |
| shop-flow | 10/10 |
| store-confirm | 7/7 |
| admin-dashboard | 8/8 |
| **market-flow** | **11/11** |
| **join-flow** | **7/7** |
| DB | 23/23 |
| lint, tsc, build | πράσινα |

### Σειρά go-live
1. `apply_migration` 014 → 015 στο `ifgzciraogohycuvujip`.
2. Γρήγορος έλεγχος με `select delivr_marketplace_areas();`.
3. Merge του PR → Vercel deploy.
4. Από το admin: «Σύνδεσμος & Marketplace» → άναμμα των μαγαζιών που θες
   να φαίνονται.

Τα screenshots `public-*-root-landing.png` δείχνουν την παλιά αρχική (τώρα `/qr`).
