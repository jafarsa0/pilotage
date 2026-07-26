# Your first verified run

This guide walks the whole Pilotage loop once, against a real server:
**discover → learn → look up → validate → execute → trace.** Every request
and response below is live output from the public example server; a CI
check replays this page against the server on every change, so what you
read here is what you will get.

The server is **Harborview**, a simulated smart building operable through
one MCP endpoint:

```
POST https://harborview.pilotagespec.org/mcp
```

Harborview's program language is `buildingflow/1`, a small JSON automation
language that was invented for this server, which is the point: your model
has never seen it, and the loop is what makes an agent reliable in it
anyway. Each session gets its own private copy of the building, so nothing
you run here can interfere with anyone else.

## 0 · Connect

Pilotage rides on plain MCP. Initialize, and keep the session id the server
returns: Harborview scopes your building, your runs, and your promotions
to it:

```bash
curl -s -D - -X POST https://harborview.pilotagespec.org/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
        "protocolVersion":"2025-11-25","capabilities":{},
        "clientInfo":{"name":"me","version":"0"}}}'
# ← note the mcp-session-id response header; send it back on every call
```

Every request that follows is a `tools/call` carrying that
`Mcp-Session-Id` header. We show only the tool name, the arguments, and the
tool's `structuredContent`.

## 1 · Discover: the manifest

One tool is guaranteed on every Pilotage server, whatever else is enabled:
`pilotage_manifest`. It tells you which Languages exist, which tools form
the loop for each, and exactly which optional capabilities you may use.
If a capability is not declared here, sending it is an error, not a shrug:

```json request
{ "tool": "pilotage_manifest", "arguments": {} }
```

```json response
{
  "pilotage": "1.1",
  "languages": [
    {
      "name": "buildingflow/1",
      "title": "Harborview building flows",
      "guides": "pilotage_get_guide",
      "catalog": "pilotage_catalog",
      "guides_resource": "pilotage://guides/buildingflow%2F1",
      "catalog_resource": "pilotage://catalog/buildingflow%2F1",
      "loop": {
        "validate": "validate_flow",
        "execute": "run_flow",
        "trace": "trace_run"
      },
      "capabilities": {
        "guides": true,
        "catalog": {
          "search": true
        },
        "validate": true,
        "plan": true,
        "execute": {
          "test_run": true,
          "idempotency": true
        },
        "trace_fetch": true
      },
      "locator": "json-pointer",
      "execution": "both",
      "trace": "full",
      "retention": "session"
    }
  ]
}
```

Read the `loop` object: for `buildingflow/1`, validation is `validate_flow`,
execution is `run_flow`, and the trace fetch door is `trace_run`. Those are
the names we call for the rest of this guide.

## 2 · Learn: the guides

The grammar of `buildingflow/1` is not in your training data. It is on the
server, behind `pilotage_get_guide`. The index is small on purpose; bodies
are fetched one at a time:

```json request
{ "tool": "pilotage_get_guide", "arguments": { "language": "buildingflow/1" } }
```

```json response
{
  "guides": [
    {
      "id": "quickstart",
      "title": "Your first flow",
      "level": "core",
      "topics": [
        "shape",
        "steps",
        "expressions",
        "scope-rules",
        "the-loop"
      ],
      "version": "1",
      "language": "buildingflow/1",
      "format": "text/markdown",
      "size_bytes": 2653
    },
    {
      "id": "reference",
      "title": "The closed sets: codes, statuses, kinds, bounds",
      "level": "reference",
      "topics": [
        "closed-sets",
        "diagnostic-codes",
        "outcomes",
        "risk",
        "scope-rules",
        "input-binding",
        "trace-levels",
        "bounds"
      ],
      "version": "1",
      "language": "buildingflow/1",
      "format": "text/markdown",
      "size_bytes": 4417
    },
    {
      "id": "examples",
      "title": "Worked examples",
      "level": "examples",
      "topics": [
        "read-then-act",
        "input",
        "automation"
      ],
      "version": "1",
      "language": "buildingflow/1",
      "format": "text/markdown",
      "size_bytes": 1836
    }
  ]
}
```

Fetch the core guide and actually read it; it is a few kilobytes and it is
the entire language:

```json request
{ "tool": "pilotage_get_guide", "arguments": { "language": "buildingflow/1", "id": "quickstart" } }
```

```json response subset
{ "guide": { "id": "quickstart", "level": "core" } }
```

*(The `body` member is the full guide text; we elide it here.)*

## 3 · Look up: the catalog

Guides teach the grammar; the **catalog** holds the vocabulary that is real
*right now*: live device ids, their actions, and per-entry risk. Ask for
the lobby light:

```json request
{ "tool": "pilotage_catalog", "arguments": { "language": "buildingflow/1", "verb": "get", "id": "light.lobby" } }
```

```json response
{
  "entry": {
    "id": "light.lobby",
    "kind": "light",
    "name": "Lobby lights",
    "description": "Lighting circuit: Lobby lights. Actions: turn_on(); turn_off(); set_brightness(percent: number).",
    "input_schema": {
      "type": "object",
      "properties": {
        "action": {
          "type": "string",
          "enum": [
            "turn_on",
            "turn_off",
            "set_brightness"
          ]
        },
        "with": {
          "type": "object"
        }
      },
      "required": [
        "action"
      ]
    },
    "output_schema": null,
    "risk": "write",
    "risk_hints": {
      "readOnly": false,
      "destructive": false,
      "openWorld": false
    },
    "tags": [
      "lighting",
      "lobby"
    ],
    "languages": [
      "buildingflow/1"
    ]
  },
  "catalog_version": "cv_590fefad56a7a504"
}
```

Two things to keep: the entry's **actions with typed arguments**, and the
**`catalog_version`** token, a fingerprint of everything you can currently
see. We will pin it at execution time.

## 4 · Draft, and make the classic mistake

Write the smallest possible flow (turn the lobby light on) with a typo'd
device id, and send it to `validate_flow`. Validation never touches the
building; it is free to fail:

```json request
{
  "tool": "validate_flow",
  "arguments": {
    "flow": { "steps": [ { "id": "on", "do": "call", "device": "light.loby", "action": "turn_on" } ] }
  }
}
```

```json response
{
  "valid": false,
  "diagnostics": [
    {
      "severity": "error",
      "code": "unknown_device",
      "path": "/steps/0/device",
      "message": "unknown device 'light.loby'",
      "hint": "close match: light.lobby"
    }
  ],
  "catalog_version": "cv_590fefad56a7a504"
}
```

This is the moment Pilotage exists for. Not a stack trace, not a guess, but a
**closed diagnostic code** (`unknown_device`), a **path** to the exact
member that is wrong, and a **hint** naming the real id. An agent repairs
this in one step, deterministically.

## 5 · Fix it, and read the plan

```json request
{
  "tool": "validate_flow",
  "arguments": {
    "flow": { "steps": [ { "id": "on", "do": "call", "device": "light.lobby", "action": "turn_on" } ] }
  }
}
```

```json response
{
  "valid": true,
  "diagnostics": [],
  "catalog_version": "cv_590fefad56a7a504",
  "plan": {
    "steps": [
      {
        "id": "on",
        "risk": "write",
        "risk_hints": {
          "readOnly": false,
          "destructive": false,
          "openWorld": false
        },
        "calls": "light.lobby"
      }
    ],
    "max_risk": "write",
    "max_risk_hints": {
      "readOnly": false,
      "destructive": false,
      "openWorld": false
    }
  }
}
```

`valid: true` comes with a **plan**: every step, what it calls, and its
risk: here a single `write`-level call, nothing destructive. A Host shows
this plan to a human *before* anything runs; that is the approval gate.

## 6 · Execute, pinned to what you validated

Between your validation and your execution, the world can change. Pin the
run to the catalog you saw: pass the `catalog_version` from step 5 as
`expected_catalog_version`. If the catalog has moved, the server refuses
*before* re-validating, and nothing runs:

```json request
{
  "tool": "run_flow",
  "arguments": {
    "flow": { "steps": [ { "id": "on", "do": "call", "device": "light.lobby", "action": "turn_on" } ] },
    "mode": "immediate",
    "trace_level": "full",
    "expected_catalog_version": "cv_590fefad56a7a504"
  }
}
```

```json response
{
  "run_id": "run_0001",
  "outcome": {
    "ok": true,
    "status": "success",
    "error": null
  },
  "trace": {
    "run_id": "run_0001",
    "level": "full",
    "steps": [
      {
        "id": "on",
        "calls": "light.lobby",
        "input": {
          "action": "turn_on"
        },
        "output": {
          "on": true,
          "brightness": 100
        },
        "outcome": {
          "ok": true,
          "status": "success",
          "error": null
        }
      }
    ]
  }
}
```

The light is on, and the **trace** proves it: one entry per executed step,
each naming the catalog entry it invoked (`calls`), its input, its output,
and its outcome.

## 7 · A branch, with the decision on the record

Traces earn their keep the moment a program can take more than one path.
This flow reads the occupancy sensor and branches:

```json request
{
  "tool": "run_flow",
  "arguments": {
    "flow": {
      "name": "comfort check",
      "steps": [
        { "id": "occ", "do": "call", "device": "sensor.occupancy", "action": "read" },
        { "id": "gate", "do": "branch",
          "when": { "gt": ["$.steps.occ.output.count", 0] },
          "then": [ { "id": "warm", "do": "call", "device": "hvac.zone1", "action": "set_target", "with": { "celsius": 22 } } ],
          "else": [ { "id": "eco",  "do": "call", "device": "hvac.zone1", "action": "eco_mode" } ] }
      ],
      "output": { "path_taken": "$.steps.gate.output.took" }
    },
    "mode": "immediate",
    "trace_level": "full"
  }
}
```

```json response
{
  "run_id": "run_0002",
  "outcome": {
    "ok": true,
    "status": "success",
    "error": null
  },
  "output": {
    "path_taken": "then"
  },
  "trace": {
    "run_id": "run_0002",
    "level": "full",
    "steps": [
      {
        "id": "occ",
        "calls": "sensor.occupancy",
        "input": {
          "action": "read"
        },
        "output": {
          "count": 23
        },
        "outcome": {
          "ok": true,
          "status": "success",
          "error": null
        }
      },
      {
        "id": "gate",
        "outcome": {
          "ok": true,
          "status": "success",
          "error": null
        },
        "decisions": [
          {
            "at": "gate",
            "took": "then",
            "because": "{\"gt\":[\"$.steps.occ.output.count\",0]} → true"
          }
        ]
      },
      {
        "id": "warm",
        "calls": "hvac.zone1",
        "input": {
          "action": "set_target",
          "celsius": 22
        },
        "output": {
          "target_celsius": 22,
          "eco": false
        },
        "outcome": {
          "ok": true,
          "status": "success",
          "error": null
        }
      }
    ]
  }
}
```

Look at the `gate` entry: `decisions` records **which arm ran and why**
(`took: "then"`, because occupancy was 23). The untaken arm (`eco`) is
absent, not silently but checkably: the plan told you `eco` belonged to
the `else` arm, so its absence is exactly what a correct run looks like.
"It succeeded but did nothing" stops being a mystery; the decision record
answers it.

## 8 · Trace, again: the run is on the record

The trace that rode the execute response is one door; the same record has
a second. Harborview declares `session` retention, so a started run is
kept and can be reopened later by its `run_id` (an execute request can
override that with `store: true` or `store: false`; `trace_level` never
decides retention):

```json request
{ "tool": "trace_run", "arguments": { "run_id": "run_0002" } }
```

```json response
{
  "run_id": "run_0002",
  "outcome": {
    "ok": true,
    "status": "success",
    "error": null
  },
  "output": {
    "path_taken": "then"
  },
  "trace": {
    "run_id": "run_0002",
    "level": "full",
    "steps": [
      {
        "id": "occ",
        "calls": "sensor.occupancy",
        "input": {
          "action": "read"
        },
        "output": {
          "count": 23
        },
        "outcome": {
          "ok": true,
          "status": "success",
          "error": null
        }
      },
      {
        "id": "gate",
        "outcome": {
          "ok": true,
          "status": "success",
          "error": null
        },
        "decisions": [
          {
            "at": "gate",
            "took": "then",
            "because": "{\"gt\":[\"$.steps.occ.output.count\",0]} → true"
          }
        ]
      },
      {
        "id": "warm",
        "calls": "hvac.zone1",
        "input": {
          "action": "set_target",
          "celsius": 22
        },
        "output": {
          "target_celsius": 22,
          "eco": false
        },
        "outcome": {
          "ok": true,
          "status": "success",
          "error": null
        }
      }
    ]
  }
}
```

That is the whole loop. You never guessed a device id, you saw the risk
before anything ran, the run was pinned to the catalog you validated
against, and the branch decision is on the record.

## Where next

- **[Drift, risk, and recovery](02-drift-risk-and-recovery.md)**: what
  happens when the world changes under you, and the guarantees that make
  failure safe.
- **The specification**: Parts [I](../spec/part-i-story-and-positioning.md)
  (why), [II](../spec/part-ii-abstract-model.md) (the model),
  [III](../spec/part-iii-mcp-binding.md) (the MCP binding),
  [IV](../spec/part-iv-implementation-notes.md) (building servers).
- **The conformance harness**: run the same 54 vectors this server is
  tested against:
  [`conformance/`](../conformance/README.md).
