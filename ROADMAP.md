# Roadmap

Last updated: 2026-07. The items here are intentions, not commitments.

## Near term

- **MCP Extensions Track (SEP) submission preparation**: assemble and
  polish the submission materials for the community-extension process.
- **In-browser playground**: walk the loop against Harborview from the
  browser, with no client setup required.
- **Implementers guide**: a build-a-server walkthrough, from an empty
  repository to passing the conformance harness.

## Standardization track

- Submit Pilotage to the **MCP SEP Extensions Track** as a community
  extension, positioned as the checkable complement to prose guidance
  (skills, server instructions). Prerequisites: a public example server
  (delivered: Harborview, live at
  `POST https://harborview.pilotagespec.org/mcp`) and a reference
  implementation in an official SDK, per the extensions framework's
  requirements.

## Specification (1.2 candidates)

- **Long-running executions**: align `execute` with the MCP Tasks
  extension (`io.modelcontextprotocol/tasks`) for runs that outlive a
  request/response exchange.
- **Assertions**: agent-declared postconditions checked by the engine
  against the trace, the mechanism that upgrades "the agent judges
  completeness from evidence" to "the engine checks declared success
  criteria".
- **Contextual policy**: per-object and per-environment rules, approvals,
  and budgets layered over the risk gate.
- Firmed-up `changed_since` semantics informed by implementation
  experience.

## Out of scope (deliberately)

- Standardizing any program language.
- Adversarial verifiability of server-reported facts (the trust model is
  explicit that traces evidence an honest engine); remote attestation is
  interesting but belongs to a different layer.
