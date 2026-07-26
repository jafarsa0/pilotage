# License

This repository contains two classes of material under two licenses.

## Specification text: CC BY 4.0

The specification documents (`SPEC.md`, everything under `spec/`, and the
repository's prose documentation) are

© 2026 Jaafar Nadher Jaafar Alaboosi

and are licensed under the Creative Commons Attribution 4.0 International
License (CC BY 4.0). You are free to share and adapt this material for any
purpose, including commercially, provided you give appropriate credit.

Everything else in this repository not listed under the Apache-2.0 class
below is covered by this CC BY 4.0 class, including `index.html` and the
recorded experiment artifacts under `proof/` (transcripts, report cards,
rendered pages), which are factual records published with the text.

Full license text: <https://creativecommons.org/licenses/by/4.0/legalcode>

## Machine-readable artifacts and tooling: Apache-2.0

The contents of `schemas/` and `conformance/`, and the runnable tooling
elsewhere in this repository (`guides/check-guides.mjs`, the proof kit
scripts `proof/runner.mjs`, `proof/grader.mjs`,
`proof/render-transcript.mjs`, and the workflows under
`.github/workflows/`), are

Copyright 2026 Jaafar Nadher Jaafar Alaboosi

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use these files except in compliance with the License. You may obtain a
copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations
under the License.

The full Apache-2.0 license text is included in this repository as
[LICENSE-APACHE](./LICENSE-APACHE).

This split exists so that implementers can embed the schemas, test
vectors, and tooling directly in their software under a standard code
license, while the specification text carries the attribution norm
appropriate to a published standard. It also matches the MCP extensions
ecosystem's convention of Apache-2.0 for extension artifacts.
