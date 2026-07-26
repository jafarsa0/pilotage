# The proof: an agent in a language that exists nowhere

This directory is the evidence and the kit for one claim:

> **An agent that has never seen this system can complete real work in it,
> using only what the server itself provides, and anyone can reproduce
> the result with their own agent.**

Harborview speaks `buildingflow/1`, a program language invented for it. It
is not on the internet and not in any model's training data. Whatever an
agent achieves here, it learned live, through the
[Pilotage](https://github.com/jafarsa0/pilotage) loop.

**Two recordings, one kit.** This directory holds two dated recordings. The
2026-07-24 originals were made against the pre-1.1 wire and are kept
byte-for-byte as recorded (the exact kit files that produced them are
preserved in `source-snapshot/proof/` of the documentation package). On
2026-07-26 the same experiment was repeated, unchanged, against the migrated
v1.1 server: see [`RESULTS-v11.md`](RESULTS-v11.md). The kit here tracks the
current server: the grader fetches fired runs through `trace_run`.

## What's in the kit

| file | role |
|---|---|
| `exam.md` | the work order: it describes the *job*, never the method. No tool names, no language teaching, no hints. |
| `runner.mjs` | the **entire** agent (~250 lines, no SDKs). The model receives the one-paragraph system prompt printed in the transcript, the server's own self-description, the tool list, and the exam. Nothing else. |
| `grader.mjs` | the answer key. No AI inside, just a fact-checker that reads the building's end state, fires the dock-door event, and prints a PASS/FAIL report card. |
| `transcripts/` | raw, unedited JSONL recordings of the published runs: every model turn, every tool call, every server response. |
| `RESULTS.md` | the 2026-07-24 recording: which models ran, how many tool calls, and their report cards. |
| `RESULTS-v11.md` | the 2026-07-26 recording against the v1.1 wire: same exam, same runner, fresh takes. |

## Reproduce it yourself

With any of the three providers (a normal-tier model is enough):

```bash
export ANTHROPIC_API_KEY=...   # or OPENAI_API_KEY / GEMINI_API_KEY
node runner.mjs --provider anthropic --model claude-sonnet-5
# the runner prints the agent's final report, the session id, and the transcript path

node grader.mjs --session sess_xxxxxxxx
# the report card: five checked facts, PASS or FAIL each
```

Every session gets a fresh, identical, isolated copy of the building, so
your run and ours start from the same world. Or skip the API entirely and
point your own agent at the live server:

```bash
claude mcp add --transport http harborview https://harborview.jafarsa0.workers.dev/mcp
```

…then paste `exam.md` as your prompt, and grade the session when it's done.

## Why this is a fair exam

- **The exam is neutral.** It states the outcome wanted ("every light on,
  dock unlocked, after-hours alarm installed and demonstrated safely") and
  nothing about how. The agent must discover the loop through the server's
  cold-start signposts (Part III §3.4).
- **The agent is transparent.** `runner.mjs` is the whole agent; the system
  prompt is recorded verbatim in every transcript. There is nowhere for
  coaching to hide.
- **The judge is dumb.** The grader checks facts: device states, deployed
  automations, and whether firing the dock-door event actually notifies
  facilities. It cannot be charmed.
- **Different paths, same destination.** Models differ in how they get
  there: different call counts, different mistakes, different repairs.
  That is the point: Pilotage does not make agents identical, it makes
  their *outcomes* converge and their paths checkable.

## Honesty rules

Transcripts are never edited. If a run fails the grader, we do not touch
the recording; we fix whatever was unclear on *our* side (a guide, the
exam wording) and record a fresh take; `RESULTS.md` states which take each
published run is and why any earlier take was discarded.
