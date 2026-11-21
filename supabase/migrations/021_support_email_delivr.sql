-- ============================================================
-- 021 — platform support address = the Delivr mailbox
--
-- notify-order sends a hidden copy (Bcc) of every new order to
-- platform_settings.support_email and uses it as the fallback Reply-To.
-- 011b set it to hello@auditbnb.com, the mailbox of another product, so
-- customer names, phones and addresses would have gone there once SMTP is on.
--
-- Idempotent: only replaces an empty value or the old AuditBnb address, so a
-- value set later by an admin is kept. Safe to run more than once.
-- Run BEFORE setting the SMTP_* secrets (docs/SMTP-DEPLOY.md).
-- ============================================================

UPDATE platform_settings
   SET support_email = 'delivr@actionweb.gr'
 WHERE id = 1
   AND (support_email IS NULL
        OR btrim(support_email) = ''
        OR lower(btrim(support_email)) = 'hello@auditbnb.com');
