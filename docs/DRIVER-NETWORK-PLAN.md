# Δίκτυο ανεξάρτητων διανομέων Delivr — σχέδιο

> **Μόνο σχέδιο, χωρίς κώδικα.** Δεν έχει εφαρμοστεί τίποτα: καμία migration, καμία αλλαγή στη live βάση,
> κανένα deploy. Απόφαση George 30/10/2026. Οι αριθμοί με *πλάγια* (60 €, 2,5 €, 5′ κ.λπ.) είναι
> **προτάσεις HQ** που ο George μπορεί να αλλάξει. Ό,τι γράφει **[ΑΝΕΠΙΒΕΒΑΙΩΤΟ]** θέλει έλεγχο από
> λογιστή ή δικηγόρο πριν από το πρώτο pilot.

---

## Μέρος Α — Με απλά λόγια (για τον George)

**Τι φτιάχνουμε.** Ένα δίκτυο ελεύθερων επαγγελματιών διανομέων. Ένα μαγαζί χωρίς δικό του διανομέα
διαλέγει στις ρυθμίσεις του «Διανομή από το δίκτυο Delivr». Μόλις δεχτεί μια παραγγελία delivery, αυτή
εμφανίζεται ταυτόχρονα σε **όλους** τους εγκεκριμένους διανομείς της περιοχής που είναι «Διαθέσιμοι».
Την παίρνει όποιος πατήσει πρώτος «Την παίρνω». Οι υπόλοιποι βλέπουν «Την πήρε άλλος».

**Πώς πληρώνεται ο διανομέας.** Η πλατφόρμα δεν πιάνει χρήματα στα χέρια της. Ο πελάτης πληρώνει
μετρητά στην πόρτα.
1. Στο μαγαζί ο διανομέας πληρώνει **την αξία του φαγητού** (π.χ. 18 €) και παίρνει τη σακούλα.
2. Στην πόρτα εισπράττει από τον πελάτη **φαγητό + μεταφορικό** (π.χ. 18 + 2,5 = 20,5 €).
3. Κρατάει **το μεταφορικό** (2,5 €). Το ποσό το έχει ήδη ορίσει το μαγαζί ανά ζώνη.
   Η πλατφόρμα δεν παίρνει τίποτα από τον διανομέα (προς το παρόν).

**Οι ασφάλειες που προτείνουμε.**
- Οι παραγγελίες του δικτύου πληρώνονται **μόνο με μετρητά**. Αργότερα και με κάρτα, μόνο για
  διανομείς με δικό τους POS.
- **Ανώτατο ποσό** ανά παραγγελία δικτύου: *60 €*, ώστε ο διανομέας να μην προπληρώνει μεγάλα ποσά.
- **Ελάχιστο μεταφορικό**: *2,5 €*. Αν μια ζώνη του μαγαζιού έχει λιγότερα, η παραγγελία χρεώνεται 2,5 €.
- Αν **κανείς δεν την πάρει σε *5 λεπτά***, ειδοποιείται το μαγαζί. Έχει τρεις επιλογές: «Τη στέλνω
  με δικό μου άνθρωπο», «Γίνεται take away» (αφού συμφωνήσει ο πελάτης) ή «Ακύρωση».
- Ο διανομέας μπαίνει στο δίκτυο **μόνο αν τον εγκρίνει ο admin**. Ελέγχονται ταυτότητα, δίπλωμα,
  ασφάλεια οχήματος και έναρξη ως ελεύθερος επαγγελματίας.
- Στην παραλαβή ο διανομέας πληκτρολογεί έναν **4ψήφιο κωδικό** που βλέπει μόνο το μαγαζί (στην οθόνη
  και στο χαρτάκι). Έτσι αποδεικνύεται ότι πήρε τη σακούλα. Αν το μαγαζί δεν πληρώθηκε, πατάει
  «Δεν πληρώθηκα» και ανοίγει διαφορά προς τον admin.
- Μέχρι να πάρει κάποιος την παραγγελία, ο διανομέας **δεν βλέπει** όνομα, τηλέφωνο ή ακριβή
  διεύθυνση του πελάτη. Βλέπει μόνο μαγαζί, περιοχή, πόσα πληρώνει και πόσα κερδίζει.

**Γιατί έτσι (νομικά).** Από 2/12/2026 ισχύει στην ΕΕ η Οδηγία για την εργασία μέσω πλατφορμών
(2024/2831). Όταν η πλατφόρμα «ελέγχει και κατευθύνει» τη δουλειά, τεκμαίρεται ότι ο εργαζόμενος είναι
μισθωτός. Γι' αυτό σχεδιάζουμε έτσι ώστε ο διανομέας να είναι πραγματικά ανεξάρτητος:
- παίρνει ή αφήνει όποια παραγγελία θέλει, χωρίς ποινή·
- δεν έχει βάρδιες·
- δεν υπάρχει βαθμολογία που να του κόβει δουλειά·
- την τιμή τη βάζει το μαγαζί, όχι εμείς·
- δουλεύει ελεύθερα και για efood ή Wolt.

Αυτό **το ελέγχει δικηγόρος πριν το pilot**. Το Μέρος Β §9 έχει τη λίστα.

**Τι γίνεται σήμερα.** Η εφαρμογή `/driver` υπάρχει, αλλά **δεν δουλεύει στο live**:
- γράφει απευθείας στον πίνακα παραγγελιών, κάτι που κλείσαμε για λόγους ασφάλειας τον Σεπτέμβριο·
- επιπλέον, ο διανομέας δεν «βλέπει» καμία διαθέσιμη παραγγελία.

Θα την ξαναγράψουμε πάνω στο νέο σχέδιο.

**Κόστος.** Κανένα νέο πληρωμένο σύστημα. Οι διανομείς ειδοποιούνται από την ίδια την εφαρμογή
(ανοιχτή στο κινητό, με ήχο και δόνηση) και σε δεύτερη φάση με web push (δωρεάν). Email (Resend) δεν
χρειάζεται.

**Πόσος χρόνος.** Περίπου **11–13 εργάσιμες μέρες ανάπτυξης**. Μετά ένα **pilot 1–2 εβδομάδων** σε μία
περιοχή, με 2–3 μαγαζιά και 3–5 διανομείς.

**Τι χρειάζομαι από σένα.** Οι αποφάσεις στο τέλος (§13), μία γραμμή η καθεμία. Μέχρι να απαντήσεις
ισχύουν οι προτάσεις HQ.

---

## Μέρος Β — Τεχνικό σχέδιο

### 1. Τι υπάρχει σήμερα (επιθεώρηση `origin/master` @ 14e958f)

| Στοιχείο | Κατάσταση | Συνέπεια για το σχέδιο |
|---|---|---|
| `src/driver/DriverApp.tsx` | Κάνει `supabase.from('orders').select(...)` και `.update(...)`, καθώς και `insert` στο `order_events`. | Από την 011a το `orders` είναι **SELECT-only** για clients (`revoke insert, update, delete ... from authenticated`). **Όλες οι ενέργειες αποτυγχάνουν στο live.** |
| RLS `orders_store_read` (004) | Δίνει SELECT όταν `driver_id = auth.uid()`. | Η καρτέλα «Διαθέσιμες» είναι **πάντα άδεια**: παραγγελία με `driver_id IS NULL` δεν τη βλέπει κανένας διανομέας. Η ανάθεση με polling πάνω στο `orders` δεν μπορεί να δουλέψει. |
| ⚠ Ίδια policy | Όποιος έχει `driver_id = auth.uid()` διαβάζει **όλη τη γραμμή**, μαζί με το `store_token`. | Με το token ο διανομέας θα μπορούσε να καλέσει `delivr_store_action` ως κατάστημα (accept/reject/delivered). **Απόφαση σχεδίου:** στις παραγγελίες δικτύου ΔΕΝ γεμίζουμε το `orders.driver_id`. Ο διανομέας μένει στο `delivery_jobs.driver_id` και διαβάζει μόνο μέσω RPC. |
| `driver_sessions` (002) | Online και τοποθεσία, ο διανομέας γράφει απευθείας (RLS own). | Δεν το χρησιμοποιούμε. Δεν χρειαζόμαστε GPS (βλ. §9) και θέλουμε εγγραφές μόνο μέσω RPC. Δεν είναι βέβαιο ότι η 002 τρέχει στο live· θέλει έλεγχο, αλλά δεν μας επηρεάζει. |
| `supabase/functions/assign-driver` | Auto-assign του «κοντινότερου» με score, με service role. **Δεν είναι deployed.** | Δεν τη χρησιμοποιούμε. Ο αλγόριθμος που διαλέγει διανομέα είναι ακριβώς το «έλεγχος και κατεύθυνση» που θέλουμε να αποφύγουμε (§9). |
| `profiles.role = 'driver'` | Υπάρχει στο admin PeoplePage. Από την 011a ο ρόλος αλλάζει μόνο από τον service role. | Η έγκριση γίνεται με νέο RPC (`delivr_admin_driver_review`), που ορίζει και `role = 'driver'` σε SECURITY DEFINER. |
| `public/sw.js` + `registerPushToken` | Το SW έχει χειριστή `push`. Το `registerPushToken` γράφει `profiles.fcm_token`, κάτι που **μπλοκάρει** η 011a (column grants: μόνο full_name/phone/avatar_url). Δεν υπάρχει `VITE_VAPID_PUBLIC_KEY`. | Οι συνδρομές web push πάνε σε νέο πίνακα μέσω RPC (§5, Φάση 6). |
| Ζώνες `store_zones` | `delivery_fee`, `min_order`, `free_above` ανά ζώνη. Ο υπολογισμός γίνεται στην `delivr_place_order` (013) μέσω `delivr_match_zone` και `delivr_match_address`. | Το μεταφορικό του διανομέα = `orders.delivery_fee`. Στις παραγγελίες δικτύου ισχύει κατώτατο όριο, και το `free_above` **δεν εφαρμόζεται** (αλλιώς ο διανομέας παίρνει 0 €). |
| `delivr_store_action` (007, token) / `delivr_merchant_set_order_status` (016, login) | Η μηχανή καταστάσεων του μαγαζιού: accept → preparing → ready → on_the_way → delivered. | Στις παραγγελίες δικτύου με διανομέα, τα `on_the_way`/`delivered` **τα κάνει μόνο ο διανομέας**. Το εξασφαλίζει guard trigger (§4.4), ώστε οι 007/016 να μένουν όπως είναι. |
| Χρέωση `order_charges` | Βάση = `subtotal` ή `total` (`platform_settings.commission_base`). | Αν η βάση είναι `total`, στις παραγγελίες δικτύου **αφαιρούμε το μεταφορικό**: δεν είναι έσοδο του μαγαζιού. |
| Πληρωμές | Το `payment_method` enum έχει `card`, `cash` κ.λπ. Οι online πληρωμές είναι κλειστές. | Το δίκτυο ξεκινά μόνο με μετρητά. Η «κάρτα στην πόρτα» θέλει νέα τιμή enum (Φάση 8). |

### 2. Ροή από άκρη σε άκρη

```
Πελάτης ──place_order──▶ orders (delivery_mode='network', pending)
                              │ μαγαζί: accept (007/016) ή auto_accept
                              ▼
                   trigger ─▶ delivery_jobs (offered, λήξη +5′)
                              │
         ┌────────────────────┼──────────────────────────┐
   διανομείς βλέπουν     κανείς σε 5′                ακύρωση μαγαζιού
   (feed / push)          ▼                          ▼
         │           job=unclaimed ─▶ μαγαζί:        job=cancelled
   claim (row lock)        retry / own_driver / to_takeaway / reject
         ▼
   job=claimed ─▶ arrived_store ─▶ pickup(PIN, πληρώνει φαγητό)
                                     │ order=on_the_way
                                     ▼
                              arrived_customer ─▶ delivered (εισπράττει όλο)
                                     │                 order=delivered, paid
                                     └─▶ failed ─▶ returning ─▶ returned (μαγαζί επιστρέφει χρήματα)
```

**Πελάτης**
1. Στο checkout ενός μαγαζιού δικτύου βλέπει «Πληρωμή με μετρητά στον διανομέα». Αν το καλάθι ξεπερνά
   το *60 €*, βλέπει «Για delivery μέχρι 60 €· χώρισε την παραγγελία ή διάλεξε take away».
2. Το tracking `/t/<token>` δείχνει, κατά σειρά:
   - «Το κατάστημα ετοιμάζει» και «Αναζητούμε διανομέα»·
   - «Ο/Η *Γιώργος* την ανέλαβε» (μόνο μικρό όνομα)·
   - «Στον δρόμο»·
   - «Παραδόθηκε».
3. Πληρώνει στην πόρτα `total` (φαγητό + μεταφορικό).

**Κατάστημα**
1. Ρυθμίσεις → «Διανομή»: **«Έχω δικό μου διανομέα»** (σημερινή συμπεριφορά, default) ή **«Δίκτυο
   Delivr»**. Το δεύτερο είναι διαθέσιμο μόνο όταν το δίκτυο είναι ανοιχτό στην πόλη/περιοχή του.
2. Δέχεται την παραγγελία όπως σήμερα (POS ή `/s/<token>`). Η κάρτα της παραγγελίας δείχνει
   «🔎 Αναζήτηση διανομέα… 4:12» και μετά «🛵 Γιώργος Π. · έρχεται».
3. Στην κάρτα, στο `/s/<token>` και στο τυπωμένο χαρτάκι υπάρχει ο **κωδικός παραλαβής**, π.χ. `4821`.
   Το μαγαζί δεν τον λέει στον διανομέα πριν πάρει τα χρήματα.
4. Αν περάσουν 5′ χωρίς διανομέα, εμφανίζεται κόκκινη μπάρα με ήχο και τέσσερα κουμπιά:
   **Ξαναδοκίμασε 5′** · **Τη στέλνω με δικό μου** · **Γίνεται take away** (μόνο αφού τηλεφωνήσει στον
   πελάτη) · **Ακύρωση**.
5. Μετά την παραλαβή: κουμπί **«Δεν πληρώθηκα»** (για *60′*) και, σε αποτυχημένη παράδοση,
   **«Επεστράφη η σακούλα — επέστρεψα τα χρήματα»**.

**Διανομέας**
1. Αίτηση στο `/driver`: στοιχεία, ΑΦΜ, όχημα, περιοχές, ανέβασμα εγγράφων, αποδοχή όρων. Η
   κατάσταση μένει «Σε έλεγχο» μέχρι την έγκριση.
2. Εγκεκριμένος → διακόπτης **Διαθέσιμος / Εκτός**. Ο διανομέας τον ελέγχει πλήρως· δεν υπάρχουν
   βάρδιες.
3. Λίστα **προσφορών**. Κάθε κάρτα δείχνει:
   - μαγαζί και περιοχή παραλαβής·
   - περιοχή παράδοσης, χωρίς οδό και όνομα·
   - «Πληρώνεις στο μαγαζί 18,00 €», «Εισπράττεις 20,50 €», «**Κερδίζεις 2,50 €**»·
   - πότε είναι έτοιμη και πόσος χρόνος μένει στην προσφορά.
   Κουμπιά: «Την παίρνω» ή απλώς την αγνοεί, χωρίς συνέπεια.
4. Αφού την πάρει, βλέπει διεύθυνση, κουδούνι, όροφο, σημειώσεις, τηλέφωνο πελάτη και πλοήγηση.
   Μπορεί να την **αφήσει** πριν από την παραλαβή («Δεν μπορώ τελικά») και τότε ξαναβγαίνει στο δίκτυο.
5. «Έφτασα στο μαγαζί» → πληρώνει → πληκτρολογεί τον κωδικό → «Παρέλαβα». Η παραγγελία γίνεται
   `on_the_way`.
6. «Έφτασα» → «Παραδόθηκε, εισέπραξα 20,50 €». Αλλιώς «Ο πελάτης δεν απαντά / αρνήθηκε», που
   επιτρέπεται μετά από *10′* από το «Έφτασα» και αφού κάνει κλήση.
7. Καρτέλα **«Σήμερα»**: πόσα πλήρωσε σε μαγαζιά, πόσα εισέπραξε, καθαρά κέρδη (μεταφορικά + tips).

**Admin**
1. Ουρά αιτήσεων: βλέπει τα έγγραφα (signed URLs από private bucket), τα σημειώνει ΟΚ ή
   απορριπτέα με ημερομηνία λήξης, και κάνει **Έγκριση / Απόρριψη / Αναστολή / Επαναφορά**. Κάθε
   απόφαση γράφεται με αιτιολογία που βλέπει και ο διανομέας.
2. Ρυθμίσεις δικτύου: on/off, περιοχές όπου είναι ανοιχτό, όριο ποσού, ελάχιστο μεταφορικό, timeout,
   μέγιστες ταυτόχρονες παραγγελίες ανά διανομέα.
3. Παρακολούθηση: ζωντανές εργασίες, «χωρίς διανομέα > 10′», ανοιχτές διαφορές με το ιστορικό
   γεγονότων κάθε εργασίας, και ειδοποίηση για έγγραφα που λήγουν σε 30 μέρες.

**Καταστάσεις.** Στο `order_status` enum **δεν προσθέτουμε τιμές**. Το `ALTER TYPE` θα άγγιζε τη
μηχανή του μαγαζιού, το tracking και τα stats. Η παραγγελία κρατά τις υπάρχουσες καταστάσεις
(`pending → confirmed → preparing → ready → on_the_way → delivered | cancelled`) και η λεπτομέρεια
της διανομής ζει σε νέο πίνακα με δικές του καταστάσεις:

| `delivery_jobs.status` | Σημαίνει | Επόμενα |
|---|---|---|
| `scheduled` | Προγραμματισμένη παραγγελία· η προσφορά βγαίνει στο `estimated_ready_at − 25′` | offered, cancelled |
| `offered` | Σε όλους τους διαθέσιμους· λήγει στο `offer_expires_at` | claimed, unclaimed, cancelled |
| `unclaimed` | Κανείς στο timeout· αποφασίζει το μαγαζί | offered (retry), cancelled (own_driver / takeaway / reject) |
| `claimed` | Την πήρε διανομέας | arrived_store, offered (release), cancelled |
| `arrived_store` | Ο διανομέας είναι στο μαγαζί | picked_up, offered (release), cancelled |
| `picked_up` | Πλήρωσε και πήρε τη σακούλα (order `on_the_way`) | arrived_customer, delivered |
| `arrived_customer` | Είναι στην πόρτα | delivered, returning |
| `delivered` | Τέλος (order `delivered`, `paid`) | — |
| `returning` | Αποτυχημένη παράδοση· επιστρέφει τη σακούλα | returned |
| `returned` | Το μαγαζί επιβεβαίωσε επιστροφή και επιστροφή χρημάτων (order `cancelled`) | — |
| `cancelled` | Ακυρώθηκε πριν την παραλαβή | — |

### 3. Ρυθμίσεις καταστήματος και κανόνες ποσών

- `stores.delivery_mode`: `'own'` (default, καμία αλλαγή για κανένα υπάρχον μαγαζί) ή `'network'`.
  Το μαγαζί το αλλάζει μέσω RPC `delivr_store_set_delivery_mode`, που ελέγχει ότι το δίκτυο είναι
  ανοιχτό στην περιοχή. Η στήλη μπαίνει και στο guard trigger της 015, ώστε να μη γράφεται απευθείας
  με PATCH.
- Στην `delivr_place_order`, όταν `delivery_mode='network'` και `p_service='delivery'`:
  1. `NOT ps.network_enabled` → `NETWORK_DISABLED`. Ο πελάτης βλέπει «Μόνο take away αυτή τη στιγμή».
  2. `p_payment <> 'cash'` → `NETWORK_CASH_ONLY` (μέχρι τη Φάση 8).
  3. `p_scheduled IS NOT NULL` → επιτρέπεται· δημιουργείται job `scheduled`.
  4. Μεταφορικό: `v_fee := greatest(zone_fee, ps.network_min_fee)`. **Αγνοείται το `free_above`.**
  5. `v_total > ps.network_max_order` → `NETWORK_MAX_ORDER:<ποσό>`. Ελέγχουμε το σύνολο, γιατί
     αυτό εισπράττει ο διανομέας. Τον κίνδυνο προπληρωμής καλύπτει το `total − fee − tip`, που είναι
     πάντα μικρότερο.
  6. `orders.delivery_mode := 'network'` (snapshot, ώστε μια αλλαγή ρύθμισης να μην επηρεάζει
     ανοιχτές παραγγελίες).
  7. Βάση προμήθειας: αν `commission_base='total'`, τότε `v_base := v_total − v_fee`.
- Ένας helper `delivr_effective_delivery_fee(store, zone_fee, subtotal)` χρησιμοποιείται **παντού**
  όπου δείχνουμε μεταφορικό: `delivr_stores_for_property`, marketplace RPCs, `delivr_match_address`
  και καλάθι. Έτσι ο πελάτης βλέπει το ίδιο ποσό που θα χρεωθεί.
- UI ρυθμίσεων ζωνών: όταν το μαγαζί είναι στο δίκτυο, ζώνες με μεταφορικό κάτω από 2,5 € δείχνουν
  «θα χρεωθεί 2,50 €», και το «δωρεάν πάνω από» εμφανίζεται «δεν ισχύει στο δίκτυο».

### 4. Μοντέλο δεδομένων (migration 018, μόνο προσθήκες)

#### 4.1 Νέοι πίνακες

```sql
CREATE TABLE drivers (
  user_id          UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'applied'
                   CHECK (status IN ('applied','approved','rejected','suspended')),
  full_name        TEXT NOT NULL,
  phone            TEXT NOT NULL,                     -- E.164
  vat_number       TEXT,                              -- ΑΦΜ
  vehicle_type     TEXT NOT NULL CHECK (vehicle_type IN ('bicycle','ebike','scooter','motorcycle','car')),
  has_card_pos     BOOLEAN NOT NULL DEFAULT false,    -- Φάση 8
  max_cash_float   NUMERIC(10,2) NOT NULL DEFAULT 60, -- πόσα μπορεί να προπληρώσει (το δηλώνει ο ίδιος)
  is_online        BOOLEAN NOT NULL DEFAULT false,
  online_since     TIMESTAMPTZ,
  last_seen_at     TIMESTAMPTZ,                       -- heartbeat από το feed· όχι τοποθεσία
  terms_version    TEXT, terms_accepted_at TIMESTAMPTZ,
  decided_by       UUID REFERENCES profiles(id), decided_at TIMESTAMPTZ,
  decision_reason  TEXT,                              -- το βλέπει ο διανομέας
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE driver_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    UUID NOT NULL REFERENCES drivers(user_id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('id_card','driving_licence','vehicle_registration',
                                             'vehicle_insurance','self_employed_proof')),
  storage_path TEXT NOT NULL,                         -- bucket private 'driver-docs/<uid>/...'
  expires_on   DATE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ok','rejected')),
  reviewed_by  UUID REFERENCES profiles(id), reviewed_at TIMESTAMPTZ, note TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE driver_areas (                           -- ίδιο λεξιλόγιο με delivr_marketplace_areas()
  driver_id  UUID NOT NULL REFERENCES drivers(user_id) ON DELETE CASCADE,
  area_norm  TEXT NOT NULL,                           -- delivr_norm(area ή city)
  label      TEXT NOT NULL,
  PRIMARY KEY (driver_id, area_norm)
);

CREATE TABLE delivery_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_id         UUID NOT NULL REFERENCES stores(id),
  pickup_area_norm TEXT NOT NULL,                     -- περιοχή μαγαζιού (city / ζώνη)
  dropoff_area     TEXT,                              -- μόνο περιοχή, όχι οδός, πριν το claim
  status           TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('scheduled','offered','unclaimed',
                   'claimed','arrived_store','picked_up','arrived_customer','delivered',
                   'returning','returned','cancelled')),
  driver_id        UUID REFERENCES drivers(user_id),
  -- snapshot ποσών τη στιγμή της προσφοράς
  collect_amount   NUMERIC(10,2) NOT NULL,            -- = orders.total (από τον πελάτη)
  delivery_fee     NUMERIC(10,2) NOT NULL,            -- = orders.delivery_fee (το κρατά ο διανομέας)
  tip_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  food_amount      NUMERIC(10,2) NOT NULL,            -- = collect − fee − tip (στο μαγαζί)
  payment_method   TEXT NOT NULL,
  pickup_code      TEXT NOT NULL,                     -- 4 ψηφία, το βλέπουν μόνο μαγαζί και admin
  offer_round      INT  NOT NULL DEFAULT 1,
  offered_at       TIMESTAMPTZ, offer_expires_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ, arrived_store_at TIMESTAMPTZ, picked_up_at TIMESTAMPTZ,
  arrived_customer_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, closed_at TIMESTAMPTZ,
  release_count    INT NOT NULL DEFAULT 0,
  cancel_reason    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- μία ενεργή εργασία ανά παραγγελία
CREATE UNIQUE INDEX uq_delivery_jobs_active ON delivery_jobs(order_id)
  WHERE status NOT IN ('delivered','returned','cancelled');
CREATE INDEX idx_jobs_open   ON delivery_jobs(pickup_area_norm, offer_expires_at) WHERE status = 'offered';
CREATE INDEX idx_jobs_driver ON delivery_jobs(driver_id, status);

CREATE TABLE delivery_job_events (                    -- audit· η βάση για κάθε διαφορά
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES delivery_jobs(id) ON DELETE CASCADE,
  event TEXT NOT NULL, actor TEXT NOT NULL CHECK (actor IN ('store','driver','admin','system','customer')),
  actor_id UUID, note TEXT, amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE delivery_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES delivery_jobs(id),
  opened_by TEXT NOT NULL CHECK (opened_by IN ('store','driver','admin')),
  kind TEXT NOT NULL CHECK (kind IN ('store_not_paid','customer_absent','customer_refused',
       'wrong_or_missing_items','damaged','cash_short','driver_no_show','other')),
  amount NUMERIC(10,2), notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','void')),
  resolution TEXT, resolved_by UUID REFERENCES profiles(id), resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE push_subscriptions (                     -- Φάση 6 (web push)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  user_agent TEXT, failed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_ok_at TIMESTAMPTZ
);
```

#### 4.2 Στήλες σε υπάρχοντες πίνακες (με ασφαλή defaults)

```sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'own'
  CHECK (delivery_mode IN ('own','network'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'own'
  CHECK (delivery_mode IN ('own','network'));
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS network_enabled            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS network_areas              TEXT[]  NOT NULL DEFAULT '{}', -- delivr_norm
  ADD COLUMN IF NOT EXISTS network_max_order          NUMERIC(10,2) NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS network_min_fee            NUMERIC(10,2) NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS network_offer_seconds      INT NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS network_max_active_per_driver INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS network_dispute_minutes    INT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS network_noshow_wait_minutes INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS network_online_idle_minutes INT NOT NULL DEFAULT 15;
```

Το constraint `order_events_actor_chk` δέχεται ήδη `'driver'`. Δεν χρειάζεται αλλαγή.

#### 4.3 RLS και REVOKE

Γενικός κανόνας, όπως στην 011a: **κανένας client δεν γράφει απευθείας** σε αυτούς τους πίνακες.

```sql
ALTER TABLE drivers / driver_documents / driver_areas / delivery_jobs /
            delivery_job_events / delivery_disputes / push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON <όλοι οι παραπάνω> FROM anon, authenticated;
REVOKE ALL ON <όλοι οι παραπάνω> FROM anon;
```

| Πίνακας | SELECT policy (authenticated) |
|---|---|
| `drivers` | `user_id = auth.uid() OR delivr_is_admin()` |
| `driver_documents` | `driver_id = auth.uid() OR delivr_is_admin()` |
| `driver_areas` | `driver_id = auth.uid() OR delivr_is_admin()` |
| `delivery_jobs` | `delivr_is_admin() OR delivr_is_store_member(store_id)`. **Όχι στους διανομείς.** Βλέπουν μόνο μέσω `delivr_driver_feed()`, που κρύβει τα προσωπικά στοιχεία πριν το claim και το `pickup_code` πάντα. |
| `delivery_job_events` | admin ή μέλος καταστήματος της εργασίας |
| `delivery_disputes` | admin ή μέλος καταστήματος. Ο διανομέας βλέπει τις δικές του μέσω `delivr_driver_me()`. |
| `push_subscriptions` | `user_id = auth.uid()` |

- **Storage** bucket `driver-docs` (private):
  - INSERT όταν `(storage.foldername(name))[1] = auth.uid()::text`·
  - SELECT μόνο admin (ο διανομέας μόνο τα δικά του)·
  - UPDATE/DELETE καμία.
  - Retention: διαγραφή *12 μήνες* μετά από απόρριψη ή διακοπή συνεργασίας **[ΑΝΕΠΙΒΕΒΑΙΩΤΟ — GDPR,
    να οριστεί με δικηγόρο]**.
- **Όλες οι νέες functions:** `SECURITY DEFINER SET search_path = public`, `REVOKE EXECUTE ... FROM
  PUBLIC, anon`, `GRANT ... TO authenticated`. Εξαίρεση οι token-twins του καταστήματος (όπως η 007):
  `GRANT ... TO anon, authenticated` με έλεγχο token. Οι triggers και η `delivr_network_sweep`:
  `REVOKE ... FROM PUBLIC, anon, authenticated`.
- **Κανόνας 009/010:** στο τέλος κάθε migration γίνεται `\df+` ή έλεγχος `has_function_privilege` στο
  test, ώστε να μη μείνει ανοιχτό EXECUTE.

#### 4.4 Triggers (για να μην αλλάξουν οι 007/016)

1. `trg_orders_network_job` (AFTER INSERT OR UPDATE OF status ON orders, SECURITY DEFINER):
   - όταν `delivery_mode='network' AND delivery_type='delivery'` και η κατάσταση γίνεται `confirmed`
     (accept ή auto_accept), δημιουργεί το `delivery_jobs`: `offered`, ή `scheduled` αν είναι
     προγραμματισμένη. Παράγει `pickup_code` με `lpad((random()*10000)::int::text,4,'0')`;
   - όταν γίνεται `cancelled`, ακυρώνει την ενεργή εργασία, αλλά **μόνο** αν δεν έχει γίνει
     `picked_up`. Μετά την παραλαβή η ακύρωση γίνεται μόνο μέσω admin.
2. `trg_orders_network_guard` (BEFORE UPDATE OF status ON orders):
   - αν υπάρχει ενεργή εργασία με `driver_id` και η νέα κατάσταση είναι `on_the_way`/`delivered`, και
     `current_setting('delivr.actor', true)` δεν είναι `'driver'` ή `'admin'`, απορρίπτει με
     `NETWORK_DRIVER_OWNS_DELIVERY`;
   - απορρίπτει επίσης `cancelled` όταν η εργασία είναι ήδη `picked_up`
     (`NETWORK_ALREADY_PICKED_UP`, ώστε να ανοίξει διαφορά και όχι σιωπηλή ακύρωση).
   - Τα driver RPCs κάνουν `PERFORM set_config('delivr.actor','driver', true)` (μόνο για το
     transaction).
3. Το guard trigger της 015 (`delivr_guard_store_admin_fields`) επεκτείνεται με
   `NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode`, ώστε η αλλαγή να γίνεται μόνο μέσω RPC.

### 5. RPCs (migration 019)

**Διανομέας** (`authenticated`· όλα ελέγχουν `drivers.user_id = auth.uid()`):

| Function | Τι κάνει / έλεγχοι |
|---|---|
| `delivr_driver_apply(p JSONB)` | Δημιουργεί ή ενημερώνει τη δική του γραμμή όσο είναι `applied`/`rejected`. Ζητά E.164 τηλέφωνο, όχημα, περιοχές και αποδοχή όρων (version). Τα έγγραφα ανεβαίνουν στο Storage και δηλώνονται με `delivr_driver_add_document(kind, path, expires_on)`. |
| `delivr_driver_me()` | Προφίλ, κατάσταση και αιτιολογία, περιοχές, έγγραφα με λήξεις, ενεργές εργασίες, σύνοψη ημέρας, ανοιχτές διαφορές. |
| `delivr_driver_set_online(p_online)` | Μόνο αν είναι `approved` και τα υποχρεωτικά έγγραφα είναι `ok` και σε ισχύ. Ενημερώνει `online_since`. |
| `delivr_driver_set_areas(p_areas TEXT[])` | Μόνο περιοχές του `network_areas`. |
| `delivr_driver_feed()` | (1) καλεί `delivr_network_sweep()`· (2) heartbeat `last_seen_at = now()`· (3) επιστρέφει: **προσφορές** με status `offered`, μη ληγμένες, `pickup_area_norm ∈ driver_areas`, `food_amount ≤ max_cash_float`, κατάλληλο payment, που **δεν** έχει αφήσει ο ίδιος στον τρέχοντα γύρο, **χωρίς** όνομα, τηλέφωνο, οδό ή `pickup_code`· και **τις δικές του ενεργές εργασίες** με πλήρη στοιχεία. Χωρίς ταξινόμηση ανά διανομέα και χωρίς προτεραιότητες: όλοι βλέπουν το ίδιο, με σειρά `offered_at`. |
| `delivr_driver_claim(p_job_id)` | Βλ. παρακάτω (row lock). |
| `delivr_driver_release(p_job_id, p_reason)` | Μόνο σε `claimed`/`arrived_store`. Η εργασία γίνεται `offered` με νέο `offer_expires_at`, `offer_round+1`, `release_count+1`, event. **Καμία ποινή** (§9). |
| `delivr_driver_arrived(p_job_id, p_where)` | `'store'` → `arrived_store`· `'customer'` → `arrived_customer` (μόνο μετά από `picked_up`). |
| `delivr_driver_pickup(p_job_id, p_code)` | Ελέγχει: δική του, σε `claimed`/`arrived_store`, order σε `confirmed`/`preparing`/`ready`, σωστός κωδικός (**5 λάθος προσπάθειες κλειδώνουν** και ειδοποιούν τον admin). Μετά: job `picked_up`, `set_config('delivr.actor','driver')`, order `on_the_way`, `picked_up_at`, `prepared_at = coalesce(prepared_at, now())`, `order_events(actor='driver')`, `delivery_job_events('paid_store', amount=food_amount)`. |
| `delivr_driver_delivered(p_job_id)` | Από `picked_up`/`arrived_customer` σε `delivered`. Order `delivered`, `delivered_at`, `payment_status='paid'` για cash, event `collected` με amount `collect_amount`. |
| `delivr_driver_failed(p_job_id, p_kind, p_note)` | `customer_absent`/`customer_refused`. Μόνο από `arrived_customer` και αφού περάσει `now() − arrived_customer_at ≥ noshow_wait`. Η εργασία γίνεται `returning` και ανοίγει `delivery_disputes`. |

**Το claim (μόνο ένας κερδίζει):**

```sql
CREATE FUNCTION delivr_driver_claim(p_job_id UUID) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE d drivers%ROWTYPE; j delivery_jobs%ROWTYPE; ps platform_settings%ROWTYPE; v_active INT;
BEGIN
  SELECT * INTO ps FROM platform_settings WHERE id = 1;
  -- κλειδώνουμε πρώτα τον διανομέα (σειριοποιεί τα claims του ίδιου διανομέα → σωστό όριο ενεργών)
  SELECT * INTO d FROM drivers WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR d.status <> 'approved' THEN RAISE EXCEPTION 'NOT_APPROVED' USING ERRCODE='42501'; END IF;
  IF NOT d.is_online THEN RAISE EXCEPTION 'NOT_ONLINE' USING ERRCODE='22023'; END IF;

  -- μετά τη δουλειά: όποιος φτάσει δεύτερος περιμένει το lock και βρίσκει status <> 'offered'
  SELECT * INTO j FROM delivery_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF j.status <> 'offered' THEN RAISE EXCEPTION 'ALREADY_TAKEN' USING ERRCODE='22023'; END IF;
  IF j.offer_expires_at < now() THEN RAISE EXCEPTION 'OFFER_EXPIRED' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM driver_areas a WHERE a.driver_id = d.user_id AND a.area_norm = j.pickup_area_norm)
    THEN RAISE EXCEPTION 'NOT_IN_AREA' USING ERRCODE='22023'; END IF;
  IF j.food_amount > d.max_cash_float THEN RAISE EXCEPTION 'OVER_CASH_FLOAT' USING ERRCODE='22023'; END IF;
  IF j.payment_method <> 'cash' AND NOT d.has_card_pos THEN RAISE EXCEPTION 'NEEDS_POS' USING ERRCODE='22023'; END IF;
  SELECT count(*) INTO v_active FROM delivery_jobs
   WHERE driver_id = d.user_id AND status IN ('claimed','arrived_store','picked_up','arrived_customer','returning');
  IF v_active >= ps.network_max_active_per_driver THEN RAISE EXCEPTION 'TOO_MANY_ACTIVE' USING ERRCODE='22023'; END IF;

  UPDATE delivery_jobs SET status='claimed', driver_id=d.user_id, claimed_at=now(), updated_at=now()
   WHERE id = j.id;
  INSERT INTO delivery_job_events(job_id, event, actor, actor_id) VALUES (j.id, 'claimed', 'driver', d.user_id);
  INSERT INTO order_events(order_id, status, actor, note)
  VALUES (j.order_id, 'driver_assigned', 'driver', split_part(d.full_name, ' ', 1));
  RETURN delivr_driver_job_detail(j.id);   -- πλήρη στοιχεία μόνο τώρα
END $$;
```

- Το `SELECT ... FOR UPDATE` στη γραμμή της εργασίας σειριοποιεί δύο ταυτόχρονα claims. Ο δεύτερος
  περιμένει, ξαναδιαβάζει τη γραμμή (READ COMMITTED) και παίρνει `ALREADY_TAKEN`. Αυτό που βλέπει
  στο UI είναι «Την πήρε άλλος».
- Η σειρά των locks (driver → job) είναι ίδια σε όλα τα RPCs, ώστε να μην υπάρχουν deadlocks.
- Η `order_events.status` είναι TEXT, άρα το `'driver_assigned'` περνά. Το tracking πρέπει να
  αγνοεί άγνωστα status ή να τα μεταφράζει (μικρή αλλαγή UI).

**Κατάστημα** (δύο εκδοχές, όπως 007/016: `..._by_token(p_token, …)` για το `/s/<token>` και
`(p_order_id, …)` με έλεγχο `delivr_is_store_member`):

| Function / action | Τι κάνει |
|---|---|
| `delivr_store_set_delivery_mode(p_store_id, p_mode)` | `own`/`network`. Το `network` επιτρέπεται μόνο αν `network_enabled` και η περιοχή του μαγαζιού είναι στο `network_areas`. |
| `delivr_store_dispatch(p_order_id, p_action, p_reason)` με actions: | |
| · `retry` | `unclaimed` → `offered` (νέα λήξη, `offer_round+1`) |
| · `own_driver` | Ακυρώνει την εργασία (`cancel_reason='store_own_driver'`). Το order γίνεται `delivery_mode='own'` και συνεχίζει με τη σημερινή ροή του μαγαζιού. |
| · `to_takeaway` | Μόνο πριν την παραλαβή. Υποχρεωτικό `p_reason` (π.χ. «συμφώνησε τηλεφωνικά»). Το order γίνεται `delivery_type='pickup'`, `delivery_fee=0`, `total` ξαναϋπολογισμένο, `order_charges` ενημερώνεται και η εργασία ακυρώνεται. Το tracking του πελάτη δείχνει «Η παραγγελία έγινε take away — παραλαβή από το κατάστημα». |
| · `release_driver` | Ο διανομέας άργησε ή δεν φάνηκε: αν `now() > estimated_ready_at + 15′` και η εργασία είναι `claimed`, ξαναβγαίνει στο δίκτυο και γράφεται `delivery_disputes(kind='driver_no_show')` **μόνο για πληροφόρηση** (όχι ποινή). |
| · `not_paid` | Μέσα σε `network_dispute_minutes` από το `picked_up_at`: ανοίγει `store_not_paid`. |
| · `returned` | Από `returning` σε `returned`, με event `refunded_driver` (amount=`food_amount`). Το order γίνεται `cancelled` (`cancel_reason='customer_absent'`/`'customer_refused'`). |
| (υπάρχον) `reject` | Ακύρωση μέσω 007/016· ο trigger ακυρώνει την εργασία πριν την παραλαβή. |

Οι `delivr_store_order(token)` (007) και η λίστα του POS επιστρέφουν επιπλέον
`dispatch: {status, offer_expires_at, driver_first_name, driver_phone (μόνο μετά το claim), pickup_code}`.
Αυτή είναι η μόνη αλλαγή σε υπάρχουσα function (CREATE OR REPLACE με ίδια υπογραφή) και θα γίνει με
προσοχή. Εναλλακτικά: νέο `delivr_store_dispatch_status(token)` και καμία αλλαγή στην 007. **Προτιμάμε
το νέο RPC.**

**Admin:**
- `delivr_admin_driver_review(p_driver_id, p_decision, p_reason)`: approve, reject, suspend ή reinstate.
  Η έγκριση ορίζει `profiles.role='driver'` αν ήταν `customer`. Κάθε απόφαση θέλει αιτιολογία.
- `delivr_admin_document_review(p_doc_id, p_status, p_expires_on, p_note)`.
- `delivr_admin_job_action(p_job_id, p_action, p_note)`: cancel_after_pickup, reassign, force_delivered.
- `delivr_admin_resolve_dispute(p_id, p_resolution, p_note)`.
- `delivr_network_settings_update(p JSONB)`.

**Σύστημα:**
- `delivr_network_sweep()` (idempotent, γρήγορη):
  - `offered` με ληγμένο `offer_expires_at` → `unclaimed` + event;
  - `scheduled` με `estimated_ready_at − 25′ ≤ now()` → `offered`;
  - διανομείς με `is_online` και `last_seen_at < now() − idle` → `is_online=false`. Είναι τεχνικό
    (κλειστό κινητό), όχι ποινή.

### 6. Ειδοποιήσεις διανομέων και timeout — μόνο με ό,τι έχουμε

**Φάση 1 (χωρίς κανένα νέο σύστημα):**
- Το `/driver` ως PWA (ξεχωριστό `manifest-driver.json` με `start_url: /driver`, `scope: /driver`)
  ώστε να μπαίνει στην αρχική οθόνη.
- Όσο είναι «Διαθέσιμος»:
  - **polling `delivr_driver_feed()` κάθε 10″**. Κάθε κλήση είναι ένα μικρό SELECT. Με 20 διανομείς
    αυτό κάνει περίπου 2 req/s, μέσα στα όρια του free/pro Supabase **[να ελεγχθεί στο πλάνο του
    project]**;
  - **Screen Wake Lock API** ώστε να μη σβήνει η οθόνη (Chrome Android και Safari iOS 16.4+), με
    κουμπί «Κράτα την οθόνη ανοιχτή»;
  - σε νέα προσφορά: **ήχος** (WebAudio, ενεργοποιείται με το πρώτο tap του διακόπτη), **δόνηση**
    (`navigator.vibrate`, μόνο Android), αναβοσβήνει ο τίτλος της καρτέλας, και **τοπική
    ειδοποίηση** `registration.showNotification()` μέσα από το υπάρχον `sw.js`. Δεν χρειάζεται push
    server, αρκεί η άδεια Notification.
- Όριο: στο iOS, με κλειστή οθόνη ή άλλη εφαρμογή μπροστά, το polling σταματά. Ο διανομέας το
  βλέπει γραμμένο στην οθόνη: «Για να σε ειδοποιούμε, κράτα την εφαρμογή ανοιχτή».
- Γιατί όχι Supabase Realtime: το `postgres_changes` περνά από RLS και οι διανομείς δεν έχουν SELECT
  στο `delivery_jobs` (ούτε πρέπει). Το Realtime *broadcast* από trigger (`realtime.send`) είναι
  δωρεάν επιλογή για αργότερα. Το polling φτάνει για pilot.

**Φάση 6 (web push, δωρεάν):**
- Δημιουργούμε μία φορά ζεύγος VAPID. Το public key μπαίνει στο `VITE_VAPID_PUBLIC_KEY` και το private
  στα Supabase Edge secrets. Οι push υπηρεσίες των browsers (FCM για Chrome, Mozilla, Apple Web Push)
  **δεν χρεώνουν και δεν θέλουν λογαριασμό** για VAPID push.
- Το `registerPushToken` αλλάζει: γράφει μέσω `delivr_push_subscribe(endpoint, p256dh, auth)` στο
  `push_subscriptions`, όχι στο `profiles.fcm_token`, που είναι μπλοκαρισμένο από την 011a.
- Νέα edge function `driver-push` (Deno, `npm:web-push`). Όταν μια εργασία γίνεται `offered`, στέλνει
  push σε όλους τους online διανομείς της περιοχής. Την καλεί trigger μέσω `pg_net`, που η 002 ήδη
  χρησιμοποιεί **[να ελεγχθεί ότι το extension είναι ενεργό στο live]**, ή το ίδιο το RPC που κάνει
  offer.
- iOS: push μόνο όταν το PWA είναι στην αρχική οθόνη, από iOS 16.4 και μετά.
- Αποτυχίες 404/410 → σβήσιμο της συνδρομής.
- **Resend δεν χρειάζεται.** Δεν είναι ρυθμισμένο (ROADMAP) και δεν το προϋποθέτουμε πουθενά. SMS
  (Twilio) **όχι**, γιατί είναι πληρωμένο. Το WhatsApp μένει μόνο ως χειροκίνητο `wa.me` (το μαγαζί
  μπορεί να στείλει μήνυμα στον διανομέα με ένα tap).

**Timeout:**
- `offer_expires_at = offered_at + network_offer_seconds` (*300″*).
- Η λήξη εφαρμόζεται από τη `delivr_network_sweep()`. Αυτήν την καλούν:
  1. κάθε `delivr_driver_feed()`·
  2. κάθε ανάγνωση dispatch από το POS (polling 20″, ήδη υπάρχει) και από το `/s/<token>`·
  3. προαιρετικά, το **pg_cron** κάθε λεπτό. Είναι extension της Postgres, δωρεάν μέσα στο Supabase
     **[να ελεγχθεί αν είναι ενεργό]**.
  Ακόμα και χωρίς cron, το μαγαζί που έχει ανοιχτό το POS ή το `/s/` βλέπει τη λήξη το πολύ 20″ αργότερα.
- Αν η εργασία είναι `unclaimed`, το μαγαζί βλέπει κόκκινη μπάρα με ήχο και τις 4 επιλογές (§2). Το
  tracking του πελάτη γράφει «Το κατάστημα οργανώνει τη διανομή». Ο admin βλέπει «χωρίς διανομέα
  > 10′».
- **Πρόταση:** χωρίς αυτόματη επανάληψη. Αποφασίζει το μαγαζί, που ξέρει αν έχει άνθρωπο (απόφαση
  George #5).

### 7. Μετρητά, συμψηφισμός και διαφορές

Η πλατφόρμα **δεν κρατά και δεν μεταφέρει χρήματα**. Καταγράφει μόνο τι δήλωσε ο καθένας, με χρόνο,
στο `delivery_job_events`, ώστε να υπάρχουν στοιχεία όταν προκύπτει διαφορά.

| Ποσό | Τύπος | Ποιος → ποιον | Πότε |
|---|---|---|---|
| `food_amount` | `total − delivery_fee − tip` | διανομέας → μαγαζί | παραλαβή (κωδικός) |
| `collect_amount` | `total` | πελάτης → διανομέας | παράδοση |
| κέρδος διανομέα | `delivery_fee + tip` | μένει στον διανομέα | — |
| προμήθεια/συνδρομή πλατφόρμας | όπως σήμερα, σε `order_charges` | μαγαζί → πλατφόρμα | μηνιαία (ξεχωριστό, βλ. `feat/subscription-tiers`) |

**Οθόνες συμψηφισμού:**
- διανομέας: «Σήμερα / Εβδομάδα» με πληρωμές σε μαγαζιά, εισπράξεις και καθαρό ποσό;
- μαγαζί: «Πληρωμές διανομέων», μια γραμμή ανά παραγγελία με διανομέα, ποσό, ώρα και κουμπί «Δεν
  πληρώθηκα» μέσα στο παράθυρο;
- admin: όλα τα παραπάνω και οι ανοιχτές διαφορές.
- Εβδομαδιαία κατάσταση ανά ζεύγος μαγαζί–διανομέας (CSV), χρήσιμη αν ο λογιστής επιλέξει το «Μοντέλο Β»
  της §9.4.

**Σενάρια διαφορών (πρόταση HQ — αποφάσεις George #6):**

| Σενάριο | Τι γίνεται στο σύστημα | Ποιος σηκώνει το κόστος (πρόταση) |
|---|---|---|
| Μαγαζί: «δεν πληρώθηκα» | `store_not_paid`. Ο admin βλέπει events: χρόνο κωδικού, `food_amount`. Η παραγγελία συνεχίζει κανονικά. | Ο admin επικοινωνεί και με τους δύο. Επαναλαμβανόμενο → αναστολή διανομέα με αιτιολογία. |
| Πελάτης απών ή αρνείται | `returning` → ο διανομέας φέρνει πίσω τη σακούλα → το μαγαζί πατά `returned` και του επιστρέφει το `food_amount` | Το **μαγαζί** χάνει το φαγητό (είναι δικός του πελάτης). Το μεταφορικό: απόφαση #6 (πρόταση: το πληρώνει το μαγαζί στον διανομέα). Το τηλέφωνο του πελάτη σημειώνεται για τον admin (blocklist αργότερα). |
| Λάθος ή ελλιπή είδη | Ο πελάτης πληρώνει ό,τι παρέλαβε, ο διανομέας ανοίγει `wrong_or_missing_items` με ποσό | Το μαγαζί αποζημιώνει τη διαφορά στον διανομέα στην επόμενη συναλλαγή ή άμεσα |
| Ο πελάτης δεν έχει να πληρώσει όλο το ποσό | `cash_short` με ποσό | Όπως «αρνείται» για το υπόλοιπο |
| Ο διανομέας δεν εμφανίζεται | `release_driver` από το μαγαζί, ξαναβγαίνει στο δίκτυο, `driver_no_show` (πληροφοριακό) | Κανείς. Επαναλαμβανόμενο και τεκμηριωμένο → συζήτηση/αναστολή από άνθρωπο, όχι αυτόματα |
| Ο διανομέας κρατά τα χρήματα του πελάτη χωρίς να πληρώσει το μαγαζί | Ο κωδικός δεν δίνεται χωρίς πληρωμή, άρα δεν μπορεί να πάρει τη σακούλα | — |
| Ο διανομέας δηλώνει «παραδόθηκε» χωρίς να παραδώσει | Ο πελάτης παραπονιέται στο μαγαζί → admin. *(Προαιρετικά, Φάση 7: 4ψήφιος κωδικός παράδοσης στο `/t/<token>` του πελάτη.)* | Admin |

**Ακυρώσεις:**

| Ποιος / πότε | Αποτέλεσμα |
|---|---|
| Μαγαζί, πριν την παραλαβή (`reject`) | Η εργασία ακυρώνεται. Ο διανομέας, αν την είχε πάρει, βλέπει «Ακυρώθηκε από το κατάστημα». Δεν έχουν αλλάξει χέρια χρήματα. |
| Μαγαζί, μετά την παραλαβή | **Απαγορεύεται** (guard). Μόνο ο admin, μέσω διαφοράς. |
| Πελάτης | Δεν υπάρχει σήμερα ακύρωση από τον πελάτη. Τηλεφωνεί στο μαγαζί, που κάνει `reject`. Μετά την παραλαβή = «αρνείται» (πίνακας πάνω). |
| Διανομέας, πριν την παραλαβή | `release` (ελεύθερα). |
| Διανομέας, μετά την παραλαβή | Δεν μπορεί να «αφήσει» σακούλα. Ανοίγει διαφορά `other` και ο admin συντονίζει. |
| Admin | Οποιαδήποτε, με αιτιολογία και event. |

### 8. Ασφάλεια — λίστα ελέγχου

- Καμία νέα table-level INSERT/UPDATE/DELETE σε `authenticated`/`anon`. Παραμένει ο κανόνας της 011a.
- Τα `pickup_code`, `store_token` και `public_token` δεν επιστρέφονται ποτέ σε διανομέα.
- Στις παραγγελίες δικτύου **δεν γεμίζει το `orders.driver_id`** (το κενό της policy 004, §1). Το
  βάζουμε στο backlog: ξεχωριστή διόρθωση για column-level SELECT στο `store_token`.
- Διεύθυνση και τηλέφωνο πελάτη: μόνο μετά το claim και μόνο ως το `closed_at + 2h`. Μετά τα κρύβει το
  `delivr_driver_feed`/`job_detail` (GDPR, ελαχιστοποίηση).
- Rate-limit του `pickup_code`: 5 λάθη κλειδώνουν.
- Όλα τα ποσά υπολογίζονται στη βάση (snapshot στο job). Ο client δεν στέλνει ποτέ ποσά.
- Όλοι οι νέοι πίνακες με RLS ενεργό. Το `get_advisors` (security) πρέπει να είναι καθαρό μετά από
  κάθε migration.
- E.164 στο τηλέφωνο διανομέα πριν από `tel:` ή `wa.me` (κανόνας repo).

### 9. Νομικά και φορολογικά — ΟΛΑ προς έλεγχο από λογιστή/δικηγόρο

> Τίποτα σε αυτή την ενότητα δεν είναι νομική ή φορολογική συμβουλή. Είναι η λίστα ερωτήσεων και οι
> επιλογές σχεδίου που κάναμε για να μειώσουμε τον κίνδυνο.

#### 9.1 Οδηγία (ΕΕ) 2024/2831 για την εργασία μέσω πλατφορμών

- **Επιβεβαιωμένο από δημόσιες πηγές:**
  - η προθεσμία ενσωμάτωσης είναι **2 Δεκεμβρίου 2026**·
  - η Οδηγία θεσπίζει **μαχητό τεκμήριο σχέσης εξαρτημένης εργασίας** όταν τα πραγματικά περιστατικά
    δείχνουν **έλεγχο και κατεύθυνση** από την πλατφόρμα, όπως κρίνεται κατά το εθνικό δίκαιο. Το βάρος
    απόδειξης του αντιθέτου είναι στην πλατφόρμα·
  - ρυθμίζει την **αλγοριθμική διαχείριση**: ενημέρωση για αυτοματοποιημένα συστήματα παρακολούθησης
    και λήψης αποφάσεων, ανθρώπινη εποπτεία και επανεξέταση αποφάσεων. Αυτά ισχύουν **και για
    αυτοαπασχολούμενους**.

  Πηγές: [Ius Laboris](https://www.iuslaboris.com/insights/eu-platform-work-directive-which-countries-have-implemented/),
  [Lexgo](https://www.lexgo.be/en/news-and-articles/13897-new-eu-directive-impacting-digital-platforms-and-individuals-working-for-them),
  [CMS](https://cms.law/en/int/legal-updates/from-gig-to-guarantee-how-the-eu-is-transforming-platform-work).
- **[ΑΝΕΠΙΒΕΒΑΙΩΤΟ]** η ακριβής διατύπωση των άρθρων (αριθμός άρθρου για το τεκμήριο, ημερομηνία
  έναρξης ισχύος 1 ή 2/12/2024)· να διαβαστεί το κείμενο στο EUR-Lex.
- **[ΑΝΕΠΙΒΕΒΑΙΩΤΟ]** αν και πώς η Ελλάδα έχει ενσωματώσει την Οδηγία μέχρι σήμερα (30/10/2026).
  Αναφορές του 2026 έδειχναν ότι λίγα κράτη είχαν προχωρήσει.

#### 9.2 Ελληνικό δίκαιο ψηφιακών πλατφορμών

- **[ΑΝΕΠΙΒΕΒΑΙΩΤΟ — από δευτερογενείς πηγές]** Ν. 4808/2021:
  - άρθρο 68: ορισμός ψηφιακής πλατφόρμας;
  - άρθρο 69: τεκμήριο **ανεξάρτητων υπηρεσιών** όταν ισχύουν σωρευτικά κριτήρια. Αναφέρονται: ο
    πάροχος επιλέγει χρόνο εργασίας, μπορεί να αρνηθεί εργασίες, μπορεί να συνεργάζεται και με άλλες
    πλατφόρμες, μπορεί να χρησιμοποιεί υπεργολάβους/αντικαταστάτες.
  Σχολιαστές θεωρούν ότι η Οδηγία θα αντιστρέψει αυτό το τεκμήριο. Πηγές:
  [Eurofound](https://apps.eurofound.europa.eu/platformeconomydb/greek-law-no-48082021-protective-framework-for-platform-workers-105256),
  [ELA fiche](https://www.ela.europa.eu/sites/default/files/2024-06/Good-practice-fiche-EL-UDW_Regulating-the-digital-platforms-economy.pdf),
  [wherewework.gr](https://www.wherewework.gr/en/news-and-articles/eu-directive-2024-2831-greek-delivery-couriers-invisible-workforce-492).
  **Ο δικηγόρος να επιβεβαιώσει το κείμενο των άρθρων και τυχόν νεότερες ρυθμίσεις.** Ιδίως: αν
  υπάρχει υποχρέωση δήλωσης στο ΕΡΓΑΝΗ, ψηφιακή κάρτα ή άλλη αναγγελία συνεργασίας με αυτοαπασχολούμενους
  μέσω πλατφόρμας.

#### 9.3 Επιλογές σχεδίου που κρατούν τον διανομέα ανεξάρτητο

| Κριτήριο ελέγχου που αποφεύγουμε | Τι κάνει το σύστημα |
|---|---|
| Υποχρεωτική αποδοχή / ποινές | Δεν αποθηκεύουμε acceptance rate. Το «αγνοώ» δεν καταγράφεται καν. Το release πριν την παραλαβή επιτρέπεται και δεν έχει συνέπειες. |
| Βάρδιες / ωράριο | Κανένα. Online/offline όποτε θέλει. Το αυτόματο offline για αδράνεια είναι τεχνικό και δεν καταγράφεται ως αρνητικό. |
| Κατάταξη / αλγοριθμική ανάθεση | **Broadcast σε όλους ταυτόχρονα, first-come.** Καμία βαθμολογία, καμία προτεραιότητα, καμία προσφορά «πρώτα στον καλύτερο». Δεν χρησιμοποιούμε το `assign-driver`. |
| Η πλατφόρμα ορίζει την αμοιβή | Το μεταφορικό το ορίζει **το κατάστημα** ανά ζώνη. ⚠ Το **ελάχιστο 2,5 €** είναι παρέμβαση της πλατφόρμας στην τιμή. Ο δικηγόρος να κρίνει αν είναι αποδεκτό ως προστατευτικό κατώτατο όριο ή αν πρέπει να γίνει απλή σύσταση (απόφαση #3). |
| Εποπτεία / GPS | **Δεν συλλέγουμε τοποθεσία.** Η πλοήγηση είναι απλό link στο Google Maps. |
| Αξιολογήσεις που κόβουν δουλειά | Καμία αξιολόγηση διανομέων στη Φάση 1 (απόφαση #11). |
| Αποκλειστικότητα, στολή, εξοπλισμός | Καμία απαίτηση. Μπορεί να δουλεύει ταυτόχρονα για efood/Wolt, με δικό του όχημα και εξοπλισμό. |
| Αυτόματη απενεργοποίηση | Αναστολή **μόνο από άνθρωπο (admin)**, με γραπτή αιτιολογία που βλέπει ο διανομέας, και δυνατότητα αντίρρησης. Ευθυγραμμίζεται με τις διατάξεις της Οδηγίας για ανθρώπινη επανεξέταση. Αυτόματο είναι μόνο το «έληξε η ασφάλεια/δίπλωμα → δεν μπορείς να γίνεις online». **[ΑΝΕΠΙΒΕΒΑΙΩΤΟ: αρκεί η ενημέρωση;]** |
| Πλατφόρμα ως εργοδότης | Η πλατφόρμα **δεν πληρώνει** τον διανομέα και **δεν παίρνει** προμήθεια από αυτόν. Η σύμβαση μεταφοράς είναι μεταξύ καταστήματος/πελάτη και διανομέα. Η πλατφόρμα κάνει μόνο τη «σύνδεση». |
| Διαφάνεια αλγορίθμου | Σελίδα «Πώς μοιράζονται οι παραγγελίες» στην εφαρμογή διανομέα και στους όρους: «όλοι οι διαθέσιμοι της περιοχής ταυτόχρονα, πρώτος που αποδέχεται». |
| Αντικατάσταση (substitution) | **[ΑΝΕΠΙΒΕΒΑΙΩΤΟ]** Τα κριτήρια του Ν. 4808/2021 φαίνεται να αναφέρουν δυνατότητα υποκατάστασης. Η χειροκίνητη έγκριση κάθε προσώπου μάλλον συγκρούεται με αυτό. Ερώτηση για τον δικηγόρο: αρκεί ότι ο διανομέας μπορεί να δηλώσει αντικαταστάτη που επίσης εγκρίνεται; |

#### 9.4 Φορολογικά / αποδείξεις — **[ΑΝΕΠΙΒΕΒΑΙΩΤΟ, όλα για λογιστή]**

1. **Τι είναι τα χρήματα που δίνει ο διανομέας στο μαγαζί;** Αγοράζει ο διανομέας το φαγητό και το
   μεταπωλεί (κακό: τζίρος και ΦΠΑ στον διανομέα), ή είναι προκαταβολή/είσπραξη για λογαριασμό του
   πελάτη; Η απόδειξη του μαγαζιού πρέπει να εκδοθεί **στον πελάτη**, για το φαγητό, και να μπει στη
   σακούλα.
2. **Απόδειξη για το μεταφορικό — δύο μοντέλα:**
   - **Μοντέλο Α:** ο διανομέας εκδίδει δική του απόδειξη παροχής υπηρεσιών στον πελάτη για το
     μεταφορικό (myDATA, π.χ. δωρεάν εφαρμογές ΑΑΔΕ). Ο πελάτης παίρνει δύο αποδείξεις.
   - **Μοντέλο Β:** το μαγαζί χρεώνει το μεταφορικό στην απόδειξή του και ο διανομέας τιμολογεί
     **το μαγαζί** (π.χ. εβδομαδιαία) για υπηρεσίες διανομής. Ο συμψηφισμός μετρητών μένει ίδιος. Ο
     πελάτης παίρνει μία απόδειξη. Το σύστημα δίνει εβδομαδιαία κατάσταση ανά ζεύγος (§7).
   Η ροή της εφαρμογής δεν αλλάζει. Αλλάζουν μόνο τα κείμενα και οι αναφορές.
3. **Μετρητά vs POS:**
   - η υποχρέωση των επιχειρήσεων να δέχονται κάρτες·
   - η διασύνδεση POS–ταμειακής (ΦΗΜ)·
   - τα όρια συναλλαγών με μετρητά.
   Η είσπραξη με το POS **του διανομέα** για φαγητό που τιμολογεί **το μαγαζί** μάλλον δημιουργεί
   ασυμφωνία με τη διασύνδεση POS–ΦΗΜ του μαγαζιού. Γι' αυτό η προεπιλογή είναι «μόνο μετρητά» και η
   κάρτα έρχεται σε πολύ μεταγενέστερη φάση.
4. **Ιδιότητα διανομέα:** έναρξη στη ΔΟΥ με κατάλληλο ΚΑΔ (δραστηριότητες ταχυμεταφορών/διανομής —
   ο ακριβής κωδικός να επιβεβαιωθεί), εγγραφή στον e-ΕΦΚΑ ως μη μισθωτός. Τι ελέγχουμε στην έγκριση:
   βεβαίωση έναρξης ή εκτύπωση Taxisnet με ΚΑΔ.
5. **Η πλατφόρμα** δεν εισπράττει από διανομείς, άρα δεν εκδίδει τίποτα προς αυτούς. Αν αργότερα
   μπει fee διανομέα, ξανανοίγουν τα §9.3 και §9.4.

#### 9.5 Ασφάλιση — **[ΑΝΕΠΙΒΕΒΑΙΩΤΟ]**

- Αστική ευθύνη οχήματος: υποχρεωτική. **Ερώτηση στον ασφαλιστή:** καλύπτει η απλή ιδιωτική χρήση
  τη διανομή έναντι αμοιβής, ή χρειάζεται «επαγγελματική χρήση»; Τι ελέγχουμε στην έγκριση;
- Ποδήλατα/e-bikes: δεν υπάρχει υποχρεωτική ασφάλεια, αλλά μήπως πρέπει να ζητάμε αστική ευθύνη;
- Ατύχημα διανομέα: είναι ζήτημα της ασφάλισής του στον e-ΕΦΚΑ ως αυτοαπασχολούμενου. Χρειάζεται
  ρητή αναφορά στους όρους.
- Πλατφόρμα: χρειάζεται ασφάλιση αστικής ευθύνης για τη διαμεσολάβηση; (δικηγόρος/ασφαλιστής)
- Υγιεινή μεταφοράς τροφίμων (θερμομονωτική τσάντα): υπάρχουν απαιτήσεις ΕΦΕΤ για τον μεταφορέα;

#### 9.6 Όροι και GDPR

- **Όροι Διανομέα** (version στο `drivers.terms_version`) και **Όροι Καταστήματος – Δίκτυο**.
  Γράφονται από δικηγόρο. Περιλαμβάνουν: ρόλο πλατφόρμας ως μεσάζοντα, ροή χρημάτων, διαφορές,
  αναστολή με αιτιολογία, διαφάνεια ανάθεσης.
- Ενημέρωση απορρήτου διανομέα: ποια έγγραφα, γιατί, πόσο καιρό, ποιος τα βλέπει (μόνο admin).
- Δεν επεξεργαζόμαστε δεδομένα που η Οδηγία απαγορεύει (συναισθηματική κατάσταση, ιδιωτικές
  συνομιλίες, βιομετρικά πέραν της ταυτότητας κ.λπ.). Στην Φάση 1 δεν συλλέγουμε τίποτα τέτοιο.

### 10. Πλάνο υλοποίησης (εκτιμήσεις σε εργάσιμες ημέρες ανάπτυξης)

| Φάση | Περιεχόμενο | Εκτίμηση |
|---|---|---|
| 0 | Το σημερινό `/driver`: μήνυμα «Έρχεται σύντομα» αντί για σπασμένες ενέργειες, ή κρύψιμο. Καμία αλλαγή DB. | 0,25 |
| 1 | **DB**: 018 (πίνακες, στήλες, RLS, REVOKE, bucket), 019 (RPCs, triggers, sweep), 020 (`delivr_place_order` + `delivr_effective_delivery_fee` + προμήθεια χωρίς μεταφορικό). Tests σε PGlite (`e2e/db/driver-network.test.mjs`). | 3 |
| 2 | **Admin**: «Διανομείς» (αιτήσεις, έγγραφα, έγκριση/αναστολή με αιτιολογία), «Δίκτυο» (ρυθμίσεις, περιοχές), «Διανομές» (ζωντανές, χωρίς διανομέα, διαφορές). | 1,5 |
| 3 | **Εφαρμογή διανομέα** (ξαναγραμμένη σε RPCs): αίτηση + upload, online, περιοχές, feed με ήχο/δόνηση/wake lock/τοπική ειδοποίηση, claim/release, κωδικός παραλαβής, παράδοση/αποτυχία, «Σήμερα», PWA manifest `/driver`. EL + EN. | 3 |
| 4 | **Κατάστημα**: ρύθμιση «Διανομή», κατάσταση dispatch και κωδικός στην κάρτα POS και στο `/s/<token>` και στην εκτύπωση, κόκκινη μπάρα «χωρίς διανομέα» με 4 ενέργειες, «Δεν πληρώθηκα», «Επεστράφη», «Πληρωμές διανομέων». | 2 |
| 5 | **Πελάτης**: μηνύματα ορίου/μετρητών στο checkout, tracking «αναζήτηση/ανέλαβε/take away». EL + EN. | 0,5 |
| 6 | **Web push** (VAPID, `push_subscriptions`, `driver-push` edge function, trigger μέσω pg_net, οδηγίες iOS). | 1,5 |
| 7 | Pilot: 1 περιοχή, 2–3 μαγαζιά, 3–5 διανομείς, test παραγγελίες πριν το live. Προαιρετικός κωδικός παράδοσης πελάτη. | 1–2 εβδομάδες ημερολογιακά |
| 8 | (Αργότερα, αν το εγκρίνει ο λογιστής) «Κάρτα στην πόρτα» με POS διανομέα: `ALTER TYPE payment_method ADD VALUE 'card_on_delivery'`, φίλτρο `has_card_pos`. | 1 |

**Σύνολο ανάπτυξης ≈ 11–13 ημέρες** (Φάσεις 0–6) και το pilot. Η σειρά εφαρμογής στο live είναι
018 → 019 → 020, όλα με `network_enabled=false`. Μέχρι να ανοίξει ο admin το δίκτυο **δεν αλλάζει
τίποτα** για κανένα υπάρχον μαγαζί (`delivery_mode='own'` default). Κάθε migration γράφεται και στο
`supabase/migrations/` (κανόνας repo) και δοκιμάζεται πρώτα σε PGlite.

### 11. Πλάνο δοκιμών

**DB (PGlite, `e2e/db/driver-network.test.mjs`):**
- Το μαγαζί σε `network`: η `place_order` (α) απορρίπτει μη μετρητά, (β) απορρίπτει πάνω από 60 €,
  (γ) ανεβάζει το μεταφορικό 1,0 € σε 2,5 €, (δ) αγνοεί το `free_above`, (ε) η προμήθεια σε βάση
  `total` εξαιρεί το μεταφορικό.
- Υπάρχον μαγαζί `own`: **ίδιο αποτέλεσμα με σήμερα** (regression όλων των tests 014–016).
- accept → δημιουργείται εργασία `offered` με σωστά `food_amount`/`collect_amount`/`pickup_code`.
  Το auto_accept κάνει το ίδιο.
- claim: μη εγκεκριμένος, offline, εκτός περιοχής, πάνω από `max_cash_float`, πάνω από μέγιστες
  ενεργές → σωστό error. Δεύτερο claim → `ALREADY_TAKEN`. Ληγμένη προσφορά → `OFFER_EXPIRED`.
- Το feed **δεν** περιέχει όνομα, τηλέφωνο, οδό ή `pickup_code` πριν το claim. Μετά το claim τα
  περιέχει, εκτός από το `pickup_code`.
- pickup με λάθος κωδικό → error. 5 λάθη → κλείδωμα. Σωστός κωδικός → order `on_the_way`.
- Guard: μαγαζί προσπαθεί `on_the_way`/`delivered` (007 και 016) σε εργασία με διανομέα →
  `NETWORK_DRIVER_OWNS_DELIVERY`. `reject` μετά το pickup → `NETWORK_ALREADY_PICKED_UP`.
- sweep: λήξη → `unclaimed`. retry / own_driver / to_takeaway (σύνολο ξαναϋπολογισμένο,
  `order_charges` σωστό).
- failed: πριν το `noshow_wait` → error. Μετά → returning → returned → order `cancelled`.
- Δικαιώματα:
  - `anon` δεν εκτελεί κανένα νέο RPC εκτός από τα token-twins·
  - `authenticated` δεν κάνει INSERT/UPDATE σε κανέναν νέο πίνακα;
  - διανομέας Α δεν βλέπει εργασία διανομέα Β;
  - μέλος καταστήματος Χ δεν βλέπει εργασίες του Υ;
  - `has_function_privilege` για κάθε νέα function.

**Ταυτοχρονισμός (πραγματική Postgres, όχι PGlite):** script Node με δύο ξεχωριστές συνδέσεις `pg`
(τοπική Postgres ή Supabase branch, **όχι live**). 50 γύροι με δύο ταυτόχρονα claims στην ίδια
εργασία: κάθε φορά ακριβώς ένα επιτυχές.

**E2E (υπάρχον `e2e/browser.mjs`, mobile viewport, screenshots ανά φάση στο `docs/screenshots/`):**
- `driver-onboarding.mjs`: αίτηση → admin έγκριση → online;
- `driver-network.mjs`: πελάτης παραγγέλνει → μαγαζί δέχεται → **δύο** διανομείς σε δύο browsers,
  πατάνε μαζί και ο ένας παίρνει «Την πήρε άλλος» → κωδικός → παράδοση → tracking «Παραδόθηκε» → σύνοψη
  «Σήμερα» σωστή;
- `driver-timeout.mjs`: με `network_offer_seconds=10` → μπάρα στο POS → «Γίνεται take away» →
  tracking ενημερώνεται;
- `driver-dispute.mjs`: «Δεν πληρώθηκα» και «πελάτης απών → επεστράφη»;
- Επανάληψη όλων των υπαρχόντων e2e (guest, shop, store-confirm, admin, market, join, merchant-pos).
  Πρέπει να είναι πράσινα χωρίς αλλαγές.

**Χειροκίνητα στο pilot:** Android Chrome + iPhone Safari PWA (ήχος, wake lock, τοπική ειδοποίηση,
push της Φάσης 6) σε πραγματικό δρόμο.

### 12. Εκτός σχεδίου / backlog

- Οι δικοί διανομείς του καταστήματος (υπάλληλοι) στην ίδια εφαρμογή: `store_drivers`, ανάθεση από το
  μαγαζί. Ξεχωριστό σχέδιο.
- Η διόρθωση του κενού `orders_store_read` (το `store_token` είναι ορατό σε όποιον έχει
  `driver_id = uid`): column-level SELECT. Ξεχωριστή μικρή migration.
- Συνδρομές καταστημάτων: γίνονται στο `feat/subscription-tiers` και δεν επηρεάζονται από εδώ.

### 13. Ανοιχτές αποφάσεις για τον George (μία γραμμή η καθεμία· προεπιλογή HQ σε παρένθεση)

1. Σε ποια περιοχή ξεκινάμε pilot; (μία περιοχή, όπου υπάρχουν ήδη μαγαζιά Delivr Stores)
2. Ανώτατο ποσό παραγγελίας δικτύου; (60 €)
3. Ελάχιστο μεταφορικό: υποχρεωτικό ή απλή σύσταση στο μαγαζί; (υποχρεωτικό 2,5 €, αν το εγκρίνει ο δικηγόρος)
4. «Δωρεάν delivery πάνω από Χ» στο δίκτυο: δεν ισχύει, ή το πληρώνει το μαγαζί στον διανομέα; (δεν ισχύει)
5. Timeout προσφοράς και τι μετά: 5′ και απόφαση μαγαζιού, ή μία αυτόματη επανάληψη; (5′, χωρίς αυτόματη επανάληψη)
6. Πελάτης απών/αρνείται: το μαγαζί επιστρέφει το φαγητό στον διανομέα· το μεταφορικό το πληρώνει το μαγαζί; (ναι)
7. Πόσες ταυτόχρονες παραγγελίες ανά διανομέα; (2)
8. Κάρτα στην πόρτα με POS διανομέα: αργότερα ή ποτέ; (αργότερα, μόνο με ΟΚ λογιστή)
9. Απόδειξη μεταφορικού: διανομέας → πελάτη (Α) ή διανομέας → μαγαζί (Β); (απόφαση λογιστή· προτιμάμε Β)
10. Επιλογή «δικός μου πρώτα, δίκτυο ως εφεδρεία» για τα μαγαζιά; (όχι στη Φάση 1)
11. Αξιολογήσεις διανομέων από πελάτες/μαγαζιά; (όχι, για να μείνει καθαρή η ανεξαρτησία)
12. Ποιος λογιστής και ποιος δικηγόρος ελέγχουν το §9 πριν το pilot; (χρειάζεται όνομα)
13. Το σημερινό σπασμένο `/driver`: κρύψιμο τώρα με «Έρχεται σύντομα»; (ναι, Φάση 0)
14. Web push (Φάση 6) πριν ή μετά το pilot; (πριν, λόγω iPhone)
15. Πόσα μετρητά μπορεί να προπληρώνει ο διανομέας: το δηλώνει ο ίδιος, με default; (ναι, default 60 €)
