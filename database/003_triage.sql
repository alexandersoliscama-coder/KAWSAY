-- Triage on admission: first table of the patient. Synthetic data only in this MVP.
-- One row per admission; later patient tables should reference (mission_id, triage_id).
CREATE TABLE kawsay.triage_records (
  mission_id text NOT NULL REFERENCES kawsay.missions,
  triage_id bigint GENERATED ALWAYS AS IDENTITY,
  request_id text NOT NULL,                       -- client idempotency key (safe retries)
  content_hash text NOT NULL,
  synthetic boolean NOT NULL CHECK (synthetic),
  -- 1. Identification
  patient_id text NOT NULL CHECK (length(btrim(patient_id)) BETWEEN 1 AND 64),
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 120),
  age smallint NOT NULL CHECK (age BETWEEN 0 AND 120),
  sex text NOT NULL CHECK (sex IN ('male','female')),
  -- 2. History, personal and family (ICD-10): [{kind:'personal'|'family', code, description}]
  no_known_history boolean NOT NULL,
  history jsonb NOT NULL CHECK (jsonb_typeof(history)='array'),
  -- 3. Regular medication: [{name, dose, frequency}]
  no_regular_medication boolean NOT NULL,
  medications jsonb NOT NULL CHECK (jsonb_typeof(medications)='array'),
  -- 4. Adverse drug reactions: [{drug, reaction}]
  no_known_adverse_reactions boolean NOT NULL,
  adverse_reactions jsonb NOT NULL CHECK (jsonb_typeof(adverse_reactions)='array'),
  -- 5. Vital signs at admission
  hr smallint NOT NULL CHECK (hr BETWEEN 20 AND 250),
  rr smallint NOT NULL CHECK (rr BETWEEN 4 AND 80),
  spo2 smallint NOT NULL CHECK (spo2 BETWEEN 50 AND 100),
  temp numeric(3,1) NOT NULL CHECK (temp BETWEEN 30 AND 45),
  sbp smallint NOT NULL CHECK (sbp BETWEEN 50 AND 260),
  dbp smallint NOT NULL CHECK (dbp BETWEEN 30 AND 160),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_id, triage_id),
  UNIQUE (mission_id, request_id),
  -- "none" flag and its list are mutually exclusive and one of them is mandatory.
  CHECK (no_known_history = (jsonb_array_length(history)=0)),
  CHECK (no_regular_medication = (jsonb_array_length(medications)=0)),
  CHECK (no_known_adverse_reactions = (jsonb_array_length(adverse_reactions)=0)),
  CHECK (sbp > dbp)
);
CREATE INDEX triage_by_patient ON kawsay.triage_records (mission_id, patient_id, recorded_at DESC);
INSERT INTO kawsay.schema_migrations(version) VALUES ('003_triage');
