# Part II: The Abstract Model

**Status: Normative**

This part defines the Pilotage abstract model independently of any carrier protocol. It specifies:

- the participating actors and their responsibilities;
- the terminology used throughout the specification;
- the core data structures;
- the available capabilities and operations;
- the semantics of the standard client loop;
- the error and outcome model;
- the trust and security model;
- versioning and conformance requirements.

Part III, **The MCP Binding**, defines how this model is represented over MCP, including capability negotiation, discovery addresses, message envelopes, and wire encodings.

Part I is informative and imposes no requirements.

---

## 1. Conventions and requirements language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and **OPTIONAL** in this specification are to be interpreted as described in BCP 14, RFC 2119, and RFC 8174 when, and only when, they appear in uppercase as shown here.

The following conventions apply throughout Parts II and III.

### 1.1 Field requirements

Each data structure is defined using a field table.

The **Req** column uses:

- **M**: the field MUST be present;
- **O**: the field MAY be present.

These abbreviations are exact synonyms for **MUST** and **MAY**. They carry no additional meaning.

### 1.2 Unknown members

A receiver MUST ignore members it does not recognize in any Pilotage data structure.

This rule allows a minor version of Pilotage to add fields without breaking implementations that conform to an earlier minor version.

### 1.3 Unknown enumerated values

This convention applies to values received by a Client from a Server. Handling of unrecognized values sent in requests is defined separately by each operation.

Where this specification defines a closed set for a Server-emitted field, a Client that receives an unrecognized value MUST NOT fail the entire interaction. It MUST instead apply the following conservative fallback:

| Field or context | Required fallback |
|---|---|
| Capability declaration | Treat the capability entry as undeclared. |
| A Language-entry field that conditions a capability, including `locator`, `execution`, `trace`, or `retention` | Treat the conditioned capability as undeclared for that Language. |
| `trace_subprogram` | Treat the value as `"opaque"`. |
| `promotion_authority` | Treat execution of the promoted program as requiring approval under Section 7.3. |
| Guide `level` | Treat the guide as `"reference"`. |
| Catalog change value | Treat the change as `"modified"`. |
| Unrecognized outcome status with `ok: false` | Treat the outcome as `"partial"`, including the possibility that side effects occurred. |

These fallbacks allow later minor versions to introduce additional reserved values without making earlier Clients unsafe or incompatible.

### 1.4 Absent and empty arrays

For every OPTIONAL array-valued field, an absent field and an empty array have identical meaning.

Receivers MUST treat them identically. Senders MAY use either representation.

### 1.5 Engine-defined value sets

A field marked as an **engine-defined set** has a value set chosen by the Engine.

That set:

- MUST be finite;
- MUST remain fixed for a particular Language version;
- MUST be treated as closed;
- MUST be enumerated in the Language's closed-sets guide defined in Section 5.2.

This convention applies only to value-set fields such as `kind`, `risk`, and status fields.

Fields containing unrestricted engine-specific data, such as `stats` and `tags`, are marked **engine-specific, informative** and are not subject to the closed-set requirement.

### 1.6 Opaque values

Where a value is defined as **opaque**, a Client MUST NOT parse it, derive meaning from its internal representation, or depend on its format.

The Client MUST use the value only as a token and compare it only for equality.

---

## 2. Actors and roles

Pilotage distinguishes between the party that provides a Language and the components that consume it.

| Term | Definition |
|---|---|
| **Server** | The endpoint that declares the Pilotage extension and exposes one or more Languages. The Server is the conformance-bearing party on the providing side. Every providing-side requirement in this specification applies to the Server. |
| **Engine** | The system that parses, validates, and executes programs in a Language. The Engine MAY be implemented directly by the Server or MAY be a system behind it. One Server MAY front multiple Engines. A requirement addressed to the Engine binds the Server that exposes that Engine. |
| **Client** | The consuming side as a whole, consisting of the Host and the Model acting together. Conformance is assessed against the Client as a unit under Section 12.2. |
| **Host** | The non-model software component of the Client. The Host is responsible for policy enforcement, including the risk gate defined in Section 7.3, and for transmitting execute requests. These responsibilities MUST NOT be delegated to the Model. |
| **Model** | The component of the Client that authors and revises programs and evaluates their results against the user's task. |
| **Surface** | An informal collective term for everything exposed by a Server through Pilotage, including its manifest, guides, catalog, and loop operations. This term introduces no requirements of its own. |

Normative duties in this specification are assigned only to the following defined parties:

- Server;
- Engine;
- Client;
- Host;
- Model.

The term **Surface** is descriptive only.

---

## 3. Definitions

### 3.1 Language

A **Language** is a grammar for programs that satisfies all of the following conditions.

#### Finite and documented

Its syntax and semantics are finite and documented in the guides defined in Section 5.2.

#### Enumerable failure conditions

The ways in which a program can be invalid can be represented by a finite, closed set of diagnostic codes as defined in Section 5.5.

#### Versioned

The Language has a version identifier, and its grammar is fixed for that version.

A grammar that cannot satisfy these requirements is outside the scope of full Pilotage conformance.

For example, an unconstrained general-purpose programming environment may expose an effectively unbounded universe of packages, files, network resources, and runtime behavior. Such an environment cannot ordinarily provide a finite grammar and enumerable failure model.

A Server MAY expose a bounded subset of such an environment as a Language, provided that the subset independently satisfies all three requirements.

---

### 3.2 Program, Record, and the applicability test

A **Program** is a value supplied as a tool argument whose meaning satisfies at least one of the following tests.

#### A. Environment-bound names

The value refers to names resolved against live Server state, such as:

- tables;
- fields;
- entities;
- capabilities;
- devices;
- workflows;
- other Server-owned objects.

Its validity can therefore change while the program text remains unchanged.

#### B. Execution semantics

The value expresses behavior through constructs such as:

- steps;
- ordering;
- dependencies;
- branching;
- loops;
- data flow between parts.

#### C. Step-wise observable behavior

Execution produces intermediate events or results that are meaningful to observe and can therefore be represented in a trace.

A value for which all three answers are **no** is a **Record**.

A Record is adequately described by its structural schema, and Pilotage does not apply to it.

#### Catalog applicability

Test A also determines whether the Language requires a catalog.

A Language has **environment-bound names** if and only if the validity of its programs depends on runtime Server state rather than on the grammar alone.

A Server:

- MUST declare the `catalog` capability for every Language with environment-bound names;
- SHOULD NOT declare `catalog` for a pure Language whose validity depends only on its grammar.

A catalog for a pure Language would normally be empty and would carry no useful meaning.

---

### 3.3 Language identifiers

A Language identifier is a string in the following form:

```text
family/version
```

Examples include:

```text
workflow/v1
sql/postgres-15
automation/1
```

The `family` component identifies the grammar family. The `version` component distinguishes incompatible revisions of that grammar.

Language identifiers are **Server-scoped**.

A Client MUST NOT assume that the same Language identifier exposed by two different Servers refers to the same grammar or semantics.

A Client that caches guides MUST key each cached guide by the complete tuple:

```text
(Server, Language identifier, guide version)
```

The Client MUST NOT key a guide cache by Language identifier alone.

---

### 3.4 Program step identifiers

A **program step identifier** is an identifier assigned by a program to one of its steps, where the Language includes such a construct.

Program step identifiers MUST NOT contain either of the following characters:

```text
#
/
```

These characters are reserved for trace identity under Section 5.8.2.

A Server MUST reject a program containing either reserved character in a program step identifier and MUST report the violation through a diagnostic.

For a Language whose grammar does not define program step identifiers, such as a Language represented by a SQL string, the Engine MUST generate deterministic identifiers.

The identifier-generation scheme:

- MUST be documented in the Language's closed-sets guide;
- MUST produce identical identifiers in the validation plan and execution
  trace for the same program text at the same `catalog_version`.

---

### 3.5 Promoted program and program reference

A **promoted program** is a program stored by the Server so that it may later be invoked by reference.

A **program reference**, represented as `program_ref`, is an identifier that resolves through the catalog to a promoted program.

Requirements governing promoted programs and their references are defined in:

- Section 5.4;
- Section 6.5.2;
- Section 10.4.

---

### 3.6 Run

A **Run** is one execute request accepted for processing by the Server.

Every Run is identified by a `run_id`, regardless of whether execution begins.

A Run is classified as one of the following:

- **started Run**: execution began;
- **refused Run**: the request was accepted for processing but refused before execution.

A Run is refused when its outcome is one of:

- `validation_error`;
- `catalog_drift`;
- `promotion_drift`.

The rules governing later retrieval of a Run through the trace fetch door are defined in Section 6.6.

---

### 3.7 Session

A **Session** is the association between one Client and one Server over the carrier protocol.

The concrete boundaries of a Session are defined by the applicable binding. The MCP-specific boundary is defined in Part III.

The retention value `"session"` defined in Section 6.6 refers to this Session definition.

---

## 4. Capabilities and composition

Pilotage is composable.

A Server declares, for each Language, only the capabilities that are meaningful and genuinely supported for that Language.

A Language is not required to expose the complete Pilotage capability set. However, every declaration is subject to the minimum capability floor, dependency rules, and consistency requirements defined below.

### 4.1 Capability set

| Capability | Meaning | Dependency |
|---|---|---|
| `guides` | Teaching material for the Language is available. | None |
| `catalog` | A queryable and versioned inventory of environment-bound names is available. | None |
| `validate` | The Server provides a side-effect-free checker that returns structured diagnostics. | `guides` |
| `plan` | Successful validation of a valid program also returns an execution plan with risk information. | `validate` |
| `execute` | Programs can be executed and produce an outcome and, when requested, a trace. | `validate` |
| `trace_fetch` | The stored traces of previously started Runs can be fetched by `run_id`. | `execute` |

The following sub-features refine these capabilities:

| Sub-feature | Meaning |
|---|---|
| `catalog.search` | The catalog supports free-text search. |
| `catalog.changed_since` | The catalog can report changes since a previous catalog version. |
| `guides.topic_fetch` | Individual topics can be retrieved without fetching an entire guide. |
| `execute.test_run` | Deploying Languages support side-effect-free test evaluation. |
| `execute.idempotency` | Execute requests support idempotency keys. |
| `trace_fetch.narrate` | Trace fetch responses may include Server-generated prose narration in addition to recorded facts. |

A sub-feature is meaningful only when its parent capability is declared.

---

### 4.2 Capability declarations

A **capability declaration** is a map from a capability identifier to either:

- `true`; or
- an object containing boolean sub-feature declarations.

For example:

```json
{
  "catalog": {
    "search": true,
    "changed_since": false
  }
}
```

A capability is **undeclared** when it is:

- absent from the effective capability map; or
- explicitly mapped to `false`.

A sub-feature is declared only when:

1. its parent capability is declared; and
2. its own boolean value is `true`.

#### Server-level and Language-level declarations

The manifest MAY contain:

- a Server-level capability declaration that acts as a default;
- a separate capability declaration on each Language entry.

The **effective capability map** is computed independently for each Language and each capability identifier.

For a given capability:

- when the Language-level declaration contains that capability identifier, the Language-level value governs the capability in full, including all of its sub-features;
- otherwise, the Server-level declaration governs it.

A Language-level declaration replaces the Server-level declaration for that capability. It does not merge individual sub-feature values with the Server-level declaration.

For every Language, at least one of the following MUST exist:

- a Server-level capability declaration;
- a Language-level capability declaration.

A manifest that provides neither is invalid.

---

### 4.3 Capability rules

The effective capability map of each Language MUST satisfy all of the following rules.

#### 1. Minimum capability floor

Every Language MUST declare at least:

- `guides`;
- `validate`.

There is no conformant Language that provides guidance without validation or validation without guidance.

#### 2. Catalog obligation

A Language with environment-bound names MUST declare `catalog`.

A Server MUST NOT omit the catalog when program validity depends on live Server state.

#### 3. Capability dependencies

When a capability is declared, every capability on which it depends MUST also be declared.

In particular:

- `validate` requires `guides`;
- `plan` requires `validate`;
- `execute` requires `validate`;
- `trace_fetch` requires `execute`.

#### 4. Trace obligation

A Language that declares `execute` MUST support traces at either:

- `summary`; or
- `full`.

Pilotage defines no conformant execute capability without trace support.

A Client may request no trace for an individual Run under the rules of Section 5.8.1, but the Language itself MUST support at least the `summary` level.

#### 5. Retention obligation

A Language MUST NOT declare `trace_fetch` when its declared retention value is `"none"`.

#### 6. Truthful declarations

A Server MUST NOT declare:

- a capability;
- a sub-feature;
- a trace level;
- an execution mode;
- a retention commitment;
- or any other supported feature

that it does not actually provide.

#### 7. Manifest consistency

The effective capability map is authoritative.

The `loop`, `guides`, and `catalog` fields of each Language entry MUST identify exactly the operations and surfaces declared by that effective map.

Specifically:

- the `guides` reference MUST always be present;
- the `validate` operation address MUST always be present;
- the `catalog` reference MUST be present if and only if `catalog` is declared;
- the `execute` operation address MUST be present if and only if `execute` is declared;
- the `trace` operation address MUST be present if and only if `trace_fetch` is declared.

A manifest that violates these consistency requirements is invalid.

A Client MAY refuse to use an invalid manifest.

## 5. Data model

This section defines the information carried by each Pilotage data structure.

Part III defines:

- the exact serialization of these structures;
- the MCP messages through which they are exchanged;
- the concrete form of references and operation addresses.

---

### 5.1 Manifest

The manifest is the Server's Pilotage self-description.

The manifest:

- MUST be retrievable before any other Pilotage interaction;
- MUST accurately describe the Server's Languages and capabilities;
- MUST satisfy the capability requirements in Sections 4.2 and 4.3.

#### Manifest fields

| Field | Type | Req | Description |
|---|---|---|---|
| `pilotage` | string | M | Pilotage extension version in `major.minor` form, as defined in Section 11.1. |
| `languages` | array of Language entries | M | One entry for each Language exposed by the Server. The array MUST NOT be empty. |
| `capabilities` | capability declaration | O | Server-level default capability declaration under Section 4.2. |

#### Language entry

Each item in `languages` has the following fields.

| Field | Type | Req | Description |
|---|---|---|---|
| `name` | string | M | Language identifier defined in Section 3.3. |
| `title` | string | M | Human-readable Language name. |
| `guides` | reference | M | Binding-defined reference through which the guide index can be retrieved. |
| `catalog` | reference | M when `catalog` is declared | Binding-defined reference through which the catalog can be queried. |
| `loop` | object | M | Binding-defined addresses of the declared loop operations. It MUST satisfy the consistency rule in Section 4.3. |
| `capabilities` | capability declaration | O | Per-Language capability declaration. |
| `locator` | string | M when `validate` is declared | Diagnostic locator dialect: `"json-pointer"` or `"text-range"`. |
| `context_schema` | JSON Schema | Conditional | MUST be present when the Language requires validation context. It MUST otherwise be absent. |
| `execution` | string | M when `execute` is declared | Execution mode: `"immediate"`, `"deploy"`, or `"both"`. |
| `trace` | string | M when `execute` is declared | Highest trace level supported by the Language: `"summary"` or `"full"`. |
| `trace_subprogram` | string | O | Sub-program trace behavior: `"opaque"` or `"expanded"`. Default: `"opaque"`. |
| `retention` | string | M when `execute` is declared | Run retention policy: `"none"`, `"session"`, or an ISO 8601 duration. |
| `promotion_authority` | string | O | Authority model for promoted programs: `"caller"` or `"promoter"`. Default: `"caller"`. |

---

### 5.2 Guide

A guide is one teaching unit associated with a Language.

#### Guide fields

| Field | Type | Req | Description |
|---|---|---|---|
| `id` | string | M | Identifier unique among all guides exposed by the Server. |
| `title` | string | M | Human-readable guide title. |
| `level` | string | M | One of `"core"`, `"reference"`, or `"examples"`. |
| `topics` | array of strings | M | Topic identifiers covered by the guide. They MUST be stable within a guide version and are otherwise free-form, except for the reserved identifier `closed-sets`. |
| `language` | string | M | Identifier of the Language taught by the guide. |
| `version` | string | M | Guide version. It MUST change whenever the guide content changes. |
| `size_bytes` | integer | M | UTF-8 size of the guide body in bytes. |
| `tokens_estimate` | integer | O | Informative estimate of the guide's token count. This field is not normative or testable; `size_bytes` is the normative size field. |
| `format` | string | O | Media type of the guide body. Default: `"text/markdown"`. |

#### Core guide

For every Language, at least one guide with `level: "core"` MUST exist.

The `size_bytes` of a core guide SHOULD be no greater than 8192 bytes. This recommendation allows a context-constrained Client to retrieve the minimum required instruction set at low cost.

#### Closed-sets guide

For every Language, exactly one guide MUST include the reserved topic identifier:

```text
closed-sets
```

That guide:

- MUST have `level: "reference"`;
- MUST enumerate every closed set required by the Language's declared capabilities.

The closed-sets guide MUST always enumerate:

- the complete diagnostic-code set;
- the reserved diagnostic codes defined in Section 5.5.

When `catalog` is declared, it MUST also enumerate:

- every catalog entry `kind`;
- which entry kinds are callable.

Whenever risk appears because `catalog` or `plan` is declared, it MUST enumerate:

- every engine-defined risk level;
- the corresponding `risk_hints` for each level.

When the Language includes branches or loops, it MUST document:

- the scope rules governing when values produced inside branch arms or loop bodies become addressable.

Scope rules are the single most common authoring error; omitting them is a conformance violation.

When inline programs accept `input`, it MUST document:

- the Language's parameter-binding convention.

When the Language has no native program step identifiers, it MUST document:

- the deterministic step-identifier scheme defined in Section 3.4.

When `execute` is declared, it MUST enumerate:

- the complete run-level outcome status set;
- the complete step-level outcome status set;
- the `ok` value of every engine-defined status;
- whether side effects may have occurred for every failure status;
- the truncation format used by `summary` traces;
- the meaning of the run-level `output` value.

Guides other than the closed-sets guide are unrestricted in number and subject matter.

---

### 5.3 Risk

Risk appears on:

- catalog entries;
- plan steps;
- promoted-program catalog entries.

Wherever risk appears, both of the following representations are REQUIRED.

| Field | Type | Req | Description |
|---|---|---|---|
| `risk` | string | M | Engine-defined risk level, such as `safe`, `write`, or `destructive`. This value is informative to generic Clients. |
| `risk_hints` | object | M | Generic boolean risk indicators used by Host policy gates. |

The `risk_hints` object contains:

| Field | Meaning |
|---|---|
| `readOnly` | The operation creates no persistent state change and no state change observable outside the Run. |
| `destructive` | The operation may delete state or alter it irreversibly. |
| `openWorld` | The operation may reach a system outside the Server's own domain. |

The engine-defined `risk` value MUST be consistent with `risk_hints`.

For example, a risk level presented as safe MUST NOT carry:

```json
{
  "destructive": true
}
```

#### Entry-level risk

The risk of a catalog entry represents the maximum effect that the Language can express against that entry.

For example, a table that can be modified is not read-only at the entry level, even when a particular program only reads from it.

The risk of an individual use is represented by the corresponding plan step.

As a result, a Host that gates execution without a plan must necessarily behave conservatively.

#### Risk aggregation

Wherever Pilotage computes the maximum risk of multiple steps, it MUST compute that maximum from `risk_hints`, not from engine-defined risk strings.

The aggregate values are calculated as follows:

```text
max.readOnly    = AND of every step's readOnly value
max.destructive = OR  of every step's destructive value
max.openWorld   = OR  of every step's openWorld value
```

All risk values are Server-authored claims and have the trust status defined in Section 9.

---

### 5.4 Catalog entry and catalog version

A catalog entry describes one environment-bound name.

#### Catalog entry fields

| Field | Type | Req | Description |
|---|---|---|---|
| `id` | string | M | Stable identifier unique within the catalog. |
| `kind` | string | M | Member of the Language's engine-defined entry-kind set. |
| `name` | string | M | Human-readable name. |
| `description` | string | O | Human-readable description. This is Server-authored text. |
| `input_schema` | JSON Schema | M for callable kinds | Declared shape of the callable entry's input. |
| `output_schema` | JSON Schema or null | O | Declared output shape when statically known. |
| `risk` and `risk_hints` | Section 5.3 | M | Maximum-effect risk associated with the entry. |
| `tags` | array of strings | O | Engine-specific, informative grouping labels. |
| `languages` | array of strings | O | Languages that may reference this entry. Absence means every Language exposed by the Server may reference it. |
| `revision` | string | O | Opaque token that changes when the entry changes. |

#### `catalog_version`

Every response to:

- catalog `list`;
- catalog `get`;
- catalog `changed_since`;
- `validate` for a catalog-bearing Language

MUST carry a `catalog_version`.

A `catalog_version` is an opaque change-detection token.

It MUST be computed within the requesting Client's authorization scope. It represents only the catalog visible to that Client.

This requirement ensures that:

- invisible entries do not cause observable token changes;
- one Client cannot infer changes to another Client's authorized vocabulary;
- invisible entries do not create unnecessary drift failures.

The token MUST change whenever:

- a visible entry is added;
- a visible entry is removed;
- any defined field of a visible entry changes, except `revision`.

The token SHOULD NOT change for any other reason.

Changing the token unnecessarily is not itself a conformance violation, but it creates avoidable `catalog_drift` refusals for Clients.

#### Promoted programs as catalog entries

When a program is promoted, it MUST appear in the catalog as an entry of an engine-defined kind.

The entry MUST declare an `input_schema`.

Promoted programs are subject to the following additional requirements.

##### Immutable reference

A `program_ref` MUST identify an immutable program body.

The Server MUST satisfy this requirement by either:

- making the reference itself version-specific; or
- minting a new reference whenever the stored program body changes.

##### Honest risk

The `risk_hints` declared by a promoted-program entry MUST be at least as restrictive as the aggregate risk of its body.

A promoted program MUST NOT present itself as safer than the program it contains.

##### Recorded compatibility baseline

At promotion time, the Server MUST record the current values of every referenced catalog entry's load-bearing fields:

- `kind`;
- `input_schema`;
- `output_schema`;
- `risk`;
- `risk_hints`;
- `languages`.

The baseline MUST NOT depend on:

- `revision`;
- `name`;
- `description`;
- `tags`.

Changes to those fields alone do not alter the promoted program's behavior.

Before a promoted program executes, the Server compares the recorded baseline with the current catalog state under Section 6.5.2.

A mismatch is terminal for that reference. The program MUST be promoted again, producing a new reference and a new baseline.

---

### 5.5 Diagnostic

A diagnostic is one validation finding.

#### Diagnostic fields

| Field | Type | Req | Description |
|---|---|---|---|
| `severity` | string | M | One of `"error"` or `"warning"`. |
| `code` | string | M | Member of the Language's closed diagnostic-code set. |
| `path` | locator | M | Location to which the finding applies. |
| `range` | object | O | Position within a text value addressed by `path`, of the form `{start: {line, column}, end: {line, column}}` with 1-based lines and columns. |
| `message` | string | M | Human-readable explanation. This is Server-authored text. |
| `hint` | string | O | Suggested correction. This is Server-authored text. |

#### Locator dialects

Each Language declares one diagnostic locator dialect.

##### `json-pointer`

For a structured, JSON-valued program, `path` is an RFC 6901 JSON Pointer into the program.

Example:

```text
/steps/1/capability
```

When a finding applies to an expression embedded inside a string field:

- `path` identifies the innermost JSON Pointer-addressable value;
- `range` MAY identify the position inside that string.

##### `text-range`

For a text-valued program, `path` is an object of the form:

```json
{
  "start": {
    "line": 1,
    "column": 1
  },
  "end": {
    "line": 1,
    "column": 8
  }
}
```

Lines and columns are 1-based.

When `text-range` is used, the separate `range` field is not used.

#### Whole-document findings

A whole-document finding uses:

- `""`, the empty JSON Pointer, for `json-pointer`; or
- the full-document range for `text-range`.

#### Input and context findings

When a diagnostic applies to the execute request's `input` rather than to the program:

- `path` is a JSON Pointer into `input`;
- `code` MUST be `input_binding`.

When a diagnostic applies to `context`:

- `path` is a JSON Pointer into `context`;
- `path` is `""` when context is missing or was supplied unexpectedly;
- `code` MUST be `context_binding`.

#### Reserved diagnostic codes

Every Language's closed diagnostic set MUST contain these reserved codes:

| Code | Meaning |
|---|---|
| `constraint` | Catch-all for a finding the Server cannot classify more precisely. |
| `input_binding` | Failure involving the request's `input` value. |
| `context_binding` | Failure involving the request's `context` value. |

A diagnostic `code` MUST NOT contain a value outside the Language's enumerated closed set.

When the Server cannot assign a more specific code, it MUST use `constraint`.

#### Native and adapted validation

A Server MAY produce closed diagnostic codes:

- natively, through a validator that already emits them; or
- through an adapter that classifies existing validator output and falls back to `constraint`.

Both approaches are conformant and are indistinguishable on the wire.

#### Validity

A program is valid if and only if validation returns no diagnostic with:

```json
{
  "severity": "error"
}
```

Warnings do not make a program invalid.

A validation response MUST set `valid` exactly according to this rule.

When `plan` is declared and `valid` is true, the response MUST include a plan, even when warnings remain.

---

### 5.6 Plan

A plan is the statically derivable preview of what executing a valid program would do.

For a Language with execution mode `"deploy"`, the plan describes the deployed program's body: what it will do when triggered.

The plan does not merely describe installation, because the body's effects are what the Host must evaluate when making a risk decision.

#### Plan fields

| Field | Type | Req | Description |
|---|---|---|---|
| `steps` | array of plan steps | M | Steps in expected execution order. |
| `max_risk` | string | M | Engine-defined maximum risk level. Informative to generic Clients. |
| `max_risk_hints` | object | M | Aggregate risk hints computed under Section 5.3. The Host gate operates on this field. |

#### Plan step

| Field | Type | Req | Description |
|---|---|---|---|
| `id` | string | M | Program step identifier. |
| `calls` | string | Conditional | Catalog entry or promoted-program reference invoked by the step. MUST be present for an invoking step and absent for non-referencing steps. |
| `arm` | object | M for a step inside a branch arm | `{branch, label}`, identifying the enclosing branch and the arm containing the step. |
| `loop` | string | M for a step inside a loop body | Identifier of the innermost enclosing loop. |
| `risk` and `risk_hints` | Section 5.3 | M | Risk associated with this use of the step. |

#### Plan derivation

The Engine MUST derive plans according to the following rules:

- branches and loops appear as plan steps of their own;
- control-flow steps do not carry `calls`;
- a branch contributes the steps of every possible arm, because the plan cannot know which arm will run;
- each branch-arm step carries `arm`;
- a loop contributes its body steps once;
- each loop-body step carries `loop`;
- a call to a promoted program contributes one step carrying the promoted entry's declared risk;
- steps with no externally visible effect, such as pure transformations, MAY be omitted.

---

### 5.7 Outcome

An outcome is the closed classification of a Run's result.

#### Outcome fields

| Field | Type | Req | Description |
|---|---|---|---|
| `ok` | boolean | M | Whether the Run completed successfully. |
| `status` | string | M | Member of the Language's run-level outcome status set. |
| `error` | string or null | M | Human-readable failure summary. MUST be `null` when `ok` is true and non-null when `ok` is false. |

#### Reserved statuses

| Status | `ok` | Meaning |
|---|---|---|
| `success` | true | The program completed successfully. |
| `validation_error` | false | Execution was refused because the program, input, or context failed validation. No side effects occurred. Diagnostics accompany the response. |
| `catalog_drift` | false | Execution was refused because the current `catalog_version` differs from `expected_catalog_version`. No side effects occurred. This condition is recoverable. |
| `promotion_drift` | false | Execution was refused because a promoted program's referenced entries no longer match the promotion baseline. No side effects occurred. The reference is no longer runnable. |
| `partial` | false | Execution began but did not complete. Side effects may have occurred. |
| `error` | false | The Run failed and no more specific status applies. |

The Server MUST use:

- `success`;
- `validation_error`;
- `catalog_drift`;
- `promotion_drift`

exactly for the conditions defined above.

It MUST NOT substitute engine-specific names for those conditions.

For a failed started Run, an Engine MAY use a more specific engine-defined status, such as:

- `timeout`;
- `not_found`;
- `denied`.

Every engine-defined status MUST be listed in the closed-sets guide with:

- its `ok` value;
- whether side effects may have occurred.

The run-level status set is closed per Server and Language.

A Client that receives an unrecognized status with `ok: false` MUST treat it as equivalent to `partial`.

#### Step-level outcomes

Each trace step carries an outcome with the same structure.

The step-level status set is also closed per Server and Language and MUST be enumerated in the closed-sets guide.

Reserved statuses retain their specified meanings when used for a step.

---

### 5.8 Trace

A trace is the Server's recorded account of a Run.

Its trust status is defined in Section 9.

#### Trace fields

| Field | Type | Req | Description |
|---|---|---|---|
| `run_id` | string | M | Identifier unique among all Runs of the Server. |
| `level` | string | M | Effective trace level: `"summary"` or `"full"`. |
| `steps` | array of trace steps | M | Steps in flat execution order. |
| `stats` | object | O | Engine-specific, informative aggregate statistics. |

#### Trace step

| Field | Type | Req | Description |
|---|---|---|---|
| `id` | string | M | Trace step identifier. |
| `calls` | string | O | Catalog entry or program reference invoked by the step. |
| `input` | any | Conditional | MUST be present at `full` for non-control-flow steps. MUST be absent at `summary` and for control-flow steps. |
| `output` | any | Conditional | MUST be present at `full` for non-control-flow steps. MAY be present in truncated form at `summary`. MUST be absent for control-flow entries. |
| `outcome` | object | M | Step-level outcome. |
| `t_ms` | integer | O | Step duration in milliseconds. |
| `decisions` | array | M for control-flow steps | Decisions made by a branch or loop. |

Each decision has the following form:

```json
{
  "at": "step-identifier",
  "took": "decision-value",
  "because": "evaluated reason"
}
```

For a branch:

- `at` identifies the branch construct;
- `took` is the selected arm label;
- the label MUST correspond to the relevant `arm.label` in the plan.

For a loop:

- `took` is `"continue"` or `"exit"`;
- an Engine MAY use a summarized form documented in the closed-sets guide.

`because` contains the evaluated reason for the decision.

#### Trace envelope

The **trace envelope** consists of the structured facts of a Run:

- the run outcome;
- `run_id`;
- trace `level`;
- step identifiers;
- `calls`;
- step inputs;
- step outputs;
- step outcomes;
- `t_ms`;
- decisions;
- `stats`.

The trace envelope excludes Server-authored prose, including:

- diagnostic `message`;
- diagnostic `hint`;
- catalog `description`;
- narration.

Client verification requirements refer to the trace envelope rather than to prose interpretation.

---

#### 5.8.1 Trace levels

Trace levels are ordered as follows:

```text
none < summary < full
```

##### `full`

A full trace contains every executed step with:

- input;
- output;
- outcome;
- decisions.

##### `summary`

A summary trace contains every executed step with:

- `id`;
- `outcome`;
- optional `t_ms`;
- optional truncated `output`;
- decisions where applicable.

It omits step input.

The truncation form MUST be documented in the closed-sets guide.

##### `none`

`none` is not itself a trace level returned in a trace object.

It is a request value meaning that the Server should return no trace.

A Language declaring `execute` MUST support at least `summary`.

The manifest declares the Language's highest supported level:

- `"summary"`; or
- `"full"`.

The effective trace level is the lower of:

- the requested level;
- the declared ceiling.

When `trace_level` is absent, the request is treated as asking for the declared ceiling.

The response MUST state the effective level in `trace.level`.

When the effective request level is `none`:

- no trace is returned;
- `run_id` MUST still be returned;
- `outcome` MUST still be returned;
- the partial-trace requirement in Section 6.5.6 does not apply;
- whether the Run is retrievable through the trace fetch door is governed by `store` and the declared retention value alone, per Sections 6.5 and 6.6; the level does not decide it.

---

#### 5.8.2 Flat order and step identity

The `steps` array is a flat execution log.

Every executed step:

- MUST appear exactly once as a top-level entry;
- MUST appear in the order in which execution reached it.

Steps inside branches, loops, and expanded sub-programs are not nested objects.

##### Identity grammar

A trace step identifier begins with the corresponding program step identifier and may be qualified for:

- loop iteration;
- sub-program expansion.

###### Iteration

For each loop enclosing the step, from outermost to innermost, append:

```text
#n
```

where `n` is the 1-based iteration number of that loop's current activation
(an inner loop's counter restarts on each outer-loop iteration).

Examples:

```text
step#1
step#2
step#3
```

For nested loops:

```text
step#2#4
```

Iteration qualification applies to every step inside the loop body, including nested control-flow constructs.

###### Expansion

When a promoted sub-program is expanded, each internal trace entry is prefixed with:

- the calling trace entry's complete iteration-qualified identifier;
- `/`.

Example:

```text
call1#2/body#3
```

The same rule applies recursively to nested expanded calls.

###### Base identifier recovery

The base program step identifier of a trace entry is recovered by:

1. selecting the segment after the final `/`, if one exists;
2. removing all `#` suffixes.

This is unambiguous because program step identifiers cannot contain `#` or `/`.

##### Control-flow entries

A branch or loop appears as its own trace entry.

A branch entry:

- carries the decision for that branch activation;
- uses the selected arm label as `took`.

A loop entry:

- appears once per activation;
- carries one decision for each continue-or-exit evaluation;
- MAY instead use an Engine-defined summarized decision representation documented in the closed-sets guide.

A control-flow construct that is reached is considered activated and MUST be traced even when its body executes zero times.

A zero-iteration loop therefore carries one `"exit"` decision.

Steps inside a selected branch arm or loop body appear as separate top-level trace entries.

---

#### 5.8.3 Sub-programs

A call to a promoted program appears as one trace entry containing the sub-program's outcome.

The `trace_subprogram` Language field determines whether internal steps also appear.

##### `opaque`

This is the default.

The call appears as one trace entry. The sub-program's internal steps are not emitted.

##### `expanded`

The sub-program's internal entries are inserted into the flat trace.

Each internal identifier is prefixed according to Section 5.8.2.

Plan correspondence for the call is based on the calling step's base identifier. Internal expanded entries do not have corresponding steps in the caller's plan.

---

#### 5.8.4 Plan–trace correspondence

For an `"immediate"` execution or `test_run` of a program at a given `catalog_version`, the following rules apply.

The Engine MUST NOT execute an operation that was not part of the validated program.

Every trace entry that invokes a catalog entry MUST identify it in `calls`.

The trace MUST correspond to the plan.

Correspondence is evaluated only over unprefixed trace entries: entries whose identifiers do not contain `/`.

Expanded sub-program entries do not participate in:

- required-presence matching;
- prohibited-absence matching;
- branch-entry enumeration.

The expected set contains:

1. every plan step that is neither inside a branch arm nor inside a loop body;
2. for each branch entry in the trace, every plan step whose `arm.branch` identifies that branch and whose `arm.label` matches the selected arm;
3. for each loop entry that records at least one iteration, every plan step whose `loop` identifies that loop and which does not itself carry `arm`.

Branch-arm steps are contributed exclusively by the branch rule, including when the branch is inside a loop.

For a Run with outcome `success`:

- every member of the expected set MUST appear in the trace;
- matching is performed using the base identifier;
- a loop-body step MUST appear at least once when its loop executed.

For a started Run that did not complete:

- expected steps not yet reached MAY be absent;
- every unprefixed trace entry that does appear MUST map by base identifier to a member of the expected set.

In all cases, plan steps belonging to branch arms that were not selected MUST be absent from the trace.

For a `"deploy"` Run:

- the execution trace describes installation;
- the body plan is not matched against the installation trace;
- body-plan correspondence is checked against `test_run` traces where `execute.test_run` is declared.

A Server whose execution may diverge from its plan for internal Engine reasons MUST NOT declare `plan`.

---

## 6. Operations

Pilotage defines six abstract operations:

1. `discover`;
2. `learn`;
3. `lookup`;
4. `validate`;
5. `execute`;
6. `trace`.

Together these operations realize the layer order **manifest → guides → catalog → validate → plan → execute → trace**, with the agent at the center deciding what and when to call.

This section defines their semantics and information content.

Part III defines their MCP request and response encodings.

---

### 6.1 `discover`

`discover` returns the manifest.

A Client MUST retrieve and honor the manifest before using any other Pilotage operation.

The Server MUST process `discover` without side effects.

---

### 6.2 `learn`

`learn` has two forms.

#### Index

The index form returns guide metadata for every guide associated with a Language.

It returns every guide field except the body.

A Server MUST support the index form so that a Client can choose which guides to retrieve without first loading their content.

#### Fetch

The fetch form accepts:

```json
{
  "id": "guide-id"
}
```

and returns the selected guide, including its body.

An unknown guide `id` is a request error.

When `guides.topic_fetch` is declared, the Client may request:

```json
{
  "id": "guide-id",
  "topic": "topic-id"
}
```

The response then contains only the content associated with that topic.

---

### 6.3 `lookup`

`lookup` provides access to the catalog.

It defines three verbs:

- `list`;
- `get`;
- `changed_since`.

Every successful or catalog-related response MUST carry `catalog_version`.

#### `list`

Request:

```json
{
  "kind": "optional-kind",
  "tag": "optional-tag",
  "cursor": "optional-opaque-cursor",
  "limit": 100
}
```

Response:

```json
{
  "items": [],
  "next_cursor": "optional-opaque-cursor",
  "catalog_version": "opaque-token"
}
```

All filters are optional.

When `catalog.search` is declared, the request MAY also contain a free-text `q` filter.

Catalog listing is paginated.

When additional results remain, the response MUST include `next_cursor`.

The Client MUST return the cursor unchanged in the next request.

Absence of `next_cursor` means that the listing is complete.

#### `get`

Request:

```json
{
  "id": "entry-id"
}
```

Response:

```json
{
  "entry": {},
  "catalog_version": "opaque-token"
}
```

An unknown `id` is a request error.

The error response MUST still carry the current `catalog_version`.

#### `changed_since`

This verb is available only when `catalog.changed_since` is declared.

Request:

```json
{
  "catalog_version": "previous-token"
}
```

Response:

```json
{
  "catalog_version": "current-token",
  "changes": [
    {
      "id": "entry-id",
      "change": "modified"
    }
  ]
}
```

The `change` field has the closed set:

- `added`;
- `removed`;
- `modified`.

When the Server cannot calculate changes from the supplied token, it MUST return a distinguishable unknown-baseline request error.

The Client then falls back to a complete listing.

#### Authorization scope

All catalog-derived information MUST be computed within the requesting Client's authorization scope, including:

- entries;
- catalog tokens;
- diagnostic hints;
- validation findings derived from catalog knowledge.

A catalog name the Client is not authorized to see MUST be indistinguishable from a nonexistent name in every Pilotage operation.

---

### 6.4 `validate`

Request:

```json
{
  "program": {},
  "context": {}
}
```

Response:

```json
{
  "valid": true,
  "diagnostics": [],
  "catalog_version": "optional-token",
  "plan": {},
  "references": []
}
```

The presence of optional response fields depends on the Language's declared capabilities.

The `diagnostics` array is always present; an empty array means no findings.

#### Side-effect freedom

Validation MUST:

- create no externally observable state change;
- invoke no catalog entry;
- be safe to repeat any number of times.

#### Context

The `context` field exists for Languages whose validation depends on declared external bindings, such as types or variables required for semantic checking.

A Language that requires context MUST declare `context_schema`.

For such a Language:

- missing context;
- malformed context;
- context that does not satisfy the schema

MUST produce a diagnostic with code `context_binding`.

This is a validation result, not a request error.

A Language without `context_schema` MUST reject supplied context through a `context_binding` diagnostic.

Server-specific request fields not declared by this specification are prohibited.

A generic Client MUST be able to construct a valid validation request from the manifest alone.

#### Catalog snapshot

Validation MUST operate against the current catalog snapshot.

When the Language declares `catalog`, the response MUST include the corresponding `catalog_version`.

#### Diagnostics and plan

The `valid` field MUST follow the validity rule in Section 5.5.

When `plan` is declared, a valid response MUST include the plan.

#### References without a plan

When:

- `catalog` is declared;
- `plan` is not declared;
- the program is valid,

the validation response SHOULD include `references`, containing the identifier of every catalog entry referenced by the program.

The Host uses this Server-generated list when applying the no-plan risk gate.

---

### 6.5 `execute`

An execute request has the abstract form:

```json
{
  "program": {},
  "program_ref": "reference",
  "input": {},
  "context": {},
  "trace_level": "full",
  "store": true,
  "expected_catalog_version": "opaque-token",
  "idempotency_key": "opaque-key",
  "test_run": false
}
```

Exactly one of `program` or `program_ref` is allowed.

`test_run` is accepted only when `execute.test_run` is declared.

Supplying it otherwise is a request error.

#### `store`

`store` is OPTIONAL and controls retention of the run record for later trace fetch.

- When `store` is absent, the Language's declared retention policy governs, as defined in Section 6.6.
- When `store` is `true`, the Engine MUST retain the run record so that its trace can later be fetched through the trace fetch door. A Server whose declared retention is `"none"` MUST reject the request with a request error of kind `unsupported`. It MUST NOT silently ignore the field.
- When `store` is `false`, the Engine MUST NOT retain the run record beyond this response.

`run_id` is always returned; it identifies the Run in-band even when the record is not stored.

The inline trace rides the execute response at the effective trace level regardless of `store`.

`store` and `trace_level` are independent controls over the same record: `trace_level` governs only the inline detail returned with this response, while `store` governs retention. `store: true` combined with an effective trace level of `"none"` is therefore valid: the response carries no inline trace, and the Engine MUST still record the trace at its declared trace capability level so it can be fetched later.

`store` applies only to started Runs. A refused Run is never retained, regardless of `store`.

#### Execute response

| Field | Type | Req | Description |
|---|---|---|---|
| `run_id` | string | M | Run identifier. MUST also be present for refused Runs. |
| `outcome` | object | M | Run outcome defined in Section 5.7. |
| `output` | any | O | Engine-defined successful result, where the Language produces one. For a deploy Run, this is the installation result. |
| `diagnostics` | array | M when status is `validation_error` | Diagnostics that caused refusal. |
| `trace` | object | Conditional | MUST be present for a started Run at effective level `summary` or `full`. It MUST otherwise be absent. |

`output` MUST appear only when:

- `outcome.ok` is true;
- the Language produces a result.

The meaning of `output` MUST be documented in the closed-sets guide.

---

#### 6.5.1 Runnable selection

Exactly one of the following MUST be present:

- `program`, containing an inline program;
- `program_ref`, identifying a promoted program.

A request containing both or neither is a request error.

A Server declaring `execute`:

- MUST accept inline programs;
- MUST accept `program_ref` exactly when promoted programs are exposed in the catalog.

---

#### 6.5.2 Processing order

The Server MUST process execute requests in the following order.

The first failing check determines the response.

##### 1. Request well-formedness

The Server first checks:

- the runnable selection rule;
- whether `program_ref` can be resolved;
- whether `trace_level` is recognized;
- whether `test_run` is allowed;
- whether a supplied `store: true` can be honored, which it cannot under declared retention `"none"`;
- whether an idempotency-key conflict exists.

An unauthorized `program_ref` MUST be indistinguishable from a nonexistent reference.

A failure at this stage is a request error.

An idempotency replay is not an error.

When the same key is supplied with the same runnable and input, the Server returns the recorded result of the original Run without further processing.

##### 2. Catalog drift

When `expected_catalog_version` is supplied and differs from the current authorization-scoped `catalog_version`, the Server MUST return:

```json
{
  "ok": false,
  "status": "catalog_drift",
  "error": "catalog version mismatch"
}
```

No side effects may occur.

##### 3. Re-validation or promotion-baseline check

For an inline program, the Server MUST validate `{program, context}` exactly as `validate` would.

When invalid, it MUST:

- return outcome `validation_error`;
- attach the diagnostics;
- execute nothing.

This guard applies even when the Client did not call `validate` separately.

For a `program_ref`, the Server MUST compare the current values of the referenced catalog fields with the baseline recorded at promotion.

Any difference MUST produce outcome `promotion_drift`.

No side effects may occur.

##### 4. Input and context binding

The Server validates `input` and `context` under Section 6.5.5.

Failure produces:

- outcome `validation_error`;
- an `input_binding` or `context_binding` diagnostic.

No side effects may occur.

##### 5. Execution

Execution begins only after all previous checks succeed.

---

#### 6.5.3 Drift protection

A Client following the standard loop supplies the `catalog_version` against which it validated the program as `expected_catalog_version`.

For a promoted-program Run, it supplies the token returned when retrieving the promoted entry.

Whenever the Client supplies `expected_catalog_version`, the Server MUST compare it with the current token.

The Server MUST NOT ignore a supplied token.

---

#### 6.5.4 Containment

The Engine MUST NOT execute an operation outside the validated program.

For a `program_ref`, the validated program is the immutable promoted body.

---

#### 6.5.5 Input and context binding

For a promoted program, `input` MUST be validated against the catalog entry's `input_schema`.

For an inline program, the Language's parameter-binding convention MUST be documented in the closed-sets guide.

A Language with no inline parameter convention MUST reject a request that supplies `input`.

An input-binding failure produces:

- outcome `validation_error`;
- diagnostic code `input_binding`.

The `context` rules used by execute are identical to those used by validate.

For a Language with `context_schema`:

- context MUST satisfy that schema;
- valid context is made available to execution.

For a Language without `context_schema`:

- supplying context MUST produce a validation failure.

A context-binding failure produces:

- outcome `validation_error`;
- diagnostic code `context_binding`.

---

#### 6.5.6 Effects, idempotency, and partial failure

##### Idempotency

When `execute.idempotency` is declared, idempotency keys are scoped to the Server.

Two requests with the same:

- `idempotency_key`;
- runnable;
- input

MUST be treated as one execution.

A repeated request returns the recorded result of the first Run.

A request using the same key with a different runnable or different input is a request error.

Refused Runs MUST NOT be recorded for replay because no side effects occurred.

After recovering from drift, a Client that changes the program or input MUST use a new idempotency key.

The Server's deduplication window MUST be at least as long as the declared retention period.

When `execute.idempotency` is not declared:

- a Client MUST NOT assume that retrying execute is safe;
- for a side-effecting program, it SHOULD surface a timeout-retry decision rather than retry silently.

##### Partial failure

A started Run that does not complete MUST return:

- an outcome with `ok: false`;
- either `partial` or a more specific enumerated engine-defined status;
- the trace of execution completed so far.

The trace is returned at the effective trace level.

At effective level `none`, only `run_id` and `outcome` are returned.

Trace absence is never the signal that execution failed. The `outcome` is authoritative.

---

#### 6.5.7 Execution modes

A Language declaring `execute` specifies one of the following execution modes.

##### `immediate`

The Server evaluates the program during the execute request.

The outcome and trace describe that evaluation.

##### `deploy`

The Server installs the program to execute later in response to future events.

Examples include:

- automation rules;
- trigger definitions;
- scheduled workflows.

The execute outcome describes installation.

The trace is an installation trace.

The run-level `output` carries the installation result, such as a promoted program reference.

Later executions of the deployed body are outside the scope of the installation Run.

However:

- the validation plan describes the deployed body;
- the Host risk gate operates on that body plan.

##### `both`

The Language supports both immediate evaluation and deployment.

The request selects the desired mode using a binding-defined selector.

##### Test run

When `execute.test_run` is declared, the request may include:

```json
{
  "test_run": true
}
```

The Server then evaluates the deploying program without side effects against synthetic or current state.

The response contains an ordinary execution trace.

A test run is the standard mechanism for observing what the deployed body would do.

Body-plan correspondence is checked against this trace.

---

### 6.6 `trace`: the fetch door

The trace is one layer with two doors:

- the **inline door** (mandatory wherever `execute` is declared): the trace envelope rides the execute response, as defined in Sections 5.8 and 6.5;
- the **fetch door** (optional, and requiring storage): the same stored envelope can be retrieved later by `run_id` through the `trace` operation defined in this section.

One trace, two doors: it rides the execute response; if the run was stored, the same trace can be fetched later by `run_id`.

The fetch door is available only when `trace_fetch` is declared.

Request:

```json
{
  "run_id": "run-identifier",
  "trace_level": "optional-level",
  "question": "optional-question"
}
```

Response:

```json
{
  "run_id": "run-identifier",
  "outcome": {},
  "output": {},
  "trace": {},
  "narration": "optional-narration"
}
```

The response contains the recorded facts of the Run: the same trace envelope that rode the execute response.

On the fetch door, `trace_level` admits only `summary` and `full`. `none` is an execute-time value: it suppresses the inline envelope, and has no meaning when asking for a stored record. A fetch request carrying `trace_level: "none"` is rejected with a request error of kind `invalid_request`.

The trace is returned at the level at which it was originally recorded. When the request supplies `trace_level`, the returned level is the lower of the requested level and the recorded level. The fetch door MUST NOT return more than was recorded.

`output` is returned where it was retained.

`question` and `narration` are meaningful only for a Language declaring `trace_fetch` with `narrate: true`, as defined under Narration below.

#### Retention

The Language declares one retention value.

Retention governs run records whose execute request omitted `store`. An explicit `store` value overrides it under Section 6.5: `store: true` requires retention, and `store: false` forbids it.

##### `"none"`

Runs are not retrievable.

The Language MUST NOT declare `trace_fetch`.

An execute request with `store: true` is rejected under Section 6.5.

##### `"session"`

Started Runs are retrievable only within the Session in which they executed.

##### ISO 8601 duration

Started Runs are retrievable for at least the declared duration after execution.

A duration is a durability commitment that survives Server restarts.

A Server that cannot make that commitment MUST instead declare:

- `"session"`; or
- `"none"`.

Retention applies only to started Runs.

Refused Runs are not retrievable through the fetch door.

The effective trace level does not affect retention. `trace_level` selects the inline envelope; `store` and the declared retention value decide the record's fate, per Section 6.5. A retained Run executed at effective trace level `none` remains retrievable through the fetch door, at the level the Engine recorded.

A Run executed with `store: false` MUST NOT be retrievable through the fetch door.

A Run executed with `store: true` MUST be retrievable within the scope of the declared retention value: within its Session for `"session"`, and for at least the declared duration otherwise.

#### Indistinguishability

The following conditions MUST produce the same request error, of kind `not_found`:

- unknown `run_id`;
- expired Run;
- non-retained Run;
- unauthorized Run.

An unauthorized Run MUST be indistinguishable from a nonexistent Run.

#### Narration

By default, the fetch door returns deterministic recorded facts and no additional interpretation.

When `trace_fetch.narrate` is declared:

- the request MAY include a `question`;
- the response MAY include Server-generated prose in `narration`.

The facts (the trace envelope) are the contract. Narration is optional interpretation and has the trust status defined in Section 9.

> **Changed in v1.1.** The formerly separate `explain` operation is folded into the trace layer as its fetch door: one record, one layer, two access paths; fewer concepts, same guarantees.

---

## 7. Standard Client loop

### 7.1 Sequence

The layer order is **manifest → guides → catalog → validate → plan → execute → trace**, with the agent at the center deciding what and when to call; the sequence below is the standard path through those layers for one Run.

A conformant Client follows this sequence for each Run:

```text
[Model] 1. discover
            Retrieve and read the manifest.

[Model] 2. learn
            Retrieve the core guide first, then reference topics as needed.

[Model] 3. lookup
            Retrieve the environment-bound names needed for the task,
            where catalog is declared.

[Model] 4. author
            Draft the program.

[Model] 5. validate
            Process diagnostics and revise until the program is valid.

[Host]  6. gate
            Apply the risk policy defined in Section 7.3.

[Host]  7. execute
            Issue the execute request on the Model's request.
            Supply expected_catalog_version when validation returned one.
            Use an effective trace level of at least summary.
            The trace rides the execute response inline.
            Supply store: true when the trace must be fetchable later.

[Model] 8. verify
            Compare the inline trace envelope with the task.
            When the result is wrong or incomplete, return to authoring.

[Model] 9. fetch (optional)
            Where the Run was stored and trace_fetch is declared,
            the same trace can be fetched later by run_id through
            the trace operation.
```

Steps 1 through 8 are a per-Run obligation for a conformant Client. Step 9 is OPTIONAL.

A Client MAY skip validation only when:

- it previously validated the same program;
- the program is unchanged;
- it supplies the `catalog_version` from that validation as `expected_catalog_version`;
- the Host uses the plan returned by the prior validation.

A conformant Client MUST NOT request `trace_level: "none"` for a program that has not already been verified through this loop.

---

### 7.2 Convergence duties

A Client MUST NOT execute while validation returns an error-severity diagnostic.

Warnings do not block execution.

When only warnings remain, a Client SHOULD leave the revision loop rather than repeatedly attempting to remove warnings that it cannot resolve.

After execution, the Model MUST perform mission verification against the trace envelope that rode the execute response. A stored Run's envelope fetched later through the trace fetch door is the same record and MAY support later review, but it does not defer this duty.

Mission verification determines whether the actual behavior satisfied the task, not merely whether the Engine reported successful execution.

---

### 7.3 Host risk gate

The risk gate is policy code enforced by the Host.

The Model MUST NOT be responsible for enforcing it.

In this section, **approval** means authorization obtained outside the Model, such as:

- explicit human confirmation;
- a previously established Host policy.

#### Inline program with a plan

When a plan is available, the Host MUST NOT issue execute without approval when:

```json
{
  "destructive": true
}
```

or:

```json
{
  "openWorld": true
}
```

appears in `plan.max_risk_hints`.

#### Promoted program

For every `program_ref` Run, the Host MUST apply the same rule to the promoted entry's `risk_hints`.

The promoted entry's risk is required to be at least as restrictive as the risk of its body.

#### Inline program without a plan

When `plan` is not declared, the Host MUST use the Server-provided `references` from validation.

It MUST aggregate the corresponding catalog entries' `risk_hints` and MUST apply the same approval rule to the aggregate.

A reference list inferred by the Model does not satisfy this requirement.

When no Server-provided reference list is available, the Host MUST require approval for every execution.

#### Fail closed

Missing risk information MUST be treated as risky.

It MUST NOT be treated as evidence that the program is safe.

#### Honest approval presentation

Approval context MUST state that:

- plan descriptions;
- entry descriptions;
- risk labels

are unverified Server claims.

For a text-valued Language, the Host SHOULD display the program itself alongside the plan.

---

### 7.4 Promoted-program loop

For a promoted-program Run, standard loop steps 2 through 5 are replaced by a catalog `get` for the promoted entry.

The Client retrieves:

- `input_schema`;
- `risk_hints`;
- current `catalog_version`.

The Host applies the promoted-program risk gate.

The execute request uses the token from the lookup as `expected_catalog_version`.

---

### 7.5 Drift recovery

#### `catalog_drift`

`catalog_drift` is recoverable.

For an inline program, the Client SHOULD:

1. retrieve the referenced catalog entries again;
2. validate the program against the current snapshot;
3. resume from validation.

For a promoted program, the Client SHOULD:

1. retrieve the promoted entry again;
2. obtain the current token;
3. reapply the risk gate;
4. retry.

When the runnable or input changes, the Client MUST use a fresh idempotency key.

#### `promotion_drift`

`promotion_drift` is terminal for the existing reference.

Retrying the same `program_ref` cannot succeed.

The promoted program must be promoted again, producing a new reference and baseline.

The Client SHOULD:

- surface the condition to its operator; or
- fall back to inline authoring.

#### Execute-time `validation_error`

When execute returns `validation_error`, the Client resumes from the authoring step using the returned diagnostics.

---

## 8. Error model

Pilotage failures travel through exactly four channels.

The routing rules are normative.

| Channel | Carries | Examples | Required treatment |
|---|---|---|---|
| **Carrier protocol error** | Malformed or unroutable messages | Unparseable request, unknown operation | Defined by the binding. MUST NOT carry program-level findings. |
| **Request error** | A well-formed operation request that cannot be served | Unknown guide, unknown catalog entry, unknown or expired or unauthorized Run, invalid runnable selection, unknown baseline, idempotency conflict, validator crash | Defined by the binding. MUST NOT represent an invalid program or a failed Run. |
| **Diagnostics** | Findings about the program, input, or context | Unknown name, type mismatch, malformed step, input-binding failure, context-binding failure | Returned through a successful operation response with `valid: false`, or with execute outcome `validation_error`. |
| **Outcome** | Classification of a Run | `success`, `catalog_drift`, `partial`, engine-defined failure | Returned through a successful execute response. |

Invalidity is a result, not an operation error.

A Client MUST NOT treat:

- a validation response with `valid: false`;
- an execute outcome with `ok: false`

as a transport failure.

It MUST NOT automatically retry or abandon the Pilotage loop merely because those values were returned.

A Server MUST NOT convert program-level validation findings into carrier protocol errors or request errors.

Doing so would prevent the Model from receiving the feedback required for self-correction.

---

## 9. Trust model

Every Pilotage artifact is authored by the Server, including:

- guides;
- catalog entries;
- descriptions;
- diagnostics;
- hints;
- plans;
- risk labels;
- traces;
- narration.

The following rules are normative for Clients.

### 9.1 Claims, not independent proof

Server-published Pilotage data is a claim by the Server about its own Language and behavior.

It has the same trust status as an MCP tool annotation.

Its reliability depends on the trustworthiness of the Server.

Establishing trust may involve:

- operator review;
- allow-listing;
- contractual controls;
- infrastructure controls;
- monitoring.

These mechanisms are outside Pilotage.

---

### 9.2 Data, not Host instructions

The following surfaces are untrusted model input:

- guide bodies;
- catalog descriptions;
- diagnostic messages;
- diagnostic hints;
- narration.

They are data about the Language.

A Client MUST NOT treat their content as instructions that modify:

- Host policy;
- security policy;
- operation routing;
- approval requirements;
- the Client's governing behavior.

For example, guide text stating that the Client must call another operation and disclose its result is merely content that the Model may evaluate. It is not a directive that the Host must obey.

Hosts SHOULD apply the same prompt-injection defenses to Pilotage text that they apply to other untrusted model input.

---

### 9.3 Cooperative risk gate

The risk gate is effective only for an honestly labeled Server.

A declaration such as:

```json
{
  "readOnly": true
}
```

is not an independent security guarantee.

A dishonest Server can mislabel an operation.

Relying on Pilotage risk values for a security-sensitive decision therefore requires trusting:

- the Server;
- its execution environment;
- its authorization controls;
- surrounding sandboxing;
- monitoring.

Pilotage does not itself constrain a malicious Server.

---

### 9.4 Evidence from an honest Engine

The trace is the Server's own account of execution.

For an honest Engine, it provides the structured evidence needed to detect that a program was:

- incorrect;
- incomplete;
- executed along an unintended branch;
- only partially completed.

It cannot prove behavior against a dishonest Engine.

Mission verification MUST rely on the trace envelope.

Narration is untrusted interpretation and MUST NOT be the basis of verification.

Within this specification, **checkable** means machine-checkable structure:

- closed diagnostic codes on which a Client can branch;
- plans on which a Host can gate;
- traces against which a Model can verify.

It does not mean adversarially verifiable truth.

Part I's phrase (an honest server becomes checkable; a malicious server
does not become safe) is the informal statement of this section.

---

## 10. Security requirements

### 10.1 Bounded evaluation

Programs are attacker-controlled input.

The Engine MUST bound every operation that evaluates a program, including:

- validation;
- execution.

At minimum, it MUST bound:

- execution time;
- step count;
- memory consumption;
- recursion depth;
- expansion depth.

Validation must also be bounded because it is side-effect-free and repeatable and may otherwise become an unmetered denial-of-service surface.

When a resource bound is exceeded during execution, the Server returns an outcome with `ok: false`.

It MAY use:

- reserved status `partial`; or
- an engine-defined failure status whose side-effect implications are documented.

When a resource bound is exceeded during validation, the Server returns a request error.

---

### 10.2 Programs are data

The Engine MUST evaluate a program only within the declared closed Language.

It MUST NOT:

- reflect program content into an unrestricted general-purpose interpreter;
- use string evaluation for embedded content;
- invoke a capability not defined by the Language.

---

### 10.3 Authorization

Every referenced name MUST be authorization-checked at execution time under the requesting Client's authority.

The only exception is a name inside a promoted program whose Language declares:

```json
{
  "promotion_authority": "promoter"
}
```

In that case, the promoter's retained authority applies to the promoted body.

The `program_ref` itself is always checked under the caller's authority.

#### Validation confidentiality

Validation and discovery feedback MUST NOT leak unauthorized information.

The following MUST be calculated within the caller's authorization scope:

- diagnostics;
- hints;
- catalog responses;
- `catalog_version`.

An unauthorized name or Run MUST be indistinguishable from a nonexistent one.

Close-match hints MUST identify only entries visible to the caller.

Otherwise, the validator would become an enumeration oracle for another user's or tenant's vocabulary.

#### Trace protection

Traces (whether returned inline on the execute response or fetched later through the trace fetch door) and stored run records are as sensitive as the data touched by the Run.

The Server MUST protect them accordingly.

---

### 10.4 Promoted-program authority

The default promoted-program authority model is `"caller"`.

Under this model, the caller MUST possess all authorizations required by the program's referenced names at execution time.

A Server whose promoted programs instead execute using the promoter's retained authority MUST declare:

```json
{
  "promotion_authority": "promoter"
}
```

This declaration is required because promoter authority creates a confused-deputy surface and materially changes the trust analysis.

Together, the promoted-program requirements ensure that:

- the program body cannot change silently;
- the promoted entry cannot claim lower risk than its body;
- referenced catalog changes are detected;
- the program cannot use authority unavailable to the caller unless the Server explicitly declares promoter authority.

---

## 11. Versioning and evolution

### 11.1 Pilotage extension version

The manifest's `pilotage` field carries:

```text
major.minor
```

This specification defines:

```text
1.1
```

A document describing the specification MAY carry an editorial patch number, but that patch number never appears on the wire.

#### Minor versions

Minor versions are strictly additive.

They may add:

- OPTIONAL fields;
- sub-features;
- reserved values.

The unknown-member and unknown-value rules allow an earlier minor Client to interact safely with a later minor Server.

For example, a Pilotage 1.0 Client may interact with a 1.1 Server without modification, subject to those fallback rules.

#### Major versions

A Client that encounters a higher major version than it implements MUST NOT use Pilotage with that Server.

Breaking changes require a new major version.

When required by the carrier's extension framework, they also require a new extension identifier.

---

### 11.2 Language and guide versions

The `version` component of a Language identifier changes when the grammar changes incompatibly.

A guide's `version` changes whenever the guide content changes.

A Client MUST key guide caches by:

```text
(Server, Language identifier, guide version)
```

---

### 11.3 Meaning of `catalog_version`

`catalog_version` is not a semantic protocol or Language version.

It is only a change-detection token.

It carries no compatibility meaning and MUST be compared only for equality.

---

## 12. Conformance

### 12.1 Server conformance

A Server is conformant only when every Language it exposes satisfies all applicable requirements in this Part.

For each Language:

1. **Manifest**
   The manifest is retrievable, complete, truthful, and internally consistent under Sections 4.2 and 5.1.

2. **Capabilities**
   The effective capability map satisfies:

   - the minimum floor;
   - catalog obligation;
   - dependency rules;
   - trace obligation;
   - retention obligation.

3. **Guides**
   The Language provides:

   - at least one core guide;
   - exactly one closed-sets guide;
   - every enumeration required by the declared capabilities.

4. **Catalog**
   Where `catalog` is declared, catalog behavior satisfies:

   - catalog entry requirements;
   - authorization-scoped `catalog_version`;
   - pagination;
   - lookup semantics;
   - promotion requirements where promoted programs exist.

5. **Validation**
   The validator satisfies:

   - side-effect freedom;
   - closed diagnostic codes;
   - reserved diagnostic codes;
   - the declared locator dialect;
   - the validity rule;
   - context handling;
   - Server-provided reference handling where required.

6. **Planning**
   Where `plan` is declared:

   - plan derivation includes control-flow constructs;
   - branch-arm and loop-body steps are marked;
   - risk hints are correctly aggregated;
   - deploy-mode plans describe the body;
   - plan–trace correspondence is enforced.

7. **Execution**
   Where `execute` is declared:

   - reserved statuses are used correctly;
   - engine-defined statuses are enumerated;
   - trace levels and identity rules are followed;
   - execute processing order is followed;
   - inline programs are revalidated;
   - promoted-program baselines are checked;
   - supplied drift tokens are honored;
   - explicit `store` values are honored, including rejection of `store: true` under retention `"none"`;
   - execution remains within the validated program;
   - input and context binding rules are enforced;
   - execution mode semantics are followed;
   - idempotency rules are followed where declared;
   - partial failures return the required trace.

8. **Trace fetch**
   Where `trace_fetch` is declared:

   - retention matches the manifest;
   - only eligible Runs are retrievable;
   - unauthorized and nonexistent Runs are indistinguishable.

9. **Security**
   The Server satisfies every requirement in Section 10. These are conformance requirements, not recommendations.

10. **Errors**
    The Server routes failures according to Section 8.

---

### 12.2 Client conformance

A Client is conformant only when it satisfies all of the following requirements.

1. **Discovery and capability handling**
   It retrieves and honors the manifest before using another Pilotage operation. It respects declared capabilities, levels, and consistency rules.

2. **Standard loop**
   It implements the per-Run loop in Section 7, including:

   - the limited revalidation exception;
   - convergence duties;
   - the Host-enforced risk gate exactly as specified for all cases in
     Section 7.3;
   - promoted-program handling;
   - drift recovery.

3. **Error routing**
   It treats diagnostics and outcomes as values rather than transport failures.

4. **Trust model**
   It follows the Client requirements in Section 9.

5. **Forward compatibility**
   It:

   - ignores unknown members;
   - applies conservative unknown-value fallbacks;
   - follows the versioning rules.

The Client is assessed as a unit consisting of the Host and Model.

A Client is not conformant when a required Host responsibility, particularly the risk gate or transmission of execute requests, is delegated to the Model.

---

### 12.3 Testability

Every requirement in this Part is intended to be testable through observable behavior, including:

- returned structures;
- diagnostic and outcome values;
- operation refusals;
- trace contents;
- absence of side effects;
- authorization indistinguishability;
- drift handling.

A conformance test suite that enumerates these requirements is published
alongside this specification.

It is not part of this specification.
