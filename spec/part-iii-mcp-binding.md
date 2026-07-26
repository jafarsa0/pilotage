# Part III: The MCP Binding

**Status: Normative**

This part defines how the abstract Pilotage model specified in Part II is represented over the Model Context Protocol.

It specifies:

- the extension identifier and capability negotiation;
- the Pilotage `_meta` namespace;
- the declaration of program-valued tool arguments;
- manifest discovery;
- the mapping of every Pilotage operation onto MCP primitives;
- reserved loop-tool argument names;
- result-envelope requirements;
- the mapping of Pilotage errors onto MCP and JSON-RPC;
- session, transport, and state semantics;
- complete wire examples;
- binding-specific conformance requirements.

Every requirement in Part II continues to apply unchanged.

This part adds only the concrete MCP representation.

The conventions defined in Part II Section 1 apply throughout this part, including:

- requirements language;
- field-table notation;
- unknown-member handling;
- unknown-value fallbacks;
- opaque-token handling.

This binding supports MCP revision `2025-06-18` and later, including:

- `2025-11-25`;
- the stateless `2026-07-28` revision (a release candidate at the time of
  writing; final scheduled 2026-07-28).

Where the stateless revision changes the applicable mechanism, this part states the difference explicitly.

---

## 1. Extension identity

### 1.1 Identifier

The Pilotage extension identifier is:

```text
io.github.jafarsa0/pilotage
```

This identifier follows the MCP extensions framework identifier form:

```text
vendor-prefix/extension-name
```

The vendor prefix is the reverse-domain form of the author-controlled domain:

```text
jafarsa0.github.io
```

A future revision MAY migrate to a prefix based on a Pilotage-owned domain.

A breaking change that creates a new Pilotage major version (Part II Section 11.1) MUST also create a new extension identifier, as the MCP extensions framework requires for breaking changes.

For example:

```text
io.github.jafarsa0/pilotage-v2
```

> **Compatibility note (informative)**
>
> Earlier Pilotage documents used:
>
> `io.github.jafarsa0.pilotage`
>
> That dotted form is not wire-normative under this binding. The slash form defined above is the only normative identifier.

---

### 1.2 Negotiation

Pilotage is negotiated through MCP's `extensions` capability map.

The map associates an extension identifier with a settings object.

An empty settings object means:

supported, with no additional settings

#### Handshake-based MCP revisions

On MCP revisions that use `initialize`, a Client implementing Pilotage MUST declare:

```json
{
  "capabilities": {
    "extensions": {
      "io.github.jafarsa0/pilotage": {}
    }
  }
}
```

A Server implementing Pilotage MUST declare the same extension in its `initialize` result:

```json
{
  "capabilities": {
    "extensions": {
      "io.github.jafarsa0/pilotage": {}
    }
  }
}
```

The settings object MAY include:

```json
{
  "version": "1.1"
}
```

The manifest's `pilotage` field remains the authoritative version declaration.

Receivers MUST ignore unknown settings members.

#### Stateless MCP revision `2026-07-28`

The stateless revision has no `initialize` handshake.

The Client's extension capability map is carried with each request in:

```text
_meta["io.modelcontextprotocol/clientCapabilities"]
```

This applies to every request, including `tools/list`.

The Server's extension declarations are obtained through `server/discover`.

The Pilotage extension entry has the same form in both locations.

#### Compatibility across revisions

The `extensions` capability is schema-formal only from MCP revision `2026-07-28`.

On revisions `2025-06-18` and `2025-11-25`, it is an additive member that some intermediaries or SDKs may remove.

For that reason, the `pilotage_manifest` tool defined in Section 3.1 is the guaranteed detection mechanism.

A Server that:

1. exposes `pilotage_manifest`; and
2. returns a valid Pilotage manifest

thereby declares Pilotage support.

A Client MUST NOT conclude that Pilotage is unsupported solely because the extension capability declaration is absent when `pilotage_manifest` exists and returns a valid manifest.

---

### 1.3 Graceful degradation

The MCP extensions framework requires that when only one party supports an extension, the supporting party revert to core protocol behavior, or reject the request if the extension is mandatory.

Accordingly:

1. A Server MUST NOT alter the behavior of core MCP operations for a Client that did not declare Pilotage.

2. A Server SHOULD expose Pilotage tools to all Clients because they are ordinary MCP tools and degrade naturally.

3. A Server MAY hide those tools from Clients that did not declare Pilotage.

4. A Client that finds neither:

   - a Pilotage extension declaration; nor
   - a validly answering `pilotage_manifest` tool

   MUST NOT infer Pilotage semantics from tools with similar names.

In particular, it MUST NOT assume:

- Pilotage manifest semantics;
- closed diagnostic sets;
- Pilotage trace rules;
- Pilotage error routing.

---

## 2. The `_meta` namespace

Every Pilotage `_meta` key uses the vendor prefix:

```text
io.github.jafarsa0/
```

This binding defines exactly one Pilotage `_meta` key:

```text
io.github.jafarsa0/pilotage
```

The value associated with this key is an object.

Its allowed members depend on where the key appears, as defined in Sections 3 and 5.

The full reverse-domain key is wire-normative.

A sender MUST NOT emit:

```text
pilotage
```

or any other shorthand key.

A receiver MUST NOT interpret a shorthand key as Pilotage metadata.

---

## 3. Discovery

Part II requires the manifest to be retrievable before any other Pilotage interaction.

This binding provides:

- one mandatory discovery path;
- two optional accelerators;
- the cold-start signposts that lead an uninstructed agent into the loop.

---

### 3.1 Manifest tool

A conformant Server MUST expose an MCP tool named:

```text
pilotage_manifest
```

Its input schema is an object with no required members.

Its result contains the Part II manifest in `structuredContent`, using the result envelope defined in Section 6.

This tool is the guaranteed discovery mechanism because it works across:

- every supported MCP revision;
- every supported transport;
- hosts that do not expose resources to the Model;
- stateless deployments.

---

### 3.2 Optional discovery accelerators

#### Initialize metadata

On an MCP revision with `initialize`, a Server MAY attach the manifest to the initialize result:

```json
{
  "_meta": {
    "io.github.jafarsa0/pilotage": {
      "manifest": {
        "pilotage": "1.1",
        "languages": [ "… one or more Language entries (Part II 5.1) …" ]
      }
    }
  }
}
```

Instead of an inline manifest, the object MAY contain:

```json
{
  "manifest_uri": "pilotage://manifest"
}
```

When the Pilotage `_meta` key is present in this location, at least one of the following MUST be present:

- `manifest`;
- `manifest_uri`.

#### Manifest resource

A Server MAY expose the manifest as an MCP resource.

The RECOMMENDED URI is:

```text
pilotage://manifest
```

The `pilotage://` scheme is a convention, not a requirement.

Any resource URI advertised through `manifest_uri` is valid.

---

### 3.3 Precedence and freshness

When multiple discovery paths are available:

1. an inline manifest in initialize metadata takes precedence for the current Session;
2. otherwise, the Client calls `pilotage_manifest`.

When both an inline manifest and the manifest tool are used and their contents differ, the result from `pilotage_manifest` is authoritative because it is newer.

#### Manifest changes during a Session

When the Server changes its manifest during a Session and declares `tools.listChanged`, it SHOULD emit:

```text
notifications/tools/list_changed
```

Manifest changes that affect the tool surface coincide with a tool-list change.

A Client receiving that notification SHOULD repeat discovery before its next Pilotage interaction.

#### Stateless deployments

On MCP revision `2026-07-28`:

- the initialize accelerator does not exist;
- notifications may not be deliverable.

Discovery therefore becomes:

```text
server/discover
→ tools/list
→ pilotage_manifest
```

The Server MAY attach Pilotage discovery metadata to `server/discover`.

That metadata has the same precedence as initialize metadata.

Without notifications, a Client SHOULD rediscover:

- on a Host-defined policy interval;
- after `unknown_baseline`;
- after `catalog_drift`;
- after `not_found` for a name the Client believed to be current.

---

### 3.4 Cold start

Discovery is designed for the agent that arrives with nothing.

The baseline this binding assumes:

- no client-side instructions about this Server;
- no prior knowledge of its Languages;
- only the connection, the user's request, and whatever the host relays
  of the standard surfaces (at minimum, the tool list).

For that agent, the trail into the loop is carried by three signposts.

In this section, a tool's *stage* is the Section 8.2 loop operation it
binds.

#### The welcome text

On an MCP revision with `initialize`, whenever the Pilotage tools are
exposed to the Client (Section 1.3), the Server MUST include, in the
initialize result's `instructions` field, text that:

- names Pilotage (the extension identifier or the word "Pilotage"); and
- directs the agent to call `pilotage_manifest` first.

On MCP revision `2026-07-28`, the same duty applies to the server
description carried by `server/discover` when that revision provides a
server-description text surface; when it does not, the entry-point
description below carries the whole welcome duty.

#### The entry-point description

The `pilotage_manifest` tool description MUST identify the tool as the
starting point for using this Server's program Languages, sufficient
for an agent reading `tools/list` alone to conclude: call this first.

This signpost is the load-bearing one. Hosts differ in whether they show
`instructions` or `_meta` to the Model; every host shows tool
descriptions.

#### The stage descriptions

The description of `pilotage_get_guide` MUST state that it serves the
learn stage: the guides.

When any Language declares `catalog`, the description of
`pilotage_catalog` MUST state that it serves the lookup stage: the
catalog.

`pilotage_manifest` carries the entry-point duty above and no stage duty.

The description of each declared loop tool MUST state:

- which stage it serves (validate, execute, or trace fetch); and
- the Language name(s) it serves.

Loop-tool names are chosen per Language, so for an uninstructed agent the
description is the only reliable signal of what a loop tool is.

Read together, the tool descriptions alone reconstruct the map: what to
call first, where to learn, where to look up names, how to check, how to
run, and how to inspect.

#### Content, not wording

These rules constrain what the signposts must communicate, never their
wording. A Server keeps its own voice.

Signposts are Server claims. They carry the trust status defined in
Part II Section 9.

---

## 4. Tool surface

Pilotage uses two categories of ordinary MCP tools.

#### Fixed-name access tools

The binding defines these names:

```text
pilotage_manifest
pilotage_get_guide
pilotage_catalog
```

#### Loop tools

Each Language selects the tool names used for:

- `validate`;
- `execute`;
- `trace`: present iff the Engine supports fetching stored traces.

Those names are declared in the Language entry's `loop` object.

All Pilotage tools:

- appear in `tools/list`;
- are invoked through `tools/call`;
- return `CallToolResult`.

---

### Manifest reference-field binding

In this MCP binding:

- a Language entry's `guides` field MUST contain:

  `pilotage_get_guide`

- a Language entry's `catalog` field MUST contain:

  `pilotage_catalog`

The operative access path is always the tool, with the Language selected through the `language` argument.

A Server that also exposes optional resource surfaces MAY include:

- `guides_resource`;
- `catalog_resource`.

Each contains the resource URI of the corresponding index.

A Client MUST NOT assign any other MCP-binding meaning to the manifest's `guides`, `catalog`, `guides_resource`, or `catalog_resource` fields.

---

### 4.1 `pilotage_get_guide`

This tool binds the abstract `learn` operation.

#### Input schema

```json
{
  "type": "object",
  "properties": {
    "language": { "type": "string" },
    "id": { "type": "string" },
    "topic": { "type": "string" }
  },
  "required": ["language"]
}
```

The `language` member is REQUIRED, including on a Server exposing only one Language.

#### Index form

When `id` is absent, the tool performs the guide-index form.

`structuredContent` contains:

```json
{
  "guides": []
}
```

Each entry contains every Part II Section 5.2 guide field except the body.

#### Fetch form

When `id` is supplied, `structuredContent` contains:

```json
{
  "guide": {
    "id": "guide-id",
    "body": "guide content"
  }
}
```

The returned guide contains:

- every Part II guide metadata field;
- `body`.

`body` is a string in the guide's declared `format` (Part II Section 5.2).

The `body` field exists only in the fetch form.

#### Topic form

When:

- `id` is supplied;
- `topic` is supplied;
- `guides.topic_fetch` is declared,

the response uses the same guide shape, but `body` contains only the requested topic.

#### Errors

An unknown:

- `language`;
- `id`;
- `topic`

is a request error under Section 7.

---

### 4.2 `pilotage_catalog`

This tool binds the abstract `lookup` operation.

A Server MUST expose it exactly when at least one Language declares `catalog`.

#### Input schema

```json
{
  "type": "object",
  "properties": {
    "language": { "type": "string" },
    "verb": { "type": "string", "enum": ["list", "get", "changed_since"] },
    "kind": { "type": "string" },
    "tag": { "type": "string" },
    "q": { "type": "string" },
    "cursor": { "type": "string" },
    "limit": { "type": "integer", "minimum": 1 },
    "id": { "type": "string" },
    "catalog_version": { "type": "string" }
  },
  "required": ["language", "verb"]
}
```

#### `list`

The `list` verb may use:

- `kind`;
- `tag`;
- `cursor`;
- `limit`;
- `q`, when `catalog.search` is declared.

The Server MAY cap `limit`.

#### `get`

The `get` verb requires `id`.

#### `changed_since`

The `changed_since` verb:

- requires `catalog_version`;
- is accepted only when `catalog.changed_since` is declared.

#### Invalid combinations

Supplying:

- a member not applicable to the selected verb;
- a verb not enabled by the declared sub-features

is a request error.

Responses carry the Part II Section 6.3 shapes in `structuredContent`.

---

### 4.3 Loop tools

Each Language entry's `loop` object declares the Server-selected names of its loop tools.

Example:

```json
{
  "loop": {
    "validate": "validate_workflow",
    "execute": "run_workflow",
    "trace": "trace_run"
  }
}
```

The following rules apply.

#### Tool existence and capability consistency

Every declared name MUST exist in `tools/list`.

The set of declared names MUST correspond exactly to the effective capability map.

There is no loop member for `plan`.

The plan is returned by the validate tool.

The `trace` member names the trace-fetch tool.

One trace, two doors: it rides the execute response; if the run was stored, the same trace can be fetched later by `run_id` through this tool.

#### Shared loop tools

Two Languages MAY share one loop tool only by using distinct program-bearing argument names.

Those argument-to-Language mappings are declared through the `languages` array defined in Section 5.

For a shared loop tool, a request containing:

- more than one program-bearing member; or
- no program-bearing member

is an `invalid_request`.

This rule applies to both validate and execute tools.

No other loop-tool sharing mechanism is permitted.

When this mechanism is not used, each Language names its own loop tools.

---

### 4.4 Reserved argument names

Loop tools carry the abstract Part II request members as MCP tool arguments.

The following names are reserved.

| Reserved name | Tool | Abstract meaning |
|---|---|---|
| Language-declared argument | validate, execute | Inline `program` |
| `program_ref` | execute | Promoted program reference |
| `input` | execute | Program input |
| `context` | validate, execute | Validation or execution context |
| `trace_level` | execute, trace fetch | On execute: `"none"`, `"summary"`, or `"full"`. On trace fetch: `"summary"` or `"full"` only |
| `expected_catalog_version` | execute | Catalog snapshot token |
| `idempotency_key` | execute | Idempotency key, where declared |
| `test_run` | execute | Test-run selector, where declared |
| `mode` | execute | `"immediate"` or `"deploy"` for a Language with `execution: "both"` |
| `store` | execute | Run-record retention override: `true` requires the record be retained for later trace fetch; `false` forbids retention beyond the response; absent defers to the declared retention policy |
| `run_id` | trace fetch | Run identifier |
| `question` | trace fetch | Narration question, where `trace_fetch` declares `narrate`; supplying it otherwise is a request error |

#### `mode`

A Language with:

```json
{
  "execution": "both"
}
```

MUST accept `mode`.

For that Language, `mode` is REQUIRED.

Its recognized values are:

- `"immediate"`;
- `"deploy"`.

The following are `invalid_request` conditions:

- absent `mode` where `execution` is `"both"`;
- an unrecognized `mode`;
- supplying `mode` for a Language that is not `"both"`.

#### Reserved-name rules

1. When a loop tool supports one of these members, it MUST use the reserved name.
2. The member MUST appear in the tool's `inputSchema`.
3. A Server MUST NOT use a reserved name for another purpose on a loop tool.
4. A generic Client MUST be able to form every loop request from:
   - the manifest;
   - the tool's `inputSchema`;
   - the Section 5 program declaration;
   - this reserved-name table.
5. Every execute tool MUST declare `trace_level`.
6. An execute tool for a catalog-bearing Language MUST declare `expected_catalog_version`.
7. Every trace-fetch tool MUST declare `run_id` and mark it required.
8. A validate tool serving one Language MUST mark its program-bearing argument required.
9. A shared validate tool MUST mark none of its program-bearing arguments required; selection is enforced after schema validation.
10. Supplying unsupported `context` is not an `invalid_request`. Part II requires a `context_binding` diagnostic, so the schema MUST allow the request to reach Pilotage validation.

---

### 4.5 Tool annotations

Pilotage tools SHOULD carry MCP annotations consistent with their semantics.

The following tools SHOULD declare:

```json
{
  "readOnlyHint": true
}
```

- `pilotage_manifest`;
- `pilotage_get_guide`;
- `pilotage_catalog`;
- validate tools;
- trace-fetch tools.

An execute tool SHOULD declare annotations reflecting the maximum effect expressible by its Language.

For example, it should declare:

```json
{
  "destructiveHint": true
}
```

when any catalog entry carries `destructive: true`.

MCP annotations remain unverified Server claims.

They have the trust status defined in Part II Section 9.

The Pilotage Host risk gate MUST use `risk_hints`, not MCP tool annotations.

---

### 4.6 Loop-tool schema authoring

The Pilotage error-channel rules take precedence over eager JSON Schema rejection.

Loop-tool `inputSchema` definitions MUST therefore remain permissive.

#### Unknown members and value constraints

A loop-tool schema:

- MUST NOT set `additionalProperties: false`;
- MUST NOT constrain reserved members beyond their JSON type.

For example:

```json
{
  "trace_level": {
    "type": "string"
  }
}
```

is valid.

An enum restricting the field to known trace levels is not valid for a conformant loop-tool schema.

This ensures that value and eligibility failures are routed through Pilotage rather than being intercepted as carrier-level schema failures.

Examples include:

- unknown `trace_level`;
- unsupported `test_run`;
- unsupported `mode`;
- `store: true` on an Engine that declares `"retention": "none"`;
- both or neither runnable;
- a member supplied outside the selected capability.

#### Runnable selection

An execute tool's schema MUST NOT mark either:

- the program-bearing argument;
- `program_ref`

as required.

Runnable selection is enforced after schema validation.

An execute tool supporting promoted programs MUST still declare `program_ref` in `properties`.

#### Program-bearing schema

The program-bearing argument SHOULD use a permissive schema, such as:

```json
{}
```

or a broad type constraint.

Invalid program content MUST be reported through diagnostics, not as a tool-schema failure.

#### Structural versus semantic faults

A Server MUST NOT return a protocol error for a loop-tool value or eligibility fault.

Only structural faults may be expressed by the schema. These are exactly:

- a missing schema-required member;
- an incorrect JSON type.

Those faults are carrier-level.

---

## 5. Program-valued tool declaration

Every MCP tool accepting a Program MUST carry a Pilotage declaration in its `tools/list` entry.

This includes every validate and execute loop tool.

Example:

```json
{
  "name": "run_workflow",
  "inputSchema": {
    "type": "object",
    "properties": {
      "workflow": {},
      "program_ref": { "type": "string" },
      "input": { "type": "object" },
      "trace_level": { "type": "string" },
      "expected_catalog_version": { "type": "string" }
    }
  },
  "_meta": {
    "io.github.jafarsa0/pilotage": {
      "argument": "workflow",
      "language": "workflow/v1"
    }
  }
}
```

The declaration uses:

```text
_meta["io.github.jafarsa0/pilotage"]
```

#### `argument`

`argument` names the tool argument containing the Program.

The wire-level program argument does not have a universal fixed name.

The Program always appears in the argument declared by the tool.

#### `language`

`language` contains the corresponding Language identifier from the manifest.

#### Multi-Language tool

A tool accepting Programs from more than one Language MUST use:

```json
{
  "languages": [
    { "argument": "workflow", "language": "workflow/v1" },
    { "argument": "query", "language": "sql/postgres-15" }
  ]
}
```

Every `argument` value in this array MUST be distinct.

A Client MUST read this declaration only from the registered full `_meta` key.

---

## 6. Result envelope

Every Pilotage tool result is an MCP `CallToolResult`.

It contains the following fields.

#### `structuredContent`

`structuredContent` is REQUIRED.

It contains the Part II response object for the operation, exactly as defined in Part II Sections 5–6.

This field is the machine-readable Pilotage contract.

#### `content`

`content` is RECOMMENDED.

It SHOULD contain one text block carrying either:

- serialized JSON equivalent to `structuredContent`; or
- a short human-readable summary.

Examples:

```text
valid: max risk safe
```

```text
invalid: 2 diagnostics
```

The JSON form supports MCP hosts that expose only `content` to the Model.

A Pilotage-aware Client MUST read the machine contract from `structuredContent`.

It MUST NOT parse a human-readable summary to recover protocol semantics.

#### `isError`

The `isError` field follows Section 7.

A validation result with:

```json
{
  "valid": false
}
```

is a successful tool result.

A Run outcome with:

```json
{
  "ok": false
}
```

is also a successful tool result.

For both, `isError` MUST be `false`.

#### Output schemas

Servers SHOULD declare an MCP `outputSchema` for every Pilotage tool.

Because MCP requires `structuredContent` to satisfy the declared output schema even for request-error results, the schema MUST accept every possible `structuredContent` shape produced by that tool.

It therefore MUST be an `anyOf` union containing:

- every successful Part II response shape;
- every operation-specific response shape;
- the Section 7.2 request-error shape.

For a multi-verb tool such as `pilotage_catalog`, the union MUST include all verb response shapes.

Full JSON Schema files for every shape, in this unioned form, are a deliverable of this specification.

---

## 7. Error mapping

This section maps the four Pilotage error channels defined in Part II onto MCP.

---

### 7.1 Channel mapping

| Part II channel | MCP representation |
|---|---|
| Carrier protocol error | JSON-RPC error response |
| Request error | `CallToolResult` with `isError: true` |
| Diagnostics | `CallToolResult` with `isError: false` |
| Outcome | `CallToolResult` with `isError: false` |

#### Carrier protocol errors

Carrier errors include JSON-RPC responses such as:

| Code | Meaning |
|---|---|
| `-32700` | Parse error |
| `-32600` | Invalid request |
| `-32601` | Method not found |
| `-32602` | Unknown tool or invalid `CallToolRequest` envelope |

Any JSON-RPC error response, including codes not listed here such as `-32603` (Internal error), is a carrier protocol error.

> Revision note (informative): MCP `2025-06-18` listed invalid arguments
> under protocol errors; `2025-11-25` narrowed protocol errors to the
> envelope level. The deterministic routing below is consistent with both.

#### Request errors

A request error is returned as:

```json
{
  "isError": true,
  "structuredContent": {
    "error": {}
  }
}
```

#### Diagnostics

Program findings appear in `structuredContent` with:

```json
{
  "isError": false
}
```

#### Outcomes

Run outcomes also appear in `structuredContent` with:

```json
{
  "isError": false
}
```

---

#### Deterministic schema-fault routing

Pilotage schemas are constructed so each fault class maps to exactly one channel.

##### Structural faults

The only schema-level faults allowed for conformant Pilotage tools are structural:

- a required member is missing;
- a member has the wrong JSON type.

These are carrier-level faults.

For the fixed access tools, their binding-defined schemas are intentionally strict for structural routing.

For example:

- `language` is required;
- `verb` is required;
- `verb` is enumerated.

A schema violation against those access tools is carrier-level.

##### Value and eligibility faults

The following travel through Pilotage request-error or diagnostic channels rather than JSON-RPC:

- unknown `trace_level`;
- unsupported `test_run`;
- unsupported `mode`;
- `store: true` on an Engine that retains nothing;
- an argument inapplicable to the chosen verb;
- an argument requiring an undeclared sub-feature;
- both-or-neither runnable;
- program invalidity;
- context-binding failure.

This routing is possible because Section 4.6 prohibits loop-tool schemas from enforcing those value constraints.

##### Mandatory prohibitions

A Server MUST NOT report:

- an invalid program;
- a failed Run

through:

- `isError: true`;
- a JSON-RPC error.

A Client MUST NOT treat:

- `valid: false`;
- `ok: false`

as a transport failure.

---

### 7.2 Request-error shape

A request error's `structuredContent` contains:

```json
{
  "error": {
    "kind": "not_found",
    "message": "unknown run: it may have expired"
  }
}
```

The `kind` field belongs to the following closed set.

| Kind | Used for |
|---|---|
| `not_found` | Unknown guide, topic, catalog entry, Language, promoted reference, or Run, including expired and non-retained Runs; includes unauthorized objects required to be indistinguishable from nonexistent ones |
| `invalid_request` | Invalid runnable selection, unsupported `test_run` or `mode`, unknown `trace_level`, or a member inapplicable to the verb or declared capabilities |
| `unknown_baseline` | The Server cannot calculate `changed_since` from the supplied token |
| `idempotency_conflict` | The same idempotency key is reused with different runnable or input |
| `bounds_exceeded` | A validation resource bound was exceeded |
| `unsupported` | `store: true` supplied to an Engine that declares `"retention": "none"`; the Server MUST reject, never silently ignore |
| `internal` | Validator, Engine, or Server malfunction |

`message` is Server-authored prose (trust status per Part II Section 9).

A Client MUST branch on `kind`, not on `message`.

A minor revision MAY add request-error kinds, under Part II's unknown-value convention.

A Client receiving an unrecognized kind MUST treat it as:

```text
internal
```

#### Operation-mandated sibling fields

When Part II requires additional data on a request error, that data appears as a top-level sibling of `error`.

Example: a failed catalog `get` still carries `catalog_version`.

```json
{
  "error": {
    "kind": "not_found",
    "message": "unknown entry"
  },
  "catalog_version": "cv_9f2c41ab07de"
}
```

#### Whole-result indistinguishability

Using one `not_found` kind is necessary but not sufficient for the indistinguishability Part II requires (Sections 6.6 and 10.3).

Where Part II requires two conditions to be indistinguishable, the entire result MUST be indistinguishable, including:

- `kind`;
- `message`;
- `content`;
- every other field;
- observable response structure.

---

## 8. Sessions, transports, and state

### 8.1 Session binding

The Part II Session maps onto MCP as follows.

#### stdio on handshake-based revisions

For stdio, this binding defines the Session as the lifetime of the Server process serving the connection.

This is a Pilotage binding definition because MCP itself defines explicit sessions only for Streamable HTTP.

#### Streamable HTTP

The Session is the lifetime of the:

```text
Mcp-Session-Id
```

session.

#### Stateless revision `2026-07-28`

A stateless deployment has no Session.

A stateless Server MUST NOT declare:

```json
{
  "retention": "session"
}
```

It MUST instead declare:

- an ISO 8601 duration; or
- `"none"`.

---

### 8.2 Transport behavior

Pilotage adds no transport requirement beyond MCP itself.

The complete loop operates through ordinary request-response `tools/call` operations:

```text
discover
learn
lookup
validate
execute
trace
```

These bind the layered loop (manifest → guides → catalog → validate → plan → execute → trace) with the agent at the center deciding what and when to call; the loop is a hub, not a pipeline.

No Server-initiated stream is required.

Long-running execution is outside the scope of this version.

Until a future minor revision aligns execute with the MCP Tasks extension (`io.modelcontextprotocol/tasks`), execute remains one bounded request-response operation.

The Server MUST bound it under Part II Section 10.1.

---

### 8.3 Optional resource surface

A Server MAY expose guides and catalogs as MCP resources in addition to the required tools.

Recommended URI forms are:

```text
pilotage://guides/{language}
pilotage://guides/{language}/{id}
pilotage://catalog/{language}
```

The Language identifier is percent-encoded as one RFC 3986 path segment.

In particular, `/` MUST become `%2F`.

Example:

```text
pilotage://guides/workflow%2Fv1
```

When resources are exposed:

1. their content MUST equal the corresponding tool response;
2. the Server MAY emit:
   - `notifications/resources/list_changed`;
   - `notifications/resources/updated`;
3. `resources/updated` is applicable only when:
   - the Client subscribed through `resources/subscribe`;
   - the Server declared `resources.subscribe`;
4. `catalog_version` remains the authoritative drift mechanism;
5. the tools remain REQUIRED.

Resources never replace the tools because an MCP Host is not required to expose resources to the Model.

---

### 8.4 Authorization identity

The "requesting Client's authority" defined in Part II binds to the identity established by the MCP connection.

For Streamable HTTP, this is the connection's authorization context, such as OAuth identity.

For stdio, it is the ambient identity of the deployment.

How an Engine maps that identity onto:

- users;
- tenants;
- workspaces;
- internal authorization models

is Engine-specific and outside the scope of Pilotage.

---

## 9. Wire examples

**Status: Informative**

The following examples show complete JSON-RPC 2.0 messages.

Values are illustrative.

---

### 9.1 Initialize with negotiation and inline manifest

Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "extensions": {
        "io.github.jafarsa0/pilotage": {}
      }
    },
    "clientInfo": { "name": "example-agent", "version": "1.0" }
  }
}
```

Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "tools": {},
      "resources": {},
      "extensions": {
        "io.github.jafarsa0/pilotage": { "version": "1.1" }
      }
    },
    "serverInfo": { "name": "example-rules-engine", "version": "3.2" },
    "_meta": {
      "io.github.jafarsa0/pilotage": {
        "manifest": {
          "pilotage": "1.1",
          "languages": [
            {
              "name": "workflow/v1",
              "title": "Workflow documents",
              "guides": "pilotage_get_guide",
              "catalog": "pilotage_catalog",
              "guides_resource": "pilotage://guides/workflow%2Fv1",
              "catalog_resource": "pilotage://catalog/workflow%2Fv1",
              "loop": {
                "validate": "validate_workflow",
                "execute": "run_workflow",
                "trace": "trace_run"
              },
              "capabilities": {
                "guides": true,
                "catalog": { "search": true },
                "validate": true,
                "plan": true,
                "execute": true,
                "trace_fetch": true
              },
              "locator": "json-pointer",
              "execution": "immediate",
              "trace": "full",
              "retention": "PT1H"
            }
          ]
        }
      }
    }
  }
}
```

---

### 9.2 Execute tool in `tools/list`

```json
{
  "name": "run_workflow",
  "description": "Execute a workflow document or a promoted workflow.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "workflow": { "type": "object" },
      "program_ref": { "type": "string" },
      "input": { "type": "object" },
      "trace_level": { "type": "string" },
      "expected_catalog_version": { "type": "string" }
    }
  },
  "annotations": { "readOnlyHint": false, "destructiveHint": true },
  "_meta": {
    "io.github.jafarsa0/pilotage": {
      "argument": "workflow",
      "language": "workflow/v1"
    }
  }
}
```

---

### 9.3 Invalid program returned as diagnostics

Request

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "validate_workflow",
    "arguments": {
      "workflow": {
        "steps": [
          { "id": "profile", "kind": "call", "capability": "cap_read_user_profil" }
        ]
      }
    }
  }
}
```

Response

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "content": [
      { "type": "text", "text": "invalid: 1 diagnostic" }
    ],
    "structuredContent": {
      "valid": false,
      "diagnostics": [
        {
          "severity": "error",
          "code": "unknown_capability",
          "path": "/steps/0/capability",
          "message": "unknown capability 'cap_read_user_profil'",
          "hint": "close match: cap_read_user_profile"
        }
      ],
      "catalog_version": "cv_9f2c41ab07de"
    },
    "isError": false
  }
}
```

The invalid program is not an MCP tool error.

---

### 9.4 Successful execution with full trace

Request

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "run_workflow",
    "arguments": {
      "workflow": {
        "steps": [
          {
            "id": "profile",
            "kind": "call",
            "capability": "cap_read_user_profile",
            "with": { "user_id": "$.input.userId" }
          }
        ],
        "output": { "name": "$.steps.profile.output.name" }
      },
      "input": { "userId": "42" },
      "trace_level": "full",
      "expected_catalog_version": "cv_9f2c41ab07de"
    }
  }
}
```

Response

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "result": {
    "content": [
      { "type": "text", "text": "success" }
    ],
    "structuredContent": {
      "run_id": "run_7d3f0a9c21be",
      "outcome": { "ok": true, "status": "success", "error": null },
      "output": { "name": "Amira Hassan" },
      "trace": {
        "run_id": "run_7d3f0a9c21be",
        "level": "full",
        "steps": [
          {
            "id": "profile",
            "calls": "cap_read_user_profile",
            "input": { "user_id": "42" },
            "output": { "name": "Amira Hassan", "tier": "gold" },
            "outcome": { "ok": true, "status": "success", "error": null },
            "t_ms": 84
          }
        ]
      }
    },
    "isError": false
  }
}
```

---

### 9.5 Request error for unknown Run

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "result": {
    "content": [
      { "type": "text", "text": "unknown run" }
    ],
    "structuredContent": {
      "error": {
        "kind": "not_found",
        "message": "unknown run: it may have expired"
      }
    },
    "isError": true
  }
}
```

---

### 9.6 Carrier error for unknown tool

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "error": {
    "code": -32602,
    "message": "Unknown tool: validate_workflw"
  }
}
```

---

## 10. Binding conformance

### 10.1 Server conformance

In addition to satisfying Part II Section 12.1, a conformant MCP Server MUST satisfy all of the following requirements.

1. **Extension declaration**
   It declares the Pilotage extension identifier on every supported revision path and follows the graceful-degradation rules.

2. **Fixed access tools**
   It exposes:

   - `pilotage_manifest`;
   - `pilotage_get_guide`;
   - `pilotage_catalog` when any Language declares `catalog`.

   Those tools use the Section 4 schemas.

3. **Manifest references**
   It binds manifest guide and catalog references to the fixed tool names defined in Section 4.

4. **Loop tools**
   It declares loop tools consistently with each Language's effective capability map.

5. **Reserved names**
   It uses the reserved argument names and satisfies all declaration obligations in Section 4.4.

6. **Permissive loop schemas**
   It authors loop-tool schemas according to Section 4.6.

7. **Program declaration**
   Every program-valued tool carries the Section 5 declaration under the full registered `_meta` key.

8. **Result envelope**
   Every Pilotage tool returns the operation result in `structuredContent`.

9. **Error mapping**
   It uses `isError` according to Sections 6 and 7 and emits only the closed request-error kinds defined in Section 7.2.

10. **Session binding**
    It binds retention to the MCP Session according to Section 8.1.

11. **Stateless restriction**
    It does not declare `"session"` retention on a stateless deployment.

12. **Resource equality**
    When resources are exposed, their content equals the corresponding tool responses.

13. **Cold-start signposts**
    It carries the Section 3.4 signposts: the welcome text, the entry-point description, and the stage descriptions.

---

### 10.2 Client conformance

In addition to satisfying Part II Section 12.2, a conformant MCP Client MUST satisfy all of the following requirements.

1. **Capability declaration**
   It declares the Pilotage extension in its MCP capability map.

   On stateless revisions, it includes that declaration in the required per-request metadata.

2. **Discovery precedence**
   It follows the discovery and precedence rules in Section 3.

3. **Rediscovery**
   It rediscovers after `tools/list_changed` and follows the stateless freshness recommendations where applicable.

4. **Request construction**
   It constructs loop requests using:

   - the manifest;
   - the tool's `inputSchema`;
   - the program-valued tool declaration;
   - the reserved-name table.

   It MUST NOT guess argument names.

5. **Machine contract**
   It reads Pilotage results from `structuredContent`.

   It MUST NOT derive protocol semantics by parsing `content`.

6. **Error routing**
   It applies Section 7 exactly.

   In particular:

   - `isError: true` is not a program finding;
   - `valid: false` is not a transport failure;
   - `ok: false` is not a transport failure.

7. **Unknown request-error kind**
   It treats an unrecognized request-error `kind` as:

   ```text
   internal
   ```
