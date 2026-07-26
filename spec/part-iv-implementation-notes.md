# Part IV: Implementation Notes

**Status: Informative**

This part contains no normative requirements.

It records practical lessons from the first Pilotage reference implementation: an agent gateway mounted on a production workflow-automation engine. It also provides implementation guidance for both Servers and Clients.

Where this part appears to conflict with Part II or Part III, the normative text in Parts II and III governs.

Uppercase BCP 14 requirement keywords are intentionally avoided here. A lowercase "must" may restate a requirement whose normative form appears elsewhere in the specification, but it does not create a new requirement in this part.

---

## 1. Adopting Pilotage on an existing engine

Most systems suited to Pilotage already contain much of the required machinery.

The implementation work is usually not building a new execution engine. It is exposing existing engine knowledge and behavior through the Pilotage model.

A typical mapping looks like this:

| Pilotage capability | Typical existing engine artifact | Usual work required |
|---|---|---|
| Manifest | Engine and product metadata, declared limits, retention policy | Assemble the welcome card served at the MCP handshake |
| Guides | Authoring documentation, grammar references, and closed vocabularies | Split the material into a small core guide, focused reference topics, and the required closed-sets guide |
| Catalog | Registry of connected sources, capabilities, entities, or other live objects | Expose list and get operations and compute an authorization-scoped `catalog_version` |
| Validate | Existing document or query validators | Wrap the validator and classify messages into a closed diagnostic-code set |
| Plan | Information derivable from the program and catalog risk metadata | Usually a small derivation layer |
| Execute | Existing run or evaluation endpoint | Add drift checks, revalidation, input binding, and Pilotage request fields |
| Trace (inline door) | Existing run records and step outcomes | Add stable step identities, per-step inputs and outputs, and control-flow decisions |
| Trace (fetch door) | Run-record retrieval | Add retention-aware storage, `store`-flag handling, and a fetch tool (e.g. `trace_run`) |
| Promotion | Existing mechanism for saving a workflow, rule, or query | Add immutable references and promotion-baseline recording |

The pieces most likely to be genuinely new are:

- static plan derivation;
- explicit branch and loop decision records in the trace.

In the reference implementation, both were smaller additions than expected. The engine already computed the relevant information during validation or execution. The main work was preserving and exposing it in a stable shape.

---

## 2. Adapting existing diagnostics

Part II permits two approaches to closed diagnostic codes:

- **native**: the validator emits stable codes directly;
- **adapted**: a classification layer maps existing validator output into the closed code set.

The adapted approach is a practical starting point for engines that already have mature validators.

A useful implementation pattern is:

1. Leave the existing validator unchanged.
2. Add an ordered classification layer over its messages.
3. Map recognizable message patterns to declared diagnostic codes.
4. Extract useful values, such as an unknown name, and use them to produce locators or close-match hints.
5. Route every unmatched message to the reserved `constraint` code.
6. Derive the best available locator from the validator's position information.
7. When exact position data is unavailable, attach the finding to the nearest meaningful addressable node rather than inventing coordinates.

For example, a validator message shaped like:

```text
unknown capability 'cap_read_user_profil'
```

might map to:

```json
{
  "severity": "error",
  "code": "unknown_capability",
  "path": "/steps/0/capability",
  "message": "unknown capability 'cap_read_user_profil'",
  "hint": "close match: cap_read_user_profile"
}
```

The important fallback is `constraint`.

A newly introduced engine message should degrade to a complete diagnostic carrying the catch-all code:

```json
{
  "severity": "error",
  "code": "constraint",
  "path": "",
  "message": "<the engine's original message>"
}
```

rather than escaping as an undeclared string.

This keeps the diagnostic set closed without requiring invasive changes to the underlying validator.

---

### 2.1 Evolving closed diagnostic sets

The adapter model creates a natural evolution path.

Within one Language version, previously unseen failure shapes remain classified as `constraint`.

When one recurring failure shape becomes important enough to deserve its own code:

1. introduce the new code with a new Language version;
2. add it to the closed-sets guide;
3. update the guide version so Client caches refresh;
4. update the classification layer.

This preserves the rule that engine-defined sets remain fixed for a given Language version.

A Client encountering a code absent from its cached closed-sets guide should treat it like an unclassified constraint and refresh the guide index. The index is metadata-only and inexpensive to retrieve.

---

## 3. Computing `catalog_version`

The reference implementation computes `catalog_version` as a deterministic content hash.

The hash input contains every defined field of every catalog entry visible to the requesting Client, except `revision`.

This matches the fields whose changes Part II requires the token to reflect.

Data outside the catalog-entry contract may be excluded, such as:

- live health statistics;
- usage counters;
- transient timestamps;
- operational metrics.

Defined entry fields should not be excluded merely because they appear descriptive.

For example, changes to:

- `name`;
- `description`;
- `output_schema`

are required to change the token under Part II.

Omitting them would allow the Client to validate against one visible catalog state and execute against another without detecting drift.

The content-hash approach provides two useful properties.

#### Stability

The same visible catalog produces the same token across:

- processes;
- restarts;
- horizontally scaled instances.

This is especially valuable in stateless deployments, where any Server instance may receive the next request.

#### Selectivity

Excluding truly volatile, non-contract data prevents unnecessary token churn.

A token that changes constantly causes repeated `catalog_drift` refusals and makes drift protection less useful.

#### Authorization scope

Part II Section 5.4 requires the token to be computed within the requesting Client's authorization scope: a single global token is non-conformant wherever visibility differs between callers.

The token is therefore computed over the requesting Client's visible catalog only.

This avoids:

- leaking that another tenant's catalog changed;
- producing drift because of entries the Client cannot see;
- creating cross-tenant side channels through token churn.

In a per-tenant catalog architecture, this often follows naturally because the tenant-filtered catalog is already the hash input.

---

## 4. Wiring and testing

### 4.1 Build-and-boot smoke testing

One of the most instructive failures in the reference implementation was not a semantic bug.

Every handler-level unit test passed, but the first deployment entered a crash loop because the endpoint had been wired incorrectly into the application. The tests imported handlers directly and never constructed the production application.

A Pilotage implementation benefits from a smoke test that builds and starts the real application in the same way production does.

That test should verify at least:

- the application starts successfully;
- the Pilotage endpoint is mounted;
- the manifest can be retrieved;
- the Pilotage tools appear in `tools/list`.

Integration failures frequently occur at the wiring boundary rather than inside the handlers.

---

### 4.2 Testing both sides of every closed surface

The reference implementation organizes conformance evidence around a simple rule:

> Every closed-set surface should have both a concrete accepted case and a concrete rejected case.

The rejected case should fail through the correct Pilotage value channel, not through a crash or an unrelated transport error.

A useful minimum test catalog includes:

- one successful request and one request-error case for every operation that defines request errors (discovery defines none; its failure surfaces are carrier-level);
- one example of every reserved diagnostic code and every reserved outcome status that is reachable under the Language's declared capabilities;
- direct execution of an invalid program, producing `validation_error` with no side effects;
- execution with a stale catalog token, producing `catalog_drift` with no side effects;
- a branching program whose trace contains the decision record;
- a partially failing program whose response contains the trace produced so far;
- where the trace fetch door is declared, an execution with `store: true` followed by a fetch of the same trace by `run_id`;
- a trace fetch with an unknown or unstored `run_id`, producing the `not_found` request error;
- on an engine declaring retention `"none"`, an execution requesting `store: true`, producing the `unsupported` request error with no side effects;
- a malformed JSON-RPC request producing a carrier error;
- an unknown tool producing a carrier error.

Not every reserved value is necessarily reachable in every implementation.

For example:

- `promotion_drift` requires promoted programs;
- `catalog_drift` requires a catalog-bearing Language;
- `constraint` must belong to the closed diagnostic set, but a fully native validator may never need to emit it.

Membership in the closed set is required even when a concrete reachable case does not exist.

A completeness script can compare:

- declared diagnostic codes;
- declared outcome statuses;
- declared request-error kinds;

against the test catalog and fail the build when a reachable value lacks coverage.

---

### 4.3 Test through the real endpoint

Handler tests do not exercise many of the layers that fail in production:

- request parsing;
- MCP session handling;
- transport headers;
- result envelopes;
- schema validation;
- JSON-RPC error mapping;
- tool registration.

The most valuable end-to-end tests drive the real endpoint through the complete loop:

```text
discover
→ learn
→ lookup
→ validate invalid program
→ validate corrected program
→ execute with trace (store: true)
→ fetch the stored trace by run_id
```

The reference implementation used:

- real validators;
- the real runner;
- the actual MCP endpoint;
- in-memory substitutes only at external storage boundaries.

---

## 5. Execution and trace implementation

#### Opt-in engine tracing

When adding Pilotage to an existing runner, trace collection is often least invasive as an optional internal parameter.

Existing engine callers can continue with tracing disabled, while the Pilotage gateway enables it for Pilotage Runs.

This internal default should not be confused with the Pilotage wire behavior.

At the Pilotage surface:

- absent `trace_level` requests the Language's declared ceiling;
- the gateway therefore enables tracing unless the effective request level is `none`.

#### Emit a flat trace directly

The flat trace model is easiest to implement by appending one entry to a single ordered list when each step executes.

Building a nested tree and flattening it later creates unnecessary identity and ordering problems.

Iteration-qualified identifiers can be derived from an execution-context stack containing the active loop counters.

For example:

```text
fetch-user#1
fetch-user#2
outer-step#2#3
```

#### Shared run storage

Retention that outlives a process requires shared storage.

The reference implementation stores bounded, tenant-scoped run records in shared storage and expires them according to the declared retention policy.

This allows any Server instance to answer a trace fetch: one trace, two doors. The trace rides the execute response, and if the run was stored, the same envelope can be fetched later by `run_id`.

#### Honoring the `store` flag

The optional `store` field on the execute request modulates retention per run:

- **omitted**: the declared retention policy governs, exactly as before;
- **`store: true`**: the run record must be retained for later trace fetch. An engine declaring retention `"none"` cannot honor this and must refuse the request with an `unsupported` request error, before any side effect (never silently ignore the flag);
- **`store: false`**: the record must not be retained beyond the response. Deletion or non-persistence should be verified, not assumed; a background expiry job is not sufficient to satisfy `store: false`.

`run_id` is always returned regardless of storage: it identifies the run in-band even when nothing is retained. The inline trace also always rides the execute response per the effective trace level; the `store` flag governs only whether the fetch door can later find the run.

The `store: true` refusal check belongs with the other pre-execution refusals (drift, revalidation): it must fire before execution begins, so nothing runs whose promised retention cannot be honored.

Two further details matter.

##### Persist before responding when durability is promised

A duration-based retention value is a durability commitment, and an accepted `store: true` is the same commitment made per run.

Returning the execution response before the run record is durably stored creates a failure window:

- the process may crash after responding;
- a trace fetch may not find a Run that was just reported as retained.

A Server promising duration retention, or accepting `store: true`, should complete the durable write before returning the execution response.

Otherwise, it should declare:

- `"session"`; or
- `"none"`.

##### Preserve the declared trace level

A storage-size limit must not silently remove fields required by the stored trace level.

A record labeled `full` is no longer a full trace if required inputs or outputs were truncated before retrieval.

A practical implementation can:

- bound individual step payloads before constructing the trace; or
- downgrade and report the trace as `summary` when full retention cannot be honored.

---

## 6. Execute revalidation and validation cost

Part II requires every inline program to be validated again during execute before any side effect occurs.

For engines with expensive validation, a cache avoids duplicating work.

A useful cache key is:

```text
(program hash, catalog_version, context hash)
```

When the Client follows the standard loop:

1. `validate` computes and caches the result;
2. execute confirms that `expected_catalog_version` is still current;
3. the revalidation guard retrieves the cached verdict.

When the Client skips the separate validate call:

1. execute performs validation;
2. the result is cached;
3. execution proceeds only when valid.

Validation itself also needs resource limits.

Because it is:

- side-effect-free;
- repeatable;
- cheap for a Client to invoke;

an unbounded validator can become a denial-of-service surface.

A validation resource-limit breach becomes a `bounds_exceeded` request error (Part II Section 10.1), not a hung request.

---

## 7. Text-valued Languages

The first reference implementation used a structured workflow Language with native step identifiers.

Text-valued Languages, such as SQL families, can satisfy the same model using derived structures.

One practical mapping is described below.

#### Statements as steps

Treat each top-level statement as one program step.

Assign deterministic identifiers in source order:

```text
stmt-1
stmt-2
stmt-3
```

This keeps identifiers stable between the plan and trace for the same text and catalog snapshot.

#### Statements referencing multiple catalog entries

One statement may reference several catalog entries.

For example, a SQL join may reference multiple relations.

Because one plan step's `calls` field identifies one reference, a clean derivation is:

1. emit the statement itself as a non-referencing step;
2. emit one deterministic reference sub-step for each resolved name, in resolution order.

Example:

```text
stmt-2
stmt-2.ref-1
stmt-2.ref-2
```

Each reference sub-step carries exactly one `calls` value.

The ordering and identifier scheme should be documented in the closed-sets guide and reproduced exactly in the trace.

#### Risk derivation

Risk can be derived from the statement class and the referenced object.

For example:

- a read-only query maps to `readOnly: true`;
- data-changing statements map to write risk;
- schema-destructive statements map according to the Engine's destructive taxonomy.

#### Native query-plan (`EXPLAIN`) facilities

A database or query engine's native `EXPLAIN` output may help derive a Pilotage plan when it is:

- stable;
- deterministic enough for the contract;
- side-effect-free.

Where those properties do not hold, the Pilotage plan should be derived from parsed statement structure rather than exposing unstable optimizer output as the plan contract.

#### Locators

Text-valued Languages should use the `text-range` locator dialect.

The generated step-identifier scheme should be documented so a Client can correlate:

```text
stmt-2
```

with the second statement it authored.

---

## 8. Idempotency in practice

Declared idempotency is only reliable when both storage and concurrency are handled correctly.

#### Storage and atomic key claims

Idempotency records should use shared storage, like retained Run records.

Each record typically contains:

- the idempotency key;
- a hash of the runnable;
- a hash of the input;
- the recorded execution response.

The record should be retained for at least the declared retention period.

The key should be claimed atomically before execution begins.

A conditional insert or equivalent operation ensures that two concurrent requests with the same key result in:

- one execution;
- one recorded result;
- one replay response.

Checking for the key only after execution does not prevent duplicate effects.

The claim should occur after pre-execution refusal checks succeed, or it should be released when the request is refused.

Refused Runs are not replay records.

This matters during drift recovery: an *unchanged* retry with the same key must execute rather than replay the refusal, while a *corrected* retry (a changed runnable or input) must use a fresh key, since Part II treats a reused key with a different payload as a request error.

#### Client timeout behavior

The primary idempotency scenario is uncertainty after a timeout.

A Client should set its execute timeout above the Server's expected execution bound.

When a timeout still occurs and idempotency is declared, the Client can retry with the same key.

The retry will either:

- return the recorded result of the first attempt; or
- execute once if the first attempt never started.

Without declared idempotency, automatic retry is unsafe. The Client should surface the decision instead.

---

## 9. Authoring guides

#### Core guide composition

The core guide's size recommendation forces deliberate selection.

A useful core guide contains:

- the minimal top-level grammar;
- the essential step or statement shape;
- one complete runnable example;
- the parameter-binding convention;
- pointers to reference topics.

The following generally belong in reference guides:

- complete enumerations;
- edge cases;
- per-entry-kind detail;
- advanced control flow;
- uncommon operators.

A useful quality test is:

> After reading only the core guide, can a Client produce a structurally meaningful program whose remaining failures are only unresolved live names?

If so, the catalog can provide the missing environment-specific information.

#### Verify documentation against engine behavior

Guide examples should be tested against the actual Engine.

The reference implementation found a branch-scope documentation error: the guide showed a result being addressed through the branch object, while the Engine actually exposed it in the parent scope.

The authoring agent reproduced the incorrect path exactly.

This illustrates why:

- the closed-sets guide is required to state scope rules (Part II Section 5.2 makes omitting them a conformance violation);
- documentation should be derived from actual Engine behavior;
- every executable example should be passed through validation during the build.

#### Refuse near-miss mechanisms loudly

When an Engine offers two mechanisms that an agent can plausibly confuse
(an installed, event-triggered automation versus a stored program run on
demand; a one-shot execution versus an installation), silent tolerance of
the wrong pairing is where a wrong mental model survives.

The reference implementation observed this end to end: an agent authored
a correct automation, executed it in one-shot mode, and the Engine
silently ignored the declared trigger. The agent then reported success
with nothing installed. Every later signal was honest, and the agent
misread all of them; the one moment the misunderstanding could have been
corrected cheaply was the first request.

The remedy is a validation refusal at that moment, with the repair in the
hint: the wrong pairing returns the existing closed diagnostic code and a
hint naming the correct mechanism. Wherever descriptions name one
mechanism with words that also describe its near-miss, state the
difference in both descriptions explicitly.

The same discipline applies to request errors: a `not_found` for a
mis-guessed guide or entry identifier should name the valid choices when
the set is small, and an `invalid_request` for an undeclared sub-feature
should say what to call instead. An uninstructed agent recovers exactly as
well as the refusal it is holding.

---

## 10. Deployment topology

#### Mount Pilotage on the execution surface

A Pilotage endpoint executes or deploys programs.

It should therefore live with the system that owns:

- execution;
- authorization;
- tenant identity;
- run storage;
- catalog visibility.

It generally does not belong on a separate configuration or administration plane.

#### Stateless instances and logical sessions

The Pilotage loop uses ordinary request-response interactions.

A live logical Session does not require a permanently held socket.

The reference implementation keeps no per-instance run state.

Instead:

- run records live in shared storage;
- any instance may serve the next request;
- horizontal scaling remains straightforward;
- no Server-initiated stream is needed.

#### Convert failures at the correct layer

Only carrier-level faults should become JSON-RPC errors, such as:

- malformed request bodies;
- unknown methods;
- unknown tools;
- invalid envelopes;
- structural schema failures.

Other failures should be converted into Pilotage values.

The key dividing line is whether execution began.

Before execution begins:

- an unexpected Engine failure becomes an `internal` request error.

After execution begins:

- a failure becomes an outcome with `ok: false` (`partial` or a documented engine-defined status);
- the response includes the trace recorded so far when applicable.

A failed started Run is never converted into a request error; Part II's error model forbids it.

---

## 11. Schema authoring in practice

Part III's permissive loop-schema rules exist to preserve deterministic error routing.

Many MCP SDKs automatically validate tool arguments against `inputSchema`.

If a loop-tool schema uses:

```json
{
  "additionalProperties": false
}
```

or declares value enums for reserved fields, the SDK may reject the request before Pilotage logic runs.

That moves faults such as:

- unsupported `trace_level`;
- unexpected `context`;
- unsupported `mode`;
- invalid runnable selection

onto the wrong error channel.

Loop-tool schemas should therefore constrain types and basic structure only. Value and eligibility checks should occur inside the Pilotage handler.

Output schemas require similar care.

A Pilotage tool may return:

- one or more success shapes;
- a request-error shape.

An `outputSchema` that describes only successful responses may cause a Host or SDK to reject the first legitimate request-error result.

The `anyOf` union covering every possible `structuredContent` shape (success shapes plus the request-error shape) is required by Part III Section 6; this section only explains why violating it bites quickly in practice.

---

## 12. Client implementation notes

#### Put the gate and transmission in Host code

The Host risk gate and the transmission of execute requests must not live in the prompt; Part II Section 12.2 makes delegating either to the Model a conformance failure.

A natural design is a Host interception layer placed between:

- the Model's requested tool call;
- the MCP transport.

That layer can:

1. recognize a pending Pilotage execute call;
2. retrieve the relevant plan or promoted-entry risk;
3. evaluate `risk_hints`;
4. pause for approval where required;
5. transmit the request only after policy succeeds.

This satisfies both Host responsibilities in one place.

A prompt instruction such as:

```text
always ask before destructive actions
```

is not equivalent to an enforced risk gate.

#### Cache guides by the complete identity

Guide caches should use:

```text
(Server, Language identifier, guide version)
```

The guide index should be refreshed:

- after a tool-list change notification;
- when a diagnostic code is absent from the cached closed-sets guide;
- after rediscovery suggests a manifest or Language change.

Because the index contains metadata only, it is inexpensive to fetch.

The Client can then compare guide versions and retrieve only bodies that changed.

#### Retrieve guides according to task signals

A practical retrieval strategy is:

1. always fetch the core guide;
2. fetch reference topics only when a task signal points to them.

Signals may include:

- a diagnostic code that requires explanation;
- an unfamiliar catalog kind;
- a question about branch or loop scope;
- an input-binding issue;
- a trace or outcome status not yet understood by the Model.

Client code should branch on structured protocol fields, such as:

- diagnostic codes;
- outcome statuses;
- request-error kinds;
- `risk_hints`;
- boolean validity and success fields.

Server-authored prose should remain content for the Model to evaluate.

It should not be a parsing target for Client policy code.

---

## 13. What the first implementation demonstrated

The first reference implementation was mounted on an Engine that already provided:

- validators;
- a program runner;
- Run records;
- a capability registry.

The resulting Pilotage gateway added:

- the manifest;
- guides;
- the catalog;
- validate;
- execute;
- trace fetch;
- diagnostic classification.

The only required change inside the Engine was an optional trace-collection parameter.

The existing Engine test suite continued to pass unchanged.

The complete loop operated over ordinary request-response interactions in production:

```text
learn
→ author
→ validate with closed diagnostics
→ inspect the risk plan
→ execute with trace and decisions
→ fetch the stored trace
```

The agent sits at the center of that loop (manifest → guides → catalog → validate + plan → execute → trace), deciding what to call and when; the order above is one common path, not a required sequence.

The areas requiring the most genuine design work were:

- trace identity;
- closed diagnostic classification;
- catalog drift tokens;
- plan derivation.

Those are precisely the areas the specification now defines explicitly.

The intended Pilotage adoption model is therefore not to move Engine intelligence into a new external system.

The knowledge already exists inside the Engine.

Pilotage gives that knowledge one standard, discoverable, and checkable surface.
