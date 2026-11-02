-- ==============================================================================
-- Health Connect Hub - Complete Supabase Database Schema
-- Idempotent setup for `booking_requests` table, constraints, indexes & RLS policies
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL,
  price_eur integer NOT NULL DEFAULT 0,
  appointment_type text NOT NULL DEFAULT 'private' CHECK (appointment_type IN ('gesy', 'private')),
  private_fee_eur integer CHECK (private_fee_eur IS NULL OR private_fee_eur >= 0),
  appointment_date date NOT NULL,
  appointment_time text NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  patient_confirmed_at timestamptz,
  patient_cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'booking_requests' AND column_name = 'appointment_type'
  ) THEN
    ALTER TABLE public.booking_requests ADD COLUMN appointment_type text NOT NULL DEFAULT 'private' CHECK (appointment_type IN ('gesy', 'private'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'booking_requests' AND column_name = 'private_fee_eur'
  ) THEN
    ALTER TABLE public.booking_requests ADD COLUMN private_fee_eur integer CHECK (private_fee_eur IS NULL OR private_fee_eur >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'booking_requests' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.booking_requests ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'booking_requests' AND column_name = 'patient_confirmed_at'
  ) THEN
    ALTER TABLE public.booking_requests ADD COLUMN patient_confirmed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'booking_requests' AND column_name = 'patient_cancelled_at'
  ) THEN
    ALTER TABLE public.booking_requests ADD COLUMN patient_cancelled_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'booking_requests_appointment_date_appointment_time_key'
  ) THEN
    ALTER TABLE public.booking_requests 
    ADD CONSTRAINT booking_requests_appointment_date_appointment_time_key 
    UNIQUE (appointment_date, appointment_time);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_booking_requests_date 
  ON public.booking_requests (appointment_date);

CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at 
  ON public.booking_requests (created_at DESC);

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

COMMENT ON TABLE public.booking_requests IS 'Stores appointment booking requests for the clinic.';
COMMENT ON COLUMN public.booking_requests.price_eur IS 'Legacy price column retained for compatibility; 0 for GeSY or an unquoted private visit.';
COMMENT ON COLUMN public.booking_requests.private_fee_eur IS 'Optional private fee quote in EUR; null for GeSY coverage.';

-- 7. Dual-table compatibility: Ensure both `bookings` and `booking_requests` routes exist in PostgREST
DO $$
BEGIN
  -- If bookings table already exists but booking_requests doesn't, create booking_requests view
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND table_type = 'BASE TABLE'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'booking_requests'
  ) THEN
    CREATE VIEW public.booking_requests AS SELECT * FROM public.bookings;
    GRANT ALL ON public.booking_requests TO service_role;
    GRANT SELECT, INSERT ON public.booking_requests TO anon, authenticated;
  -- If booking_requests exists as a table, provide `bookings` view for backward-compatibility
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'booking_requests'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'bookings'
  ) THEN
    CREATE VIEW public.bookings AS SELECT * FROM public.booking_requests;
    GRANT ALL ON public.bookings TO service_role;
    GRANT SELECT, INSERT ON public.bookings TO anon, authenticated;

    CREATE OR REPLACE RULE bookings_insert AS ON INSERT TO public.bookings
    DO INSTEAD
      INSERT INTO public.booking_requests (
        id, service, price_eur, appointment_type, private_fee_eur,
        appointment_date, appointment_time, full_name, phone, email, notes,
        status, patient_confirmed_at, patient_cancelled_at, created_at
      ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.service,
        COALESCE(NEW.price_eur, 0),
        COALESCE(NEW.appointment_type, 'private'),
        NEW.private_fee_eur,
        NEW.appointment_date,
        NEW.appointment_time,
        NEW.full_name,
        NEW.phone,
        NEW.email,
        NEW.notes,
        COALESCE(NEW.status, 'pending'),
        NEW.patient_confirmed_at,
        NEW.patient_cancelled_at,
        COALESCE(NEW.created_at, now())
      )
    RETURNING *;
  END IF;
END $$;

-- 8. Refresh PostgREST schema cache immediately to prevent PGRST125
NOTIFY pgrst, 'reload schema';
