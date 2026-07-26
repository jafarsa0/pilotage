# Versioning policy

## The wire version

The manifest's `pilotage` field carries the wire version as `major.minor`
(currently `1.1`). Its semantics are normative in Part II §11:

- **Minor** versions are strictly additive: new OPTIONAL fields, new
  sub-features, new reserved values. The unknown-member rule and the
  unknown-value fallbacks (Part II §1.2–1.3) make minors safe: a `1.0`
  Client interoperates with a `1.1` Server unchanged.
- **Major** versions may break compatibility. A Client encountering a
  higher major than it implements MUST NOT use the extension on that
  Server. A breaking change also mints a **new extension identifier**
  (e.g. `io.github.jafarsa0/pilotage-v2`), as the MCP extensions framework
  requires.

## Document releases

Specification documents carry `major.minor.patch` (currently **1.1.1**).
The patch component is editorial only (clarifications, typo fixes, example
corrections that change no requirement) and never appears on the wire.

A document release that changes any requirement increments the wire minor
(additive) or major (breaking), never just the patch.

## What is versioned separately

- **Language identifiers** (`family/version`): the version part changes
  when a grammar changes incompatibly. Server-scoped (Part II §3.3).
- **Guides**: `version` changes with content; clients cache by
  (Server, Language identifier, guide version).
- **Schemas**: published per wire version under `schemas/<major.minor>/`.
  Enums in a schema file are closed for that version; later minors may add
  reserved values (see the schema file's own description).
- **`catalog_version`** is not a version: it is an opaque change-detection
  token, compared only for equality (Part II §11.3).

## Release procedure

1. Changes land via pull request (see CONTRIBUTING.md), mapped in the PR to
   patch / minor / major per this policy.
2. A release updates every file that states the version: the wire version
   where applicable, SPEC.md front matter, CHANGELOG.md, CITATION.cff
   (version, date-released, and the version sentence in the abstract),
   .zenodo.json (version and the version sentence in the description),
   llms.txt, index.html (the version chip), the current-release note in
   README.md, the harness package.json, the two "currently" markers in
   this file, and (for wire-version changes) a new `schemas/<version>/`
   directory plus the links that reference it.
3. Each GitHub release is archived on Zenodo, minting a version DOI under
   the concept DOI 10.5281/zenodo.21396027.
