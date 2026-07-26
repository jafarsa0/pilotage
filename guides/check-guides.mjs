#!/usr/bin/env node
/**
 * Docs that execute: the guide honesty check.
 *
 * Every guide in this directory shows real requests and real responses.
 * This script replays each guide's request blocks, in order, against the
 * live server and fails if any documented response no longer matches
 * reality. Run it in CI; a guide that drifts from the server is a build
 * failure, not a footnote.
 *
 * Conventions inside a guide:
 *   ```json request            a tools/call: {"tool": "...", "arguments": {...}}
 *   ```json response           the exact structuredContent that call returns
 *   ```json response subset    a curated excerpt; every shown member must match
 *   ```json initmeta           the session's initialize _meta Pilotage value
 *                              (the manifest welcome card); subset works too
 *   ```json / ```bash          illustrative only, not executed
 *
 * Each guide file runs in its own fresh MCP session, top to bottom.
 *
 * Usage:
 *   node check-guides.mjs                # verify all guides here
 *   node check-guides.mjs --update       # rewrite exact response blocks from live
 *   node check-guides.mjs --endpoint http://localhost:8787/mcp
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const UPDATE = argv.includes("--update");
function argOf(flag, dflt) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
}
const endpoint = argOf("--endpoint", "https://harborview.jafarsa0.workers.dev/mcp");
const files = argv.filter((a) => a.endsWith(".md"));

// ---------- transport ----------
let rpcId = 0;
class Session {
  constructor() {
    this.id = null;
  }
  async rpc(method, params) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "pilotage-guide-check/1.1",
        ...(this.id ? { "mcp-session-id": this.id } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, ...(params !== undefined ? { params } : {}) }),
    });
    const sid = res.headers.get("mcp-session-id");
    if (sid && !this.id) this.id = sid;
    return res.json();
  }
  async open() {
    const body = await this.rpc("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: { extensions: { "io.github.jafarsa0/pilotage": {} } },
      clientInfo: { name: "pilotage-guide-check", version: "1.1" },
    });
    this.initMeta = body.result?._meta?.["io.github.jafarsa0/pilotage"];
    if (!this.id) throw new Error("no mcp-session-id header from initialize");
    return this;
  }
  async call(tool, args) {
    const body = await this.rpc("tools/call", { name: tool, arguments: args ?? {} });
    if (body.error) throw new Error(`carrier error for ${tool}: ${JSON.stringify(body.error)}`);
    return body.result?.structuredContent;
  }
}

// ---------- matching ----------
function subsetMatch(expected, actual, at = "$") {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return [`${at}: expected an array`];
    if (expected.length > actual.length) return [`${at}: expected ≥${expected.length} items, got ${actual.length}`];
    return expected.flatMap((e, i) => subsetMatch(e, actual[i], `${at}[${i}]`));
  }
  if (expected !== null && typeof expected === "object") {
    if (actual === null || typeof actual !== "object" || Array.isArray(actual)) {
      return [`${at}: expected an object`];
    }
    return Object.entries(expected).flatMap(([k, v]) =>
      k in actual ? subsetMatch(v, actual[k], `${at}.${k}`) : [`${at}.${k}: missing`],
    );
  }
  return Object.is(expected, actual) || JSON.stringify(expected) === JSON.stringify(actual)
    ? []
    : [`${at}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`];
}

// ---------- guide parsing ----------
function parseBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^```json (request|response|initmeta)( subset)?\s*$/);
    if (!m) continue;
    const start = i + 1;
    let end = start;
    while (end < lines.length && !lines[end].startsWith("```")) end++;
    blocks.push({
      kind: m[1],
      subset: !!m[2],
      startLine: start,
      endLine: end, // exclusive: the ``` line
      body: lines.slice(start, end).join("\n"),
    });
    i = end;
  }
  return { lines, blocks };
}

// ---------- main ----------
const targets = files.length
  ? files
  : (await readdir(here)).filter((f) => f.endsWith(".md")).sort();

let anyFail = false;
for (const file of targets) {
  const full = path.join(here, file);
  const text = await readFile(full, "utf8");
  const { lines, blocks } = parseBlocks(text);
  if (!blocks.some((b) => b.kind === "request" || b.kind === "initmeta")) continue;

  const session = await new Session().open();
  const edits = [];
  let checked = 0;
  let failed = 0;
  console.log(`\n── ${file}`);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind === "initmeta") {
      checked++;
      const actual = session.initMeta;
      const label = `initialize _meta @ line ${b.startLine}`;
      if (actual === undefined) {
        console.log(`  FAIL ${label}: initialize carried no Pilotage _meta`);
        failed++;
        continue;
      }
      if (UPDATE && !b.subset) {
        edits.push({ block: b, text: JSON.stringify(actual, null, 2) });
        console.log(`  UPDATE ${label}`);
        continue;
      }
      let expected;
      try {
        expected = JSON.parse(b.body);
      } catch (e) {
        console.log(`  FAIL ${label}: block is not JSON (${e.message})`);
        failed++;
        continue;
      }
      const problems = b.subset
        ? subsetMatch(expected, actual)
        : JSON.stringify(expected) === JSON.stringify(actual)
          ? []
          : [`documented _meta differs from live initialize:\n    live: ${JSON.stringify(actual)}`];
      if (problems.length) {
        console.log(`  FAIL ${label}`);
        for (const p of problems) console.log(`    · ${p}`);
        failed++;
      } else {
        console.log(`  OK   ${label}`);
      }
      continue;
    }
    if (b.kind !== "request") continue;
    let req;
    try {
      req = JSON.parse(b.body);
    } catch (e) {
      console.log(`  FAIL line ${b.startLine}: request block is not JSON (${e.message})`);
      failed++;
      continue;
    }
    const actual = await session.call(req.tool, req.arguments);
    const resp = blocks[i + 1];
    if (!resp || resp.kind !== "response") {
      console.log(`  FAIL line ${b.startLine}: request has no following response block`);
      failed++;
      continue;
    }
    checked++;
    const label = `${req.tool} @ line ${b.startLine}`;
    if (UPDATE && !resp.subset) {
      edits.push({ block: resp, text: JSON.stringify(actual, null, 2) });
      console.log(`  UPDATE ${label}`);
      continue;
    }
    let expected;
    try {
      expected = JSON.parse(resp.body);
    } catch (e) {
      console.log(`  FAIL ${label}: response block is not JSON (${e.message})`);
      failed++;
      continue;
    }
    const problems = resp.subset
      ? subsetMatch(expected, actual)
      : JSON.stringify(expected) === JSON.stringify(actual)
        ? []
        : [`documented response differs from live response:\n    live: ${JSON.stringify(actual)}`];
    if (problems.length) {
      console.log(`  FAIL ${label}`);
      for (const p of problems) console.log(`    · ${p}`);
      failed++;
    } else {
      console.log(`  OK   ${label}`);
    }
  }

  if (UPDATE && edits.length) {
    // apply bottom-up so line numbers stay valid
    for (const { block, text: t } of edits.sort((a, b) => b.block.startLine - a.block.startLine)) {
      lines.splice(block.startLine, block.endLine - block.startLine, ...t.split("\n"));
    }
    await writeFile(full, lines.join("\n"), "utf8");
    console.log(`  wrote ${edits.length} response block(s)`);
  }
  console.log(`  ${checked} request(s) checked, ${failed} failed`);
  if (failed) anyFail = true;
}

process.exit(anyFail ? 1 : 0);
