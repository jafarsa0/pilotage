# Roadmap

Last updated: 2026-07. The items here are intentions, not commitments.

## Near term

- **Runnable conformance harness** over `conformance/vectors.json`, so a
  Server implementation can be checked mechanically rather than by reading.
- **Public example server**: a minimal open-source implementation over a
  toy closed language, exercising the full loop end to end; the artifact
  the MCP Extensions Track expects before review.
- **Illustrated overview page** updated to the 1.1 four-part structure.

## Standardization track

- Submit Pilotage to the **MCP SEP Extensions Track** as a community
  extension, positioned as the checkable complement to prose guidance
  (skills, server instructions). Prerequisites: the example server above
  and a reference implementation in an official SDK, per the extensions
  framework's requirements.

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
