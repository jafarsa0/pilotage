#!/usr/bin/env node
/**
 * The minimal agent. This file is the ENTIRE agent, published so anyone
 * can verify there is nothing else: no hidden prompt, no coaching, no
 * scaffolding. The model receives exactly three things:
 *
 *   1. a one-paragraph system prompt (SYSTEM below, printed verbatim into
 *      the transcript);
 *   2. the server's own self-description and tool list, fetched live over
 *      MCP (the same surfaces any MCP host shows any model);
 *   3. the work order (exam.md).
 *
 * Everything the model says, every tool call it makes, and every byte the
 * server returns is appended to a JSONL transcript, unedited.
 *
 * Usage:
 *   node runner.mjs --provider anthropic --model claude-sonnet-5
 *   node runner.mjs --provider openai    --model gpt-5.4-mini
 *   node runner.mjs --provider gemini    --model gemini-flash-latest
 *   [--endpoint URL] [--exam exam.md] [--out transcripts] [--max-calls 80]
 *
 * Keys come from ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY in
 * the environment, or from a --env-file (never logged, never recorded).
 */

import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";

// ---------- arguments & keys ----------
const argv = process.argv.slice(2);
function argOf(flag, dflt) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
}
const provider = argOf("--provider", null);
const model = argOf("--model", null);
const endpoint = argOf("--endpoint", "https://harborview.pilotagespec.org/mcp");
const examPath = argOf("--exam", new URL("./exam.md", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const outDir = argOf("--out", new URL("./transcripts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const maxCalls = Number(argOf("--max-calls", "80"));
if (!provider || !model) {
  console.error("usage: node runner.mjs --provider anthropic|openai|gemini --model <id>");
  process.exit(2);
}
const envFile = argOf("--env-file", null);
if (envFile) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.trim().match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const KEYS = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
};
if (!KEYS[provider]) {
  console.error(`missing API key for ${provider} (set the env var or pass --env-file)`);
  process.exit(2);
}

// ---------- transcript ----------
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(outDir, `${provider}-${model.replace(/[^a-zA-Z0-9.-]/g, "_")}-${stamp}.jsonl`);
let seq = 0;
function record(type, payload) {
  appendFileSync(outFile, JSON.stringify({ seq: ++seq, t: new Date().toISOString(), type, ...payload }) + "\n");
}

// ---------- MCP client ----------
let rpcId = 0;
let sessionId = null;
async function mcpRpc(method, params) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": `pilotage-proof-runner/1.0 (${provider})`,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, ...(params !== undefined ? { params } : {}) }),
  });
  sessionId = sessionId ?? res.headers.get("mcp-session-id");
  return res.json();
}
async function mcpToolCall(name, args) {
  const body = await mcpRpc("tools/call", { name, arguments: args ?? {} });
  if (body.error) return { carrier_error: body.error };
  const r = body.result ?? {};
  return {
    isError: r.isError === true,
    structuredContent: r.structuredContent,
    content: r.content,
  };
}

// ---------- connect and learn what any MCP host would show ----------
const exam = readFileSync(examPath, "utf8");
const init = await mcpRpc("initialize", {
  protocolVersion: "2025-11-25",
  capabilities: {},
  clientInfo: { name: "pilotage-proof-runner", version: "1.0" },
});
const serverInstructions = init?.result?.instructions ?? "";
const toolsList = (await mcpRpc("tools/list"))?.result?.tools ?? [];

const SYSTEM = [
  "You are an autonomous agent connected to an MCP server named 'harborview'.",
  "The server describes itself as follows:",
  "",
  serverInstructions,
  "",
  "Complete the user's work order using the server's tools. Work autonomously —",
  "do not ask the user questions. Your reply ends the job, so reply only when",
  "every item of the work order is done and verified.",
].join("\n");

record("run_meta", {
  provider, model, endpoint, session: sessionId,
  exam_file: path.basename(examPath),
  max_calls: maxCalls,
  note: "complete model input = SYSTEM + exam + tool list + tool results, all recorded in this file",
});
record("system_prompt", { text: SYSTEM });
record("exam", { text: exam });
record("server_instructions", { text: serverInstructions });
record("tools", { tools: toolsList });

// ---------- provider adapters (plain fetch, no SDKs) ----------
function sanitizeSchema(s) {
  // Gemini accepts an OpenAPI-style subset; make loose schemas explicit.
  if (s === null || typeof s !== "object" || Array.isArray(s)) return { type: "object" };
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "$schema" || k === "additionalProperties") continue;
    if (k === "properties") {
      out.properties = {};
      for (const [pk, pv] of Object.entries(v ?? {})) out.properties[pk] = sanitizeSchema(pv);
    } else if (k === "items") out.items = sanitizeSchema(v);
    else out[k] = v;
  }
  if (!out.type && !out.anyOf && !out.oneOf && !out.enum) out.type = "object";
  return out;
}

async function apiPost(url, headers, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      record("api_retry", { status: res.status, attempt });
      await new Promise((r) => setTimeout(r, attempt * 5000));
      continue;
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${provider} API ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
    return json;
  }
}

/**
 * Each adapter runs the standard tool loop and returns the final text.
 * executeTool(name, args) -> string (the tool result as the model sees it)
 */
async function executeTool(name, args) {
  const r = await mcpToolCall(name, args);
  record("tool_result", { tool: name, args, result: r });
  if (r.carrier_error) return JSON.stringify({ error: r.carrier_error });
  const sc = r.structuredContent;
  const text = sc !== undefined ? JSON.stringify(sc) : JSON.stringify(r.content ?? null);
  return r.isError ? JSON.stringify({ isError: true, result: sc ?? r.content }) : text;
}

let toolCalls = 0;
function budgetLeft() {
  return toolCalls < maxCalls;
}

async function runAnthropic() {
  const tools = toolsList.map((t) => ({
    name: t.name, description: t.description ?? "", input_schema: t.inputSchema ?? { type: "object" },
  }));
  const messages = [{ role: "user", content: exam }];
  for (;;) {
    const resp = await apiPost("https://api.anthropic.com/v1/messages",
      { "x-api-key": KEYS.anthropic, "anthropic-version": "2023-06-01" },
      { model, max_tokens: 8192, system: SYSTEM, messages, tools });
    record("model_response", { stop_reason: resp.stop_reason, usage: resp.usage, content: resp.content });
    messages.push({ role: "assistant", content: resp.content });
    const uses = (resp.content ?? []).filter((b) => b.type === "tool_use");
    if (uses.length === 0 || resp.stop_reason === "end_turn") {
      return (resp.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    }
    const results = [];
    for (const u of uses) {
      if (!budgetLeft()) return "[aborted: tool-call budget exhausted]";
      toolCalls++;
      results.push({ type: "tool_result", tool_use_id: u.id, content: await executeTool(u.name, u.input) });
    }
    messages.push({ role: "user", content: results });
  }
}

async function runOpenAI() {
  const tools = toolsList.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description ?? "", parameters: t.inputSchema ?? { type: "object" } },
  }));
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: exam },
  ];
  for (;;) {
    const resp = await apiPost("https://api.openai.com/v1/chat/completions",
      { authorization: `Bearer ${KEYS.openai}` },
      { model, messages, tools });
    const msg = resp.choices?.[0]?.message ?? {};
    record("model_response", { finish_reason: resp.choices?.[0]?.finish_reason, usage: resp.usage, message: msg });
    messages.push(msg);
    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) return msg.content ?? "";
    for (const c of calls) {
      if (!budgetLeft()) return "[aborted: tool-call budget exhausted]";
      toolCalls++;
      let args = {};
      try { args = JSON.parse(c.function.arguments || "{}"); } catch { /* leave {} */ }
      messages.push({ role: "tool", tool_call_id: c.id, content: await executeTool(c.function.name, args) });
    }
  }
}

async function runGemini() {
  const tools = [{
    functionDeclarations: toolsList.map((t) => ({
      name: t.name, description: t.description ?? "", parameters: sanitizeSchema(t.inputSchema),
    })),
  }];
  const contents = [{ role: "user", parts: [{ text: exam }] }];
  for (;;) {
    const resp = await apiPost(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { "x-goog-api-key": KEYS.gemini },
      { systemInstruction: { parts: [{ text: SYSTEM }] }, contents, tools });
    const cand = resp.candidates?.[0];
    const parts = cand?.content?.parts ?? [];
    record("model_response", { finish_reason: cand?.finishReason, usage: resp.usageMetadata, parts });
    contents.push({ role: "model", parts });
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length === 0) return parts.filter((p) => p.text).map((p) => p.text).join("\n");
    const respParts = [];
    for (const p of calls) {
      if (!budgetLeft()) return "[aborted: tool-call budget exhausted]";
      toolCalls++;
      const out = await executeTool(p.functionCall.name, p.functionCall.args ?? {});
      let parsed;
      try { parsed = JSON.parse(out); } catch { parsed = { text: out }; }
      respParts.push({ functionResponse: { name: p.functionCall.name, response: { result: parsed } } });
    }
    contents.push({ role: "user", parts: respParts });
  }
}

// ---------- run ----------
const started = Date.now();
try {
  const finalText = await ({ anthropic: runAnthropic, openai: runOpenAI, gemini: runGemini })[provider]();
  record("final_report", { text: finalText, tool_calls: toolCalls, seconds: Math.round((Date.now() - started) / 1000) });
  console.log(`\n=== final report (${provider}/${model}, ${toolCalls} tool calls) ===\n`);
  console.log(finalText);
  console.log(`\nsession: ${sessionId}`);
  console.log(`transcript: ${outFile}`);
} catch (e) {
  record("runner_error", { error: String(e?.message ?? e), tool_calls: toolCalls });
  console.error(`runner error after ${toolCalls} tool calls: ${e?.message ?? e}`);
  console.error(`session: ${sessionId}\ntranscript: ${outFile}`);
  process.exit(1);
}
