-- Add OTP login columns to staff table
-- Required by /api/admin/auth/send-otp and /api/admin/auth/verify-otp

ALTER TABLE staff ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
