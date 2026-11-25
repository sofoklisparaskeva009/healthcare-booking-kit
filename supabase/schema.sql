-- ==============================================================================
-- Health Connect Hub — Master Template Supabase Database Schema
-- ==============================================================================
-- Copy-paste this entire file into a new Supabase project's SQL Editor and run it
-- once. It is 100% idempotent (safe to re-run on existing databases).
--
-- Includes:
--   • `public.booking_requests` table (with nullable `email`, `preferred_language`,
--     `action_token`, `reminder_sent`, `calendar_event_id`,
--     `patient_confirmed_at`, `patient_cancelled_at`)
--   • Dual-table/view compatibility for `public.bookings`
--   • Partial unique slot index (cancelled appointments automatically free up slots)
--   • Performance indexes for 48h Cron Reminders & `/manage-booking?token=...`
--   • Bi-directional column sync trigger (`service` <-> `service_name`, etc.)
--   • Complete Row Level Security (RLS) policies for `service_role`, `anon`, & `authenticated`
--   • PostgREST schema cache reload (`NOTIFY pgrst, 'reload schema'`)
-- ==============================================================================

-- 1. Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create primary table `public.booking_requests`
CREATE TABLE IF NOT EXISTS public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL DEFAULT '',
  service_name text,
  service_id text,
  appointment_type text NOT NULL DEFAULT 'private',
  price_eur integer NOT NULL DEFAULT 0,
  private_fee_eur integer,
  appointment_date date NOT NULL,
  appointment_time text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  full_name text NOT NULL DEFAULT '',
  patient_name text,
  phone text NOT NULL DEFAULT '',
  patient_phone text,
  email text,
  patient_email text,
  notes text,
  preferred_language text NOT NULL DEFAULT 'el',
  status text NOT NULL DEFAULT 'pending',
  action_token text,
  reminder_sent boolean NOT NULL DEFAULT false,
  calendar_event_id text,
  patient_confirmed_at timestamptz,
  patient_cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Idempotently add EVERY column (safe when upgrading an existing table)
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS service text NOT NULL DEFAULT '';
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS service_name text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS service_id text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS appointment_type text NOT NULL DEFAULT 'private';
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS price_eur integer NOT NULL DEFAULT 0;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS private_fee_eur integer;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS appointment_date date;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS appointment_time text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '';
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS patient_name text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS patient_phone text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS patient_email text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'el';
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS action_token text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS calendar_event_id text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS patient_confirmed_at timestamptz;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS patient_cancelled_at timestamptz;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure `email` is nullable (optional for accessibility / elderly patients)
ALTER TABLE public.booking_requests ALTER COLUMN email DROP NOT NULL;

-- 4. Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_requests_appointment_type_check'
  ) THEN
    ALTER TABLE public.booking_requests
      ADD CONSTRAINT booking_requests_appointment_type_check
      CHECK (appointment_type IN ('gesy', 'private'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_requests_private_fee_check'
  ) THEN
    ALTER TABLE public.booking_requests
      ADD CONSTRAINT booking_requests_private_fee_check
      CHECK (private_fee_eur IS NULL OR private_fee_eur >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_requests_status_check'
  ) THEN
    ALTER TABLE public.booking_requests
      ADD CONSTRAINT booking_requests_status_check
      CHECK (status IN ('pending', 'confirmed', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_requests_preferred_language_check'
  ) THEN
    ALTER TABLE public.booking_requests
      ADD CONSTRAINT booking_requests_preferred_language_check
      CHECK (preferred_language IN ('el', 'en'));
  END IF;

  -- Drop legacy full-table unique slot constraint if present, so cancelled slots can be re-booked
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_requests_appointment_date_appointment_time_key'
  ) THEN
    ALTER TABLE public.booking_requests
      DROP CONSTRAINT booking_requests_appointment_date_appointment_time_key;
  END IF;
END $$;

-- 5. Performance & Uniqueness Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_requests_active_slot
  ON public.booking_requests (appointment_date, appointment_time)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_booking_requests_date
  ON public.booking_requests (appointment_date);

CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at
  ON public.booking_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_requests_status
  ON public.booking_requests (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_requests_action_token
  ON public.booking_requests (action_token)
  WHERE action_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_requests_pending_reminders
  ON public.booking_requests (appointment_date, reminder_sent)
  WHERE reminder_sent = false AND status <> 'cancelled';

-- 6. Bi-directional column sync trigger
CREATE OR REPLACE FUNCTION public.sync_booking_columns()
RETURNS trigger AS $$
BEGIN
  -- 1. Sync service <-> service_name
  IF (NEW.service IS NULL OR NEW.service = '') AND (NEW.service_name IS NOT NULL AND NEW.service_name <> '') THEN
    NEW.service := NEW.service_name;
  ELSIF (NEW.service_name IS NULL OR NEW.service_name = '') AND (NEW.service IS NOT NULL AND NEW.service <> '') THEN
    NEW.service_name := NEW.service;
  END IF;

  -- 2. Sync full_name <-> patient_name
  IF (NEW.full_name IS NULL OR NEW.full_name = '') AND (NEW.patient_name IS NOT NULL AND NEW.patient_name <> '') THEN
    NEW.full_name := NEW.patient_name;
  ELSIF (NEW.patient_name IS NULL OR NEW.patient_name = '') AND (NEW.full_name IS NOT NULL AND NEW.full_name <> '') THEN
    NEW.patient_name := NEW.full_name;
  END IF;

  -- 3. Sync phone <-> patient_phone
  IF (NEW.phone IS NULL OR NEW.phone = '') AND (NEW.patient_phone IS NOT NULL AND NEW.patient_phone <> '') THEN
    NEW.phone := NEW.patient_phone;
  ELSIF (NEW.patient_phone IS NULL OR NEW.patient_phone = '') AND (NEW.phone IS NOT NULL AND NEW.phone <> '') THEN
    NEW.patient_phone := NEW.phone;
  END IF;

  -- 4. Sync nullable email <-> patient_email
  IF (NEW.email IS NULL OR NEW.email = '') AND (NEW.patient_email IS NOT NULL AND NEW.patient_email <> '') THEN
    NEW.email := NEW.patient_email;
  ELSIF (NEW.patient_email IS NULL OR NEW.patient_email = '') AND (NEW.email IS NOT NULL AND NEW.email <> '') THEN
    NEW.patient_email := NEW.email;
  END IF;

  -- 5. Sync price_eur (legacy compatibility) and private_fee_eur
  IF (NEW.price_eur IS NULL OR NEW.price_eur = 0) AND (NEW.private_fee_eur IS NOT NULL AND NEW.private_fee_eur > 0) THEN
    NEW.price_eur := NEW.private_fee_eur;
  ELSIF (NEW.private_fee_eur IS NULL) AND (NEW.appointment_type = 'private') AND (NEW.price_eur IS NOT NULL AND NEW.price_eur > 0) THEN
    NEW.private_fee_eur := NEW.price_eur;
  END IF;

  -- 6. Defaults
  IF NEW.appointment_type IS NULL OR NEW.appointment_type = '' THEN
    NEW.appointment_type := 'private';
  END IF;

  IF NEW.status IS NULL OR NEW.status = '' THEN
    NEW.status := 'pending';
  END IF;

  IF NEW.preferred_language IS NULL OR NEW.preferred_language = '' THEN
    NEW.preferred_language := 'el';
  END IF;

  IF NEW.reminder_sent IS NULL THEN
    NEW.reminder_sent := false;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_booking_requests_columns ON public.booking_requests;
CREATE TRIGGER trg_sync_booking_requests_columns
BEFORE INSERT OR UPDATE ON public.booking_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_booking_columns();

-- 7. Dual-table compatibility: Ensure `public.bookings` works seamlessly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookings' AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service text NOT NULL DEFAULT '';
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_name text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_id text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS appointment_type text NOT NULL DEFAULT 'private';
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS price_eur integer NOT NULL DEFAULT 0;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS private_fee_eur integer;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS appointment_date date;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS appointment_time text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '';
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS patient_name text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS patient_phone text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS email text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS patient_email text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notes text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'el';
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS action_token text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS calendar_event_id text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS patient_confirmed_at timestamptz;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS patient_cancelled_at timestamptz;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE public.bookings ALTER COLUMN email DROP NOT NULL;

    DROP TRIGGER IF EXISTS trg_sync_bookings_columns ON public.bookings;
    CREATE TRIGGER trg_sync_bookings_columns
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.sync_booking_columns();
  ELSE
    CREATE OR REPLACE VIEW public.bookings AS
    SELECT
      id, service, service_name, service_id,
      appointment_type, price_eur, private_fee_eur,
      appointment_date, appointment_time, duration_minutes,
      full_name, patient_name, phone, patient_phone, email, patient_email,
      notes, preferred_language, status,
      action_token, reminder_sent, calendar_event_id,
      patient_confirmed_at, patient_cancelled_at,
      created_at, updated_at
    FROM public.booking_requests;

    CREATE OR REPLACE RULE bookings_insert AS ON INSERT TO public.bookings
    DO INSTEAD
      INSERT INTO public.booking_requests (
        id, service, service_name, service_id,
        appointment_type, price_eur, private_fee_eur,
        appointment_date, appointment_time, duration_minutes,
        full_name, patient_name, phone, patient_phone, email, patient_email,
        notes, preferred_language, status,
        action_token, reminder_sent, calendar_event_id,
        patient_confirmed_at, patient_cancelled_at, created_at, updated_at
      ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        COALESCE(NEW.service, NEW.service_name, 'Consultation'),
        COALESCE(NEW.service_name, NEW.service, 'Consultation'),
        NEW.service_id,
        COALESCE(NEW.appointment_type, 'private'),
        COALESCE(NEW.price_eur, NEW.private_fee_eur, 0),
        NEW.private_fee_eur,
        NEW.appointment_date,
        NEW.appointment_time,
        COALESCE(NEW.duration_minutes, 60),
        COALESCE(NEW.full_name, NEW.patient_name, 'Patient'),
        COALESCE(NEW.patient_name, NEW.full_name, 'Patient'),
        COALESCE(NEW.phone, NEW.patient_phone, ''),
        COALESCE(NEW.patient_phone, NEW.phone, ''),
        COALESCE(NEW.email, NEW.patient_email),
        COALESCE(NEW.patient_email, NEW.email),
        NEW.notes,
        COALESCE(NEW.preferred_language, 'el'),
        COALESCE(NEW.status, 'pending'),
        NEW.action_token,
        COALESCE(NEW.reminder_sent, false),
        NEW.calendar_event_id,
        NEW.patient_confirmed_at,
        NEW.patient_cancelled_at,
        COALESCE(NEW.created_at, now()),
        COALESCE(NEW.updated_at, now())
      )
    RETURNING *;
  END IF;
END $$;

-- 8. Row Level Security (RLS) & Permissions
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.booking_requests TO service_role;
GRANT SELECT, INSERT ON public.booking_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_requests TO authenticated;

-- Service role (server-side Admin client, Cron Jobs, /manage-booking): unrestricted access
DROP POLICY IF EXISTS "Service role has full access to booking_requests" ON public.booking_requests;
CREATE POLICY "Service role has full access to booking_requests"
  ON public.booking_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public patients: can submit new booking requests
DROP POLICY IF EXISTS "Allow anonymous and authenticated booking requests" ON public.booking_requests;
CREATE POLICY "Allow anonymous and authenticated booking requests"
  ON public.booking_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Public slot availability check (date/time queries) & authenticated admin viewing
DROP POLICY IF EXISTS "Allow reading appointment slots" ON public.booking_requests;
CREATE POLICY "Allow reading appointment slots"
  ON public.booking_requests
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated clinic admins: can update & delete bookings from /admin
DROP POLICY IF EXISTS "Authenticated admins can update booking_requests" ON public.booking_requests;
CREATE POLICY "Authenticated admins can update booking_requests"
  ON public.booking_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated admins can delete booking_requests" ON public.booking_requests;
CREATE POLICY "Authenticated admins can delete booking_requests"
  ON public.booking_requests
  FOR DELETE
  TO authenticated
  USING (true);

-- Permissions for `bookings` view or table
GRANT ALL ON public.bookings TO service_role;
GRANT SELECT, INSERT ON public.bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookings' AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Service role has full access to bookings" ON public.bookings;
    CREATE POLICY "Service role has full access to bookings"
      ON public.bookings FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow anonymous and authenticated booking requests to bookings" ON public.bookings;
    CREATE POLICY "Allow anonymous and authenticated booking requests to bookings"
      ON public.bookings FOR INSERT TO anon, authenticated WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow reading appointment slots from bookings" ON public.bookings;
    CREATE POLICY "Allow reading appointment slots from bookings"
      ON public.bookings FOR SELECT TO anon, authenticated USING (true);

    DROP POLICY IF EXISTS "Authenticated admins can update bookings" ON public.bookings;
    CREATE POLICY "Authenticated admins can update bookings"
      ON public.bookings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated admins can delete bookings" ON public.bookings;
    CREATE POLICY "Authenticated admins can delete bookings"
      ON public.bookings FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- 9. Documentation Comments
COMMENT ON TABLE public.booking_requests IS 'Stores appointment booking requests for the clinic.';
COMMENT ON COLUMN public.booking_requests.email IS 'Optional patient email address (nullable for accessibility).';
COMMENT ON COLUMN public.booking_requests.price_eur IS 'Legacy price column retained for compatibility; 0 for GeSY or an unquoted private visit.';
COMMENT ON COLUMN public.booking_requests.private_fee_eur IS 'Optional private fee quote in EUR; null for GeSY coverage.';
COMMENT ON COLUMN public.booking_requests.preferred_language IS 'Patient preferred notification language (el or en).';
COMMENT ON COLUMN public.booking_requests.action_token IS 'Unique token sent in 48-hour reminder links for /manage-booking.';
COMMENT ON COLUMN public.booking_requests.reminder_sent IS 'True once the automated 48-hour reminder SMS/Email has been sent.';
COMMENT ON COLUMN public.booking_requests.calendar_event_id IS 'Google Calendar event ID for syncing confirmations and cancellations.';

-- 10. Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
