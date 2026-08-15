# Changelog

All notable changes to the Pilotage specification.

## 1.1.2 (2026-08-15)

Clarity and presentation patch following a full production review; no
model or wire changes (the wire version stays `1.1`).

- **Layers presented as a composable set**: ordered arrow chains and the
  "seven layers, five tools, one handshake" slogan removed everywhere.
  The layer list is written out (manifest, guides, catalog, validate,
  plan, execute, trace) with the agent at the center deciding what to
  call and when.
- **Capabilities section restructured** (Part II Section 4): the
  capability table's Dependency column folded into a renamed "Capability
  requirements" subsection (declaration-time composition rules), a
  manifest row added to the table, and a worked declaration example
  added to Section 4.2.
- **Validate and plan division made explicit** (Part II Section 5.6):
  validation reports what is wrong with the program; the plan makes
  visible what will happen when it runs.
- **Terminology and tables hardened** (Part II): "Loop operations"
  defined in Section 2; loop operations have operation addresses; an
  Example column added to every data-shape field table in Section 5;
  the individually optional capabilities fields explained against the
  guides+validate floor in Section 5.1.
- **Citation simplified**: CITATION.cff carries the concept DOI only,
  and the legacy landing page is a thin redirect to the website.
- **Editorial fixes**: four double-encoded en-dashes repaired in Part I;
  the release-candidate hedge on MCP `2026-07-28` removed (the revision
  shipped final on schedule); stale cross-references aligned across
  README, VERSIONING, conformance, and the guides.

## 1.1.1 (2026-07-26)

Documentation and packaging patch; no model or wire changes (the wire
version stays `1.1`). Citation metadata corrected (release date, canonical
website links), the license class for the runnable tooling clarified, the
proof kit index completed and its report-card names aligned with the
rendered pages, the roadmap refreshed, a code of conduct added, and the
legacy landing page pointed at the canonical website and server endpoint.

## 1.1.0 (2026-07-26)

The specification was restructured and substantially hardened through
multi-round adversarial review. Wire version: `1.1`.

### Model

- **Manifest presented as first-class layer #1**: the welcome card a
  zero-knowledge agent reads at the MCP handshake. The loop's layers are
  `manifest, guides, catalog, validate, plan, execute, trace`,
  with the agent at the center deciding what to call and when.
- **Plan and trace promoted to first-class layers** (wire coupling
  unchanged: the plan rides the validate response, the trace rides the
  execute response).
- **Explain folded into trace**: one record, one layer, two access
  paths: `loop.explain` → `loop.trace`, `capabilities.explain` →
  `capabilities.trace_fetch`, and the `explain_run` tool superseded by
  the trace fetch tool (e.g. `trace_run`). Same stored envelope; the
  optional `question`/`narration` pair remains available only under
  `trace_fetch: { "narrate": true }`.
- **Execute gains `store?: boolean`**: a per-run retention override.
  Omitted, the engine's declared retention policy governs; `true` on an
  engine with retention `none` is rejected with a request error (kind
  `unsupported`), never silently ignored; `false` forbids retention
  beyond the response. `run_id` is still always returned.

### Structure

- Split into four parts: I Story and Positioning (informative), II Abstract
  Model (normative), III MCP Binding (normative), IV Implementation Notes
  (informative), replacing the single-document 1.0.x layout.
- Added machine-readable artifacts: `schemas/1.1/pilotage.schema.json`
  (JSON Schema 2020-12 for every shape, with per-tool `outputSchema`
  unions) and `conformance/vectors.json` (54 engine-neutral test vectors).

### Normative changes since 1.0.1 (wire `1.0` → `1.1`)

- **Extension identifier corrected** to the extensions-framework form:
  `io.github.jafarsa0/pilotage` (the dotted form used by 1.0.x is not
  wire-normative under the new binding).
- **BCP 14 requirements language declared**; normative and informative text
  demarcated.
- **Actors defined** (Server, Engine, Client, Host, Model) with duties
  attached; the risk gate and execute transmission are Host obligations.
- **Applicability pinned**: the Program-vs-Record test, the definition of a
  closed Language, Server-scoped language identifiers.
- **Capabilities formalized**: declaration mechanics with per-Language
  override, capability requirements (declaration-time composition
  rules), the guides+validate floor, manifest
  consistency rules.
- **Data model completed**: per-field tables for every shape; diagnostic
  locator dialects (`json-pointer` / `text-range`) with reserved codes
  `constraint`, `input_binding`, `context_binding`; plan `arm`/`loop`
  marking; six reserved outcome statuses including the new
  `promotion_drift`; trace identity grammar (iteration `#n`, expansion
  `/`, reserved characters) with a computable plan-trace correspondence
  algorithm; the trace-envelope definition.
- **Operations pinned**: execute processing order (well-formedness → drift
  → re-validation/baseline → binding → run), mandatory re-validation guard,
  promotion baselines, idempotency semantics, execution modes
  (`immediate`/`deploy`/`both`) with `test_run`, retention semantics and
  trace-fetch eligibility.
- **Error model**: four channels with exact routing; the closed
  request-error kinds; deterministic schema-fault routing in the binding.
- **Trust model added** (server data are claims; teaching surfaces are
  data, not instructions; the gate is cooperative; traces evidence an
  honest engine) and **security requirements made conformance-bearing**
  (bounded validation and execution, programs-as-data, authorization
  scoping with indistinguishability, promoted-program authority).
- **Versioning defined**: `major.minor` wire version, additive minors,
  unknown-member and unknown-value rules, breaking changes mint a new
  extension identifier.
- **MCP binding added** (Part III): negotiation for handshake and
  stateless revisions, the mandatory `pilotage_manifest` discovery tool,
  fixed access tools with schemas, reserved argument names, permissive
  loop-tool schema rules, result envelopes, complete wire examples.

Zenodo version DOI 10.5281/zenodo.21591184 minted under concept DOI
10.5281/zenodo.21396027 (the concept DOI always resolves to the latest
version).

## 1.0.1 (2026-07-18)

First stable release, refined from the first reference implementation:
program-or-reference execute with a re-validation guard, the flat
control-flow trace rule, native-vs-adapted diagnostic tiers, promoted
programs as catalog entries, implementation guidance. Zenodo version DOI
minted under concept DOI 10.5281/zenodo.21396027.

## 1.0-draft (2026-07-16)

Initial public draft.
