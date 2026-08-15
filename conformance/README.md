# Pilotage conformance test vectors

`vectors.json` contains 54 engine-neutral, machine-readable test vectors keyed
to the requirements of the Pilotage specification (Parts II and III). They
follow the both-polarity method described in Part IV Section 4.2: for every
closed-set surface, a concrete **good** case and a concrete **bad** case,
where "bad" means *rejected correctly, as a value, never a crash*.

## The runnable harness

`harness/` executes the server-target vectors against a **live** MCP
endpoint:

```
cd harness
npm install
node harness.mjs                 # default: the public Harborview example server
node harness.mjs --endpoint http://localhost:8787/mcp
node harness.mjs --only PIL-EXECUTE-DRIFT-B
```

The harness is server-independent; everything language-specific lives in a
small **binding** module (`harness/bindings/harborview.mjs`) that supplies
concrete programs for each `<placeholder>`, the language's program-argument
name, and hooks to observe or perturb the engine's world. To run the vectors
against your own Server, copy that file, fill in programs in your Language,
and pass `--binding ./bindings/your-server.mjs`.

Every vector ends in one of three verdicts, printed per vector:

- **PASS**: all expected assertions held, including shape validation
  against `../schemas/1.1/pilotage.schema.json`.
- **FAIL**: an assertion did not hold; the process exits non-zero.
- **SKIP**: the vector is not reachable for this binding (an undeclared
  capability, a setup the language cannot construct, or a client-target
  vector). Every skip prints its reason; a skip is a statement of
  non-constructibility on the record, never a waiver.

## How to bind them by hand

The vectors are specifications of tests. A Server implementer binds each
vector to their engine:

1. Replace every `<placeholder>` (a program, an input, an entry id) with a
   concrete artifact of your Language that satisfies the vector's `setup`.
2. Drive the `action` through your real MCP endpoint (Part IV Section 4.3:
   from the endpoint in, not handler-level).
3. Assert everything in `expected`: shape validation against the named
   `$defs` of `../schemas/1.1/pilotage.schema.json`, `isError` and
   request-error `kind` values, JSON-RPC codes, and the listed assertions.

A vector applies only when its `requires` capabilities (and sub-features)
are declared by the Language under test; reachability follows declared
capabilities (Part IV Section 4.2).

Two vectors target the Client side (`"target": "client"`); they specify
observable Client behavior for host implementers.

## The completeness gate

Keep a script in your build that fails when any *reachable* closed-set
member (diagnostic code, outcome status, request-error kind) lacks both
its cases in your bound test suite. (This file's own integrity is checked
the same way: every reserved request-error kind, outcome status, and
diagnostic code appears in at least one vector; the kind `unsupported` is
exercised by PIL-EXECUTE-STORE-UNSUPPORTED-B.)

## Status

These vectors accompany wire version 1.1 of the specification, and the
runnable harness
in `harness/` executes them against a live server (see above). The vectors
remain usable by hand for anyone binding them to a different Server.

License: Apache-2.0 (the specification text remains CC BY 4.0).
