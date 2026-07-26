# Pilotage

**A competence layer for complex MCP tools**

MCP standardizes how agents connect to tools, resources, and external systems.
It gives clients a common way to discover capabilities, exchange structured
inputs, and invoke operations.

But connection is only the first layer.

Many real systems do not accept simple arguments such as a city name, a file
path, or a date. They accept queries, workflows, automation rules, policy
expressions, deployment configurations, and other structured programs. To use
these systems correctly, an agent must understand more than a tool schema. It
must learn the language of the payload, discover the environment it refers to,
interpret validation feedback, assess the consequences of execution, and revise
its work until the intended result is achieved.

Today, much of that competence is implemented separately inside each agent,
usually through prompts, custom orchestration code, framework-specific logic,
and hand-built integrations.

Pilotage moves that competence closer to the system that understands it best:
the MCP server.

It gives an MCP surface a standard way to teach agents how to use complex
capabilities, help them construct valid programs, evaluate proposed execution,
and return structured evidence about what happened.

MCP standardizes the connection. Pilotage standardizes the path from connection
to competent execution.

---

## The problem

The same three problems appear repeatedly wherever agents interact with
sophisticated tools.

### 1. Schemas describe structure, not languages

A JSON Schema can describe the shape of an argument:

- which fields exist;
- which values are required;
- which types are accepted;
- which combinations are structurally valid.

That is sufficient for ordinary record-like inputs.

It is not sufficient when a field contains a program.

A workflow definition has operators, dependencies, branching rules, references,
and execution semantics. A query refers to tables, fields, functions,
permissions, and other objects that exist in a changing environment. An
automation rule may be syntactically valid while referring to an event, action,
or property that is unavailable on the current server.

In these cases, the agent needs two different kinds of knowledge.

The first is stable knowledge: the grammar, concepts, constraints, examples,
and recommended construction patterns of the language.

The second is live knowledge: the tables, fields, actions, nodes, functions,
resources, permissions, and other symbols currently available in a particular
environment.

Pilotage represents these as two complementary surfaces:

- **Guides** explain the language.
- **Catalogs** describe the live world in which that language is used.

A guide is similar to a language manual. A catalog is similar to a compiler's
symbol table.

MCP already provides carriers through which a server may expose documentation
or data, but it does not define a standardized, versioned, payload-bound guide
and catalog model for program-valued tool arguments. As a result, every
implementation must currently invent its own conventions.

Pilotage standardizes those conventions.

---

### 2. Complex work rarely succeeds in one tool call

For simple operations, an agent can construct an input, call a tool, and
consume the result.

For complex programs, that interaction is often insufficient.

An authored workflow may be structurally valid but logically incomplete. A
query may compile but reference the wrong field. An automation may be
executable but contain a destructive step the user did not intend. A
configuration may pass basic validation while producing an unexpected
execution path.

The agent therefore needs an iterative convergence loop:

1. read the server's manifest to learn which capabilities exist;
2. understand the available language and environment;
3. construct a candidate program;
4. validate it without causing side effects;
5. receive structured diagnostics;
6. revise the program;
7. inspect the proposed execution plan and associated risks;
8. execute when appropriate;
9. examine a trace of the actual behavior.

Pilotage standardizes the server-side capabilities required for this loop.

#### Validate

Validation answers:

- Is the program syntactically valid?
- Do referenced symbols exist?
- Are types and relationships compatible?
- Are required conditions satisfied?
- What must the agent change?

Diagnostics are returned as structured, stable information rather than as
unstructured error prose alone.

#### Plan

Planning explains what the server expects to do before execution.

A plan may expose:

- the expected sequence of steps;
- dependencies between those steps;
- resources that will be read or modified;
- external effects;
- permissions required;
- risk classifications;
- points at which confirmation may be necessary.

The purpose is not to replace the agent's reasoning. It is to let the system
that owns the execution semantics describe the consequences of the proposed
program.

#### Trace

A trace explains what happened during execution.

It may include:

- executed steps;
- resolved inputs and outputs;
- branch decisions;
- failures and retries;
- affected resources;
- relevant state transitions;
- references to resulting artifacts.

A distributed trace can show where requests travelled. A Pilotage trace
explains how the authored program was interpreted and executed.

One trace, two doors: it rides the execute response; if the run was stored,
the same trace can be fetched later by run_id.

Together, validation, planning, and tracing turn a one-shot tool invocation
into a checkable feedback loop.

Pilotage does not guarantee that an agent will always achieve its goal. It
gives the agent structured evidence with which to judge, revise, and improve
its work.

---

### 3. Competence does not scale when it is hardcoded into every agent

MCP reduces the cost of connectivity.

Without a common protocol, every agent must integrate separately with every
external system. With MCP, agents and servers can connect through a shared
interface.

However, the same scaling problem reappears one level above the connection.

An agent may be able to discover and invoke an MCP tool while still lacking
the knowledge required to use it correctly. That knowledge is commonly
embedded in:

- system prompts;
- tool-specific prompt templates;
- client-side planners;
- framework adapters;
- validation wrappers;
- custom retry logic;
- hand-written explanations of server behavior.

Each agent developer must independently teach their agent how to use each
sophisticated server. Each server provider must separately document, test, and
support the behavior of many different agent clients.

The protocol connection is standardized, but the competence layer remains
pair-specific.

This recreates an N × M problem:

- N agent implementations;
- M complex MCP surfaces;
- a separate body of integration knowledge for every pairing.

Pilotage separates this concern.

The server publishes the guides, catalogs, validation behavior, execution
planning, and trace semantics associated with its own surface. Any compatible
agent can discover and use that information through the same extension.

The server teaches once. Agents learn through a common interface.

This changes the scaling model from pair-specific competence toward N + M:

- agent developers implement Pilotage support once;
- server developers publish Pilotage support once;
- new compatible pairings inherit the same checkable competence layer.

MCP addressed N × M connectivity. Pilotage addresses the N × M competence
problem that appears after the connection is established.

---

## The layer already exists, but only in fragments

Pilotage does not introduce a need that appeared with this specification. It
gives a common shape to a layer the ecosystem is already building repeatedly
and independently.

Whenever agents interact with sophisticated systems, developers add extra
knowledge around the tool interface:

- server instructions explaining how tools should be used;
- system prompts containing tool-specific rules;
- skills files and operational playbooks;
- examples embedded in tool descriptions;
- repository instructions such as "AGENTS.md";
- website guidance such as "llms.txt";
- retry logic that teaches the agent through runtime errors;
- safety annotations such as "readOnlyHint" and "destructiveHint".

These mechanisms all respond to the same underlying fact: a schema alone is
often not enough to use a capability correctly.

MCP's own server instructions provide a prose manual for the model. Agent
Skills package reusable operational knowledge. Tool annotations communicate
information that cannot be expressed through input shape alone. Production
integrations frequently add custom prompts, live-context calls, instructive
errors, and execution observations around MCP tools.

In effective integrations, the pieces of Pilotage can already be seen in
improvised form:

- a system-prompt section acts as a guide;
- a context or discovery call acts as a catalog;
- structured failures act as diagnostics;
- previews and screenshots act as an execution trace.

The problem is not that this competence layer does not exist.

The problem is that it is currently distributed across prose, prompts, client
code, framework conventions, and tool-specific workarounds. It has no shared
structure, no standard discovery mechanism, and little that a client can
reliably check.

Pilotage names this layer, gives it a common interface, and turns its most
important parts from informal guidance into structured evidence.

---

## What Pilotage provides

Pilotage defines a common interaction model for MCP tools whose inputs behave
like programs: seven layers, five tools, one handshake, with the agent at the
center orchestrating.

The counts reconcile as follows. The manifest is the handshake: it arrives in
the initialize response, with `pilotage_manifest` re-serving it on demand.
The plan arrives with validate's response, and the trace rides execute's
response, with an optional fetch tool for stored runs. The five working tools
are the guide tool, the catalog tool, and up to three loop tools (validate,
execute, trace fetch).

Its core capabilities are:

#### Manifest

The first thing an agent meets. At the MCP handshake, the server hands over a
single machine-readable card describing which Pilotage capabilities it offers,
which tools implement the loop, and what guarantees apply, so a
zero-knowledge agent can orient itself before making any other call.

#### Guides

Token-conscious, navigable documentation for the language accepted by a tool
or payload field.

Guides may describe:

- concepts and terminology;
- grammar and operators;
- construction rules;
- examples and patterns;
- common mistakes;
- advanced features;
- links between related topics.

Agents should be able to retrieve only the sections relevant to the current
task rather than loading an entire manual into context.

#### Catalogs

Queryable descriptions of the live environment against which a program is
authored.

Catalogs may expose:

- available symbols;
- object types;
- fields and properties;
- operations;
- relationships;
- capabilities;
- permissions;
- version or freshness information.

Catalogs are not a replacement for guides. The guide explains what a valid
reference means; the catalog explains which references currently exist.

#### Validation

A side-effect-free mechanism for checking a proposed program and returning
structured diagnostics.

#### Planning

A pre-execution representation of the expected behavior, effects,
dependencies, and risks of a proposed program.

#### Trace

A structured account of how the program was interpreted and what occurred
during execution. One trace, two doors: the trace rides the execute response,
and, when the run was stored, the same trace can be fetched later by run_id.

These capabilities form a common loop:

```
manifest → guides → catalog → validate + plan → execute → trace
```

The arrows describe dependencies, not a fixed order. The agent sits at the
center of the loop (a hub, not a pipeline), deciding what to call and when.

Pilotage standardizes this loop without standardizing the underlying language.

---

## The layer Pilotage moves, and the layers it does not touch

Pilotage moves one specific kind of knowledge from the agent to the server:
how to operate a system. The grammar of its language, the names that exist
right now, the rules that make a program valid, the risk of running it.

That knowledge is not a durable differentiator between agents. An agent
that lacks it does not behave differently; it fails.

Everything above that layer stays with the agent, and becomes more visible,
not less.

#### Intelligence

Ten agents given the same guides and the same task will not perform the
same. A sharper model reads faster, drafts better programs, hits fewer
diagnostics, and recovers in one step instead of five.

A fair field does not hide skill differences. It exposes them. Pilotage
makes convergence checkable; the path stays the agent's own.

#### The user's side of the context

Pilotage carries how to operate a system. It knows nothing about why.

Why the user wants a change, what their priorities are, what they would
never approve: that context lives with the agent, and always will.

#### Composition

Real work spans systems: read from one, decide, act on another, notify a
third. Each Pilotage server teaches its own island.

Deciding how to connect the islands remains agent work; even when a
server exposes an orchestration language, the agent chooses what to
author. Composition is where the difficult work remains.

#### Judgment

The duties this specification assigns to the host application (gating
destructive plans, deciding what needs a human) sit on the agent's side
of the boundary by design.

Not every agent will be an equally trustworthy steward, and Pilotage does
not pretend otherwise.

Standardizing the operating layer does not remove the differences between
agents. It relocates them to the layers above.

---

## Why this belongs in MCP

Pilotage is an extension to MCP rather than a separate agent protocol because
the competence it describes is inseparable from the MCP surface that owns the
tool.

The server already knows:

- the language its tool accepts;
- the environment against which that language is evaluated;
- the validation rules;
- the execution semantics;
- the risks and side effects;
- the meaning of execution results.

Moving this knowledge into a separate protocol would duplicate identity,
discovery, transport, authorization, and lifecycle concerns that MCP already
provides.

Pilotage instead builds on MCP's existing primitives and extension model. It
adds the semantics required for complex program interaction while preserving
the underlying MCP connection and tool invocation model.

An implementation may adopt only the capabilities relevant to its surface. A
server that needs validation but has no meaningful catalog should not be
required to invent one. A server exposing a changing query environment may
provide both guides and catalogs. A system with consequential execution may
additionally expose plans and traces.

The extension is designed to be composable rather than all-or-nothing.

---

## Related work and neighboring standards

Pilotage builds on ideas that already exist across the agent, MCP, API, and
orchestration ecosystems. Its purpose is not to replace these systems, but to
standardize the missing interaction around agents authoring and executing
programs against live environments.

| Neighbor | What it provides | What it does not provide | Relationship to Pilotage |
|---|---|---|---|
| **Agent Skills** | Packaged instructions that teach an agent how to perform tasks, commonly through a "SKILL.md" file and supporting resources. | No standard live catalog, side-effect-free validator, execution plan, or program-level trace contract. Its primary object is task knowledge rather than a program-valued tool argument. | Complementary. Skills can teach the broader task; Pilotage governs the checkable interaction with the program accepted by a specific surface. |
| **MCP "InitializeResult.instructions"** | A server-provided prose manual explaining how the server or its tools should be used. | The content is free text. A client cannot depend on standard diagnostic codes, planning semantics, catalog versions, or trace structures. | Pilotage extends the same idea from a manual into a structured and checkable competence layer. |
| **SEP-2640: Skills over MCP** | A proposed way to publish skills from MCP servers, exposing skill files as MCP resources with dedicated discovery methods. | Primarily transports prose-based skill content. It does not define program validation, live catalogs, execution plans, or traces. | Aligned rather than competing. Pilotage guides may be published through compatible skill mechanisms where available. |
| **SEP-1303: validation errors returned to the model** | Allows errors from tool execution to enter model context so the model can correct its input. | Feedback arrives after a real tool call and may be unstructured prose. It does not define a mandatory side-effect-free pre-execution validation operation or closed diagnostic codes. | Complementary. Pilotage adds explicit pre-run validation and structured diagnostics. |
| **SEP-1862: "tools/resolve"** | Proposed pre-flight refinement of tool metadata, including more precise read-only or destructive-operation hints for a particular call. | It does not validate arguments and does not describe a multi-step program or its execution plan. | Complementary. "tools/resolve" refines call metadata; Pilotage evaluates the authored program and its expected multi-step effects. |
| **A2A Traceability Extension** | Adds identifiers, timing, cost, and other traceability metadata to agent-to-agent runs. | It does not define program-level step inputs and outputs, branch decisions, or reasons for execution choices. | Neighboring work. Pilotage traces focus on how a server interpreted and executed an authored program. |
| **FINOS OpenEAGO** | A compliance-oriented control plane for multi-agent and tool orchestration, including planning gates, approval controls, risk assessment, and audit trails. | Its primary object is orchestration governance and regulatory compliance, not the semantics of agent-authored programs. It does not define Pilotage-style closed diagnostics, live language catalogs, or branch-decision traces. | A close neighbor in pre-execution control and auditability, but aimed at a different layer. |
| **OpenAPI Arazzo** | Provider-published descriptions of multi-step API workflows, including dependencies and success criteria. | It is centered on OpenAPI and AsyncAPI operations, does not define an MCP-native step model, and does not provide a server-side validate–revise–execute loop. | Strong evidence that provider-published sequencing is valuable. Pilotage applies a related principle to MCP and adds interactive checking. |
| **SEP-2106: full JSON Schema support** | Brings full JSON Schema 2020-12 capabilities to MCP tool input and output schemas. | It validates the structural shape of a single tool call. It does not describe program grammar, live references, session rules, operation ordering, or validity against changing server state. | Foundational. JSON Schema defines the call boundary; Pilotage addresses the semantic layer above that boundary. |

The important distinction is not whether neighboring systems provide guidance,
risk metadata, validation, or traces in some form. Many do.

The distinction is whether they provide the complete, server-published loop
required for program-valued MCP interactions:

- a discoverable manifest announcing the server's capabilities at the handshake;
- a versioned live catalog;
- a declared relationship between a payload and its language;
- side-effect-free validation with stable diagnostic codes;
- a multi-step execution plan with per-step risk;
- a trace containing execution facts and branch decisions;
- a standardized client loop connecting these capabilities.

Pilotage occupies that combined space.

**Skills are the textbook. Pilotage is the harbor chart handed over at the
pier, the pre-departure check, and the voyage log, written during the voyage
and readable from the archive later.**

---

## A proven shape: the Language Server Protocol

The Language Server Protocol solved a structurally similar problem for
developer tools.

Before LSP, each editor needed a separate integration for each programming
language. Supporting completions, diagnostics, hover information, symbol
lookup, and navigation across many editors and many languages required a
growing matrix of bespoke implementations.

LSP did not solve this by standardizing programming languages.

Instead, it standardized the interaction between an editor and a
language-aware server. It defined common operations such as completion and
diagnostics, along with common response envelopes such as a diagnostic
containing a location, severity, code, and message. Each language server
remained responsible for understanding its own language.

This changed the scaling model.

An editor could implement LSP once and gain access to many languages. A
language implementation could expose one server and become usable from many
editors. The ecosystem moved from separate editor–language pairings toward a
shared N + M model.

Pilotage follows the same architectural principle.

It does not standardize SQL, workflow languages, policy expressions,
automation formats, or orchestration graphs. It standardizes how an agent
interacts with the system that understands those languages:

- how capabilities are negotiated;
- how diagnostics are represented;
- how live symbols are discovered;
- how a proposed program is checked;
- how expected execution is described;
- how actual execution is reported.

There is also an important difference.

LSP primarily assists with authoring. The editor may ask whether code is valid
or request information about it, but the language server protocol does not
generally govern the consequential execution of that code.

Agents operate against live systems.

They may modify records, trigger workflows, deploy infrastructure, communicate
externally, or invoke other services. Pilotage therefore extends the
LSP-shaped authoring model with the runtime feedback that agent systems
require: planning, risk inspection, execution traces, and decision evidence.

Pilotage is LSP for agents authoring programs against live systems, plus the
execution loop that LSP never needed.

The analogy has limits.

Pilotage moves integration-specific competence, not general intelligence. An
agent's pretraining still supplies broad knowledge; Pilotage supplies the
private and changing details of a particular surface.

A hand-tuned integration may also outperform a generic Pilotage client
initially. The same was true of bespoke editor integrations before LSP
matured. The value of the standard is not that every generic integration
immediately beats every custom one. Its value is that the ecosystem no longer
has to rebuild the entire competence layer for every pairing.

Finally, moving prose to the server is not itself the differentiator. Other
MCP work is already moving in that direction. The distinguishing property of
Pilotage is that the important knowledge becomes checkable: diagnostics an
agent can act on, a plan a host can gate, and a trace it can inspect after
execution.

---

## Scope

Pilotage is intended for tools whose inputs contain a constrained language or
program interpreted by the server.

Typical examples include:

- data queries;
- workflow definitions;
- automation rules;
- policy expressions;
- CI and deployment configurations;
- orchestration graphs;
- transformation pipelines;
- structured search or filtering languages.

Pilotage may also be useful for smaller expression languages, although some
capabilities may be unnecessary. A pure expression language with no changing
external environment, for example, may support guides and validation while
exposing an empty or minimal catalog.

Pilotage is generally not intended for:

- ordinary record-like arguments already described adequately by JSON Schema;
- unconstrained natural-language fields;
- arbitrary general-purpose code whose environment, dependencies, and possible
  effects cannot be meaningfully bounded or described by the server.

The relevant distinction is not whether an input is represented as a string or
an object. It is whether the input behaves as a language that requires
semantics beyond its structural schema.

---

## Trust and security

Pilotage makes a cooperative server more understandable and more checkable. It
does not make an untrusted or malicious server safe.

Manifests, guides, catalogs, diagnostics, plans, risk labels, and traces are
all produced by the server. A client may use them as evidence about the server's declared
behavior, but it must not treat them as independent proof that the server is
honest.

A server can omit a side effect from a plan, misclassify an operation, publish
an inaccurate catalog, or return a misleading trace.

Pilotage therefore improves transparency and interoperability within an
explicit trust boundary. It does not replace:

- authentication;
- authorization;
- sandboxing;
- policy enforcement;
- user confirmation;
- independent monitoring;
- infrastructure-level security controls.

The extension standardizes what a server can declare and how a client can
interact with those declarations. It does not guarantee the truthfulness of
the declaring party.

---

## Design principle

Pilotage follows one governing rule:

> **Standardize the loop, not the language.**

Pilotage does not define SQL, workflow syntax, automation semantics, policy
languages, or deployment formats. Those remain the responsibility of their
respective systems.

It standardizes the reusable interaction around them:

- how a server announces its capabilities;
- how an agent learns the language;
- how it discovers the live environment;
- how it checks a candidate program;
- how it inspects expected execution;
- how it reviews actual execution.

This is the same separation that allows a protocol to support many underlying
systems without forcing them into a single language or runtime.

---

## About the name

Pilotage means navigating by reference to the environment's own marks and
lights (its buoys, landmarks, and leading signals) rather than navigating from
instruments alone.

The name captures the central idea of the extension: guidance comes from the
surface being navigated.

---

## Design decisions

The following decisions define the shape of Pilotage and record the
alternatives that were intentionally rejected.

| Decision | Rejected alternative | Rationale |
|---|---|---|
| Build Pilotage as an MCP extension. | Create a standalone protocol. | The required capabilities can be expressed through MCP's existing identity, transport, discovery, authorization, and extension mechanisms. Reusing MCP lowers adoption cost and keeps the competence layer attached to the surface it describes. |
| Standardize the interaction loop, not the underlying language. | Standardize the schemas or semantics of every supported program type. | Query engines, workflow systems, policy languages, and automation platforms differ substantially. A shared envelope can scale across them without forcing semantic uniformity. |
| In the trace fetch door, keep execution facts separate from optional narration. | Return one combined narrative blob. | Step inputs, outputs, timings, and decisions can be structured and checked; the facts (the trace) are the contract. Narrative interpretation is more subjective, more expensive, and not always required; it stays optional. |
| Return the proposed plan during validation. | Reveal the plan only after execution or through a separate dry run. | A plan is most valuable before effects occur. When the server can derive it during validation, returning it there enables risk review and approval without an additional execution-like operation. |
| Return the trace with the execution result. | Require a second round trip after execution to fetch the trace. | The executing system already possesses the relevant facts. Returning them immediately avoids reconstructing state and allows stateless implementations. |
| v1.1: fold explain into trace (one record, one layer, two access paths). | Keep a separate explain layer beside the trace. | The stored record and the inline record are the same envelope. One layer with two doors means fewer concepts with the same guarantees. |
| Make catalogs queryable, paginated, and versioned. | Place the full environment inventory into model context. | Live environments may contain thousands of symbols. Querying preserves context budgets, while a version token allows clients to detect drift between authoring, validation, and execution. |
| Align risk concepts with MCP tool annotations where possible. | Invent a completely independent risk vocabulary. | Reusing concepts already present in MCP reduces translation cost and makes Pilotage easier to integrate with existing client policies. |
| Support guides and catalogs through both resources and callable mirrors. | Publish them only as resources. | Resources are commonly controlled by the host application and may not always be surfaced to the model. Callable access ensures the agent can retrieve required knowledge through an explicit interaction. Compatible skills mechanisms may also be used where available. |
| Use stable, enumerated diagnostic codes. | Return only free-text errors. | An agent can learn, branch on, test against, and recover from a closed diagnostic vocabulary. Human-readable messages remain useful, but they should not be the only contract. |
| Defer completeness assertions to a later version. | Include full "the program completely satisfies the goal" assertions in v1. | Completeness is substantially harder than syntax, reference, and execution validation. Deferring it keeps the first version implementable while acknowledging the boundary honestly. |
| Frame Pilotage around learning, convergence, and scale. | Describe it only as documentation or validation for complex payloads. | Guides and catalogs solve how an agent learns; validation, planning, and tracing solve how it converges; server-published competence solves the ecosystem's scaling problem. All three are necessary to explain the full value. |
| State the trust boundary explicitly. | Present plans, labels, and traces as independent proof of safety. | Pilotage makes a cooperative server more checkable. It cannot guarantee that a malicious server reports its behavior truthfully. |
| Allow composable adoption. | Require every server to implement every capability. | Some languages have no live catalog, some operations need validation but no trace, and some read-only systems require little risk planning. Servers should implement the capabilities that have real meaning for their surface. |

---

## The idea in one sentence

Pilotage lets an MCP server publish the checkable competence required to use
its complex tools, so any compatible agent can learn, validate, plan, execute,
and trace them through a common interface.

Or, more simply:

**Schemas teach the moves. Pilotage teaches the game.**
