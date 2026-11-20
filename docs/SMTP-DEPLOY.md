# Delivr: ανέβασμα email μέσω SMTP (για το HQ)

Τα email του Delivr (νέα παραγγελία στο κατάστημα, αντίγραφο στον πελάτη, αλλαγή
κατάστασης) φεύγουν πλέον με **SMTP από το `delivr@actionweb.gr`**. Το Resend μένει μόνο
ως εφεδρικό, αν λείπει το SMTP. **Δεν χρειάζεται κλειδί Resend και δεν ρωτάμε τον George**
(απόφαση 17/11: τα email @actionweb.gr είναι έτοιμα).

Branch: `fix/email-smtp` (πάνω στο τρέχον `master`). Λεπτομέρειες: `docs/EMAIL-SMTP.md`.

## 1. Πριν
- Merge του `fix/email-smtp` στο `master` (PR). Build, lint και τα 15 tests του mailer είναι πράσινα.
- Backup του πίνακα `orders` (ή snapshot της βάσης) στο Supabase project `ifgzciraogohycuvujip`.

## 2. Βάση (πρώτα αυτό)
Τρέξε το `supabase/migrations/020_order_email_claims.sql`. Προσθέτει μόνο 2 κενές στήλες
στο `orders` (`store_email_claimed_at`, `guest_email_claimed_at`). Χωρίς αυτό, το νέο
`notify-order` δεν στέλνει τίποτα (γράφει `failed` στο `order_dispatch_log`).
Προϋπόθεση: να έχει ήδη περάσει το `019_stripe_plan_billing.sql`.

## 3. Secrets (Supabase → Edge Functions → Secrets)
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

## 4. Deploy των 2 functions
```bash
supabase functions deploy notify-order --project-ref ifgzciraogohycuvujip
supabase functions deploy send-notification --no-verify-jwt --project-ref ifgzciraogohycuvujip
```
(Το `_shared/mailer.ts` μπαίνει μαζί αυτόματα. Τα υπόλοιπα functions δεν αλλάζουν.)

## 5. Δοκιμή στο live
1. Σε ένα **δοκιμαστικό** κατάστημα βάλε `order_email` ένα δικό μας mailbox
   (π.χ. το ίδιο το `delivr@actionweb.gr` ή το γραφείο `actionweboffice@gmail.com`).
2. Κάνε μια πραγματική παραγγελία από τη φόρμα του καταστήματος, με email πελάτη επίσης δικό μας.
3. Έλεγξε:
   - ήρθε το email, όχι στα spam («Show original»: SPF και DKIM `PASS` για actionweb.gr)·
   - στο `order_dispatch_log` οι νέες γραμμές έχουν `provider = smtp`, `status = sent`·
   - αν `failed`, η στήλη `error` λέει την απάντηση του server (κωδικός, port κτλ.).
4. Screenshot + link στον George.

Προσοχή: το `notify-order` στέλνει αντίγραφο και στο `platform_settings.support_email`
(στο live σήμερα: `hello@auditbnb.com`). Αν πρέπει να γίνει `delivr@actionweb.gr`, είναι
ξεχωριστή αλλαγή.

Πραγματικά μηνύματα σε καταστήματα ή πελάτες θέλουν, όπως πάντα, το γραπτό OK του George.
