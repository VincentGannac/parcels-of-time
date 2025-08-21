-- db/schema_phaseA.sql — Phase A (MAJ registre public minimal)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instants (
  ts TIMESTAMPTZ PRIMARY KEY,
  edition TEXT NOT NULL DEFAULT 'classic',
  nice_label TEXT,
  is_listed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ts_is_minute CHECK (date_trunc('minute', ts) = ts),
  CONSTRAINT edition_valid CHECK (edition IN ('classic','premium','iconic'))
);

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  price_cents INT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  title TEXT,
  message TEXT,
  link_url TEXT,
  cert_style TEXT NOT NULL DEFAULT 'neutral',
  time_display TEXT NOT NULL DEFAULT 'local+utc',
  local_date_only BOOLEAN NOT NULL DEFAULT FALSE,
  text_color TEXT NOT NULL DEFAULT '#1a1f2a',
  -- ✅ registre public (opt-in + id public)
  public_id UUID NOT NULL DEFAULT gen_random_uuid(),
  title_public BOOLEAN NOT NULL DEFAULT FALSE,
  message_public BOOLEAN NOT NULL DEFAULT FALSE,
  -- certificats
  cert_hash TEXT,
  cert_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ts_is_minute CHECK (date_trunc('minute', ts) = ts),
  CONSTRAINT one_owner_per_minute UNIQUE (ts),
  CONSTRAINT cert_style_valid CHECK (cert_style IN (
    'neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'
  )),
  CONSTRAINT claims_time_display_chk CHECK (time_display IN ('utc','utc+local','local+utc')),
  CONSTRAINT claims_text_color_hex_chk CHECK (text_color ~* '^#[0-9a-f]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_claims_owner ON claims(owner_id);
CREATE INDEX IF NOT EXISTS idx_instants_edition ON instants(edition);

-- Stockage des fonds custom (éphémère puis persistant)
CREATE TABLE IF NOT EXISTS custom_bg_temp (
  key TEXT PRIMARY KEY,
  data_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS claim_custom_bg (
  ts TIMESTAMPTZ PRIMARY KEY
    REFERENCES claims(ts) ON DELETE CASCADE,
  data_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 🔁 Registre public MINIMAL (table + trigger)
DROP VIEW IF EXISTS minute_public CASCADE;
DROP TABLE IF EXISTS minute_public CASCADE;

CREATE TABLE minute_public (
  id UUID PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL UNIQUE,
  title TEXT NULL,
  message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fonction + trigger de synchro depuis claims
CREATE OR REPLACE FUNCTION public.sync_minute_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.minute_public WHERE id = OLD.public_id;
    RETURN OLD;
  END IF;

  IF (NEW.title_public OR NEW.message_public) THEN
    INSERT INTO public.minute_public AS p (id, ts, title, message)
    VALUES (
      NEW.public_id,
      NEW.ts,
      CASE WHEN NEW.title_public   THEN NULLIF(trim(NEW.title),   '') END,
      CASE WHEN NEW.message_public THEN NULLIF(trim(NEW.message), '') END
    )
    ON CONFLICT (id) DO UPDATE
      SET ts      = EXCLUDED.ts,
          title   = EXCLUDED.title,
          message = EXCLUDED.message;
  ELSE
    DELETE FROM public.minute_public WHERE id = NEW.public_id;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_minute_public ON public.claims;
CREATE TRIGGER trg_sync_minute_public
AFTER INSERT OR UPDATE OF ts, title, message, title_public, message_public ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.sync_minute_public();

-- 🔐 RLS de lecture publique
ALTER TABLE public.minute_public ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_public_register ON public.minute_public;
CREATE POLICY read_public_register
  ON public.minute_public
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON public.minute_public FROM public;
GRANT SELECT ON public.minute_public TO anon, authenticated;

-- Index
CREATE INDEX IF NOT EXISTS minute_public_ts_idx ON public.minute_public (ts DESC);
