# Contributing

Pilotage is an openly published specification with a single maintainer.
Contributions are welcome and handled in public.

## How to propose a change

1. **Open an issue first** describing the problem: what an implementer
   cannot determine, where two implementations would diverge, or what the
   specification gets wrong. Concrete failure scenarios are the most
   persuasive form of argument here; this specification was built by
   adversarial review, and issues in that style get the fastest traction.
2. For text changes, follow with a **pull request** referencing the issue.
   Keep normative changes (Parts II–III) separate from editorial ones.
3. Every normative PR must state its versioning impact (patch / minor /
   major, per [VERSIONING.md](./VERSIONING.md)) and update
   [CHANGELOG.md](./CHANGELOG.md).

## Ground rules for spec text

- Parts II and III use BCP 14 keywords; every new requirement must attach
  to a defined actor (Server, Engine, Client, Host, Model) and be testable
  against observable behavior.
- Parts I and IV are informative and must not introduce requirements;
  lowercase "must" there may only restate a requirement that exists in
  Parts II–III, with a citation.
- New wire-visible values (statuses, codes, kinds, enum members) follow the
  reserved-value rules of Part II §1.3 and §11.
- Examples must validate against `schemas/`: run the schema suite before
  submitting.

## Decision making

The maintainer decides, in public, on the issue or PR thread. The intended
long-term home for governance is the MCP SEP Extensions Track; if and when
Pilotage enters that process, its governance supersedes this file for the
extension's evolution.

## License of contributions

By contributing you agree that your contributions are licensed under the
repository's licenses: CC BY 4.0 for specification text, Apache-2.0 for
schemas and conformance artifacts.
