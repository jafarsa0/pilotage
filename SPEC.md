# Pilotage: Specification, version 1.1.2

**An MCP extension for guided program authoring and verified execution.**

- **Extension identifier:** `io.github.jafarsa0/pilotage`
- **Wire version:** `1.1` (the manifest's `pilotage` field; Part II §11.1)
- **Document version:** 1.1.2
- **Status:** Release
- **Author:** Jaafar Nadher Jaafar Alaboosi
- **License:** specification text CC BY 4.0; schemas, conformance
  vectors, and tooling Apache-2.0 (see [LICENSE.md](./LICENSE.md))
- **Cite:** [CITATION.cff](./CITATION.cff) · concept DOI
  [10.5281/zenodo.21396027](https://doi.org/10.5281/zenodo.21396027)

Pilotage lets an MCP server publish the checkable competence required to use
its complex, program-valued tools through a common set of capability layers:
manifest, guides, catalog, validate, plan, execute, and trace.

These layers are composable, not a dependency chain. The manifest is the entry
point: read at the handshake, it tells the agent which capabilities the server
provides. From there the agent, at the center, calls whichever layers the task
needs, in whatever order fits, and may revisit them as it goes. A server may
implement some or all of them.

> Schemas teach the moves. **Pilotage teaches the game.**

## The specification

The specification is organized in four parts. Parts II and III are
normative; Parts I and IV are informative.

| Part | Status | Contents |
|---|---|---|
| [Part I: Story and Positioning](./spec/part-i-story-and-positioning.md) | Informative | The three problems (learning, iteration, scalability), what Pilotage provides, scope, trust boundary, prior art, the LSP precedent, design decisions |
| [Part II: The Abstract Model](./spec/part-ii-abstract-model.md) | **Normative** | Actors, definitions, capabilities, the eight data shapes, the six operations, the standard client loop, the error and trust models, security requirements, versioning, conformance |
| [Part III: The MCP Binding](./spec/part-iii-mcp-binding.md) | **Normative** | Extension identity and negotiation, discovery, the tool surface and reserved argument names, result envelopes, error mapping, sessions and transports, complete wire examples, binding conformance |
| [Part IV: Implementation Notes](./spec/part-iv-implementation-notes.md) | Informative | Lessons from the first reference implementation: adoption mapping, diagnostics adaptation, catalog versioning, testing method, text languages, idempotency, deployment |

## Machine-readable artifacts

| Artifact | Purpose |
|---|---|
| [`schemas/1.1/pilotage.schema.json`](./schemas/1.1/pilotage.schema.json) | JSON Schema (2020-12) for every data shape, including the per-tool `outputSchema` unions required by Part III §6 |
| [`conformance/vectors.json`](./conformance/vectors.json) | 54 engine-neutral test vectors keyed to Part II/III requirements ([usage](./conformance/README.md)) |

The wire examples in Part III §9 validate against the schema file; the
54 vectors, the runnable harness, and the weekly docs-replay CI
(`.github/workflows/docs-replay.yml`) exercise the conformance surface
against the live example server.

## Reading paths

- **Evaluating Pilotage?** Read Part I.
- **Implementing a server?** Start with the step-by-step
  [IMPLEMENTERS.md](./IMPLEMENTERS.md), then Part II §§4–6, 10, 12.1 →
  Part III → Part IV.
- **Implementing a client (agent host)?** Part II §§7–9, 12.2 → Part III
  §§3–4, 7, 10.2.
- **Citing or comparing?** Part I's prior-art section states precisely what
  neighbors this work builds on and what it adds.

## Versioning

The wire version is `major.minor` (`1.1`); minor versions are strictly
additive. Document releases carry an additional patch number (1.1.2) that
never appears on the wire. Policy: [VERSIONING.md](./VERSIONING.md) ·
history: [CHANGELOG.md](./CHANGELOG.md).
