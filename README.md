# Pilotage

[![DOI](https://zenodo.org/badge/1302736087.svg)](https://doi.org/10.5281/zenodo.21396027)

**An MCP extension for guided program authoring and verified execution.**

> Schemas teach the moves. **Pilotage teaches the game.**

MCP taught agents *what to call*: tools with JSON-Schema inputs. But a schema can
only describe a record — it cannot teach a **language**. The moment a tool's
argument is a *program* (a SQL query, an automation rule, a workflow document),
the agent needs four things no schema can carry: the **grammar** of the language,
the **live world** the program refers to, a **checker** that catches mistakes
before anything runs, and a **trace** that proves afterwards the program did the
right thing.

Pilotage is a small, standard shape for exactly those four things — expressed
entirely with MCP's own primitives, so that **one generic agent loop works
against any system that adopts it**.

> MCP gave servers a user manual. **Pilotage turns the user manual into a
> checkable contract.**

- **Read the specification:** [SPEC.md](./SPEC.md)
- **Read the illustrated overview:** [index.html](./index.html) (open locally, or
  via GitHub Pages once enabled)
- **Status:** v1.0 draft · extension id `io.github.jafarsa0.pilotage`
- **Author:** Jaafar Nadher Jaafar Alaboosi

---

## Why

Two problems, one loop:

1. **Program-valued arguments.** `run_workflow {workflow: object}` or
   `query {sql: string}` is legal MCP, but the schema says nothing an author
   needs — not the syntax, not the semantic rules, not which names exist right
   now. Today every provider papers over this gap with prose: tool descriptions
   carrying folklore, README files, cookbooks, skills files. All prose. None
   machine-checkable. No standard place to look.
2. **Converging on "fully and correctly."** A syntactically perfect program can
   be logically wrong, and a plausible-looking result can hide the bug — a
   filter that matched zero rows plus a default fallthrough *looks* fine. Human
   developers catch this with compilers, dry runs, and traces. Agents today get
   only the return value.

```
LEARN the language  →  AUTHOR a program   →  CONVERGE on correct
    (guides)           (catalog + draft)     (validate → plan → execute → trace)
```

## The five pieces

| Piece | What it is |
|---|---|
| **manifest** | The front door: which languages this server accepts programs in, where the guides and catalog live, which loop services exist. |
| **guides** | The grammar, made navigable — topics, levels, token estimates, versions. At least one small *core* guide, by rule. |
| **catalog** | The live world the programs refer to (tables, devices, capabilities) — queryable, paged, and **versioned** (`catalog_version` makes drift detectable). |
| **validate + plan** | A mandatory, side-effect-free check returning structured diagnostics (`code · path · message · hint`, with `code` from a closed enumerated set) — and, when valid, a **plan**: the steps that would run, each with a risk level, for a generic go/no-go gate. |
| **execute + trace** | Results carry evidence: an ordered trace of every step — inputs, outputs, outcomes, and `decisions[]` recording which way every branch went and why. |

A sixth element — **risk** — is cross-cutting rather than a piece of its own: every catalog entry and every plan step carries a comparable danger class, aligned with MCP's tool annotations, so a generic gate can say no without understanding your domain.

The governing rule for all of it: **standardize the loop, not the language.**
Pilotage mandates the verbs and the report envelopes — never the languages
themselves. Your SQL stays SQL; your workflow language stays yours.

## The standard agent loop

```
manifest → core guide → catalog query → draft
→ validate (fix until clean) → review plan (risk gate)
→ execute with trace → check trace against the mission → done · promote
```

A conformant agent implements this loop once and works against every conformant
server — whether the programs are SQL, home-automation rules, or workflows. The
spec walks all three examples end to end.

## Prior art, honestly

Pilotage sits in a busy, healthy neighborhood and cites it precisely: Anthropic
Agent Skills (task-level prose teaching), MCP's `InitializeResult.instructions`
(the per-server prose manual), SEP-2640 (skills served over MCP), SEP-1303
(post-hoc validation errors), SEP-1862 (`tools/resolve` pre-flight metadata),
and A2A's traceability sample. What none of them provide — and what Pilotage
adds — is the **checkable** part: the versioned catalog, the pre-run structured
validate, the multi-step risk plan, the decision-bearing trace, the
program-in-grammar declaration, and the standard loop that binds them. See
[SPEC.md §2](./SPEC.md#2-prior-art--positioning) for the full positioning table.

## Adoption path

Pilotage is designed as an **MCP extension**: declared under the reverse-DNS id
`io.github.jafarsa0.pilotage` in MCP's `extensions` capability negotiation, following
the Extensions Track of the MCP SEP process. No new transport, no new session
model — if your system speaks MCP today, Pilotage is additive.

## Status & roadmap

- **v1.0 (draft, this repository)** — the full specification.
- **v1.1** — long-running executions (progress notifications), firmed-up
  catalog `changed_since`.
- **v2** — assertions (agent-declared postconditions checked against the
  trace), contextual policy, multi-language composition.

## License & citation

Text and specification © 2026 Jaafar Nadher Jaafar Alaboosi, released under
[CC BY 4.0](./LICENSE.md) — use it freely, with attribution. To cite this work,
see [CITATION.cff](./CITATION.cff) or use GitHub's "Cite this repository"
button. Permanently archived on Zenodo: DOI
[10.5281/zenodo.21396027](https://doi.org/10.5281/zenodo.21396027).
