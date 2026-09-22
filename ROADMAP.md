# Delivr Roadmap

QR-per-property delivery & takeaway πλατφόρμα για ελληνικά καταλύματα: ο guest
σκανάρει το QR του δωματίου/βίλας → βλέπει τα συνεργαζόμενα καταστήματα της
ζώνης του → παραγγέλνει (delivery/takeaway) → το κατάστημα επιβεβαιώνει από
tokenized σελίδα χωρίς login. Έσοδα: προμήθεια πλατφόρμας ανά παραγγελία +
συνδρομές καταστημάτων.

## Status (2026-09-12)

- ✅ **Rebuild 2026-08-25 (PR #2, cloud)**: guest QR flow end-to-end σε live
  Supabase (8 `delivr_*` SECURITY DEFINER RPCs, server-side τιμολόγηση, ζώνες,
  ελάχιστα, extras), store-confirm `/s/:token`, tracking `/t/:token`,
  merchant/driver/admin apps (guarded), συνδρομές + χρεώσεις + στατιστικά
  (migrations 003-010, **applied στο live** `ifgzciraogohycuvujip`).
- ✅ **Deployed**: https://delivr-ten.vercel.app (Vercel `sfirakis-projects/delivr`,
  `app_url` σωστό στο `platform_settings`).
- ✅ **Full QA 2026-09-12**: 7×P0, 9×P1 ευρήματα — πλήρης αναφορά στο session
  log του agent (βλ. `.claude/memory/`).
- ✅ **Security hardening LIVE (migrations 011a/011b, 2026-09-12)**: έκλεισε το
  privilege escalation (profiles role self-update), τα direct writes σε
  orders/order_items (πλέον SELECT-only, γράφει μόνο το RPC), τα anon EXECUTE
  leaks (resolve_billing κ.ά.), διορθώθηκε το `delivr_match_zone` (specificity
  area>postal>city + ακτίνα ως hard limit — verified με το OLIVE3 repro),
  μπήκαν default ωράρια 09:00-23:00 σε όλα τα ενεργά καταστήματα.
- 🔄 **Frontend QA fixes** σε εξέλιξη (branch `claude/qa-frontend-fixes`):
  αφαίρεση legacy fake app (ψεύτικη Visa/«PCI DSS»), root landing, E.164
  τηλέφωνα, favicon/OG/robots, conversion pack (σύνολο στο cart bar, progress
  ελαχίστου, free-delivery upsell, promo field, items στο checkout), /terms.

- ✅ **Standalone stores (2026-09-22)**: κάθε κατάστημα μπορεί να πουληθεί
  μόνο του, χωρίς δικά μας καταλύματα. Δημόσιος σύνδεσμος `/store/<slug>`,
  ο πελάτης διαλέγει περιοχή (ζώνη) και γράφει τη διεύθυνσή του, η
  `delivr_place_order` δέχεται ad-hoc διεύθυνση όταν το κατάστημα έχει
  `standalone_enabled` (migrations 012/013, applied live). Η προμήθεια
  χρεώνεται κανονικά· το `orders.channel = 'store'` ξεχωρίζει τον τζίρο.
- ✅ **Unblocked (2026-09-22)**: admin (`sfirakis@gmail.com`) + σύνδεση
  καταστήματος (`demo@delivr.app` → Souvlaki Corner) στο live, οι δύο
  εκκρεμείς διορθώσεις (διπλή περιοχή στη διεύθυνση, λευκή σελίδα χωρίς env)
  rebased πάνω στο master.

## Εκκρεμή (owner)

- ⬜ **Edge secrets: `RESEND_API_KEY` + `RESEND_FROM`** — το μόνο που μένει
  για να φύγει πραγματικό email. Χωρίς αυτά κάθε παραγγελία γράφει
  `email: skipped` στο `order_dispatch_log` (0 απεσταλμένα ως τώρα).
  Supabase → Edge Functions → Secrets.
- ⬜ Έγκριση διαγραφής των 6 σκουπιδο-καταστημάτων Αθήνας (mojibake seed).
- ⬜ Πραγματικά `order_email` στα καταστήματα (τώρα *@example.com).

## Backlog (μετά το go-live)

- Μετάφραση menu (name_en στήλες) — το κοινό είναι ξένοι τουρίστες.
- Φωτογραφίες προϊόντων/λογότυπα (uploader + Storage bucket).
- Online πληρωμές (Stripe/Viva) — τώρα σωστά «Μετρητά + Coming soon».
- Realtime tracking (τώρα polling 20s — το postgres_changes δεν περνά RLS).
- Deploy των υπόλοιπων 5 edge functions (μόνο notify-order είναι deployed).

## Log

- 2026-09-22: Standalone store links (/store/<slug>), ad-hoc διευθύνσεις,
  admin + store user στο live, e2e 37/37, migrations 011a/011b καταγράφηκαν
  στο repo (ήταν μόνο στη βάση).
- 2026-09-12: QA campaign + security 011a/011b + docs επιτέλους committed.
- 2026-08-25: Full rebuild merged (QR-per-property, subscriptions, stats).
- 2026-09-06: Τοπικό repo επανασυνδέθηκε στο GitHub ιστορικό (το .git είχε χαθεί).
