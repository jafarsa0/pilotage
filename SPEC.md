# Pilotage — an MCP extension for guided program authoring and verified execution, v1.0 (draft)

**The Pilotage extension lets agents safely author and execute PROGRAMS — not
just call tools — against any live system, and converge on a result that is
both fully and correctly achieved.**

- Status: v1.0 DRAFT — first drafted 2026-07-13/14.
- Author: Jaafar Nadher Jaafar Alaboosi.
- Naming note: *pilotage* is a real word from the sea and the air — navigating
  by reference to the environment's own marks and lights. Guidance that comes
  FROM the surface is the whole thesis, so the name is the thesis. Pilotage is
  an **extension** over MCP — a set of conventions using MCP's own primitives —
  and is never called a protocol.
- The extension is deliberately engine-neutral; the three worked examples in §9
  come from three different worlds (SQL analytics, home automation, and a
  workflow-automation engine).

---

## 0. The idea in four sentences

MCP taught agents **what to call**: tools with JSON-Schema inputs. But a schema
can only describe a *record* — it cannot teach a *language*. The moment a tool's
argument is a **program** (a SQL query, an automation rule, a workflow document),
the agent needs four things no schema can carry: the **grammar** of the language,
the **live world** the program refers to, a **checker** that catches mistakes
before execution, and a **trace** that proves afterwards the program did the
right thing. Pilotage is a small, standard shape for exactly those four things —
so that one generic agent loop works against ANY system that adopts it.

> **Schemas teach the moves. Pilotage teaches the game.**

In one line against the state of the art:

> **MCP gave servers a user manual. Pilotage turns the user manual into a
> checkable contract.**

---

## 1. Motivation — the two problems

### Problem A — program-valued arguments

A tool like `run_workflow {workflow: object}` or `query {sql: string}` is legal
MCP, but its schema says nothing an author needs: not the expression syntax, not
the step kinds, not which names exist to reference, not the semantic rules
("step ids must be unique", "this function takes two arguments"). JSON-Schema
describes *records*; programs are *sentences in a language*. Today every
provider papers over this gap with prose: descriptions carrying folklore
("call X before Y"), README files, cookbooks, few-shot examples, llms.txt,
skills files, and MCP's own `InitializeResult.instructions`. All prose. None
machine-checkable. No standard place to look.

### Problem B — converging on "fully and correctly"

Even a syntactically perfect program can be *logically* wrong, and a
plausible-looking result can hide the bug: a filter that matched zero rows plus
a default fallthrough produces output that LOOKS fine. Human developers catch
this with compilers, debuggers, `EXPLAIN ANALYZE`, traces. Agents today receive
only the return value — they cannot distinguish "correct" from "plausible".
And for the *fully* half: only the agent knows its mission, so it needs
**evidence** (a trace of what actually happened) to verify the mission is met.

### The two problems are one loop

```
LEARN the language → AUTHOR a program → CONVERGE on correct
   (guides)            (catalog + draft)   (validate → plan → execute → trace)
```

MCP lets agents **call**. Pilotage lets agents **compose and converge**.

### Evidence this layer is real: convergent evolution

Within ~2 years, the ecosystem independently grew fragments of this layer, with
no shared standard: MCP added `prompts` + `resources` (proto-guides, free-text)
and `InitializeResult.instructions` (a per-server prose manual); Anthropic
launched Agent Skills (SKILL.md — packaged how-to, now an open standard with
40+ adopters); the web grew llms.txt; repos grew AGENTS.md /
.cursorrules; tool builders attached few-shot examples; and MCP's 2025 spec added
risk hints (`destructiveHint`) — conceding schemas weren't even enough for
*safety*. When everyone reinvents the same organ, the organ is real. Pilotage
names it and gives it one shape — and, crucially, makes it **checkable**
instead of prose.

---

## 2. Prior art & positioning

Pilotage sits in a busy, healthy neighborhood. The honest way to position it is
to name the neighbors precisely and state, for each, what it does, what it
deliberately does not do, and how the Pilotage extension relates. (Adversarial
prior-art review, 2026-07-16; all six verified.)

> **MCP gave servers a user manual. Pilotage turns the user manual into a
> checkable contract.**

> **Skills are the textbook. Pilotage is the chart, the pre-flight check, and
> the voyage log.**

### 2.1 The six neighbors

| Neighbor | What it does | What it deliberately doesn't | How Pilotage relates |
|---|---|---|---|
| **Anthropic Agent Skills** (agentskills.io; launched 2025-10-16, open standard 2025-12-18, 40+ adopters) | Teaches agents how to do TASKS via packaged prose (SKILL.md); owns the territory "MCP connects, Skills teach" | No machine-checkable contract: no validator, no live catalog, no plan, no trace | **Complement — different territory.** Skills teach tasks in prose; Pilotage covers surface self-instruction for *program-valued arguments*, checkable end to end |
| **MCP core `InitializeResult.instructions`** | The official per-server prose manual — the MCP blog literally calls it "giving LLMs a user manual for your server", and recommends validate-before-mutate sequences AS PROSE | The manual is free text: nothing enforces, checks, or structures it | **Extend.** Pilotage turns the user manual into a checkable contract |
| **SEP-2640** — Skills over MCP (`experimental-ext-skills`, draft merged 2026-04) | Standardizes servers serving skills on-connection (`skill://index.json`) — guidance is moving server-side in core | Skills remain prose; no validate, no plan, no trace | **Align / interoperate.** Pilotage adopts it as a guide-distribution channel where available; it does not compete with it |
| **SEP-1303** (Final; in core 2025-11-25) | Validation errors flow into model context for self-correction | Post-hoc, free-text, and only AFTER a real call has run | **Complement.** Pilotage adds the *pre-run*, side-effect-free, structured validate with a closed code enum |
| **SEP-1862** — `tools/resolve` (draft) | Pre-flight refinement of per-operation `readOnlyHint`/`destructiveHint`; explicitly LSP-resolve-inspired | Single-call metadata only: no argument validation, no multi-step plan | **Complement / extend.** Pilotage adds the multi-step plan with per-step risk, plus diagnostics |
| **A2A Traceability Extension** (optional sample) | Step ids, cost, latency on agent-to-agent runs | No per-step inputs/outputs, no branch decisions | **Neighbor.** Pilotage's trace adds per-step I/O and `decisions[]` with reasons |

### 2.2 What remains uniquely Pilotage

Verified unoccupied as of 2026-07-16:

1. the **versioned catalog** with `catalog_version` anti-drift;
2. the **mandatory side-effect-free validate** with LSP-shaped, closed-code
   diagnostics;
3. the **multi-step plan** with per-step risk;
4. the **trace envelope** with `decisions[]` + reasons;
5. the **program-in-grammar declaration** (`_meta` language binding);
6. the **standardized end-to-end client loop** (§6.10).

Equally honest about what is NOT novel: the competence-layer *framing* and the
LSP-inspiration *rhetoric* are established idioms (SEP-1862 cites LSP resolve;
MCP itself is LSP-inspired). Pilotage uses those patterns; it does not claim
them. The durable differentiation is not where guidance lives (client vs
server — SEP-2640 is closing that gap) but what guidance IS: **prose vs
checkable**.

### 2.3 The scalability argument — separation of concerns (N×M → N+M)

Pilotage's deepest structural effect is a classic **separation of concerns**:
it moves *guidance* out of the AGENT and into the SURFACE. The provider of the
tool becomes the teacher. Any agent can connect to any surface that teaches;
any surface that teaches can be understood by any agent.

**The problem today, with a live specimen.** One of the best agent-browser
integrations in production — a leading coding agent driving a browser through
MCP — works because the competence layer was built BY HAND, client-side, for
that one pairing. Four knowledge sources carry it: (1) pretraining (what a
browser is); (2) a browser-specific guide hardcoded into the agent's system
prompt ("always fetch the tab context first", "never reuse tab ids", "avoid
dialogs"); (3) usage folklore stuffed into the server's tool-description
strings; (4) runtime errors that teach ("Tab no longer exists — fetch the tab
context again"). Look closely and that integration has independently grown
every Pilotage organ, ad hoc: the tab-context call is a live **catalog** verb,
screenshots and page reads are the **trace**, the instructive errors are
**diagnostics**, and the prompt section is the **core guide**. Convergent
evolution, once more.

**The cost of the bespoke arrangement is multiplicative.** Competence built
into one side for one pairing works for exactly that pairing: N agents × M
surfaces = **N×M** hand-built integrations. The agent tuned for one browser
gets nothing when it meets a different browser's MCP server; a different agent
connecting to the same browser gets less than the tuned one. Every good
pairing is bespoke.

**Pilotage makes it additive.** When the surface carries its own competence —
guides, catalog, diagnostics, trace — each surface writes its knowledge ONCE,
each agent implements the standard loop ONCE, and every pairing works: **N+M**.
The learning becomes the surface's responsibility, exactly where the knowledge
lives anyway (who knows a browser's session rules better than the browser's
maker?).

Three honest bounds: (a) Pilotage moves the *integration-specific* knowledge,
not general intelligence — pretraining still supplies "what a browser is";
Pilotage carries the private delta. (b) A hand-tuned flagship pairing may beat
a generic Pilotage connection at first. That is LSP's exact history: bespoke
IntelliSense won early; the standard raised the floor for the long tail, then
the head migrated because maintaining N×M by hand does not scale. (c) "Guidance
moves server-side" is NOT by itself the differentiator — SEP-2640 is
standardizing server-served prose skills in core. What N+M requires, and what
only Pilotage supplies, is that the surface's knowledge be **checkable**:
diagnostics the agent can act on, a plan it can gate on, a trace it can verify
against — not prose it can only hope it understood.

---

## 3. Positioning: an MCP extension

### 3.1 Why not "just MCP"?

MCP's primitives don't contain this layer:
- **Tools** carry JSON-Schema — records, not grammars.
- **Resources** are *application-controlled* context data (files, DB rows,
  logs — often dynamic, subscribable). Using them as "manuals the model studies"
  works on the wire but is a *repurposing*: no MCP primitive has the defined
  meaning "the model must read this before authoring arguments for that tool."
- **Prompts** are user-picked recipes, not machine-consumable contracts.
- **`InitializeResult.instructions`** is the closest thing to a manual — and it
  is prose, unstructured and uncheckable by design.

Pilotage supplies precisely the missing semantics — by convention *on top of*
MCP.

### 3.2 Extension identity

Pilotage is built as a first-class citizen of the MCP **extensions framework**
(2026-07-28 release candidate):

- **Extension id**: the reverse-DNS identifier **`io.github.jafarsa0.pilotage`**
  (the id is grounded in the author's GitHub namespace; it can migrate to a
  pilotage-owned domain in a later revision without changing the extension's
  semantics).
- **Negotiation**: clients and servers declare the extension in the
  `extensions` capability map exchanged at `initialize` — a client that
  understands Pilotage advertises it; a server that implements it confirms it.
- **Repo convention**: `ext-pilotage`, following the extensions framework's
  repo-naming convention.
- **Adoption path**: the Extensions Track of the SEP process — the route the
  framework defines for community extensions to be reviewed and, if earned,
  promoted.

Why an extension and not a standalone effort? Adoption economics. MCP won the
interface layer: agents, clients, auth and transports already exist. Everything
Pilotage needs is expressible as MCP tools + resources + one manifest + `_meta`
conventions. A standalone effort would pay a cold-start cost for zero
expressive gain. If the Pilotage extension earns gravity it can graduate
through the Extensions Track (the GraphQL path: convention first, standard
after).

### 3.3 The proof the shape works: LSP

The Language Server Protocol standardized how an editor gets language help
(diagnostics, hovers) from ANY language server **while standardizing zero
languages** — it standardized the *interaction verbs* and *report envelopes*
only. It scaled to hundreds of languages. Pilotage is "LSP for agents authoring
programs against live systems, plus runtime feedback" — the piece LSP never
needed because editors don't execute.

One honest note: LSP-inspiration is an established MCP idiom, not a Pilotage
invention — SEP-1862 explicitly cites LSP's resolve, and MCP itself is
LSP-inspired. Pilotage uses the pattern; the claim of novelty rests on the
pieces in §2.2, not on the rhetoric.

### 3.4 The governing rule — what is mandated vs left open

> **STANDARDIZE THE LOOP, NOT THE LANGUAGE.**

Mandated: the sections' existence, the verbs, the report **envelopes**
(diagnostic, plan, trace), conformance flags. Left engine-specific: the language
itself, guide content, per-step payloads (opaque JSON), narration prose, policy
semantics. The test for every candidate field: *"does a GENERIC agent loop need
it to work against ANY conformant server?"* If no — don't mandate it.

---

## 4. Core concepts (glossary)

| Concept | Meaning | Crisp criterion |
|---|---|---|
| **Language** | A closed, versioned grammar for programs (e.g. `workflow/v1`, `sql/postgres-15`, `automation/1`) | — |
| **Program** | A document/string in a Language, passed as a tool argument | — |
| **Guide** | Teaching material for a Language, with navigation metadata | always needed |
| **Catalog** | The queryable inventory of live *names* programs can reference | needed **iff** the language has environment-bound free variables |
| **Loop services** | validate (+plan) · execute (+trace) · explain | validate always; trace iff execution exists |
| **Diagnostic** | One structured validation finding (LSP-shaped) | — |
| **Risk** | Per-operation danger class, alignable to MCP tool annotations | needed **iff** any op mutates the world beyond the session |
| **Conformance** | Flags declaring which optional parts a server implements | always |

The guides/catalog split is the compiler split: **grammar vs symbol table**.
Guides are stable per language version; the catalog changes hourly.

In the extension's own idiom: the catalog is the **chart**, the guides are the
**leading lights and buoys**, validate+plan is the **harbor pilot's
pre-departure check**, and the trace is the **voyage log**.

---

## 5. How the Pilotage extension binds to MCP

- **Transport**: unchanged. stdio or Streamable HTTP; sessions via
  `Mcp-Session-Id`; SSE only for streaming/notifications. Nothing new to deploy.
- **Negotiation**: the extension id `io.github.jafarsa0.pilotage` is declared in the
  `extensions` capability map at `initialize` (§3.2).
- **Discovery**: one well-known resource `pilotage://manifest` (URI scheme is a
  convention, not a requirement — the manifest may live at any URI advertised
  in the `initialize` result `_meta.pilotage.manifest`).
- **Program-valued tools** declare their language in `_meta`:
  ```json
  { "name": "run_workflow", "inputSchema": { … },
    "_meta": { "pilotage": { "argument": "workflow", "language": "workflow/v1" } } }
  ```
  (Examples use the short `"pilotage"` key for readability; the registered form
  is the reverse-DNS extension id, e.g. `"_meta": { "io.github.jafarsa0.pilotage": … }`.)
- **Guides and catalog ship BOTH ways** — as resources (clean semantics,
  subscribable) *and* mirrored tools (`pilotage_get_guide`, `pilotage_catalog`):
  because resources are application-controlled and some clients never surface
  them to the model, while tools are model-reachable in every client. Cheap to
  do both. Where a server also implements SEP-2640 (`experimental-ext-skills`),
  guides SHOULD additionally be published through its `skill://` index — the
  Pilotage extension aligns with that channel rather than competing with it.
- **Loop services are plain MCP tools** (`tools/call`) — nothing new on the wire.
- **Risk aligns with MCP tool annotations**: servers SHOULD set
  `readOnlyHint` / `destructiveHint` / `openWorldHint` on tools AND carry the
  engine-specific level in Pilotage fields. No conflict with the base protocol.

---

## 6. The complete v1 schema (normative)

Legend: **M** = mandatory for conformance, **O** = optional (declared in
`conformance`).

### 6.1 The manifest (M)

```json
{
  "pilotage": "1.0",
  "extension": "io.github.jafarsa0.pilotage",
  "languages": [
    {
      "name": "workflow/v1",
      "title": "Workflow documents",
      "guides": "pilotage://guides",
      "catalog": "pilotage://catalog",
      "loop": {
        "validate": "validate_workflow",
        "execute":  "run_workflow",
        "explain":  "explain_run"
      }
    }
  ],
  "conformance": {
    "plan": true,
    "trace": "full",          // "none" | "summary" | "full"
    "narration": false,
    "assertions": false,       // v2
    "catalog_search": true,
    "catalog_changed_since": false
  }
}
```

| Field | M/O | Meaning |
|---|---|---|
| `pilotage` | M | Extension version. |
| `extension` | M | The reverse-DNS extension id (`io.github.jafarsa0.pilotage`). |
| `languages[]` | M | One entry per language this server accepts programs in. |
| `languages[].loop.validate` | M | Tool name of the validator. The ONE service every server must have. |
| `languages[].loop.execute` | O | Absent for validate-only servers (e.g. linters). |
| `languages[].loop.explain` | O | After-the-fact drill-down. |
| `conformance` | M | What the generic agent may rely on. |

### 6.2 Guides (M)

`pilotage://guides` returns a list; each guide is a readable resource (and
reachable via the `pilotage_get_guide {id}` mirror tool).

```json
{ "id": "quickstart",
  "title": "Your first workflow in 20 lines",
  "level": "core",                          // core | reference | examples
  "topics": ["steps.call", "expressions.paths", "output"],
  "language": "workflow/v1",
  "version": "1.3",
  "tokens_estimate": 900,
  "uri": "pilotage://guides/quickstart" }
```

Rules (all with the same reason — **context budget**: an agent must be able to
fetch the right 2 KB, not a 120 KB manual):
- (M) At least ONE `core` guide, and it SHOULD be ≤ ~2k tokens.
- (M) `topics` — the navigation index; topic ids are free-form but stable.
- (M) `version` — bumped when the language changes; agents cache by it.
- (M) One `reference` guide MUST enumerate the validator's closed
  **diagnostic codes** (so even the errors are teachable).

### 6.3 Catalog (M when the language references a live environment)

Entry:

```json
{ "id": "cap_read_user_profile",
  "kind": "capability",                       // engine-defined kinds
  "name": "read user profile",
  "description": "read the json at key 'rdemo:user:{user_id}:profile'",
  "input_schema":  { "type":"object", "properties":{ "user_id":{"type":"string"} }, "required":["user_id"] },
  "output_schema": { "type":"object" },
  "risk": "safe",                              // engine level; see §6.7
  "tags": ["redis", "crm"],
  "version": "…" }
```

Verbs (via resource templates and/or the `pilotage_catalog` mirror tool):
- (M) `list` — paged; filters: `kind`, `tag`; (O) free-text `q` when
  `catalog_search: true`.
- (M) `get {id}` — the full entry.
- (O) `changed_since {version}` — drift feed.
- (M) Every list/get response carries a **`catalog_version`** (opaque string) —
  the anti-staleness token used in §6.5/§6.6.

### 6.4 Diagnostics (M) — the validator's report, LSP-shaped

```json
{ "severity": "error",                        // error | warning
  "code": "unknown_capability",               // CLOSED per engine, enumerated in a reference guide
  "path": "steps[1].capability",              // location IN THE PROGRAM document
  "message": "call references unknown capability 'find_deals_by_email'",
  "hint": "close match: cap_find_deals_by_email" }
```

The `hint` field is optional but strongly recommended — it is the cheapest
convergence accelerator a server can offer.

### 6.5 Validate (M)

Request: `{ program }` (plus any engine context). Response:

```json
{ "valid": true,
  "diagnostics": [],
  "catalog_version": "cv_18422",
  "plan": {                                    // O — when conformance.plan
    "steps": [
      { "id": "profile", "calls": "cap_read_user_profile",   "risk": "safe" },
      { "id": "deals",   "calls": "cap_find_deals_by_email", "risk": "safe" } ],
    "max_risk": "safe" } }
```

- Validation MUST be **side-effect free**.
- When valid and `plan` is supported, the response includes the statically
  derivable preview: ordered steps, what each references, each step's risk,
  and the maximum. Reason: post-run explanation is too late for a destructive
  write — the plan is the pre-run decision point for the agent AND for any
  policy gate. (Precedents: `terraform plan`, SQL `EXPLAIN`.)

### 6.6 Execute (O) — with the trace riding along

Request: `{ program, input?, trace_level?: "none"|"summary"|"full",
expected_catalog_version? }`. Response:

```json
{ "outcome": { "ok": true, "status": "success", "error": null },
  "output":  { … },
  "trace":   { … §6.8 … } }
```

- `outcome` MUST be a **closed** status set (engine-defined, enumerated in a
  guide) — failures are values, not exceptions.
- If `expected_catalog_version` is stale, the server MAY reject with a
  distinct `catalog_drift` outcome (the Terraform stale-plan mitigation).
- The trace comes WITH the response (no second round trip for what the engine
  just knew); `explain` exists for later drill-down.

### 6.7 Risk (M where ops mutate the world)

Engine-specific levels are allowed (an engine might use
`safe | write | update | destructive | external_side_effect`), but every level
MUST map onto the MCP-aligned booleans so generic gates work:

```json
{ "risk": "destructive",
  "risk_hints": { "readOnly": false, "destructive": true, "openWorld": false } }
```

Honest limit, recorded: **risk ≠ impact** (a "write" flipping a feature flag for
millions is formally write, materially catastrophic). Risk is a *comparable
gate signal*, not a policy. Contextual policy is v2. Think of the gate as
compulsory pilotage: in marked waters, nobody proceeds without the pilot's
check.

### 6.8 Trace (M if execute exists) — envelope standard, payloads opaque

```json
{ "run_id": "run_7f3a…",
  "level": "full",
  "steps": [
    { "id": "profile", "calls": "cap_read_user_profile",
      "input":  { "user_id": "42" },
      "output": { "name": "Max", "email": "max@acme.com" },
      "outcome": { "ok": true },
      "t_ms": 84,
      "decisions": [] },
    { "id": "deals", "calls": "cap_find_deals_by_email",
      "input":  { "email": "max@acme.com" },
      "output": [ { "title": "Renewal Q3", "amount": 12000 } ],
      "outcome": { "ok": true },
      "t_ms": 210,
      "decisions": [ { "at": "branch high_value", "took": "then",
                        "because": "amount > 10000 → true" } ] } ] }
```

Mandated: the envelope — `run_id`, ordered `steps[]` each with `id`, what it
`calls`, its `input`/`output`/`outcome`, and `decisions[]` (which way each
branch went and the evaluated reason). Engine-opaque: the *contents* of
`input`/`output`/`outcome` (any JSON). This is the §3.4 rule in action, and it
resolves "different engines have different outcomes": the LOOP only needs the
envelope; the payloads are for the agent's domain reasoning.

Reason `decisions` is mandated: it is precisely the field that catches the
"plausible output, wrong logic" class — the agent sees *the branch it did not
expect*. (Neighbor note: A2A's sample Traceability Extension carries step ids,
cost and latency; the Pilotage trace adds per-step I/O and the branch
decisions — the voyage log records not just the ports visited but why each
course was taken.)

### 6.9 Explain (O)

`explain_run { run_id, question? }` → `{ trace, narration? }`.
`narration` (prose "why") is optional conformance — interpretations may be
expensive; facts (the trace) are the contract.

### 6.10 The standard agent loop (normative for clients)

```
1. read manifest                     → which languages, which services, what conformance
2. read core guide(s)                → learn the grammar (budget-aware via topics/levels)
3. query catalog                     → the live names this mission needs
4. draft the program
5. validate                          → diagnostics? fix → goto 5
6. review plan                       → risk gate (agent policy / human confirm on destructive)
7. execute (trace on)
8. check trace against the mission   → wrong/incomplete? fix → goto 5
9. done — optionally persist/promote the program (engine-specific)
```

The loop is the product. Any conformant agent runs it against any conformant
server without domain code.

---

## 7. Decision record (what we chose, what we rejected, why)

| # | Decision | Rejected alternative | Reason |
|---|---|---|---|
| 1 | Extension over MCP | Standalone effort | Adoption economics; expressible with MCP primitives. Since decided, MCP's extensions framework (the 2026-07-28 release candidate) made this a first-class path: reverse-DNS id, `extensions` capability negotiation, and the Extensions Track of the SEP process for adoption — Pilotage targets exactly that track |
| 2 | Standardize the loop, not the language | Standardize program/output schemas | Engines differ; LSP proved envelope-only scales |
| 3 | Trace (facts, mandated) split from narration (prose, optional) | One "explainer" blob | Facts are cheap/objective/machine-checkable; interpretation is neither |
| 4 | Plan returned by VALIDATE | Plan only after execution / separate dry-run service | Post-run is too late for side effects; statically derivable ⇒ near-free |
| 5 | Trace rides the execute response | Separate explain round trip only | Don't re-ask the engine what it just knew; stateless servers stay possible |
| 6 | Catalog = queryable, paged, versioned | Full dump in context | Thousands of names; agent budgets; drift detection needs a version token |
| 7 | Risk aligned to MCP tool annotations | Invent an unrelated scale | The base protocol already has hints; alignment = free compatibility |
| 8 | Guides/catalog exposed as resources AND mirror tools | Resources only | Resources are app-controlled; some clients never show them to the model; where SEP-2640 skills-over-MCP is present, publish guides there too (align, don't compete) |
| 9 | Diagnostic codes closed + enumerated in a guide | Free-text errors | Errors themselves must be learnable; closed sets are teachable (contrast SEP-1303: post-hoc free-text after a real call — Pilotage's diagnostics are pre-run and structured) |
| 10 | Assertions ("fully") deferred to v2 | In v1 | Keeps v1 small; named now because it is the honest answer to completeness |

---

## 8. Challenges & open questions (honest section)

1. **Catalog staleness (TOCTOU)** — validate against a snapshot, world drifts
   before execute. Mitigated (§6.5/6.6) by `catalog_version` +
   `catalog_drift` rejection; not fully solvable in principle.
2. **Risk ≠ impact** — v1 gives a comparable gate signal; contextual policy
   (which object, which environment, budgets, approvals) is v2.
3. **"Fully" needs assertions (v2)** — agent-declared, engine-checked
   postconditions evaluated against the trace
   (`"assert": ["output.email != null", "steps.deals.output.length >= 1"]`).
4. **Long-running programs** — a sync `tools/call` doesn't fit hour-long runs;
   map run records onto MCP progress notifications + a `get_run` poll. Design
   sketched, not yet normative.
5. **Security** — programs are attacker-shaped input: engines MUST bound
   execution (timeouts, step limits), treat programs as data (no eval outside
   the closed language), and enforce tenancy/authz per referenced name.
6. **Narration quality/cost** — server-side LLM narration is allowed but never
   required; the trace must stand alone.
7. **Governance & naming** — name settled: **Pilotage**, extension id
   `io.github.jafarsa0.pilotage` (repo convention `ext-pilotage`). Adoption path: the
   Extensions Track of the SEP process. Still open: spec repo location,
   versioning policy, conformance tests.

---

## 9. Worked examples — three different worlds

### 9.1 SQL analytics server (`sql/postgres-15`)

The oldest "program as payload" in the world, Pilotage-shaped:

- **Manifest**: language `sql/postgres-15`; loop = `validate_sql`, `run_sql`,
  `explain_run`; conformance: plan=true (EXPLAIN), trace=summary.
- **Guides**: `core` = "read-only analytics SQL in this warehouse" (naming
  conventions, allowed functions, 1.2k tokens); `reference` = full dialect
  notes + **diagnostic code list**; `examples` = 5 canonical queries.
- **Catalog**: kinds `table`, `column`, `view` — fed by `information_schema`
  (the ORIGIN of the word "catalog"):
  ```json
  { "id": "public.orders", "kind": "table", "risk": "safe",
    "output_schema": { "columns": [ {"name":"id","type":"bigint"},
      {"name":"customer_email","type":"text"}, {"name":"amount","type":"numeric"} ] } }
  ```
- **The loop in action**: agent drafts
  `SELECT customer_email, SUM(amout) FROM orders GROUP BY 1` →
  `validate_sql` → diagnostic
  `{code:"unknown_column", path:"select[1]", message:"'amout' does not exist",
  hint:"close match: amount"}` → fix → valid, plan =
  `{steps:[{calls:"public.orders", risk:"safe"}], max_risk:"safe"}` →
  `run_sql` → output rows + trace summary
  (`rows_scanned: 120k, filter matched: 118k`) — and the trace is what lets
  the agent spot a suspicious `matched: 0` even when the output "looks fine".

### 9.2 Home automation server (`automation/1`)

Shows the **risk gate** doing real work:

- **Catalog**: kind `entity` — the live device registry:
  `light.porch (risk: write)`, `sensor.front_door (risk: safe)`,
  `lock.front_door (risk: destructive, risk_hints.destructive: true)`.
- **Program** (the automation the agent authors):
  ```json
  { "trigger":  { "entity": "sensor.front_door", "event": "opened" },
    "condition":{ "after": "22:00" },
    "action":   [ { "entity": "light.porch", "do": "turn_on" },
                  { "entity": "lock.front_door", "do": "unlock" } ] }
  ```
- **Validate** returns valid — but **plan** says
  `max_risk: "destructive"` (the unlock). The generic agent loop's step 6
  (risk gate) now fires *without understanding smart homes*: the agent asks
  the human before executing, or drops the unlock step. That is the entire
  point of a comparable risk signal.
- **Trace** after a test run shows
  `decisions: [{at:"condition after 22:00", took:"skip", because:"time=14:03"}]`
  — teaching the agent its automation did nothing *and why*, instead of
  silently "succeeding".

### 9.3 A workflow-automation engine (`workflow/v1`)

The richest case: the programs are multi-step workflow documents — call steps
over a catalog of connected capabilities (databases, APIs, devices), with data
flowing between steps under a closed expression language. The mapping below is
typical of what such an engine already has, which is why adopting the
extension is mostly *mounting*, not building:

| Pilotage piece | Typical existing artifact | Distance to conformance |
|---|---|---|
| guides | the engine's authoring manual + its closed vocabularies | split into core/reference topics |
| catalog | the connected sources and their capabilities | mount list/get + stamp `catalog_version` |
| validate | the engine's own document validators | wrap as the validate tool |
| plan | derivable from the document + per-capability risk levels | small addition |
| execute | the engine's run endpoint (ad-hoc variant) | small addition |
| trace | the engine's run records / per-step outcomes | enrich with per-step I/O + `decisions[]` |
| explain / narration | narration over run records | optional |
| promote | saving a workflow as a named, typed unit | usually exists |

The insight this case generalizes: **stored workflows are better MCP tools than
raw capabilities** (a saved workflow declares a typed input and returns a
shaped output), so the loop ends in *promotion* — today's ad-hoc program is
tomorrow's vocabulary:

```
discover tools → compose ad-hoc (validate→plan→execute→trace) → PROMOTE
      ↑                                                            |
      └────────────── the new workflow appears as a TOOL ←─────────┘
```

### 9.4 One-liners from other worlds (the shape repeats)

- **Kubernetes**: language = manifests; catalog = `kubectl api-resources` +
  CRDs; plan = server-side dry-run; trace = events/rollout status.
- **CI (GitHub Actions)**: language = workflow YAML; catalog = available
  actions/runners/secret NAMES; validate = actionlint-class checks.
- **BI/dbt**: language = SQL models/metrics; catalog = `manifest.json` /
  semantic layer; trace = row counts per model.

---

## 10. Conformance summary (what "Pilotage v1 conformant" means)

A server is Pilotage v1 conformant when it provides:
1. the manifest (§6.1);
2. per program-valued tool, the `_meta` pilotage language declaration (§5);
3. guides with one small `core` guide, topics, versions, and the diagnostic-code
   reference (§6.2);
4. a catalog with list/get + `catalog_version`, when the language references a
   live environment (§6.3);
5. a side-effect-free validator returning the standard diagnostics (§6.4/6.5);
6. if it executes: the closed outcome + the standard trace envelope (§6.6/6.8);
7. truthful `conformance` flags for everything optional (plan, narration,
   search, changed-since, assertions).

A client (agent) is conformant when it declares the extension at `initialize`,
runs the standard loop (§6.10), and respects the risk gate before executing
plans whose `max_risk` maps to `destructive` or `openWorld`.

---

## 11. Roadmap

- **v1.0** — everything above.
- **v1.1** — long-running executions (progress notifications + `get_run`),
  catalog `changed_since` firmed up.
- **v2** — assertions (agent-declared postconditions checked against the
  trace); contextual policy (per-object/per-environment rules, approvals,
  budgets); multi-language composition (programs embedding programs).
