#!/usr/bin/env node
/**
 * Render a raw run transcript (JSONL) into a readable markdown page.
 *
 * The rendering is mechanical: nothing is added, removed, or reworded —
 * the JSONL file remains the authority, and this script is published so
 * the mapping can be audited. Long tool results are truncated for
 * readability with an explicit marker showing how many characters the raw
 * record holds.
 *
 * Usage:
 *   node render-transcript.mjs transcripts/<run>.jsonl [report.txt] > rendered/<run>.md
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const [file, reportFile] = process.argv.slice(2);
if (!file) {
  console.error("usage: node render-transcript.mjs <transcript.jsonl> [report.txt]");
  process.exit(2);
}

const records = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const out = [];
const meta = records.find((r) => r.type === "run_meta") ?? {};
const final = records.find((r) => r.type === "final_report");

function fence(s, lang = "") {
  return "```" + lang + "\n" + String(s).replace(/```/g, "` ``") + "\n```";
}
function compact(v, limit = 900) {
  const s = typeof v === "string" ? v : JSON.stringify(v, null, 2);
  if (s.length <= limit) return s;
  return s.slice(0, limit) + `\n… [truncated for readability — ${s.length} chars in the raw record]`;
}

out.push(`# Run transcript — ${meta.provider}/${meta.model}`);
out.push("");
out.push(`| | |`);
out.push(`|---|---|`);
out.push(`| provider / model | \`${meta.provider}\` / \`${meta.model}\` |`);
out.push(`| server | \`${meta.endpoint}\` |`);
out.push(`| session | \`${meta.session}\` |`);
out.push(`| recorded | ${records[0]?.t ?? "?"} |`);
out.push(`| tool calls | ${final?.tool_calls ?? "?"} |`);
out.push(`| wall time | ${final?.seconds ?? "?"} s |`);
out.push(`| raw record | \`${path.basename(file)}\` (the authority — this page is a mechanical rendering) |`);
out.push("");

for (const r of records) {
  switch (r.type) {
    case "system_prompt":
      out.push(`## The complete system prompt`);
      out.push("");
      out.push(fence(r.text));
      out.push("");
      break;
    case "exam":
      out.push(`## The work order given to the model`);
      out.push("");
      out.push(fence(r.text, "markdown"));
      out.push("");
      out.push(`Beyond this and the tool list the server advertises, the model received nothing.`);
      out.push("");
      out.push(`## The run`);
      out.push("");
      break;
    case "model_response": {
      const texts = [];
      const calls = [];
      for (const b of r.content ?? []) {
        if (b.type === "text" && b.text?.trim()) texts.push(b.text);
        if (b.type === "tool_use") calls.push({ name: b.name, args: b.input });
      }
      const m = r.message ?? {};
      if (typeof m.content === "string" && m.content.trim()) texts.push(m.content);
      for (const c of m.tool_calls ?? []) {
        let args = c.function?.arguments;
        try { args = JSON.parse(args); } catch { /* keep raw */ }
        calls.push({ name: c.function?.name, args });
      }
      for (const p of r.parts ?? []) {
        if (p.text?.trim()) texts.push(p.text);
        if (p.functionCall) calls.push({ name: p.functionCall.name, args: p.functionCall.args });
      }
      for (const t of texts) {
        out.push(`**model:**`);
        out.push("");
        out.push(t.trim());
        out.push("");
      }
      for (const c of calls) {
        out.push(`→ **calls \`${c.name}\`**`);
        out.push("");
        out.push(fence(compact(c.args ?? {}), "json"));
        out.push("");
      }
      break;
    }
    case "tool_result": {
      const body = r.result?.carrier_error ?? r.result?.structuredContent ?? r.result?.content ?? null;
      const flag = r.result?.isError ? " *(request error — returned to the model as a value)*" : "";
      out.push(`← **\`${r.tool}\` returns**${flag}`);
      out.push("");
      out.push(fence(compact(body), "json"));
      out.push("");
      break;
    }
    case "final_report":
      out.push(`## The model's final report`);
      out.push("");
      out.push(String(r.text).trim());
      out.push("");
      break;
    case "runner_error":
      out.push(`## Runner error`);
      out.push("");
      out.push(fence(r.error));
      out.push("");
      break;
    default:
      break;
  }
}

if (reportFile) {
  out.push(`## The report card (grader output)`);
  out.push("");
  out.push(fence(readFileSync(reportFile, "utf8").trim()));
  out.push("");
}

out.push(`---`);
out.push("");
out.push(`Rendered mechanically by \`render-transcript.mjs\`; the raw JSONL is the authoritative record.`);
process.stdout.write(out.join("\n") + "\n");
