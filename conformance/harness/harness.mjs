#!/usr/bin/env node
/**
 * Pilotage 1.1 conformance harness.
 *
 * Binds the engine-neutral vectors in ../vectors.json to a live Server
 * through the MCP binding (Part III) and asserts the expectations, validating
 * structured results against ../../schemas/1.1/pilotage.schema.json.
 *
 * Usage:
 *   npm install
 *   node harness.mjs                                   # Harborview, live endpoint
 *   node harness.mjs --endpoint http://localhost:8787/mcp
 *   node harness.mjs --binding ./bindings/your-server.mjs
 *   node harness.mjs --only PIL-EXECUTE-DRIFT-B
 *
 * Exit code 0 iff no vector FAILed. A SKIP is a documented statement of
 * non-constructibility for the bound language, printed with its reason.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import AjvModule from "ajv/dist/2020.js";

const Ajv2020 = AjvModule.default ?? AjvModule;
const here = path.dirname(fileURLToPath(import.meta.url));

// ---------- arguments ----------
const argv = process.argv.slice(2);
function argOf(flag, dflt) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
}
const bindingRef = argOf("--binding", "./bindings/harborview.mjs");
const binding = (await import(new URL(bindingRef, import.meta.url))).default;
const endpoint = argOf("--endpoint", binding.endpoint);
const only = argOf("--only", null);

// ---------- vectors + schema ----------
const vectorsDoc = JSON.parse(await readFile(path.join(here, "..", "vectors.json"), "utf8"));
const schema = JSON.parse(
  await readFile(path.join(here, "..", "..", "schemas", "1.1", "pilotage.schema.json"), "utf8"),
);
const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addSchema(schema);
function schemaErrors(defName, value) {
  const v = ajv.getSchema(`${schema.$id}#/$defs/${defName}`);
  if (!v) return `schema has no $defs/${defName}`;
  return v(value) ? null : ajv.errorsText(v.errors, { dataVar: defName });
}

// ---------- transport (MCP over HTTP JSON-RPC) ----------
let rpcId = 0;
class Session {
  constructor() {
    this.id = null;
    this.manifest = null;
  }
  async raw(body, extraHeaders = {}) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "pilotage-conformance/1.1",
        ...(this.id ? { "mcp-session-id": this.id } : {}),
        ...extraHeaders,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    const sid = res.headers.get("mcp-session-id");
    if (sid && !this.id) this.id = sid;
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON body */
    }
    return { status: res.status, body: json };
  }
  async rpc(method, params) {
    const { body } = await this.raw({
      jsonrpc: "2.0",
      id: ++rpcId,
      method,
      ...(params !== undefined ? { params } : {}),
    });
    return body;
  }
  /** tools/call → { sc, isError, carrier } (carrier set on a JSON-RPC error). */
  async call(name, args) {
    const body = await this.rpc("tools/call", { name, arguments: args ?? {} });
    if (!body) return { carrier: { code: 0, message: "no response body" } };
    if (body.error) return { carrier: body.error };
    const r = body.result ?? {};
    return { sc: r.structuredContent, isError: r.isError === true, content: r.content };
  }
  async open() {
    const body = await this.rpc("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "pilotage-conformance", version: "1.1" },
    });
    if (!this.id) throw new Error("server did not return an mcp-session-id header on initialize");
    this.instructions = body?.result?.instructions;
    const meta = body?.result?._meta ?? {};
    this.initMeta = meta;
    for (const [k, v] of Object.entries(meta)) {
      if (v && typeof v === "object" && v.manifest) {
        this.extensionId = k;
        this.manifest = v.manifest;
      }
    }
    return this;
  }
}

async function session() {
  return new Session().open();
}

// ---------- shared lookups ----------
const boot = await session();
if (!boot.manifest) throw new Error("initialize _meta carried no Pilotage manifest");
const lang = (boot.manifest.languages ?? []).find((l) => l.name === binding.language);
if (!lang) throw new Error(`manifest has no language '${binding.language}'`);
const TOOLS = {
  guides: lang.guides,
  catalog: lang.catalog,
  validate: lang.loop?.validate,
  execute: lang.loop?.execute,
  trace: lang.loop?.trace,
};
const CAPS = lang.capabilities ?? {};
const P = binding.programArg;
const EXEC_DEFAULTS = binding.executeDefaults ?? {};

function execArgs(extra) {
  return { ...EXEC_DEFAULTS, ...extra };
}
function baseId(traceId) {
  // strip iteration (#n) and expansion (/…) qualifiers → base identifier
  return traceId.split("#")[0].split("/")[0];
}
function capDeclared(cap, sub) {
  const c = CAPS[cap];
  if (c === undefined || c === false) return false;
  if (sub === undefined) return true;
  return typeof c === "object" && c !== null && !!c[sub];
}

// ---------- assertion collector ----------
function collector() {
  const fails = [];
  return {
    fails,
    ok(cond, msg) {
      if (!cond) fails.push(msg);
    },
    eq(a, b, msg) {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        fails.push(`${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
      }
    },
    schema(def, value, label = def) {
      const err = schemaErrors(def, value);
      if (err) fails.push(`${label} does not validate: ${err}`);
    },
    requestError(r, kind, label) {
      this.ok(!r.carrier, `${label}: must be a tool result, not a carrier error (${JSON.stringify(r.carrier)})`);
      if (r.carrier) return;
      this.ok(r.isError === true, `${label}: isError must be true`);
      this.schema("RequestError", r.sc, `${label} RequestError`);
      this.eq(r.sc?.error?.kind, kind, `${label} error kind`);
    },
    value(r, label) {
      this.ok(!r.carrier, `${label}: carrier error ${JSON.stringify(r.carrier)}`);
      if (!r.carrier) this.ok(r.isError !== true, `${label}: must not be a request error (${JSON.stringify(r.sc)})`);
    },
  };
}

// ---------- vector runners ----------
const RUNNERS = {
  async "PIL-DISCOVER-MANIFEST-G"(t) {
    const s = await session();
    const before = await binding.hooks.observe(s);
    const r = await s.call("pilotage_manifest", {});
    t.value(r, "manifest call");
    t.schema("Manifest", r.sc);
    const langs = r.sc?.languages ?? [];
    t.ok(langs.length > 0, "manifest.languages must be non-empty");
    const listed = (await s.rpc("tools/list"))?.result?.tools?.map((x) => x.name) ?? [];
    for (const l of langs) {
      t.ok(listed.includes(l.loop.validate), `loop.validate '${l.loop.validate}' must exist in tools/list`);
      if (l.capabilities?.execute) t.ok(listed.includes(l.loop.execute), `loop.execute must exist in tools/list`);
      else t.ok(l.loop.execute === undefined, "loop.execute must be absent when execute is undeclared");
      if (l.capabilities?.trace_fetch) t.ok(listed.includes(l.loop.trace), `loop.trace must exist in tools/list`);
      else t.ok(l.loop.trace === undefined, "loop.trace must be absent when trace_fetch is undeclared");
      t.eq(l.guides, "pilotage_get_guide", "guides field");
      if (l.capabilities?.catalog) t.eq(l.catalog, "pilotage_catalog", "catalog field");
    }
    t.eq(await binding.hooks.observe(s), before, "no side effects from discovery");
  },

  async "PIL-DISCOVER-INITMETA-G"(t) {
    const s = await session();
    const decl = s.initMeta?.["io.github.jafarsa0/pilotage"];
    if (!decl) return { skip: "the initialize accelerator is absent (Part III 3.2 makes it a MAY)" };
    t.ok(
      decl.manifest !== undefined || typeof decl.manifest_uri === "string",
      "the _meta object holds manifest and/or manifest_uri",
    );
    if (decl.manifest) {
      t.schema("Manifest", decl.manifest, "inline manifest");
      const r = await s.call("pilotage_manifest", {});
      t.value(r, "manifest tool");
      t.eq(decl.manifest, r.sc, "inline manifest is consistent with pilotage_manifest (the tool is authoritative when they differ)");
    }
  },

  async "PIL-COLDSTART-SIGNPOSTS-G"(t) {
    // Wording is free (Part III 3.4 "content, not wording"); the harness
    // checks for the *communicated content* via generous keyword stems.
    const s = await session();
    const instr = s.instructions ?? "";
    t.ok(/pilotage/i.test(instr), "instructions name Pilotage");
    t.ok(instr.includes("pilotage_manifest"), "instructions direct the agent to pilotage_manifest");
    const tools = (await s.rpc("tools/list"))?.result?.tools ?? [];
    const desc = (name) => tools.find((x) => x.name === name)?.description ?? "";
    t.ok(
      /first|start|begin|entry/i.test(desc("pilotage_manifest")),
      "pilotage_manifest description identifies itself as the starting point",
    );
    t.ok(/guide|learn|doc/i.test(desc("pilotage_get_guide")), "guides tool description states its stage");
    if (TOOLS.catalog) t.ok(/catalog|vocabulary|names/i.test(desc(TOOLS.catalog)), "catalog tool description states its stage");
    const stageChecks = [
      [TOOLS.validate, /valid|check/i, "validate"],
      [TOOLS.execute, /run|execut/i, "execute"],
      [TOOLS.trace, /trace|past|record/i, "trace"],
    ];
    for (const [name, stageRe, stage] of stageChecks) {
      if (!name) continue;
      const d = `${name} ${desc(name)}`;
      t.ok(stageRe.test(d), `loop tool '${name}' states its stage (${stage})`);
      t.ok(desc(name).includes(binding.language), `loop tool '${name}' names its Language`);
    }
  },

  async "PIL-LEARN-INDEX-G"(t) {
    const s = await session();
    const r = await s.call(TOOLS.guides, { language: binding.language });
    t.value(r, "guide index");
    t.schema("GuideIndexResult", r.sc);
    const guides = r.sc?.guides ?? [];
    t.ok(guides.every((g) => g.body === undefined), "no guide in the index carries a body");
    t.ok(guides.some((g) => g.level === "core"), "at least one core guide");
    const closed = guides.filter((g) => (g.topics ?? []).includes("closed-sets"));
    t.eq(closed.length, 1, "exactly one closed-sets guide");
    t.eq(closed[0]?.level, "reference", "closed-sets guide level");
  },

  async "PIL-LEARN-FETCH-G"(t) {
    const s = await session();
    const idx = await s.call(TOOLS.guides, { language: binding.language });
    const id = idx.sc?.guides?.[0]?.id;
    t.ok(typeof id === "string", "index yields a guide id");
    const r = await s.call(TOOLS.guides, { language: binding.language, id });
    t.value(r, "guide fetch");
    t.schema("GuideFetchResult", r.sc);
    t.ok(typeof r.sc?.guide?.body === "string", "guide.body is a string");
  },

  async "PIL-LEARN-UNKNOWN-ID-B"(t) {
    const s = await session();
    const r = await s.call(TOOLS.guides, { language: binding.language, id: "no-such-guide" });
    t.requestError(r, "not_found", "unknown guide id");
  },

  async "PIL-LEARN-TOPIC-UNDECLARED-B"(t) {
    if (capDeclared("guides", "topic_fetch")) return { skip: "guides.topic_fetch is declared" };
    const s = await session();
    const idx = await s.call(TOOLS.guides, { language: binding.language });
    const id = idx.sc?.guides?.[0]?.id;
    const r = await s.call(TOOLS.guides, { language: binding.language, id, topic: "closed-sets" });
    t.requestError(r, "invalid_request", "undeclared topic fetch");
  },

  async "PIL-LOOKUP-LIST-G"(t) {
    const s = await session();
    const r = await s.call(TOOLS.catalog, { language: binding.language, verb: "list" });
    t.value(r, "catalog list");
    t.schema("CatalogListResult", r.sc);
    t.ok(typeof r.sc?.catalog_version === "string", "catalog_version present");
    for (const e of r.sc?.items ?? []) {
      t.ok(e.risk !== undefined, `entry ${e.id} carries risk`);
      t.ok(e.risk_hints !== undefined, `entry ${e.id} carries risk_hints`);
    }
  },

  async "PIL-LOOKUP-PAGINATION-G"(t) {
    const s = await session();
    const all = await s.call(TOOLS.catalog, { language: binding.language, verb: "list" });
    const allIds = (all.sc?.items ?? []).map((e) => e.id);
    const seen = [];
    let cursor;
    let pages = 0;
    for (;;) {
      const args = { language: binding.language, verb: "list", limit: 1 };
      if (cursor) args.cursor = cursor;
      const page = await s.call(TOOLS.catalog, args);
      t.value(page, `page ${pages}`);
      for (const e of page.sc?.items ?? []) seen.push(e.id);
      cursor = page.sc?.next_cursor;
      pages++;
      if (!cursor) break;
      t.ok(pages <= allIds.length + 2, "cursor chain terminates");
      if (pages > allIds.length + 2) break;
    }
    t.ok(pages > 1, "more than one page at limit 1");
    t.eq(new Set(seen).size, seen.length, "no entry appears twice across pages");
    t.eq([...seen].sort(), [...allIds].sort(), "the union of pages covers every visible entry");
  },

  async "PIL-LOOKUP-GET-UNKNOWN-B"(t) {
    const s = await session();
    const r = await s.call(TOOLS.catalog, { language: binding.language, verb: "get", id: "no-such-entry" });
    t.requestError(r, "not_found", "unknown entry");
    t.ok(typeof r.sc?.catalog_version === "string", "catalog_version sibling on the error");
  },

  async "PIL-LOOKUP-CHANGED-UNDECLARED-B"(t) {
    if (capDeclared("catalog", "changed_since")) return { skip: "catalog.changed_since is declared" };
    const s = await session();
    const r = await s.call(TOOLS.catalog, {
      language: binding.language, verb: "changed_since", catalog_version: "cv_x",
    });
    t.requestError(r, "invalid_request", "undeclared changed_since");
  },

  async "PIL-CATALOG-VERSION-STABLE-G"(t) {
    const s = await session();
    const a = await s.call(TOOLS.catalog, { language: binding.language, verb: "list" });
    const b = await s.call(TOOLS.catalog, { language: binding.language, verb: "list" });
    t.eq(a.sc?.catalog_version, b.sc?.catalog_version, "catalog_version stable with no changes");
  },

  async "PIL-CATALOG-VERSION-BUMPS-G"(t) {
    const s = await session();
    const a = await s.call(TOOLS.catalog, { language: binding.language, verb: "list" });
    await binding.hooks.bumpCatalog(s);
    const b = await s.call(TOOLS.catalog, { language: binding.language, verb: "list" });
    t.ok(a.sc?.catalog_version !== b.sc?.catalog_version, "catalog_version moves when the catalog changes");
  },

  async "PIL-VALIDATE-GOOD-G"(t) {
    const s = await session();
    const r = await s.call(TOOLS.validate, { [P]: binding.programs.valid });
    t.value(r, "validate good");
    t.schema("ValidateResponse", r.sc);
    t.eq(r.sc?.valid, true, "valid");
    t.ok(!(r.sc?.diagnostics ?? []).some((d) => d.severity === "error"), "no error-severity diagnostics");
    if (capDeclared("plan")) {
      t.ok(r.sc?.plan !== undefined, "plan present (declared)");
      t.schema("Plan", r.sc?.plan);
    }
    if (capDeclared("catalog")) t.ok(typeof r.sc?.catalog_version === "string", "catalog_version present (declared)");
  },

  async "PIL-VALIDATE-UNKNOWN-NAME-B"(t) {
    const s = await session();
    const r = await s.call(TOOLS.validate, { [P]: binding.programs.invalid });
    t.value(r, "validate unknown-name");
    t.schema("ValidateResponse", r.sc);
    t.eq(r.sc?.valid, false, "valid is false");
    const diags = r.sc?.diagnostics ?? [];
    t.ok(diags.length > 0, "diagnostics non-empty");
    // membership in the closed-sets enumeration, via the reference guide body
    const idx = await s.call(TOOLS.guides, { language: binding.language });
    const closedId = (idx.sc?.guides ?? []).find((g) => (g.topics ?? []).includes("closed-sets"))?.id;
    const guide = await s.call(TOOLS.guides, { language: binding.language, id: closedId });
    const body = guide.sc?.guide?.body ?? "";
    for (const d of diags) t.ok(body.includes(d.code), `code '${d.code}' is enumerated in the closed-sets guide`);
    if (lang.locator === "json-pointer") {
      for (const d of diags) t.ok(d.path === "" || d.path.startsWith("/"), `path '${d.path}' is a JSON Pointer`);
    }
  },

  async "PIL-VALIDATE-SIDE-EFFECT-FREE-G"(t) {
    const s = await session();
    const before = await binding.hooks.observe(s);
    for (let i = 0; i < 3; i++) await s.call(TOOLS.validate, { [P]: binding.programs.valid });
    t.eq(await binding.hooks.observe(s), before, "no externally observable state change");
  },

  async "PIL-VALIDATE-RESERVED-CHARS-B"(t) {
    const s = await session();
    const r = await s.call(TOOLS.validate, { [P]: binding.programs.reservedChar });
    t.value(r, "validate reserved-char");
    t.eq(r.sc?.valid, false, "valid is false");
    const diags = r.sc?.diagnostics ?? [];
    t.ok(
      diags.some((d) => `${d.code} ${d.message}`.includes("reserved") || `${d.message}`.includes("#")),
      "a diagnostic reports the reserved-character violation",
    );
  },

  async "PIL-VALIDATE-CONTEXT-UNDECLARED-B"(t) {
    if (lang.context_schema !== undefined) return { skip: "language declares a context_schema" };
    const s = await session();
    const r = await s.call(TOOLS.validate, { [P]: binding.programs.valid, context: { any: "value" } });
    t.value(r, "validate with undeclared context");
    t.eq(r.sc?.valid, false, "valid is false");
    t.ok((r.sc?.diagnostics ?? []).some((d) => d.code === "context_binding"), "reserved code context_binding");
  },

  async "PIL-EXECUTE-SUCCESS-G"(t) {
    const s = await session();
    const cv = (await s.call(TOOLS.catalog, { language: binding.language, verb: "list" })).sc?.catalog_version;
    const r = await s.call(TOOLS.execute, execArgs({
      [P]: binding.programs.valid, trace_level: "full", expected_catalog_version: cv,
    }));
    t.value(r, "execute success");
    t.schema("ExecuteResponse", r.sc);
    t.eq(r.sc?.outcome, { ok: true, status: "success", error: null }, "outcome");
    const trace = r.sc?.trace;
    const effective = lang.trace === "summary" ? "summary" : "full";
    t.eq(trace?.level, effective, "trace.level is the effective level");
    const ids = (trace?.steps ?? []).map((x) => x.id);
    t.eq(new Set(ids).size, ids.length, "every trace step appears exactly once");
    t.eq(ids, binding.programs.validTraceIds, "execution order");
    for (const stepId of binding.programs.validCallSteps) {
      const entry = (trace?.steps ?? []).find((x) => x.id === stepId);
      t.ok(typeof entry?.calls === "string", `invoking step '${stepId}' names its catalog entry in calls`);
    }
  },

  async "PIL-EXECUTE-GUARD-B"(t) {
    const s = await session();
    const before = await binding.hooks.observe(s);
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.invalid }));
    t.value(r, "guard refusal");
    t.eq(r.sc?.outcome?.status, "validation_error", "outcome status");
    t.ok((r.sc?.diagnostics ?? []).length > 0, "diagnostics present");
    t.ok(typeof r.sc?.run_id === "string", "refused Runs still mint a run_id");
    t.eq(await binding.hooks.observe(s), before, "no side effects");
  },

  async "PIL-EXECUTE-DRIFT-B"(t) {
    const s = await session();
    const stale = (await s.call(TOOLS.catalog, { language: binding.language, verb: "list" })).sc?.catalog_version;
    await binding.hooks.bumpCatalog(s);
    const before = await binding.hooks.observe(s);
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, expected_catalog_version: stale }));
    t.value(r, "drift refusal");
    t.eq(r.sc?.outcome?.status, "catalog_drift", "outcome status");
    t.eq(await binding.hooks.observe(s), before, "no side effects");
  },

  async "PIL-EXECUTE-DRIFT-BEFORE-VALIDATION-B"(t) {
    const s = await session();
    const stale = (await s.call(TOOLS.catalog, { language: binding.language, verb: "list" })).sc?.catalog_version;
    await binding.hooks.bumpCatalog(s);
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.invalid, expected_catalog_version: stale }));
    t.value(r, "drift-vs-validation ordering");
    t.eq(r.sc?.outcome?.status, "catalog_drift", "drift check precedes re-validation");
  },

  async "PIL-EXECUTE-PROMOTION-DRIFT-B"(t) {
    const s = await session();
    const { flow, referencedDevice } = binding.programs.promotable;
    const ref = await binding.hooks.promote(s, flow, flow.name);
    await binding.hooks.removeDevice(s, referencedDevice);
    const before = await binding.hooks.observe(s);
    const r = await s.call(TOOLS.execute, execArgs({ program_ref: ref }));
    t.value(r, "promotion drift");
    t.eq(r.sc?.outcome?.status, "promotion_drift", "outcome status");
    t.eq(await binding.hooks.observe(s), before, "no side effects");
  },

  async "PIL-EXECUTE-BOTH-RUNNABLES-B"(t) {
    const s = await session();
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, program_ref: "auto_x" }));
    t.requestError(r, "invalid_request", "both runnables");
  },

  async "PIL-EXECUTE-NO-RUNNABLE-B"(t) {
    const s = await session();
    const r = await s.call(TOOLS.execute, execArgs({ input: { x: 1 } }));
    t.requestError(r, "invalid_request", "no runnable");
  },

  async "PIL-EXECUTE-INPUT-BINDING-B"(t) {
    const s = await session();
    const { flow, badInput } = binding.programs.promotable;
    const ref = await binding.hooks.promote(s, flow, flow.name);
    const r = await s.call(TOOLS.execute, execArgs({ program_ref: ref, input: badInput }));
    t.value(r, "input binding");
    t.eq(r.sc?.outcome?.status, "validation_error", "outcome status");
    const diag = (r.sc?.diagnostics ?? []).find((d) => d.code === "input_binding");
    t.ok(diag, "reserved code input_binding");
    t.ok(diag && (diag.path === "" || diag.path.startsWith("/")), "path points into the input value");
  },

  async "PIL-EXECUTE-UNKNOWN-TRACE-LEVEL-B"(t) {
    const s = await session();
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, trace_level: "verbose" }));
    t.requestError(r, "invalid_request", "unknown trace_level");
  },

  async "PIL-EXECUTE-MODE-MISSING-B"(t) {
    if (lang.execution !== "both") return { skip: `execution is '${lang.execution}', not 'both'` };
    const s = await session();
    const args = { [P]: binding.programs.valid };
    const r = await s.call(TOOLS.execute, args);
    t.requestError(r, "invalid_request", "missing mode");
  },

  async "PIL-EXECUTE-IDEMPOTENT-REPLAY-G"(t) {
    if (!capDeclared("execute", "idempotency")) return { skip: "execute.idempotency undeclared" };
    const s = await session();
    const args = execArgs({ [P]: binding.programs.valid, idempotency_key: "key-1" });
    const a = await s.call(TOOLS.execute, args);
    const afterFirst = await binding.hooks.observe(s);
    const b = await s.call(TOOLS.execute, args);
    t.value(a, "first execute");
    t.value(b, "replay");
    t.eq(b.sc, a.sc, "replay is identical, including run_id");
    t.eq(await binding.hooks.observe(s), afterFirst, "exactly one execution occurred");
  },

  async "PIL-EXECUTE-IDEMPOTENT-CONFLICT-B"(t) {
    if (!capDeclared("execute", "idempotency")) return { skip: "execute.idempotency undeclared" };
    const s = await session();
    const args = execArgs({ [P]: binding.programs.valid, idempotency_key: "key-1" });
    await s.call(TOOLS.execute, args);
    const r = await s.call(TOOLS.execute, binding.hooks.idempotencyConflictArgs(args));
    t.requestError(r, "idempotency_conflict", "key reuse with different payload");
  },

  async "PIL-TRACE-BRANCH-DECISION-G"(t) {
    const s = await session();
    const v = await s.call(TOOLS.validate, { [P]: binding.programs.valid });
    const planSteps = v.sc?.plan?.steps ?? [];
    const { branchId, takenBase, untakenBase, expectedTook } = binding.programs.branching;
    const takenPlan = planSteps.find((x) => x.id === takenBase);
    t.eq(takenPlan?.arm?.label, expectedTook, "plan labels the taken arm");
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, trace_level: "full" }));
    const steps = r.sc?.trace?.steps ?? [];
    const branchEntry = steps.find((x) => x.id === branchId);
    t.ok(branchEntry, "the branch is its own trace entry");
    t.eq(branchEntry?.decisions?.[0]?.took, expectedTook, "decision.took equals the plan's arm label");
    const traceBases = steps.map((x) => baseId(x.id));
    t.ok(!traceBases.includes(untakenBase), "untaken-arm steps are absent from the trace");
    const expectedSet = planSteps
      .filter((x) => !(x.arm && x.arm.label !== expectedTook))
      .map((x) => x.id);
    for (const id of expectedSet) t.ok(traceBases.includes(id), `expected-set member '${id}' appears (base id)`);
  },

  async "PIL-TRACE-PARTIAL-B"(t) {
    const s = await session();
    const { flow, prefix } = binding.programs.midRunFailing;
    const v = await s.call(TOOLS.validate, { [P]: flow });
    const planIds = (v.sc?.plan?.steps ?? []).map((x) => x.id);
    const r = await s.call(TOOLS.execute, execArgs({ [P]: flow, trace_level: "full" }));
    t.value(r, "partial run");
    t.eq(r.sc?.outcome?.ok, false, "ok is false");
    t.eq(r.sc?.outcome?.status, "partial", "status is 'partial'");
    const ids = (r.sc?.trace?.steps ?? []).map((x) => x.id);
    t.eq(ids, prefix, "trace contains the executed prefix");
    for (const id of ids) {
      if (!id.includes("#") && !id.includes("/")) t.ok(planIds.includes(id), `unprefixed trace entry '${id}' maps to the expected set`);
    }
  },

  async "PIL-EXECUTE-TRACE-NONE-G"(t) {
    const s = await session();
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, trace_level: "none" }));
    t.value(r, "trace none");
    t.ok(typeof r.sc?.run_id === "string", "run_id returned");
    t.ok(r.sc?.outcome, "outcome returned");
    t.ok(r.sc?.trace === undefined, "no trace member");
  },

  async "PIL-EXECUTE-STORE-FALSE-G"(t) {
    if (!capDeclared("trace_fetch")) return { skip: "trace_fetch undeclared" };
    const s = await session();
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, store: false }));
    t.value(r, "execute with store false");
    t.ok(typeof r.sc?.run_id === "string", "run_id returned");
    const e = await s.call(TOOLS.trace, { run_id: r.sc?.run_id });
    t.requestError(e, "not_found", "trace fetch of an unstored run");
  },

  async "PIL-EXECUTE-STORE-RETAIN-G"(t) {
    if (!capDeclared("trace_fetch")) return { skip: "trace_fetch undeclared" };
    const s = await session();
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, store: true, trace_level: "none" }));
    t.value(r, "execute with store true at trace_level none");
    t.ok(typeof r.sc?.run_id === "string", "run_id returned");
    t.ok(r.sc?.outcome, "outcome returned");
    t.ok(r.sc?.trace === undefined, "no inline trace member");
    const e = await s.call(TOOLS.trace, { run_id: r.sc?.run_id });
    t.value(e, "trace fetch of the stored run");
    t.schema("TraceFetchResponse", e.sc);
    t.ok(e.sc?.trace !== undefined, "the stored envelope is returned");
  },

  async "PIL-EXECUTE-STORE-UNSUPPORTED-B"(t) {
    if (lang.retention !== "none") {
      return { skip: `declared retention is '${lang.retention}', not 'none': the unsupported rejection is unreachable` };
    }
    const s = await session();
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, store: true }));
    t.requestError(r, "unsupported", "store true under declared retention 'none'");
  },

  async "PIL-TRACE-FETCH-RETAINED-G"(t) {
    if (!capDeclared("trace_fetch")) return { skip: "trace_fetch undeclared" };
    const s = await session();
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, trace_level: "full" }));
    t.value(r, "execute");
    const e = await s.call(TOOLS.trace, { run_id: r.sc?.run_id });
    t.value(e, "trace fetch");
    t.schema("TraceFetchResponse", e.sc);
    t.eq(e.sc?.trace, r.sc?.trace, "the fetched envelope matches the trace that rode the execute response");
    t.eq(e.sc?.trace?.level, r.sc?.trace?.level, "trace.level equals the recorded level");
  },

  async "PIL-TRACE-FETCH-LEVEL-G"(t) {
    if (!capDeclared("trace_fetch")) return { skip: "trace_fetch undeclared" };
    if (lang.trace === "summary") return { skip: "declared trace level is 'summary': a Run recorded at 'full' is not constructible" };
    const s = await session();
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, trace_level: "full" }));
    t.eq(r.sc?.trace?.level, "full", "the Run is recorded at 'full'");
    const e = await s.call(TOOLS.trace, { run_id: r.sc?.run_id, trace_level: "summary" });
    t.value(e, "trace fetch at summary");
    t.schema("TraceFetchResponse", e.sc);
    t.eq(e.sc?.trace?.level, "summary", "returned level is the lower of requested and recorded");
  },

  async "PIL-TRACE-FETCH-LEVEL-B"(t) {
    if (!capDeclared("trace_fetch")) return { skip: "trace_fetch undeclared" };
    const s = await session();
    const r = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, trace_level: "full" }));
    const e = await s.call(TOOLS.trace, { run_id: r.sc?.run_id, trace_level: "none" });
    t.requestError(e, "invalid_request", "fetch with trace_level 'none'");
  },

  async "PIL-TRACE-FETCH-INDISTINGUISHABLE-B"(t) {
    if (!capDeclared("trace_fetch")) return { skip: "trace_fetch undeclared" };
    const other = await session();
    const foreign = await other.call(TOOLS.execute, execArgs({ [P]: binding.programs.valid, trace_level: "full" }));
    const s = await session();
    const refused = await s.call(TOOLS.execute, execArgs({ [P]: binding.programs.invalid }));
    const ids = ["run_9999", refused.sc?.run_id, foreign.sc?.run_id];
    const results = [];
    for (const run_id of ids) {
      const e = await s.call(TOOLS.trace, { run_id });
      t.requestError(e, "not_found", `trace fetch '${run_id}'`);
      results.push(e.sc);
    }
    t.eq(results[1], results[0], "refused-run result is indistinguishable from nonexistent");
    t.eq(results[2], results[0], "another caller's run is indistinguishable from nonexistent");
  },

  async "PIL-AUTHZ-INVISIBLE-ENTRY-B"(t) {
    const owner = await session();
    const { flow } = binding.programs.promotable;
    const ref = await binding.hooks.promote(owner, flow, flow.name);
    // From a different caller: `ref` exists server-side but is out of scope.
    const s = await session();
    const invisible = await s.call(TOOLS.catalog, { language: binding.language, verb: "get", id: ref });
    const unknown = await s.call(TOOLS.catalog, { language: binding.language, verb: "get", id: "auto_never_was" });
    t.requestError(invisible, "not_found", "invisible entry");
    t.requestError(unknown, "not_found", "nonexistent entry");
    // The requested id is caller-supplied data; the templates around it must
    // not distinguish exists-but-invisible from never-existed.
    const normalize = (sc, id) => JSON.parse(JSON.stringify(sc).replaceAll(id, "<id>"));
    t.eq(
      normalize(invisible.sc, ref),
      normalize(unknown.sc, "auto_never_was"),
      "indistinguishable from the nonexistent-entry result (requested id normalized)",
    );
  },

  async "PIL-VALIDATE-BOUNDS-B"(t) {
    const s = await session();
    const r = await s.call(TOOLS.validate, { [P]: binding.programs.oversized() });
    t.requestError(r, "bounds_exceeded", "resource bound");
  },

  async "PIL-VALIDATE-CONSTRAINT-FALLBACK-B"(t) {
    const s = await session();
    // native-tier assertion: 'constraint' is enumerated in the closed-sets guide
    const idx = await s.call(TOOLS.guides, { language: binding.language });
    const closedId = (idx.sc?.guides ?? []).find((g) => (g.topics ?? []).includes("closed-sets"))?.id;
    const guide = await s.call(TOOLS.guides, { language: binding.language, id: closedId });
    t.ok((guide.sc?.guide?.body ?? "").includes("constraint"), "'constraint' is enumerated in the closed-sets guide");
    if (binding.programs.constraint) {
      const r = await s.call(TOOLS.validate, { [P]: binding.programs.constraint });
      t.value(r, "constraint-producing program");
      t.eq(r.sc?.valid, false, "valid is false");
      t.ok((r.sc?.diagnostics ?? []).some((d) => d.code === "constraint"), "the diagnostic code is 'constraint'");
    }
  },

  async "PIL-CARRIER-UNKNOWN-TOOL-B"(t) {
    const s = await session();
    const body = await s.rpc("tools/call", { name: "no_such_tool", arguments: {} });
    t.eq(body?.error?.code, -32602, "unknown tool is a carrier -32602");
  },

  async "PIL-CARRIER-MALFORMED-B"(t) {
    const s = await session();
    const { body } = await s.raw("{ not json");
    t.eq(body?.error?.code, -32700, "malformed body is a carrier -32700");
  },
};

// ---------- main loop ----------
const results = [];
for (const vector of vectorsDoc.vectors) {
  const { id } = vector;
  if (only && id !== only) continue;

  const staticSkip = binding.skips?.[id];
  if (staticSkip) {
    results.push({ id, status: "SKIP", reason: staticSkip });
    continue;
  }
  const runner = RUNNERS[id];
  if (!runner) {
    results.push({ id, status: "SKIP", reason: "no runner bound for this vector" });
    continue;
  }
  const t = collector();
  try {
    const out = await runner(t);
    if (out?.skip) {
      results.push({ id, status: "SKIP", reason: out.skip });
    } else if (t.fails.length === 0) {
      results.push({ id, status: "PASS" });
    } else {
      results.push({ id, status: "FAIL", fails: t.fails });
    }
  } catch (e) {
    results.push({ id, status: "FAIL", fails: [`runner threw: ${e?.message ?? e}`] });
  }
}

// ---------- report ----------
let pass = 0, fail = 0, skip = 0;
for (const r of results) {
  if (r.status === "PASS") {
    pass++;
    console.log(`PASS  ${r.id}`);
  } else if (r.status === "SKIP") {
    skip++;
    console.log(`SKIP  ${r.id}  : ${r.reason}`);
  } else {
    fail++;
    console.log(`FAIL  ${r.id}`);
    for (const f of r.fails) console.log(`      · ${f}`);
  }
}
console.log(`\n${vectorsDoc.title}`);
console.log(`server: ${binding.name} @ ${endpoint}`);
console.log(`result: ${pass} passed, ${fail} failed, ${skip} skipped (documented), of ${results.length} vectors`);
process.exit(fail > 0 ? 1 : 0);
