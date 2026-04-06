-- Track email notification delivery status per reply comment.
-- null = no notification needed, 'sent' = delivered, 'failed' = error
ALTER TABLE comments ADD COLUMN email_notified TEXT;
