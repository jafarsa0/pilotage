/**
 * Server binding: Harborview (buildingflow/1).
 *
 * A binding supplies what the engine-neutral vectors cannot know: concrete
 * programs in the language under test, the name of the program argument on
 * the loop tools, and hooks that observe or perturb the engine's world.
 * Everything else (transport, schema validation, the vector assertions)
 * lives in the harness and is server-independent.
 */

const GOOD_FLOW = {
  name: "comfort check",
  steps: [
    { id: "occ", do: "call", device: "sensor.occupancy", action: "read" },
    {
      id: "gate", do: "branch",
      when: { gt: ["$.steps.occ.output.count", 0] },
      then: [{ id: "warm", do: "call", device: "hvac.zone1", action: "set_target", with: { celsius: 22 } }],
      else: [{ id: "eco", do: "call", device: "hvac.zone1", action: "eco_mode" }],
    },
  ],
  output: { path_taken: "$.steps.gate.output.took" },
};

export default {
  name: "Harborview (buildingflow/1)",
  endpoint: "https://harborview.pilotagespec.org/mcp",
  language: "buildingflow/1",

  /** The language-chosen name of the inline-program argument (Part III 4.3). */
  programArg: "flow",
  /** Members every execute request needs beyond the reserved names. */
  executeDefaults: { mode: "immediate" },

  programs: {
    /** Valid at the boot catalog; branches; taken arm is known (occupancy boots at 23 > 0). */
    valid: GOOD_FLOW,
    /** The step ids the valid program's success trace must contain, in order. */
    validTraceIds: ["occ", "gate", "warm"],
    /** Trace entries that invoke a catalog entry (must carry `calls`). */
    validCallSteps: ["occ", "warm"],
    branching: { branchId: "gate", takenBase: "warm", untakenBase: "eco", expectedTook: "then" },

    /** Invalid: a typo'd device id (closed code unknown_device). */
    invalid: { steps: [{ id: "a", do: "call", device: "light.loby", action: "turn_on" }] },

    /** Step id carrying a reserved trace-identity character. */
    reservedChar: { steps: [{ id: "a#1", do: "set", value: 1 }] },

    /** Fails deterministically on the second step (a path into a missing key). */
    midRunFailing: {
      flow: {
        steps: [
          { id: "ok1", do: "call", device: "light.lobby", action: "turn_on" },
          { id: "boom", do: "set", value: "$.steps.ok1.output.not_a_key" },
          { id: "never", do: "call", device: "light.lobby", action: "turn_off" },
        ],
      },
      prefix: ["ok1", "boom"],
    },

    /** Exceeds the server's documented 64 KiB document bound. */
    oversized: () => ({ steps: [{ id: "a", do: "set", value: "x".repeat(70 * 1024) }] }),

    /** More steps than the documented 100-step bound: reachable 'constraint' diagnostic. */
    constraint: {
      steps: Array.from({ length: 101 }, (_, i) => ({ id: `s${i}`, do: "set", value: i })),
    },

    /** Promotable flow with a declared input schema and a known referenced device. */
    promotable: {
      flow: {
        name: "Night shutdown",
        input: { fields: [{ name: "warn", type: "boolean", required: false }] },
        steps: [
          { id: "lights", do: "call", device: "light.lobby", action: "turn_off" },
          { id: "lockup", do: "call", device: "lock.dock_door", action: "lock" },
        ],
      },
      badInput: { warn: "yes" },
      referencedDevice: "lock.dock_door",
    },
  },

  hooks: {
    /** Fingerprint of externally observable engine state. */
    async observe(session) {
      const r = await session.call("world_status", {});
      return JSON.stringify(r.sc);
    },
    /** Change the visible catalog so catalog_version must move. */
    async bumpCatalog(session) {
      await session.call("world_advance", { remove_device: "light.floor2_west" });
    },
    /** Remove one specific device (promotion-drift setups). */
    async removeDevice(session, id) {
      await session.call("world_advance", { remove_device: id });
    },
    /** Promote a flow; returns the catalog ref. */
    async promote(session, flow, name) {
      const r = await session.call("promote_flow", { flow, name });
      if (r.isError) throw new Error(`promote_flow failed: ${JSON.stringify(r.sc)}`);
      return r.sc.ref;
    },
    /** A second execute payload for the same idempotency key that differs. */
    idempotencyConflictArgs(args) {
      return { ...args, mode: "deploy" };
    },
  },

  /**
   * Vectors this binding cannot reach, with the reason on the record.
   * A skip is a statement about constructibility for THIS language/server,
   * never a waiver of the requirement itself.
   */
  skips: {
    "PIL-LOOKUP-UNKNOWN-BASELINE-B":
      "requires catalog.changed_since, which buildingflow/1 does not declare",
    "PIL-VALIDATE-WARNINGS-ONLY-G":
      "buildingflow/1 defines no warning-severity diagnostic, so a warnings-only program is not constructible",
    "PIL-VALIDATE-CONTEXT-MISSING-B":
      "requires a Language WITH a required context_schema; buildingflow/1 declares none (the undeclared-context case is covered by PIL-VALIDATE-CONTEXT-UNDECLARED-B)",
    "PIL-EXECUTE-TEST-RUN-UNDECLARED-B":
      "requires a Language that does NOT declare test_run; buildingflow/1 declares it (test_run behaviour is exercised by the server's own suite)",
    "PIL-EXECUTE-MODE-MISSING-B": null, // runs: execution is 'both'
    "PIL-TRACE-ZERO-ITERATION-LOOP-G":
      "not constructible in buildingflow/1: the only list source for for_each is a device tag, and validation requires the tag to be non-empty (the engine's zero-iteration handling exists but is unreachable through valid programs)",
    "PIL-EXECUTE-ENGINE-ERROR-B":
      "unreachable: Harborview reports every clean engine failure with the more specific documented status 'partial' (trace-prefix semantics); the reserved fallback 'error' is enumerated in the closed-sets guide but no program reaches it",
    "PIL-EXECUTE-INTERNAL-B":
      "requires a fault-injection test build (a deliberately crashed validator); not reachable against a production deployment",
    "PIL-CLIENT-GATE-DESTRUCTIVE-B":
      "targets the Client/Host, not a Server; verify in the client's own test suite",
    "PIL-CLIENT-VALUES-NOT-FAILURES-G":
      "targets the Client/Host, not a Server; verify in the client's own test suite",
  },
};
