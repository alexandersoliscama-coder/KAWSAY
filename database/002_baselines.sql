-- Mapping and versioned imported baseline snapshots. No clinical history is invented.
ALTER TABLE kawsay.crew_members ADD CONSTRAINT member_mission_unique UNIQUE(mission_id,crew_member_id);
CREATE TABLE kawsay.source_crew_links (
  mission_id text NOT NULL,
  dataset_id text NOT NULL,
  source_crew_id text NOT NULL,
  ui_demo_id text NOT NULL,
  crew_id text NOT NULL,
  crew_member_id text NOT NULL,
  user_id text NOT NULL,
  PRIMARY KEY(mission_id,dataset_id,source_crew_id),
  UNIQUE(mission_id,dataset_id,ui_demo_id),
  UNIQUE(mission_id,dataset_id,crew_member_id),
  UNIQUE(mission_id,dataset_id,source_crew_id,crew_member_id),
  FOREIGN KEY(mission_id,crew_id,crew_member_id,user_id)
    REFERENCES kawsay.crew_members(mission_id,crew_id,crew_member_id,user_id)
);
CREATE TABLE kawsay.baseline_records (
  mission_id text NOT NULL,
  crew_member_id text NOT NULL,
  version integer NOT NULL CHECK(version>0),
  dataset_id text NOT NULL,
  source_crew_id text NOT NULL,
  synthetic boolean NOT NULL CHECK(synthetic),
  content_hash text NOT NULL,
  profile jsonb NOT NULL CHECK(jsonb_typeof(profile)='object'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(mission_id,crew_member_id,version),
  FOREIGN KEY(mission_id,crew_member_id)
    REFERENCES kawsay.crew_members(mission_id,crew_member_id),
  FOREIGN KEY(mission_id,dataset_id,source_crew_id,crew_member_id)
    REFERENCES kawsay.source_crew_links(mission_id,dataset_id,source_crew_id,crew_member_id)
);
INSERT INTO kawsay.schema_migrations(version) VALUES('002_baselines');
