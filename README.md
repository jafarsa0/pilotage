# Pilotage

[![DOI](https://zenodo.org/badge/1302736087.svg)](https://doi.org/10.5281/zenodo.21396027) [![docs-replay](https://github.com/jafarsa0/pilotage/actions/workflows/docs-replay.yml/badge.svg)](https://github.com/jafarsa0/pilotage/actions/workflows/docs-replay.yml)

**A competence layer for complex MCP tools.**

> Schemas teach the moves. **Pilotage teaches the game.**

**Website:** [pilotagespec.org](https://pilotagespec.org): guides,
reference, and the proof, rendered.

MCP standardizes how agents connect to tools. But many real tools do not
accept simple arguments; they accept queries, workflows, automation rules,
and other **programs**. To use them correctly, an agent must learn the
payload's language, discover the live environment it refers to, check its
work before anything runs, and verify afterwards what actually happened.

Today that competence is rebuilt inside every agent: prompts, custom
orchestration, hand-built integrations: an N×M cost. Pilotage moves it to
the one party that already owns the knowledge: the MCP server. The server
teaches once, through a **checkable** interface (a manifest read at the
handshake, navigable guides, a versioned live catalog, side-effect-free
validation with closed diagnostic codes, a pre-run plan with comparable
risk, and an execution trace with branch decisions on the record), and any
compatible agent orchestrates whichever of these layers the task needs:

```
manifest · guides · catalog · validate · plan · execute · trace
```

The agent sits at the center, deciding what to call and when: the layers are a
hub it drives, not a pipeline it must follow.

## Start here

- **[SPEC.md](./SPEC.md)**: the specification index (four parts: story,
  abstract model, MCP binding, implementation notes)
- **[guides/](./guides/01-your-first-verified-run.md)**: walk the loop
  against the live example server in five minutes. The guides are *docs
  that execute*: every request/response shown is replayed against the
  server in CI (`guides/check-guides.mjs`)
- **[schemas/](./schemas/1.1/pilotage.schema.json)**: machine-readable
  JSON Schemas for every data shape
- **[conformance/](./conformance/README.md)**: 54 engine-neutral test
  vectors, plus a runnable harness that executes them against any live
  server
- **[proof/](./proof/README.md)**: a recorded experiment, run twice
  (2026-07-24 and 2026-07-26): three models from three providers complete
  real work in a language that exists nowhere, transcripts unedited
- **[Harborview](https://github.com/jafarsa0/harborview)**: the public
  example server: a simulated smart building at
  `POST https://harborview.pilotagespec.org/mcp`, isolated per session

## What Pilotage is (and is not)

Pilotage is an **MCP extension**: identifier
`io.github.jafarsa0/pilotage`, negotiated through MCP's extensions
capability map, built entirely from MCP's own primitives. No new transport,
no new session model: if your system speaks MCP, Pilotage is additive.

It standardizes **the loop, not the language**: your SQL stays SQL, your
workflow format stays yours. And it is honest about trust: Pilotage makes a
cooperative server more understandable and more checkable; it does not
make a malicious server safe. The trust boundary is stated normatively in
the specification.

## Status

- **1.1.1**, the current release: the four-part specification, JSON
  Schemas, conformance vectors with a runnable harness, and executable
  guides backed by a public example server. Supports MCP `2025-06-18` and later,
  including the stateless `2026-07-28` revision (a release candidate at the time of writing; final scheduled 2026-07-28).
- Earlier: 1.1.0 (2026-07-26), the restructured four-part release; 1.0.1
  (2026-07-18), the first published specification, refined from the first
  reference implementation. See [CHANGELOG.md](./CHANGELOG.md).

## Contributing, security, citing

- Propose changes via issues and pull requests:
  [CONTRIBUTING.md](./CONTRIBUTING.md)
- Report security-relevant spec issues: [SECURITY.md](./SECURITY.md)
- Cite this work: [CITATION.cff](./CITATION.cff) (GitHub's "Cite this
  repository" button) · archived on Zenodo under concept DOI
  [10.5281/zenodo.21396027](https://doi.org/10.5281/zenodo.21396027)

Text © 2026 Jaafar Nadher Jaafar Alaboosi, [CC BY 4.0](./LICENSE.md).
Schemas, conformance vectors, and the runnable tooling:
[Apache-2.0](./LICENSE-APACHE).
