# Delivr: ανέβασμα email μέσω SMTP (για το HQ)

Τα email του Delivr (νέα παραγγελία στο κατάστημα, αντίγραφο στον πελάτη, αλλαγή
κατάστασης) φεύγουν πλέον με **SMTP από το `delivr@actionweb.gr`**. Το Resend μένει μόνο
ως εφεδρικό, αν λείπει το SMTP. Δεν χρειάζεται κλειδί Resend (απόφαση 17/11: τα email
@actionweb.gr είναι έτοιμα).

> **Θέλει γραπτό OK του George πριν μπουν τα secrets.** Μόλις μπουν τα `SMTP_*` στο live,
> **κάθε πραγματική παραγγελία στέλνει αυτόματα email στο κατάστημα και στον πελάτη**, και
> κάθε αλλαγή κατάστασης στέλνει email στον πελάτη. Αυτό είναι νέα αυτόματη αποστολή
> μηνυμάτων σε καταστήματα και πελάτες, άρα θέλει το γραπτό OK του George
> (`hq/GEORGE_RULES.md` §3). Τα βήματα 1, 2 και 4 (merge, migrations, deploy των functions)
> γίνονται χωρίς να περιμένουμε: χωρίς secrets δεν φεύγει κανένα email. Το βήμα 3 (secrets)
> **μόνο μετά το γραπτό OK**.

Branch: `fix/email-smtp` (πάνω στο τρέχον `master`). Λεπτομέρειες: `docs/EMAIL-SMTP.md`.

## 1. Πριν
- Merge του `fix/email-smtp` στο `master` (PR). Build, lint και τα 17 tests του mailer είναι πράσινα.
- Backup του πίνακα `orders` και του `platform_settings` (ή snapshot της βάσης) στο Supabase
  project `ifgzciraogohycuvujip`.
- Σημείωσε ποια έκδοση των `notify-order` και `send-notification` τρέχει σήμερα και τη
  ρύθμιση JWT του `notify-order` (Dashboard → Edge Functions → notify-order → «Enforce JWT
  verification»). Χρειάζονται για το βήμα 4 και για το rollback.

## 2. Βάση (πρώτα αυτό)
Τρέξε με τη σειρά:
1. `supabase/migrations/020_order_email_claims.sql`: προσθέτει μόνο 2 κενές στήλες στο
   `orders` (`store_email_claimed_at`, `guest_email_claimed_at`). Χωρίς αυτό, το νέο
   `notify-order` δεν στέλνει τίποτα (γράφει `failed` στο `order_dispatch_log`).
2. `supabase/migrations/021_support_email_delivr.sql`: βάζει
   `platform_settings.support_email = 'delivr@actionweb.gr'` (σήμερα στο live είναι
   `hello@auditbnb.com`, το mailbox άλλου προϊόντος). Αλλάζει μόνο κενή τιμή ή την παλιά
   του AuditBnb, και μπορεί να τρέξει ξανά χωρίς πρόβλημα. **Πρέπει να έχει τρέξει πριν
   μπουν τα secrets**, αλλιώς τα στοιχεία των πελατών πάνε στο AuditBnb.

Έλεγχος: `select support_email from platform_settings where id = 1;` → `delivr@actionweb.gr`.

Το `019_stripe_plan_billing.sql` δεν είναι τεχνική προϋπόθεση των 020/021. Είναι μόνο
σειρά αρίθμησης: τα 020/021 δεν αγγίζουν τίποτα από το 019.

## 3. Secrets (Supabase → Edge Functions → Secrets): ΜΟΝΟ μετά το γραπτό OK του George
Μόνο τα ονόματα. Τις τιμές τις έχει ήδη το HQ από το mailbox. Ποτέ σε κώδικα ή αναφορά.

| Όνομα | Τι μπαίνει |
|---|---|
| `SMTP_HOST` | `mail.actionweb.gr` |
| `SMTP_PORT` | `465` (το Supabase κόβει τα 25 και 587) |
| `SMTP_USER` | `delivr@actionweb.gr` |
| `SMTP_PASS` | ο κωδικός του mailbox |
| `SMTP_FROM` | `Delivr <delivr@actionweb.gr>` |
| `SMTP_SECURE` | προαιρετικό, κενό = TLS στο 465 |

Ίδια ονόματα με StayLink και Sparcle. Τα `RESEND_API_KEY` / `RESEND_FROM` μένουν κενά.

## 4. Deploy των 2 functions (μπορεί πριν από το OK)
```bash
# notify-order: ίδια ρύθμιση JWT με αυτή που έχει σήμερα στο live (βήμα 1).
# Αν σήμερα είναι ΚΛΕΙΣΤΟ το "Enforce JWT verification", πρόσθεσε --no-verify-jwt.
supabase functions deploy notify-order --project-ref ifgzciraogohycuvujip
supabase functions deploy send-notification --no-verify-jwt --project-ref ifgzciraogohycuvujip
```
(Το `_shared/mailer.ts` μπαίνει μαζί αυτόματα. Τα υπόλοιπα functions δεν αλλάζουν.)
Το `config.toml` δεν έχει γραμμή για το `notify-order`, οπότε χωρίς flag ανεβαίνει με
`verify_jwt = true`. Μετά το deploy, ξανακοίτα στο Dashboard ότι η ρύθμιση JWT είναι ίδια με πριν.

### Έλεγχος αμέσως μετά το deploy (401 στο send-notification)
Το `send-notification` δέχεται πλέον μόνο `Authorization: Bearer <service role key>`. Οι
functions (`confirm-order`, `assign-driver`, `order-status-webhook`) το στέλνουν ήδη. Ο
trigger της βάσης (migration 002) όμως στέλνει `current_setting('app.service_role_key')`.
Αν αυτή η ρύθμιση στο live είναι κενή ή παλιά, θα παίρνει **401** και θα κοπούν και οι
ειδοποιήσεις in-app/push, όχι μόνο το email.
1. Άλλαξε την κατάσταση μιας δοκιμαστικής παραγγελίας (π.χ. από το δοκιμαστικό κατάστημα).
2. Dashboard → Edge Functions → `send-notification` → Logs: πρέπει να δεις `200`, όχι `401`.
3. Αν δεις `401`: η `app.service_role_key` της βάσης δεν ταιριάζει με το τρέχον service role
   key. Διόρθωσέ τη (ή κάνε rollback, βήμα 6) πριν προχωρήσεις.

## 5. Δοκιμή στο live (μετά τα secrets)
1. Σε ένα **δοκιμαστικό** κατάστημα βάλε `order_email` το `delivr@actionweb.gr` (ή το
   `sfirakis@gmail.com`). **Όχι** το mailbox του γραφείου: δεν φεύγει email στο γραφείο χωρίς OK.
2. Κάνε μια πραγματική παραγγελία από τη φόρμα του καταστήματος, με email πελάτη επίσης
   `delivr@actionweb.gr` ή `sfirakis@gmail.com`.
3. Έλεγξε:
   - ήρθε το email, όχι στα spam («Show original»: SPF και DKIM `PASS` για actionweb.gr)·
   - στο email του καταστήματος το `To` έχει μόνο το κατάστημα (το αντίγραφο της
     πλατφόρμας πάει κρυφά, ως `Bcc`, στο `delivr@actionweb.gr`) και το «Απάντηση» πάει
     στον πελάτη· στο email του πελάτη το «Απάντηση» πάει στο κατάστημα·
   - στο `order_dispatch_log` οι νέες γραμμές έχουν `provider = smtp`, `status = sent`·
   - αν `failed`, η στήλη `error` λέει την απάντηση του server (κωδικός, port κτλ.)·
   - αν `sent` αλλά η `error` γράφει `rejected: …`, ο server αρνήθηκε κάποιον παραλήπτη
     (π.χ. το email του ιδιοκτήτη) ενώ οι άλλοι το πήραν.
4. Screenshot + link στον George.

## 6. Rollback
1. Άδειασε (σβήσε) τα `SMTP_*` secrets: σταματούν αμέσως όλα τα email (το `notify-order`
   γράφει `skipped` και η παραγγελία περνά κανονικά).
2. Αν χρειάζεται και ο παλιός κώδικας: ξανά deploy των `notify-order` και `send-notification`
   από την προηγούμενη έκδοση του `master` (πριν το merge του `fix/email-smtp`), με την ίδια
   ρύθμιση JWT που είχαν.
3. Οι στήλες της 020 και η τιμή της 021 μπορούν να μείνουν: δεν επηρεάζουν τον παλιό κώδικα.

## Γνωστό, σπάνιο
Αν η function πέσει ανάμεσα στο claim και στην αποστολή, το claim μένει χωρίς γραμμή στο
log και το email δεν ξαναφεύγει αυτόματα, μόνο με το «resend» του admin. Τα timeouts
(10+10+20 s) είναι κάτω από το όριο του Edge, άρα είναι πολύ σπάνιο.
