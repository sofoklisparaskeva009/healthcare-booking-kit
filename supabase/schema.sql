-- ==============================================================================
-- Health Connect Hub - Definitive Supabase Database Schema
-- Complete, idempotent setup for booking management:
-- • Handles both `booking_requests` and `bookings` relations
-- • Includes EVERY canonical and alias column used across the application
-- • Bi-directional column synchronization trigger (service <-> service_name, etc.)
-- • RLS policies for admin service_role & anon inserts
-- • PostgREST schema cache reload notification (`NOTIFY pgrst, 'reload schema'`)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create primary table `public.booking_requests` if it doesn't already exist
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
  email text NOT NULL DEFAULT '',
  patient_email text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  patient_confirmed_at timestamptz,
  patient_cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Idempotently add EVERY column if table already existed with an older schema
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
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS patient_email text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS patient_confirmed_at timestamptz;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS patient_cancelled_at timestamptz;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 4. Ensure Constraints
DO $$
BEGIN
  -- appointment_type check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_requests_appointment_type_check'
  ) THEN
    ALTER TABLE public.booking_requests 
      ADD CONSTRAINT booking_requests_appointment_type_check 
      CHECK (appointment_type IN ('gesy', 'private'));
  END IF;

  -- private_fee_eur check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_requests_private_fee_check'
  ) THEN
    ALTER TABLE public.booking_requests 
      ADD CONSTRAINT booking_requests_private_fee_check 
      CHECK (private_fee_eur IS NULL OR private_fee_eur >= 0);
  END IF;

  -- status check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_requests_status_check'
  ) THEN
    ALTER TABLE public.booking_requests 
      ADD CONSTRAINT booking_requests_status_check 
      CHECK (status IN ('pending', 'confirmed', 'cancelled'));
  END IF;

  -- Unique appointment slot constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_requests_appointment_date_appointment_time_key'
  ) THEN
    ALTER TABLE public.booking_requests 
      ADD CONSTRAINT booking_requests_appointment_date_appointment_time_key 
      UNIQUE (appointment_date, appointment_time);
  END IF;
END $$;

-- 5. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_booking_requests_date 
  ON public.booking_requests (appointment_date);

CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at 
  ON public.booking_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_requests_status 
  ON public.booking_requests (status);

-- 6. Trigger to automatically synchronize canonical and alias columns
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

  -- 4. Sync email <-> patient_email
  IF (NEW.email IS NULL OR NEW.email = '') AND (NEW.patient_email IS NOT NULL AND NEW.patient_email <> '') THEN
    NEW.email := NEW.patient_email;
  ELSIF (NEW.patient_email IS NULL OR NEW.patient_email = '') AND (NEW.email IS NOT NULL AND NEW.email <> '') THEN
    NEW.patient_email := NEW.email;
  END IF;

  -- 5. Sync price_eur and private_fee_eur
  IF (NEW.price_eur IS NULL OR NEW.price_eur = 0) AND (NEW.private_fee_eur IS NOT NULL AND NEW.private_fee_eur > 0) THEN
    NEW.price_eur := NEW.private_fee_eur;
  ELSIF (NEW.private_fee_eur IS NULL) AND (NEW.appointment_type = 'private') AND (NEW.price_eur IS NOT NULL AND NEW.price_eur > 0) THEN
    NEW.private_fee_eur := NEW.price_eur;
  END IF;

  -- 6. Ensure default appointment_type
  IF NEW.appointment_type IS NULL OR NEW.appointment_type = '' THEN
    NEW.appointment_type := 'private';
  END IF;

  -- 7. Ensure default status
  IF NEW.status IS NULL OR NEW.status = '' THEN
    NEW.status := 'pending';
  END IF;

  -- 8. Updated at timestamp
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_booking_requests_columns ON public.booking_requests;
CREATE TRIGGER trg_sync_booking_requests_columns
BEFORE INSERT OR UPDATE ON public.booking_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_booking_columns();

-- 7. Dual-table compatibility: Ensure both `bookings` and `booking_requests` exist & work identically
DO $$
BEGIN
  -- If bookings table already exists as a physical BASE TABLE, upgrade its columns too
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
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS patient_email text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notes text;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS patient_confirmed_at timestamptz;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS patient_cancelled_at timestamptz;
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    DROP TRIGGER IF EXISTS trg_sync_bookings_columns ON public.bookings;
    CREATE TRIGGER trg_sync_bookings_columns
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.sync_booking_columns();

  -- If bookings does NOT exist as a physical table, create it as a VIEW over booking_requests
  ELSE
    CREATE OR REPLACE VIEW public.bookings AS 
    SELECT 
      id, service, service_name, service_id,
      appointment_type, price_eur, private_fee_eur,
      appointment_date, appointment_time, duration_minutes,
      full_name, patient_name, phone, patient_phone, email, patient_email,
      notes, status, patient_confirmed_at, patient_cancelled_at,
      created_at, updated_at
    FROM public.booking_requests;

    CREATE OR REPLACE RULE bookings_insert AS ON INSERT TO public.bookings
    DO INSTEAD
      INSERT INTO public.booking_requests (
        id, service, service_name, service_id,
        appointment_type, price_eur, private_fee_eur,
        appointment_date, appointment_time, duration_minutes,
        full_name, patient_name, phone, patient_phone, email, patient_email,
        notes, status, patient_confirmed_at, patient_cancelled_at, created_at, updated_at
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
        COALESCE(NEW.email, NEW.patient_email, ''),
        COALESCE(NEW.patient_email, NEW.email, ''),
        NEW.notes,
        COALESCE(NEW.status, 'pending'),
        NEW.patient_confirmed_at,
        NEW.patient_cancelled_at,
        COALESCE(NEW.created_at, now()),
        COALESCE(NEW.updated_at, now())
      )
    RETURNING *;
  END IF;
END $$;

-- 8. Configure Row Level Security (RLS) & Permissions
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.booking_requests TO service_role;
GRANT SELECT, INSERT ON public.booking_requests TO anon, authenticated;

DROP POLICY IF EXISTS "Service role has full access to booking_requests" ON public.booking_requests;
CREATE POLICY "Service role has full access to booking_requests"
  ON public.booking_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous and authenticated booking requests" ON public.booking_requests;
CREATE POLICY "Allow anonymous and authenticated booking requests"
  ON public.booking_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow reading appointment slots" ON public.booking_requests;
CREATE POLICY "Allow reading appointment slots"
  ON public.booking_requests
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Permissions for bookings view or table
GRANT ALL ON public.bookings TO service_role;
GRANT SELECT, INSERT ON public.bookings TO anon, authenticated;

-- If bookings is a base table, also enable RLS and policies
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
  END IF;
END $$;

-- 9. Column and Table Comments
COMMENT ON TABLE public.booking_requests IS 'Stores appointment booking requests for the clinic.';
COMMENT ON COLUMN public.booking_requests.price_eur IS 'Legacy price column retained for compatibility; 0 for GeSY or an unquoted private visit.';
COMMENT ON COLUMN public.booking_requests.private_fee_eur IS 'Optional private fee quote in EUR; null for GeSY coverage.';

-- 10. Refresh PostgREST schema cache immediately to eliminate PGRST204 & PGRST125
NOTIFY pgrst, 'reload schema';
