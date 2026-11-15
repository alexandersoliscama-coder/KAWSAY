-- Explicit synthetic identities. Run only against a demo database.
INSERT INTO kawsay.missions VALUES ('MISSION-01','KAWSAY demo','America/Lima') ON CONFLICT DO NOTHING;
INSERT INTO kawsay.users VALUES ('USER-01','Tripulante demo 1'),('USER-02','Tripulante demo 2') ON CONFLICT DO NOTHING;
INSERT INTO kawsay.crews VALUES ('MISSION-01','CREW-01','Equipo demo') ON CONFLICT DO NOTHING;
INSERT INTO kawsay.crew_members VALUES
  ('MEMBER-01','MISSION-01','CREW-01','USER-01'),
  ('MEMBER-02','MISSION-01','CREW-01','USER-02') ON CONFLICT DO NOTHING;
INSERT INTO kawsay.devices(mission_id,crew_id,device_id,source_type)
VALUES ('MISSION-01','CREW-01','SIM-SUIT-01','simulator') ON CONFLICT DO NOTHING;
INSERT INTO kawsay.simulation_runs VALUES ('MISSION-01','SIM-01') ON CONFLICT DO NOTHING;
