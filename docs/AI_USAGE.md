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
## Clinical rules and cases catalog

Claudia Pinto and Milagros Villegas (clinical team) wrote the 34 draft rules,
the 60 cases, their thresholds, actions, levels and sources, from clinical
guidelines and published evidence. The local LLM qwen3:4b (run through Ollama)
was used only to order and format the information of the clinical cases
(organizing fields and columns in the workbook). It did not propose thresholds, levels, actions, diagnoses or
sources. The label "Draft (AI-assisted)" in `data-kit/demo/reference-catalog.json`
refers to this formatting support. All rules remain drafts pending physician
sign-off; no clinical validation is claimed.

## Background review and project analysis

Yeremi Alexander Camacho Solis defined the structural analysis of the
project: the problem, the target users, the MVP functionalities and the
criteria used to compare KAWSAY with previous systems. Claude (Anthropic)
assisted him on November 15, 2026 by searching for systems similar to the ones
he described (NASA ExMC/CDSS, EveryWear, AMOS, HERMES and CMO-DA),
organizing the comparison, and reviewing this repository to contrast the
documentation with the implemented code. The conclusions, the MVP scope and
the scalability decisions are the team's.

Claude also assisted in implementing D.13 (official engine for the AI monitor:
`motor/cli.mjs`, `motor/desde-generador.mjs`, changes to `llm-service/service.py`
and `data-kit/demo/Monitor.tsx`, and their tests) and in drafting D.13 and D.14.
These changes do not add or validate clinical rules. Claude also converted the
team's evaluation protocol to Markdown and added the implementation-status and
scalability parts in `docs/EVALUATION_PROTOCOL.md`; the protocol text is the
team's.
