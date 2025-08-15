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
  -- ⬇️ unicité à la minute
  CONSTRAINT ts_is_minute CHECK (date_trunc('minute', ts) = ts),
  CONSTRAINT edition_valid CHECK (edition IN ('classic','premium','iconic'))
);

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  price_cents INT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  message TEXT,
  link_url TEXT,
  cert_style TEXT NOT NULL DEFAULT 'neutral',
  cert_hash TEXT,
  cert_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- ⬇️ unicité à la minute
  CONSTRAINT ts_is_minute CHECK (date_trunc('minute', ts) = ts),
  CONSTRAINT one_owner_per_minute UNIQUE (ts),
  CONSTRAINT cert_style_valid CHECK (cert_style IN (
    'neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation'
  ))
);

CREATE INDEX IF NOT EXISTS idx_claims_owner ON claims(owner_id);
CREATE INDEX IF NOT EXISTS idx_instants_edition ON instants(edition);

-- Vue publique renommée à "minute_public"
CREATE OR REPLACE VIEW minute_public AS
SELECT c.ts, o.display_name, c.message, c.link_url, c.cert_url, c.created_at AS claimed_at, c.cert_style
FROM claims c JOIN owners o ON o.id = c.owner_id;
