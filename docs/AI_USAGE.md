# AI assistance

OpenAI Codex assisted Liu Bryan Cayllahua Huaringa with recovering the November 13
practice generator and check-in, isolating the data contribution, and writing
adapters, tests, preview and documentation on November 14, 2026. The mission
datasets are seeded synthetic data; no real astronaut or patient data were used.
Clinical rules, diagnoses and operational clearance are outside this contribution.

On November 14, Codex also assisted with the isolated Ollama monitoring prototype,
the Monitor IA preview tab, SQLite history, five-minute scheduling, nonclinical
statistical demo notices, bounded recommendation catalog, fallback and tests.
This adds no validated clinical rules or operational clearance. Details and
remaining integration work are documented in OLLAMA.md.

Codex also assisted with the two-role responsive dashboard, compact watch-sized
CSS, selected-crew check-in history, synthetic telemetry contract and validation,
static PWA shell, and source-preserving import of the team's draft workbook.
The 34 rules are reference material, not an activated clinical engine.
No new clinical validation or physical smartwatch testing is claimed.

Codex assisted with the PostgreSQL ingestion schema, migration runner, synthetic
seed, transactional repository, mission-scoped service-token API, receipt
idempotency, and tests using PGlite. The external PostgreSQL concurrency test is
optional and was not run without a dedicated configured database. This does not
activate the clinical draft rules or import Excel cases as mission patients.

Claude (Anthropic) assisted Yeremi Camacho with the telemetry simulator
(`simulator/`) on November 14–15, 2026: explaining the ingestion contract,
proposing module code (packets, equipment states, mock API, transport with
retries, outbox, contract rules, fault tests and `simular.mjs`), reviewing
repository state read-only, drafting parts of the documentation (D.12
alternatives and the real-API section of the README) and rehearsing the
branch merge. Yeremi made the design and data-architecture decisions recorded
in `docs/DECISIONES.md` (D.01–D.12), including how generator records map to
contract observations, the identifier scheme for idempotent resends, the
hourly sampling and the one-file-per-packet outbox; he defined the program
logic with the assistant, ran every test, fixed the errors found, made the
commits and pull requests, and ran the end-to-end test against the real API
on port 8780. All data are seeded synthetic data; no real astronaut or
patient data were used. The simulator performs no clinical calculation, and
it was tested only on one laptop (127.0.0.1), not between devices.