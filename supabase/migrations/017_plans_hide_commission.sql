-- ============================================================
-- 017 — Plan texts without commission (George 30/10/2026)
-- ============================================================
-- «Στο Delivr να μη φαίνονται οι προμήθειες προς το παρόν» — the
-- model is heading to subscriptions. /join shows each plan's name and
-- description, so both lose any mention of commission. Text only: the
-- billing columns (commission_mode / commission_value) are untouched.
-- ============================================================

UPDATE subscription_plans SET
  description = 'Παρουσία στην πλατφόρμα, απεριόριστες παραγγελίες',
  features    = '["Απεριόριστες παραγγελίες","Email + WhatsApp","Εκτύπωση"]'::JSONB,
  updated_at  = now()
WHERE audience = 'store' AND name = 'Basic';

UPDATE subscription_plans SET
  description = 'Μηνιαία συνδρομή με προβολή στην κορυφή και στατιστικά',
  features    = '["Όλα του Basic","Προβολή στην κορυφή","Στατιστικά"]'::JSONB,
  updated_at  = now()
WHERE audience = 'store' AND name = 'Pro';

UPDATE subscription_plans SET
  name        = 'Premium',
  description = 'Σταθερή μηνιαία συνδρομή με προτεραιότητα υποστήριξης',
  features    = '["Όλα του Pro","Προτεραιότητα υποστήριξης"]'::JSONB,
  updated_at  = now()
WHERE audience = 'store' AND name = 'Zero Commission';
