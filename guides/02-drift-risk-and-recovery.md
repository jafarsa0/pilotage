# Drift, risk, and recovery

The [first guide](01-your-first-verified-run.md) walked the happy path.
This one is about the guarantees that make the unhappy paths safe: the
part that separates a demo from something you would let touch a real
system. Four questions, four mechanisms:

1. **Is my knowledge still current?** `expected_catalog_version` and the
   `catalog_drift` refusal.
2. **What is the worst this program can do?** The plan's aggregated risk,
   and the Host's gate.
3. **Can I simulate it first?** `test_run`.
4. **Did it happen exactly once? What if it broke halfway?**
   idempotency keys, and the `partial` outcome with its trace prefix.

As in the first guide, every request and response on this page is replayed
against the live server in CI. Fresh session; the building boots in its
usual state:

```json request
{ "tool": "world_status", "arguments": {} }
```

```json response subset
{ "time": "14:03", "occupancy": 23,
  "devices": [ { "id": "light.lobby", "state": { "on": false, "brightness": 0 } } ] }
```

## 1 · Drift: when the world changes under you

You validated a flow, you are about to run it, and between those two
moments, the building changed. In Harborview you can *cause* that on
demand; `world_advance` is the simulator's control panel:

```json request
{ "tool": "world_advance", "arguments": { "remove_device": "light.floor2_west" } }
```

```json response
{
  "time": "14:03",
  "fired": []
}
```

A device is gone, so the catalog is different, so its version token is
different. Now run a flow pinned to the **old** token
(`cv_590fefad56a7a504`, the boot catalog from the first guide):

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
      ]
    },
    "mode": "immediate",
    "expected_catalog_version": "cv_590fefad56a7a504"
  }
}
```

```json response
{
  "run_id": "run_0001",
  "outcome": {
    "ok": false,
    "status": "catalog_drift",
    "error": "the catalog changed since validation"
  }
}
```

`catalog_drift`, **nothing executed**, even though this particular flow
never touches the removed device. That is deliberate: the refusal means
"the world you validated against is not the world you are about to act
on"; whether the difference is benign is a judgment the server refuses to
make silently. Note it is an *outcome*, not an error: failure is a value
you can branch on.

Recovery is one step: re-validate, which hands you the current token:

```json request
{
  "tool": "validate_flow",
  "arguments": {
    "flow": {
      "name": "comfort check",
      "steps": [
        { "id": "occ", "do": "call", "device": "sensor.occupancy", "action": "read" },
        { "id": "gate", "do": "branch",
          "when": { "gt": ["$.steps.occ.output.count", 0] },
          "then": [ { "id": "warm", "do": "call", "device": "hvac.zone1", "action": "set_target", "with": { "celsius": 22 } } ],
          "else": [ { "id": "eco",  "do": "call", "device": "hvac.zone1", "action": "eco_mode" } ] }
      ]
    }
  }
}
```

```json response
{
  "valid": true,
  "diagnostics": [],
  "catalog_version": "cv_d4e1f4237c537ac0",
  "plan": {
    "steps": [
      {
        "id": "occ",
        "risk": "safe",
        "risk_hints": {
          "readOnly": true,
          "destructive": false,
          "openWorld": false
        },
        "calls": "sensor.occupancy"
      },
      {
        "id": "gate",
        "risk": "safe",
        "risk_hints": {
          "readOnly": true,
          "destructive": false,
          "openWorld": false
        }
      },
      {
        "id": "warm",
        "risk": "write",
        "risk_hints": {
          "readOnly": false,
          "destructive": false,
          "openWorld": false
        },
        "arm": {
          "branch": "gate",
          "label": "then"
        },
        "calls": "hvac.zone1"
      },
      {
        "id": "eco",
        "risk": "write",
        "risk_hints": {
          "readOnly": false,
          "destructive": false,
          "openWorld": false
        },
        "arm": {
          "branch": "gate",
          "label": "else"
        },
        "calls": "hvac.zone1"
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

…and run pinned to the fresh token:

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
      ]
    },
    "mode": "immediate",
    "expected_catalog_version": "cv_d4e1f4237c537ac0"
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

The loop closed itself: refusal → re-validate → run. No human debugging
session, no stale write.

## 2 · Risk: what the plan tells the Host

Validation is also where risk surfaces. This flow ends by **unlocking the
dock door**: Harborview marks `unlock` destructive:

```json request
{
  "tool": "validate_flow",
  "arguments": {
    "flow": {
      "name": "after-hours lockdown",
      "steps": [
        { "id": "lights", "do": "call", "device": "light.lobby", "action": "turn_off" },
        { "id": "dock",   "do": "call", "device": "lock.dock_door", "action": "unlock" }
      ]
    }
  }
}
```

```json response subset
{ "valid": true,
  "plan": { "max_risk": "destructive", "max_risk_hints": { "destructive": true, "openWorld": false } } }
```

The program is *valid*, and the plan aggregates the worst step up to
`max_risk: "destructive"`. Pilotage's rule (Part II §7.3) is that the
**Host**, not the model, gates on this: a destructive plan means a human
approves before `run_flow` is ever sent. The model proposes; the record
decides what needs a signature.

## 3 · Test first: `test_run`

Harborview declares the `test_run` capability, so any deployable flow can
be exercised against a **simulated copy** of the building. Here is an
automation that would turn the lobby light on at 22:00, then test-run it:

```json request
{
  "tool": "run_flow",
  "arguments": {
    "flow": {
      "trigger": { "schedule": "22:00" },
      "steps": [ { "id": "on", "do": "call", "device": "light.lobby", "action": "turn_on" } ]
    },
    "mode": "deploy",
    "test_run": true,
    "trace_level": "full"
  }
}
```

```json response
{
  "run_id": "run_0003",
  "outcome": {
    "ok": true,
    "status": "success",
    "error": null
  },
  "trace": {
    "run_id": "run_0003",
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

An ordinary trace comes back (the step ran, the simulated light went on)
but the *real* building is untouched; the lobby light is still off:

```json request
{ "tool": "world_status", "arguments": {} }
```

```json response subset
{ "time": "14:03",
  "devices": [ { "id": "light.lobby", "state": { "on": false, "brightness": 0 } } ] }
```

## 4 · Exactly once, and halfway

Retries are how distributed systems lie to you: a timeout, a resend, and a
"turn everything off" flow has run twice. Pilotage's answer is the
`idempotency_key`. First run executes:

```json request
{
  "tool": "run_flow",
  "arguments": {
    "flow": { "steps": [ { "id": "on", "do": "call", "device": "light.lobby", "action": "turn_on" } ] },
    "mode": "immediate",
    "idempotency_key": "nightly-2026-07-24"
  }
}
```

```json response
{
  "run_id": "run_0004",
  "outcome": {
    "ok": true,
    "status": "success",
    "error": null
  },
  "trace": {
    "run_id": "run_0004",
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

Send the **identical** request again: a replay, not a re-execution; note
the *same* `run_id`:

```json request
{
  "tool": "run_flow",
  "arguments": {
    "flow": { "steps": [ { "id": "on", "do": "call", "device": "light.lobby", "action": "turn_on" } ] },
    "mode": "immediate",
    "idempotency_key": "nightly-2026-07-24"
  }
}
```

```json response
{
  "run_id": "run_0004",
  "outcome": {
    "ok": true,
    "status": "success",
    "error": null
  },
  "trace": {
    "run_id": "run_0004",
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

Reusing the key with a **different** payload is a contract violation, and
it is loud, not silent:

```json request
{
  "tool": "run_flow",
  "arguments": {
    "flow": { "steps": [ { "id": "on", "do": "call", "device": "light.lobby", "action": "turn_on" } ] },
    "mode": "deploy",
    "idempotency_key": "nightly-2026-07-24"
  }
}
```

```json response
{
  "error": {
    "kind": "idempotency_conflict",
    "message": "this idempotency key was used with a different runnable or input"
  }
}
```

And when a program fails *mid-run*, the outcome is `partial` and the trace
is the executed prefix, so you know exactly how far it got. This flow's
second step dereferences a key that does not exist:

```json request
{
  "tool": "run_flow",
  "arguments": {
    "flow": {
      "steps": [
        { "id": "ok1",   "do": "call", "device": "light.lobby", "action": "turn_on" },
        { "id": "boom",  "do": "set",  "value": "$.steps.ok1.output.not_a_key" },
        { "id": "never", "do": "call", "device": "light.lobby", "action": "turn_off" }
      ]
    },
    "mode": "immediate",
    "trace_level": "full"
  }
}
```

```json response
{
  "run_id": "run_0005",
  "outcome": {
    "ok": false,
    "status": "partial",
    "error": "set 'boom': '$.steps.ok1.output.not_a_key': 'not_a_key' not present in step output"
  },
  "trace": {
    "run_id": "run_0005",
    "level": "full",
    "steps": [
      {
        "id": "ok1",
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
      },
      {
        "id": "boom",
        "input": null,
        "outcome": {
          "ok": false,
          "status": "error",
          "error": "'$.steps.ok1.output.not_a_key': 'not_a_key' not present in step output"
        }
      }
    ]
  }
}
```

`ok1` ran, `boom` is on the record with its failure, `never` never
happened. Recovery starts from facts, not archaeology.

## The shape of the whole thing

Everything on this page was a **value**: drift was a status, risk was a
plan field, the replay was a recorded response, the halfway failure was a
trace prefix. Nothing was an exception, a retry loop, or a guess. That is
the Pilotage contract: *the loop stays closed even when the world
misbehaves.*

- The model and the rules: [Part II](../spec/part-ii-abstract-model.md)
  (§5.4 catalog versioning, §5.7 outcomes, §6.5 execute, §7.3 the risk gate).
- Verify a server yourself: [`conformance/`](../conformance/README.md).
