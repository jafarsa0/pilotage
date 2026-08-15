# Implementing Pilotage on your MCP server

This is the step-by-step path from an ordinary MCP server to a conformant
Pilotage server. Each step says what to build and links to the exact
normative text. You are done when the conformance harness passes against
your live endpoint.

This guide is informative. Where it and the specification disagree, the
specification governs: [SPEC.md](./SPEC.md).

The steps below are a convenient build order, not a protocol sequence.
On the wire, the layers are a composable set; the agent decides what to
call and when.

**What you need before starting**

- An MCP server (revision `2025-06-18` or later, any transport).
- An engine that can parse, validate, and (optionally) execute programs
  in some language: SQL, workflow documents, automation rules, a DSL of
  your own. Pilotage standardizes the loop around your language; it never
  changes the language itself.
- Node.js, to run the conformance harness at the end.

If you are wrapping an existing engine, read
[Part IV §1, Adopting Pilotage on an existing engine](./spec/part-iv-implementation-notes.md)
alongside this guide: most engines already have a parser, an error list,
and a dry-run mode, and adoption is mainly re-shaping what you already
have.

---

## Step 1. Declare the extension

Declare Pilotage in MCP's `extensions` capability map, in your
`initialize` result (or, on the stateless `2026-07-28` revision, through
`server/discover`):

```json
{
  "capabilities": {
    "extensions": {
      "io.github.jafarsa0/pilotage": {}
    }
  }
}
```

The declaration is required on every supported revision path. On MCP
revisions before `2026-07-28`, though, the `extensions` member is
additive and some intermediaries may strip it, so it is not the reliable
detection mechanism. The guaranteed detection mechanism is the
`pilotage_manifest` tool you build in the next step: exposing that tool
and returning a valid manifest is itself the declaration of support.

Normative text: [Part III §1.2, Negotiation](./spec/part-iii-mcp-binding.md).

## Step 2. Serve the manifest

Expose an MCP tool named exactly `pilotage_manifest`, taking no required
arguments and returning the manifest. The manifest is the welcome card a
zero-knowledge agent reads first: the wire version, your Languages, and
what each one supports.

A minimal manifest for one executable Language looks like this
(illustrative):

```json
{
  "pilotage": "1.1",
  "capabilities": { "guides": true, "validate": true, "execute": true },
  "languages": [
    {
      "name": "workflow/v1",
      "title": "Workflow documents",
      "guides": "pilotage_get_guide",
      "loop": {
        "validate": "validate_workflow",
        "execute": "run_workflow"
      },
      "locator": "json-pointer",
      "execution": "immediate",
      "trace": "full",
      "retention": "none"
    }
  ]
}
```

Every field is defined in
[Part II §5.1, Manifest](./spec/part-ii-abstract-model.md); the exact
tool behavior is
[Part III §3.1, Manifest tool](./spec/part-iii-mcp-binding.md). You MAY
additionally attach the manifest to the initialize result's `_meta` or
expose it as a resource (Part III §3.2), but the tool alone is
sufficient.

**One rule for every Pilotage tool you build from here on**: results are
ordinary MCP `CallToolResult`s whose machine contract lives in
`structuredContent` (with an optional human-readable `content` summary).
An invalid program or a failed run is a *successful* tool result carrying
that fact as data; `isError: true` marks request errors only, and carrier
errors stay at the JSON-RPC layer. See
[Part III §6, Result envelope](./spec/part-iii-mcp-binding.md) and §7,
Error mapping.

## Step 3. Declare capabilities truthfully

For each Language, decide which capabilities you actually provide:

| Capability | Meaning |
|---|---|
| `guides` | Teaching material is available. |
| `catalog` | A queryable, versioned inventory of live names is available. |
| `validate` | A side-effect-free checker returns structured diagnostics. |
| `plan` | Successful validation also returns an execution plan with risk. |
| `execute` | Programs can be executed. |
| `trace_fetch` | Stored traces can be fetched later by `run_id`. |

The rules that shape your declaration
([Part II §4.3](./spec/part-ii-abstract-model.md)):

- **The floor**: every Language MUST declare at least `guides` and
  `validate`. A guides-plus-validate Language with no execute is
  conformant; a guides-only or execute-without-validate Language is not.
- **Capability requirements** (declaration-time composition, not call
  order): `validate` requires `guides`; `plan` and `execute` require
  `validate`; `trace_fetch` requires `execute`.
- **Catalog obligation**: if program validity depends on live server
  state (table names, device ids, entity names), you MUST declare
  `catalog`.
- **Trace obligation**: a Language that declares `execute` MUST support
  traces at `summary` level or better. There is no execute without trace
  support.
- **Truthfulness**: never declare anything you do not actually provide.
  The conformance vectors test declared capabilities against observed
  behavior.

Declare capabilities once at the server level as a default, per Language,
or both (a Language-level entry overrides the default for that capability
in full). See [Part II §4.2](./spec/part-ii-abstract-model.md) for the
worked example.

## Step 4. Serve guides

Expose an MCP tool named exactly `pilotage_get_guide`
([Part III §4.1](./spec/part-iii-mcp-binding.md)). It has two forms:

- **Index form** (no `id` argument): returns the list of guides for a
  Language with their metadata (id, title, level, topics, language,
  version, size_bytes).
- **Fetch form** (`id` supplied): returns one guide with its `body`.

Content requirements ([Part II §5.2](./spec/part-ii-abstract-model.md)):

- At least one guide per Language with `level: "core"`, RECOMMENDED to
  stay within 8192 bytes so a context-constrained agent can learn
  cheaply.
- Exactly one guide per Language carries the reserved topic
  `closed-sets`: the enumeration of the closed value sets of your
  Language (step types, operators, statuses) that an agent must not
  guess.

Guides are the layer implementers most often underinvest in. What makes
a guide teach an agent effectively, with examples, is
[Part IV §9, Authoring guides](./spec/part-iv-implementation-notes.md).

## Step 5. Serve the catalog (when you declared it)

Expose an MCP tool named exactly `pilotage_catalog`
([Part III §4.2](./spec/part-iii-mcp-binding.md)). It answers: what
names exist *right now*, and under which catalog version. The catalog
entry shape and the `catalog_version` contract are
[Part II §5.4](./spec/part-ii-abstract-model.md); practical strategies
for computing a stable `catalog_version` over a live inventory are
[Part IV §3](./spec/part-iv-implementation-notes.md).

Optional sub-features, declared only if real: `catalog.search`
(free-text search) and `catalog.changed_since` (changes since a previous
version).

## Step 6. Implement validate, and let the plan ride its response

Expose your validate tool under the name you declared in `loop.validate`.
It MUST be side-effect free, and it returns structured diagnostics:

- Each diagnostic carries a `code` from a closed, documented set. The
  reserved codes `constraint`, `input_binding`, and `context_binding`
  have fixed meanings; your Language-specific codes are declared in your
  guides. Shape: [Part II §5.5](./spec/part-ii-abstract-model.md);
  behavior: §6.4.
- Locations use the locator dialect you declared per Language:
  `json-pointer` for structured programs, `text-range` for text
  programs.
- If you have an existing error list, you are re-shaping it, not
  rewriting it: [Part IV §2, Adapting existing diagnostics](./spec/part-iv-implementation-notes.md).

When you declare `plan`, successful validation of a valid program also
returns the pre-run plan in the same response: the steps that would run,
each with a risk hint. There is no separate plan tool and no `plan`
member in `loop`. Validation reports what is wrong with the program; the
plan makes visible what will happen when it runs. Plan shape and risk:
[Part II §5.6 and §5.3](./spec/part-ii-abstract-model.md).

## Step 7. Implement execute, with the trace inline

Expose your execute tool under the name you declared in `loop.execute`.
The response carries the outcome and, per the requested `trace_level`,
the trace: what actually ran, step by step, with branch decisions on the
record.

The argument names are reserved and fixed
([Part III §4.4](./spec/part-iii-mcp-binding.md)): `trace_level` (MUST
be declared on every execute tool), `expected_catalog_version` (MUST be
declared for a catalog-bearing Language; this is the drift guard),
`input`, `context`, `store`, and, where declared, `idempotency_key`,
`test_run`, `mode`, and `program_ref`. Your program-bearing argument
name is your own choice, declared through the program declaration in
[Part III §5](./spec/part-iii-mcp-binding.md).

Author loop-tool input schemas permissively: no
`additionalProperties: false`, no enums or value constraints on reserved
members beyond their JSON type, and neither the program-bearing argument
nor `program_ref` marked required on execute. Value faults must reach
Pilotage validation and come back as diagnostics or request errors, not
die as JSON-RPC schema failures. See
[Part III §4.6, Loop-tool schema authoring](./spec/part-iii-mcp-binding.md).

The processing order (well-formedness, drift check, re-validation,
binding, run) and the outcome statuses are normative in
[Part II §6.5](./spec/part-ii-abstract-model.md); outcome shape in §5.7;
trace shape in §5.8. Implementation guidance, including what "one
mandatory re-validation" costs in practice:
[Part IV §5 and §6](./spec/part-iv-implementation-notes.md).

## Step 8. Optional: stored traces

If you retain run records (`retention` of `"session"` or a duration, not
`"none"`), you may declare `trace_fetch` and expose a trace-fetch tool
under `loop.trace` (for example `trace_run`). It takes a required
`run_id` and returns the same stored trace envelope that rode the
execute response: one trace, two doors. The fetch door is
[Part II §6.6](./spec/part-ii-abstract-model.md); the execute-side
`store` override semantics are in §6.5.

## Step 9. Signpost for the agent that arrives knowing nothing

Pilotage's discovery is designed for a cold start: an agent with no
prior instructions about your server. Three signposts are mandatory
([Part III §3.4, Cold start](./spec/part-iii-mcp-binding.md)):

1. **The welcome text**: your initialize result's `instructions` field
   names Pilotage and directs the agent to call `pilotage_manifest`
   first.
2. **The entry-point description**: the `pilotage_manifest` tool
   description identifies it as the starting point, readable from
   `tools/list` alone. This one is load-bearing: every host shows tool
   descriptions.
3. **The stage descriptions**: each loop tool's description states which
   stage it serves (validate, execute, or trace fetch) and for which
   Language; `pilotage_get_guide` says it serves the guides,
   `pilotage_catalog` the catalog.

The rules constrain what the signposts communicate, never their wording.

## Step 10. Verify

Three checks, from cheapest to strongest:

1. **Shapes**: validate your manifest and every tool response against
   the JSON Schemas in
   [schemas/1.1/pilotage.schema.json](./schemas/1.1/pilotage.schema.json).
2. **The checklist**: walk
   [Part II §12.1, Server conformance](./spec/part-ii-abstract-model.md)
   (per Language) and
   [Part III §10.1, Server conformance](./spec/part-iii-mcp-binding.md)
   (the binding checklist). These are the normative checklists this
   guide has been building toward.
3. **The harness**: run the 54 conformance vectors against your live
   endpoint. Copy the example binding, fill in concrete programs in your
   Language, and point the harness at your server:

   ```
   cd conformance/harness
   npm install
   cp bindings/harborview.mjs bindings/your-server.mjs   # then edit it
   node harness.mjs --endpoint http://localhost:8787/mcp --binding ./bindings/your-server.mjs
   ```

   Every vector prints PASS, FAIL, or SKIP with a reason; a vector
   applies only when your Language declares the capabilities it
   requires. See [conformance/README.md](./conformance/README.md),
   including the completeness gate worth keeping in your build.

A working reference is one tool call away throughout: **Harborview**,
the public example server (a simulated smart building), lives at
`POST https://harborview.pilotagespec.org/mcp` with source at
[github.com/jafarsa0/harborview](https://github.com/jafarsa0/harborview).
When a requirement reads abstractly, call Harborview and look at what a
conformant answer looks like.

---

## Where to go deeper

- [Part II, Abstract model](./spec/part-ii-abstract-model.md): the
  normative data model and operations. What every shape and rule means.
- [Part III, MCP binding](./spec/part-iii-mcp-binding.md): the exact
  wire form of everything above.
- [Part IV, Implementation notes](./spec/part-iv-implementation-notes.md):
  engine adoption, diagnostics adaptation, catalog versioning, testing
  method, execution and trace implementation, guide authoring, schema
  authoring, deployment topology.
- [Part I, Story and positioning](./spec/part-i-story-and-positioning.md):
  why the standard is shaped this way, and what it deliberately does not
  attempt.
