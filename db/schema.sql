-- RoutePilot: registros compartilhados e registros privados por usuario.
-- A aplicacao acessa estas tabelas somente por Netlify Functions autenticadas.

CREATE TABLE IF NOT EXISTS routepilot_records (
  scope VARCHAR(16) NOT NULL,
  owner_id VARCHAR(160) NOT NULL,
  collection VARCHAR(32) NOT NULL,
  record_id VARCHAR(160) NOT NULL,
  payload JSONB NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(160) NOT NULL,
  updated_by VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, owner_id, collection, record_id),
  CONSTRAINT routepilot_scope_allowed CHECK (scope IN ('shared', 'user')),
  CONSTRAINT routepilot_collection_allowed CHECK (
    collection IN ('technicians', 'workOrders', 'agendas', 'settings', 'notes', 'addressCorrections')
  ),
  CONSTRAINT routepilot_payload_is_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS routepilot_records_updated_at_idx
  ON routepilot_records (scope, owner_id, collection, updated_at DESC);

CREATE INDEX IF NOT EXISTS routepilot_records_collection_idx
  ON routepilot_records (collection, updated_at DESC);
