-- Apply once, inside the migration runner's transaction.
CREATE SCHEMA IF NOT EXISTS kawsay;
CREATE TABLE kawsay.schema_migrations (
  version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE kawsay.missions (
  mission_id text PRIMARY KEY, name text NOT NULL, timezone text NOT NULL
);
CREATE TABLE kawsay.users (
  user_id text PRIMARY KEY, display_name text NOT NULL
);
CREATE TABLE kawsay.crews (
  mission_id text NOT NULL REFERENCES kawsay.missions,
  crew_id text NOT NULL, name text NOT NULL,
  PRIMARY KEY (mission_id, crew_id)
);
CREATE TABLE kawsay.crew_members (
  crew_member_id text PRIMARY KEY,
  mission_id text NOT NULL, crew_id text NOT NULL,
  user_id text NOT NULL REFERENCES kawsay.users,
  FOREIGN KEY (mission_id, crew_id) REFERENCES kawsay.crews,
  UNIQUE (mission_id, crew_id, user_id),
  UNIQUE (mission_id, crew_id, crew_member_id, user_id)
);
CREATE TABLE kawsay.devices (
  mission_id text NOT NULL, crew_id text NOT NULL, device_id text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('sensor','simulator')),
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (mission_id, device_id),
  FOREIGN KEY (mission_id, crew_id) REFERENCES kawsay.crews
);
CREATE TABLE kawsay.simulation_runs (
  mission_id text NOT NULL REFERENCES kawsay.missions,
  simulation_run_id text NOT NULL,
  PRIMARY KEY (mission_id, simulation_run_id)
);
CREATE TABLE kawsay.ingestion_messages (
  mission_id text NOT NULL REFERENCES kawsay.missions,
  clock_key text NOT NULL, message_id text NOT NULL,
  content_hash text NOT NULL, payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_id, clock_key, message_id)
);
CREATE TABLE kawsay.observations (
  mission_id text NOT NULL, clock_key text NOT NULL, observation_id text NOT NULL,
  crew_id text NOT NULL, crew_member_id text NOT NULL, user_id text NOT NULL,
  message_id text NOT NULL, parameter text NOT NULL CHECK
    (parameter IN ('hr','rr','spo2','sbp','dbp','temp','consciousness','on_oxygen')),
  measured_at timestamptz, status_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  synthetic boolean NOT NULL,
  content_hash text NOT NULL, payload jsonb NOT NULL,
  PRIMARY KEY (mission_id, clock_key, observation_id),
  FOREIGN KEY (mission_id, clock_key, message_id)
    REFERENCES kawsay.ingestion_messages,
  FOREIGN KEY (mission_id, crew_id, crew_member_id, user_id)
    REFERENCES kawsay.crew_members (mission_id, crew_id, crew_member_id, user_id),
  CHECK (measured_at IS NULL OR measured_at <= status_at)
);
CREATE INDEX observations_history ON kawsay.observations
  (mission_id, crew_member_id, clock_key, status_at DESC, observation_id);
INSERT INTO kawsay.schema_migrations(version) VALUES ('001_ingestion');
