-- CRM session: 24h JWT + invalidate when same phone logs in elsewhere
ALTER TABLE admin_users
  ADD COLUMN session_version INT NOT NULL DEFAULT 0 AFTER is_active;
