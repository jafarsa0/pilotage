# Implementing Pilotage on your MCP server

This is the step-by-step path from an ordinary MCP server to a conformant
Pilotage server. Each step says what to build, links to the exact
normative text, and then shows what it looks like for one concrete
example language, carried end to end through every step. You are done
when the conformance harness passes against your live endpoint.

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

## The running example: `picklist/v1`

Every step below is illustrated with one invented Language, built for
this guide: a small parts warehouse whose server executes **pick lists**,
programs that fulfill a customer order by checking stock and moving
quantities between bins and packing stations.

Everything about this example is made up for teaching. The payloads
shown are illustrative, authored against the JSON Schemas in this
repository; none of them is captured from a live server. For genuinely
captured, CI-replayed output, see the [guides/](./guides/01-your-first-verified-run.md)
walkthroughs against the public example server.

The warehouse makes the example meaningful, because it naturally
produces everything Pilotage exists for:

- **Live names**: items, bins, and stations come and go, so program
  validity depends on server state. That is the catalog.
- **A risk gradient**: checking stock changes nothing; picking moves
  physical inventory. That is per-step risk on the plan.
- **Silent wrong programs**: a pick list can be perfectly valid and
  still pick the wrong quantity from the wrong bin. That is what the
  plan makes visible before anything moves.
- **Branches that matter afterwards**: when stock runs short, the
  program takes the reserve-bin path, and the operator will want that
  decision on the record. That is the trace.

Here is a pick list. Programs are JSON; each step has an `id` and an
`op` from a closed set (`stock_check`, `pick`, `stage`, `branch`):

```json
{
  "order": "ord_1042",
  "steps": [
    { "id": "check", "op": "stock_check", "item": "sku_hinge_35mm", "needs": 40 },
    { "id": "route", "op": "branch", "when": "check.available >= needs",
      "then": [
        { "id": "pick_main", "op": "pick", "item": "sku_hinge_35mm", "from": "bin_a3", "qty": 40 }
      ],
      "else": [
        { "id": "pick_reserve", "op": "pick", "item": "sku_hinge_35mm", "from": "bin_r9", "qty": 40 }
      ]
    },
    { "id": "stage", "op": "stage", "station": "station_pack_2" }
  ]
}
```

It reads: check how many 35 mm hinges are available; if enough, pick 40
from the primary bin, otherwise pick from the reserve rack; stage the
result at packing station 2. Step ids are program step identifiers, so
they must not contain `#` or `/` (Part II §3.4; those characters are
reserved for trace identity).

Your language will look different. What carries over is the shape of the
work: each step below builds one server surface for `picklist/v1`, and
you build the same surface for your language.

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

The warehouse manifest, complete:

```json
{
  "pilotage": "1.1",
  "capabilities": {
    "guides": true,
    "catalog": { "search": true },
    "validate": true,
    "plan": true,
    "execute": true,
    "trace_fetch": true
  },
  "languages": [
    {
      "name": "picklist/v1",
      "title": "Pick lists",
      "guides": "pilotage_get_guide",
      "catalog": "pilotage_catalog",
      "loop": {
        "validate": "validate_picklist",
        "execute": "run_picklist",
        "trace": "trace_picklist"
      },
      "locator": "json-pointer",
      "execution": "immediate",
      "trace": "full",
      "retention": "session"
    }
  ]
}
```

Reading it like a conformance reviewer would:

- `pilotage: "1.1"` is the wire version, the authoritative one.
- The Language identifier `picklist/v1` follows the `family/version`
  form of Part II §3.3 and is scoped to this server.
- The `loop` object names the three tools this server chose for
  validate, execute, and trace fetch. Guides and catalog access do not
  appear here: they go through the fixed-name tools instead.
- `locator: "json-pointer"` because pick lists are JSON; a text Language
  (SQL, for instance) would declare `text-range`.
- `retention: "session"` is an honest choice for a small server: stored
  runs survive within the session, and no durability promise is made
  across restarts. An ISO duration such as `"PT24H"` is a commitment
  that survives restarts; declare one only if you can keep it.

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

| Capability | Meaning | The warehouse declares it because |
|---|---|---|
| `guides` | Teaching material is available. | Agents must learn the pick-list grammar. |
| `catalog` | A queryable, versioned inventory of live names is available. | Items, bins, and stations are live state. |
| `validate` | A side-effect-free checker returns structured diagnostics. | Always; it is part of the floor. |
| `plan` | Successful validation also returns an execution plan with risk. | Operators gate on what a run would move. |
| `execute` | Programs can be executed. | Fulfilling orders is the point. |
| `trace_fetch` | Stored traces can be fetched later by `run_id`. | Retention is `"session"`, so stored runs exist to fetch. |

The rules that shape your declaration
([Part II §4.3](./spec/part-ii-abstract-model.md)):

- **The floor**: every Language MUST declare at least `guides` and
  `validate`. A guides-plus-validate Language with no execute is
  conformant; a guides-only or execute-without-validate Language is not.
- **Capability requirements** (declaration-time composition, not call
  order): `validate` requires `guides`; `plan` and `execute` require
  `validate`; `trace_fetch` requires `execute`.
- **Catalog obligation**: if program validity depends on live server
  state, you MUST declare `catalog`. The warehouse has no choice here: a
  pick list naming a discontinued item is invalid, and only the server
  knows.
- **Trace obligation**: a Language that declares `execute` MUST support
  traces at `summary` level or better. There is no execute without trace
  support.
- **Retention coupling**: `trace_fetch` is forbidden when retention is
  `"none"`. The warehouse declares `"session"`, so the fetch door is
  allowed.
- **Truthfulness**: never declare anything you do not actually provide.
  The conformance vectors test declared capabilities against observed
  behavior.

Declare capabilities once at the server level as a default, per Language,
or both (a Language-level entry overrides the default for that capability
in full). The warehouse has one Language, so one server-level declaration
covers it. See [Part II §4.2](./spec/part-ii-abstract-model.md) for the
multi-Language worked example.

## Step 4. Serve guides

Expose an MCP tool named exactly `pilotage_get_guide`
([Part III §4.1](./spec/part-iii-mcp-binding.md)). It has two forms:

- **Index form** (no `id` argument): returns the list of guides for a
  Language with their metadata.
- **Fetch form** (`id` supplied): returns one guide with its `body`.

The warehouse index form returns:

```json
{
  "guides": [
    {
      "id": "picklist-core",
      "title": "Writing pick lists",
      "level": "core",
      "topics": ["steps", "ops", "branching"],
      "language": "picklist/v1",
      "version": "1",
      "size_bytes": 3214
    },
    {
      "id": "picklist-closed-sets",
      "title": "Pick list closed sets",
      "level": "reference",
      "topics": ["closed-sets"],
      "language": "picklist/v1",
      "version": "1",
      "size_bytes": 2050
    }
  ]
}
```

Content requirements ([Part II §5.2](./spec/part-ii-abstract-model.md)):

- At least one guide per Language with `level: "core"`, RECOMMENDED to
  stay within 8192 bytes so a context-constrained agent can learn
  cheaply. `picklist-core` teaches the program shape, the four ops, and
  the branch construct, with one worked example.
- Exactly one guide per Language carries the reserved topic
  `closed-sets`: every closed value set of your Language, enumerated so
  an agent never has to guess. For the warehouse,
  `picklist-closed-sets` lists:
  - the ops: `stock_check`, `pick`, `stage`, `branch`;
  - the catalog entry kinds: `item`, `bin`, `station`, and which of them
    are callable (`item` and `station`);
  - the diagnostic codes: the reserved `constraint`, `input_binding`,
    and `context_binding`, plus `unknown_op`, `unknown_item`,
    `unknown_bin`, `unknown_station`, and `bad_quantity`;
  - the run statuses: the six reserved ones, plus the engine-defined
    `stock_conflict` (`ok: false`, side effects possible);
  - the step statuses: `success` and `error`;
  - the risk levels, each with its `risk_hints`: `safe` (read-only) and
    `movement` (not read-only, not destructive, not open-world);
  - the scope rules for cross-step values: where an expression such as
    `check.available` may address the output of an earlier step
    (omitting these rules is a conformance violation);
  - the truncation format used by `summary` traces;
  - the meaning of execute `output`: `{ "order": ..., "staged": ... }`.

Guides are the layer implementers most often underinvest in. What makes
a guide teach an agent effectively, with examples, is
[Part IV §9, Authoring guides](./spec/part-iv-implementation-notes.md).

## Step 5. Serve the catalog (when you declared it)

Expose an MCP tool named exactly `pilotage_catalog`
([Part III §4.2](./spec/part-iii-mcp-binding.md)). It takes `language`
and a `verb` (`list`, `get`, or `changed_since`) and answers: what names
exist *right now*, and under which catalog version.

The warehouse `list` response:

```json
{
  "items": [
    {
      "id": "sku_hinge_35mm",
      "kind": "item",
      "name": "35 mm soft-close hinge",
      "input_schema": {
        "type": "object",
        "properties": {
          "item": { "type": "string" },
          "from": { "type": "string" },
          "qty": { "type": "integer" }
        }
      },
      "risk": "movement",
      "risk_hints": { "readOnly": false, "destructive": false, "openWorld": false },
      "tags": ["hardware"]
    },
    {
      "id": "bin_a3",
      "kind": "bin",
      "name": "Aisle A, shelf 3",
      "risk": "movement",
      "risk_hints": { "readOnly": false, "destructive": false, "openWorld": false }
    },
    {
      "id": "bin_r9",
      "kind": "bin",
      "name": "Reserve rack 9",
      "risk": "movement",
      "risk_hints": { "readOnly": false, "destructive": false, "openWorld": false }
    },
    {
      "id": "station_pack_2",
      "kind": "station",
      "name": "Packing station 2",
      "input_schema": {
        "type": "object",
        "properties": {
          "station": { "type": "string" }
        }
      },
      "risk": "movement",
      "risk_hints": { "readOnly": false, "destructive": false, "openWorld": false }
    }
  ],
  "catalog_version": "cv_5f21"
}
```

The callable kinds (`item` and `station`, the entries program steps
invoke) declare an `input_schema`; bins are only ever named inside step
inputs, never invoked, so their entries carry none.

Two design decisions worth copying:

- **Entry-level risk is the maximum effect the Language can express
  against the entry** (Part II §5.3). An item can be picked, so its
  entry is not read-only, even though `stock_check` only reads it. The
  read-only fact about one particular use belongs to the plan step, not
  the entry.
- **Keep the version token stable.** `catalog_version` MUST change when
  a visible entry is added, removed, or edited, and SHOULD NOT change
  otherwise (Part II §5.4). The warehouse therefore keeps stock
  *quantities* out of the catalog: they are runtime data read by
  `stock_check`. If quantities were entry fields, every pick would move
  the token and honest programs would drift constantly. Strategies for
  computing a stable token are
  [Part IV §3](./spec/part-iv-implementation-notes.md).

Declare the sub-features only if real: the warehouse declares
`catalog.search` (the `q` filter works) and not `catalog.changed_since`.

## Step 6. Implement validate, and let the plan ride its response

Expose your validate tool under the name you declared in `loop.validate`
(here `validate_picklist`). It MUST be side-effect free. Like every
program-valued tool, it carries the `_meta` declaration shown in Step 7
(`argument: "picklist"`, `language: "picklist/v1"`), and because it
serves a single Language, it marks its program-bearing argument
required (Part III §4.4; execute tools do the opposite, as Step 7
explains).

Suppose the agent authored the pick list with a typo: `sku_hinge_36mm`.
The response carries structured diagnostics:

```json
{
  "valid": false,
  "diagnostics": [
    {
      "severity": "error",
      "code": "unknown_item",
      "path": "/steps/0/item",
      "message": "unknown item 'sku_hinge_36mm'",
      "hint": "close match: sku_hinge_35mm"
    }
  ],
  "catalog_version": "cv_5f21"
}
```

- `code` comes from the closed set the guides enumerated in Step 4. The
  reserved codes `constraint`, `input_binding`, and `context_binding`
  have fixed meanings; when nothing more specific fits, use
  `constraint`. Shape: [Part II §5.5](./spec/part-ii-abstract-model.md);
  behavior: §6.4.
- `path` uses the locator dialect the manifest declared:
  `json-pointer` into the program. A text Language would declare
  `text-range` and locate by line and column.
- `hint` is the correction that lets an agent fix the program in one
  revision instead of five. If you have an existing error list, you are
  re-shaping it, not rewriting it:
  [Part IV §2, Adapting existing diagnostics](./spec/part-iv-implementation-notes.md).
- The response carries `catalog_version` because the Language is
  catalog-bearing: validity was judged against that snapshot.

After the agent fixes the typo, validation succeeds, and because `plan`
is declared, the same response carries the plan:

```json
{
  "valid": true,
  "diagnostics": [],
  "catalog_version": "cv_5f21",
  "plan": {
    "steps": [
      {
        "id": "check",
        "calls": "sku_hinge_35mm",
        "risk": "safe",
        "risk_hints": { "readOnly": true, "destructive": false, "openWorld": false }
      },
      {
        "id": "route",
        "risk": "safe",
        "risk_hints": { "readOnly": true, "destructive": false, "openWorld": false }
      },
      {
        "id": "pick_main",
        "calls": "sku_hinge_35mm",
        "arm": { "branch": "route", "label": "then" },
        "risk": "movement",
        "risk_hints": { "readOnly": false, "destructive": false, "openWorld": false }
      },
      {
        "id": "pick_reserve",
        "calls": "sku_hinge_35mm",
        "arm": { "branch": "route", "label": "else" },
        "risk": "movement",
        "risk_hints": { "readOnly": false, "destructive": false, "openWorld": false }
      },
      {
        "id": "stage",
        "calls": "station_pack_2",
        "risk": "movement",
        "risk_hints": { "readOnly": false, "destructive": false, "openWorld": false }
      }
    ],
    "max_risk": "movement",
    "max_risk_hints": { "readOnly": false, "destructive": false, "openWorld": false }
  }
}
```

There is no separate plan tool and no `plan` member in `loop`.
Validation reports what is wrong with the program; the plan makes
visible what will happen when it runs. Read the plan the way a Host
will:

- The branch contributes the steps of **both** arms, each marked with
  `arm`, because the plan cannot know which arm will run.
- The branch step itself (`route`) is a plan step of its own and, being
  control flow, carries no `calls`.
- `max_risk_hints` is computed from the hints, not the strings: one
  step with `readOnly: false` makes the whole program not read-only.
  This is the field the Host's risk gate operates on.

Plan shape and risk: [Part II §5.6 and §5.3](./spec/part-ii-abstract-model.md).

## Step 7. Implement execute, with the trace inline

Expose your execute tool under the name you declared in `loop.execute`
(here `run_picklist`). Two wiring rules first:

**The tool declares where the program goes.** Every program-valued tool
carries a Pilotage declaration in its `tools/list` entry naming its
program-bearing argument
([Part III §5](./spec/part-iii-mcp-binding.md)):

```json
{
  "name": "run_picklist",
  "inputSchema": {
    "type": "object",
    "properties": {
      "picklist": { "type": "object" },
      "trace_level": { "type": "string" },
      "expected_catalog_version": { "type": "string" },
      "store": { "type": "boolean" }
    }
  },
  "_meta": {
    "io.github.jafarsa0/pilotage": {
      "argument": "picklist",
      "language": "picklist/v1"
    }
  }
}
```

The argument name `picklist` is this server's own choice; the reserved
names (`trace_level`, `expected_catalog_version`, `input`, `context`,
`store`, `program_ref`, and, where declared, `idempotency_key`,
`test_run`, `mode`, `run_id`, `question`) are fixed by
[Part III §4.4](./spec/part-iii-mcp-binding.md). Every execute tool MUST
declare `trace_level`, and a catalog-bearing Language's execute tool
MUST declare `expected_catalog_version`: that argument is the drift
guard. Declare only what the Language supports: pick lists carry their
quantities inline and expose no promoted programs, so this schema
declares neither `input` nor `program_ref`; a request supplying them
anyway still reaches Pilotage validation and is answered there, per the
permissive-schema rule below.

**Author loop-tool input schemas permissively**: no
`additionalProperties: false`, no enums or value constraints on reserved
members beyond their JSON type, and neither the program-bearing argument
nor `program_ref` marked required on execute. Value faults must reach
Pilotage validation and come back as diagnostics or request errors, not
die as JSON-RPC schema failures. See
[Part III §4.6, Loop-tool schema authoring](./spec/part-iii-mcp-binding.md).

Now the run. The agent calls `run_picklist` with the corrected program,
`trace_level: "full"`, and `expected_catalog_version: "cv_5f21"` from
validation. Only 24 hinges remain in the primary bin, so the branch
takes the reserve path, and the response says so:

```json
{
  "run_id": "run_4c9a2e771b05",
  "outcome": { "ok": true, "status": "success", "error": null },
  "output": { "order": "ord_1042", "staged": 40 },
  "trace": {
    "run_id": "run_4c9a2e771b05",
    "level": "full",
    "steps": [
      {
        "id": "check",
        "calls": "sku_hinge_35mm",
        "input": { "item": "sku_hinge_35mm" },
        "output": { "available": 24 },
        "outcome": { "ok": true, "status": "success", "error": null },
        "t_ms": 3
      },
      {
        "id": "route",
        "outcome": { "ok": true, "status": "success", "error": null },
        "decisions": [
          { "at": "route", "took": "else", "because": "available 24 < needs 40" }
        ]
      },
      {
        "id": "pick_reserve",
        "calls": "sku_hinge_35mm",
        "input": { "item": "sku_hinge_35mm", "from": "bin_r9", "qty": 40 },
        "output": { "picked": 40 },
        "outcome": { "ok": true, "status": "success", "error": null },
        "t_ms": 122
      },
      {
        "id": "stage",
        "calls": "station_pack_2",
        "input": { "station": "station_pack_2" },
        "output": { "staged": 40 },
        "outcome": { "ok": true, "status": "success", "error": null },
        "t_ms": 41
      }
    ],
    "stats": { "total_ms": 171 }
  }
}
```

What to notice, because the harness will test it:

- The trace is a **flat execution log**: only the steps that ran appear,
  so `pick_main` is absent, and the branch decision records why
  (`took: "else"` matches the plan's `arm.label`). The agent can now
  check the trace against the plan and the user's intent; that check is
  how "verified" happens, on the client side.
- The control-flow step (`route`) carries `decisions` and no
  `input`/`output`; the other steps carry both because the effective
  level is `full`.
- Had the warehouse discontinued the hinge between validation and
  execution, `catalog_version` would have moved and the run would have
  been **refused** with `outcome.status: "catalog_drift"`, no side
  effects, recoverable by revalidating. The refusal statuses and the
  processing order (well-formedness, drift check, re-validation,
  binding, run) are normative in
  [Part II §6.5](./spec/part-ii-abstract-model.md); outcome shape in
  §5.7; trace shape in §5.8.

Implementation guidance, including what the mandatory re-validation
costs in practice:
[Part IV §5 and §6](./spec/part-iv-implementation-notes.md).

## Step 8. Optional: stored traces

Because the warehouse retains runs (`retention: "session"`) and declared
`trace_fetch`, it exposes the trace-fetch tool it named in `loop.trace`:
`trace_picklist`. It takes a required `run_id` and returns the same
stored envelope that rode the execute response:

```json
{ "run_id": "run_4c9a2e771b05" }
```

returns the `run_id`, `outcome`, `output`, and `trace` shown in Step 7:
one trace, two doors. The fetch door MUST NOT return more than was
recorded, and a fetch with `trace_level: "none"` is an
`invalid_request`. The fetch door is
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
   stage it serves and for which Language.

For the warehouse, tool descriptions along these lines satisfy the
duty (the spec constrains content, never wording):

- `pilotage_manifest`: "Start here. Returns this server's Pilotage
  manifest: the pick-list Language and what it supports."
- `pilotage_get_guide`: "Learn: the guides for writing pick lists."
- `pilotage_catalog`: "Look up: the live items, bins, and stations pick
  lists can name."
- `validate_picklist`: "Check a pick list (picklist/v1) without side
  effects; returns diagnostics and the execution plan."
- `run_picklist`: "Execute a validated pick list (picklist/v1); returns
  the outcome and trace."
- `trace_picklist`: "Fetch the stored trace of a previous pick-list
  (picklist/v1) run by run_id."

Read together, the descriptions alone reconstruct the map: what to call
first, where to learn, where to look up names, how to check, how to
run, and how to inspect.

## Step 10. Verify

Three checks, from cheapest to strongest:

1. **Shapes**: validate your manifest and every tool response against
   the JSON Schemas in
   [schemas/1.1/pilotage.schema.json](./schemas/1.1/pilotage.schema.json).
   (Every example payload in this guide validates against those schemas;
   yours should too.)
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

   The binding supplies what the vectors leave as `<placeholder>`: for
   the warehouse that means a known-valid pick list, a pick list with an
   unknown item, a way to perturb the catalog to provoke drift, and so
   on, each in your Language. Every vector prints PASS, FAIL, or SKIP
   with a reason; a vector applies only when your Language declares the
   capabilities it requires. See
   [conformance/README.md](./conformance/README.md), including the
   completeness gate worth keeping in your build.

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
