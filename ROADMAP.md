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

## Εκκρεμή (owner)

- ⬜ Έγκριση διαγραφής των 6 σκουπιδο-καταστημάτων Αθήνας (mojibake seed).
- ⬜ Εγγραφή στο /auth → προαγωγή σε admin (0 admins σήμερα).
- ⬜ Edge secrets: `RESEND_API_KEY` + `RESEND_FROM` → πρώτη πραγματική
  δοκιμαστική παραγγελία για απόδειξη email (`order_dispatch_log` = 0 ως τώρα).
- ⬜ Πραγματικά `order_email` στα καταστήματα (τώρα *@example.com).

## Backlog (μετά το go-live)

- Μετάφραση menu (name_en στήλες) — το κοινό είναι ξένοι τουρίστες.
- Φωτογραφίες προϊόντων/λογότυπα (uploader + Storage bucket).
- Online πληρωμές (Stripe/Viva) — τώρα σωστά «Μετρητά + Coming soon».
- Realtime tracking (τώρα polling 20s — το postgres_changes δεν περνά RLS).
- Deploy των υπόλοιπων 5 edge functions (μόνο notify-order είναι deployed).

## Log

- 2026-09-12: QA campaign + security 011a/011b + docs επιτέλους committed.
- 2026-08-25: Full rebuild merged (QR-per-property, subscriptions, stats).
- 2026-09-06: Τοπικό repo επανασυνδέθηκε στο GitHub ιστορικό (το .git είχε χαθεί).
