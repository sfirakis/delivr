# Review 3: SMTP email μετά το rebase (fix/email-smtp @ d24af62)

Ανεξάρτητος έλεγχος, 20/11/2026. Βάση: `origin/master` 021f7e1. Προηγούμενη ελεγμένη
έκδοση: `backup/email-smtp-pre-rebase` (01c7a04). Μόνο ανάγνωση, εκτός από αυτό το αρχείο.

## Τι έτρεξε

| Έλεγχος | Αποτέλεσμα |
|---|---|
| `npm run build` | πράσινο (μόνο η γνωστή προειδοποίηση για chunk > 500 kB) |
| `npm run lint` | πράσινο, 0 warnings |
| `deno check` notify-order, send-notification, `_shared/*.ts` | πράσινο |
| `deno test supabase/functions/_shared/` (`--allow-net=127.0.0.1`, ψεύτικο SMTP) | 15/15 πράσινα. Κανένα πραγματικό email. |

## Rebase

- Το `origin/master` είναι πρόγονος του HEAD. 7 commits από πάνω, όλα του email.
- Αρχεία που αλλάζουν σε σχέση με το master: `.env.example`, `README.md`, 3 docs, `_shared/{guards,mailer,order-mail,mail.test}.ts`,
  `notify-order`, `send-notification`, `020_order_email_claims.sql`. Τίποτα άλλο.
- **Ανέγγιχτα** (`git diff --quiet` πράσινο): `019_stripe_plan_billing.sql`, `plan-billing/`, `stripe-webhook/`,
  `_shared/planBilling.ts`, `supabase/config.toml`, όλο το `src/`.
- Σε σχέση με το 01c7a04 άλλαξαν μόνο: η μετονομασία 019 → 020, οι αναφορές σε 020 (κώδικας + `EMAIL-SMTP.md`),
  το `.env.example` κρατά και τα νέα Stripe του master, και το νέο `SMTP-DEPLOY.md`. Η λογική δεν άλλαξε.
- Καμία αναφορά σε `019_order_email_claims` δεν έμεινε στον κώδικα ή στα τρέχοντα docs.

## Ευρήματα

### ΣΟΒΑΡΟ

1. **Κάθε παραγγελία πάει σε mailbox άλλου προϊόντος (`hello@auditbnb.com`).** Το `notify-order` βάζει το
   `platform_settings.support_email` και στο `To` και στο `Reply-To` (υπάρχει ήδη στο master, αλλά εκεί δεν έφευγε
   ποτέ email γιατί δεν υπήρχε κλειδί Resend). Με το SMTP ενεργό:
   - όνομα, τηλέφωνο και διεύθυνση κάθε πελάτη πάνε στο mailbox του AuditBnb·
   - το κατάστημα βλέπει `hello@auditbnb.com` στους παραλήπτες·
   - όταν το κατάστημα **ή ο πελάτης** πατήσει «Απάντηση», η απάντηση πάει στο AuditBnb (και το αντίγραφο του
     πελάτη έχει το ίδιο `Reply-To`).
   **Ναι, είναι bug, να διορθωθεί πριν βγει.** Η πιο μικρή διόρθωση είναι δεδομένα, όχι κώδικας: `support_email =
   'delivr@actionweb.gr'` στο `platform_settings` (id 1), πριν ή μαζί με τα secrets. Καλό είναι να γίνει migration
   `021`, ώστε το `011b` να μην το ξαναγράφει σε νέο περιβάλλον. Πρόταση και για αργότερα: το αντίγραφο της
   πλατφόρμας να πηγαίνει ως `Bcc`, όχι στο `To` που βλέπει το κατάστημα.

2. **Με τα secrets ανάβει νέα αυτόματη αποστολή email σε καταστήματα και πελάτες.** Το `SMTP-DEPLOY.md` γράφει «δεν
   ρωτάμε τον George», αλλά μόλις μπουν τα `SMTP_*`, κάθε πραγματική παραγγελία στέλνει αυτόματα email στο κατάστημα
   και στον πελάτη. Οι κανόνες λένε ότι κάθε νέα αυτόματη αποστολή email και κάθε μήνυμα σε πελάτες θέλει
   **γραπτό OK του George**. Ο κώδικας μπορεί να ανέβει. Τα secrets στο live μπαίνουν μόνο με το OK του. Η πρόταση
   στο doc να διορθωθεί ανάλογα.

### ΜΕΣΑΙΟ

3. **Το `send-notification` δέχεται πλέον μόνο Bearer με το service role key.** Οι callers σε κώδικα
   (`confirm-order`, `assign-driver`, `order-status-webhook`) στέλνουν `SUPABASE_SERVICE_ROLE_KEY`, οπότε είναι εντάξει.
   Ο trigger του `002` όμως στέλνει `current_setting('app.service_role_key')`. Αν αυτή η ρύθμιση στο live είναι κενή ή
   παλιά, μετά το deploy θα παίρνει 401, και θα κοπούν και οι ειδοποιήσεις in-app/push, όχι μόνο το email. Να μπει
   στο doc: μετά το deploy, έλεγχος στα logs του `send-notification` για 401 σε μια αλλαγή κατάστασης παραγγελίας.

4. **Το `notify-order` ανεβαίνει χωρίς flag για JWT.** Το `config.toml` δεν έχει γραμμή για το `notify-order`, οπότε
   θα ανέβει με `verify_jwt = true`. Δουλεύει με το παλιό anon JWT που στέλνει ο client. Το doc να λέει «κράτα την
   ίδια ρύθμιση JWT που έχει σήμερα στο live» (Dashboard → Functions → notify-order), ώστε να μην αλλάξει χωρίς να το
   καταλάβει κανείς.

### ΜΙΚΡΟ

5. Η απάντηση του nodemailer αγνοείται. Αν ο server αρνηθεί **έναν** από τους παραλήπτες (π.χ. το email του
   ιδιοκτήτη), οι άλλοι το παίρνουν κανονικά και το log γράφει `sent` χωρίς να αναφέρει την άρνηση. Να γράφεται το
   `info.rejected` στο `error` του log.
6. Αν η function πέσει ανάμεσα στο claim και στην αποστολή, το claim μένει χωρίς γραμμή στο log. Τότε το email δεν
   φεύγει ποτέ αυτόματα, μόνο με το admin resend. Το ανώτατο timeout (10+10+20 s) είναι κάτω από το όριο του Edge,
   άρα είναι σπάνιο. Αρκεί μια σημείωση.
7. `SMTP-DEPLOY.md`:
   - Η «προϋπόθεση 019» δεν είναι τεχνική εξάρτηση, είναι μόνο σειρά αρίθμησης. Καλό να το λέει.
   - Λείπει το rollback: redeploy της προηγούμενης έκδοσης των 2 functions και άδειασμα των `SMTP_*`. Οι 2 στήλες
     μπορούν να μείνουν.
   - Η δοκιμή προτείνει το `actionweboffice@gmail.com` (γραφείο). Καλύτερα `delivr@actionweb.gr` ή
     `sfirakis@gmail.com`, ώστε να μη φύγει email στο γραφείο χωρίς OK.
8. Το παλιό `docs/REVIEW-EMAIL-SMTP.md` αναφέρει ακόμα «019» για τα claims. Είναι ιστορικό, αλλά μια γραμμή «(τώρα 020)»
   θα γλίτωνε μπέρδεμα.
9. Το `notify-order` έχει δικό του `esc`, ενώ υπάρχει και αυτό του `_shared/mailer.ts`, που κάνει και escape το `'`.
   Δεν είναι κενό ασφαλείας: κανένα attribute του template δεν είναι σε μονά εισαγωγικά.

## Τι είναι καλό

- **SMTP:** TLS στο 465 (`secure` αυτόματα για 465, `SMTP_SECURE` το παρακάμπτει), timeouts 10/10/20 s,
  `transport.close()` στο `finally`, οι εξαιρέσεις γίνονται `{ok:false, error}` και η παραγγελία δεν σπάει ποτέ.
- **Resend μόνο εφεδρικά:** χρησιμοποιείται μόνο όταν λείπει κάποιο από `SMTP_HOST/USER/PASS`. Αν υπάρχουν και τα
  δύο, κερδίζει το SMTP (υπάρχει test).
- **Χωρίς διπλά email:** atomic `UPDATE … WHERE id AND col IS NULL RETURNING id` ανά κανάλι, fail-closed όταν
  αποτυγχάνει το claim, release μετά από αποτυχία, και επιπλέον έλεγχος στο `order_dispatch_log` για παλιές
  παραγγελίες. Το admin resend αφορά μόνο το email του καταστήματος. Το αντίγραφο του πελάτη φεύγει το πολύ μία
  φορά. Οι triggers του `orders` είναι μόνο `UPDATE OF status`, οπότε το claim δεν πυροδοτεί τίποτα.
- **Παραλήπτες:** δέχεται μόνο μία διεύθυνση ανά πεδίο, οπότε το `guest_email` δεν σπάει σε λίστα. Τα subjects δεν
  έχουν CR/LF και οι τιμές του `send-notification` περνούν από escape.
- **Μυστικά:** κανένα κλειδί ή κωδικός στο diff, μόνο `dummy` / `x` μέσα στα tests. Τα logs γράφουν provider και
  μήνυμα σφάλματος, ποτέ credentials. Τα docs έχουν μόνο ονόματα secrets.
- Η migration 020 είναι idempotent (`ADD COLUMN IF NOT EXISTS`, nullable) και ασφαλής για τα δεδομένα. Στο doc
  προηγείται σωστά του deploy.

## Ετυμηγορία: **ΟΧΙ ΕΤΟΙΜΟ** (ο κώδικας είναι σωστός, λείπουν 2 βήματα πριν ανάψει στο live)

Ο κώδικας και το rebase είναι σωστά και μπορούν να μπουν στο master. Για να ανάψει στο live:
1. `platform_settings.support_email` → `delivr@actionweb.gr` (κατά προτίμηση με migration 021) πριν μπουν τα secrets.
2. Γραπτό OK του George για την ενεργοποίηση της αυτόματης αποστολής σε καταστήματα και πελάτες, και διόρθωση της
   φράσης «δεν ρωτάμε τον George» στο `SMTP-DEPLOY.md`.
3. (Μέσα στο doc) έλεγχος για 401 στο `send-notification` και διατήρηση της ίδιας ρύθμισης JWT στο `notify-order`.

Με τα 1 και 2 γίνεται **ΕΤΟΙΜΟ ΓΙΑ LIVE**. Τα ΜΙΚΡΑ μπορούν να γίνουν αργότερα.
