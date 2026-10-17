ALTER TABLE public.booking_requests ADD COLUMN appointment_type text NOT NULL DEFAULT 'private' CHECK (appointment_type IN ('gesy', 'private'));
ALTER TABLE public.booking_requests ADD COLUMN private_fee_eur integer CHECK (private_fee_eur >= 0);
UPDATE public.booking_requests SET private_fee_eur = price_eur;
COMMENT ON COLUMN public.booking_requests.price_eur IS 'Legacy price field retained for compatibility; 0 for GeSY or an unquoted private visit. Use appointment_type and private_fee_eur for new requests.';
COMMENT ON COLUMN public.booking_requests.private_fee_eur IS 'Optional private fee quote; null for GeSY coverage or when no private rate is configured.';