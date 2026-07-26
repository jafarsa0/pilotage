# Results: second recording, 2026-07-26, against the v1.1 wire

Two days after the [original recording](RESULTS.md), the Harborview server
migrated to the Pilotage v1.1 surface: the old explain layer folded into the
trace fetch door (`explain_run` became `trace_run`, `loop.explain` became
`loop.trace`), and execute gained the `store` flag. The experiment was then
repeated, unchanged: the same three models, the same byte-identical
[work order](exam.md), the same published [runner](runner.mjs) with the same
system prompt, against the same deterministic building. The only kit change
was the one the rename forces: the [grader](grader.mjs) now fetches fired
runs through `trace_run`.

No model was told anything about v1.1. Whatever each agent knows about the
renamed surface, it learned from the manifest at the handshake.

| model | take | tool calls | time | grader verdict |
|---|---|---|---|---|
| `claude-sonnet-5` (Anthropic) | 1 | 22 | 142 s | **PASS**: 5/5, a perfect card with no skips |
| `gemini-flash-latest` (Google) | 1 | 21 | 74 s | **PASS**: 4/4 checkable, 1 skip¹ |
| `gpt-5.4-mini` (OpenAI) | 1 | 16 | 24 s | **FAIL**: see below |
| `gpt-5.4-mini` (OpenAI) | 2 | 18 | 20 s | **PASS**: 4/4 checkable, 1 skip¹ |

¹ The skip is self-inflicted and benign: the agent's own after-hours
demonstration left the session clock past 21:00, so the "silent before
21:00" check was no longer live-testable. `claude-sonnet-5` avoided it by
moving the clock back to 18:00 after its dry run, which is why its card has
no skip at all.

## The story repeated itself

The original recording's strongest result was a confident false completion
report, caught by a grader that reads the building instead of the agent.
The v1.1 recording reproduced that result with a fresh mistake.

On its first take, `gpt-5.4-mini` reported: "Installed tonight's alarm as a
flow that would notify facilities if the dock door is opened after 21:00."
The grader found `deployed: []`. This time the model did not promote the
program (the original failure); it authored the alarm logic and ran it once
in `immediate` mode, then described the result as an installation. A run is
not an installation, and no self-report can make it one.

Two facts make this failure more instructive than the first:

- The server was already hardened. The guide text and refusal hints that
  the original failure motivated were live and unchanged. The false report
  is agent behavior, not a gap in the server's teaching.
- The unchanged second take passed. Same server, same exam, same runner:
  the model deployed `auto_001`, advanced the clock, fired the event, and
  verified the notification through the fetched trace.

## The renamed layer, used cold

Both passing first takes used the v1.1 surface naturally. `claude-sonnet-5`
verified its opening flow "via the run's full trace", and
`gemini-flash-latest` cited `trace_run` by name in its verification notes
for three separate runs. Neither model had ever seen the name before the
handshake delivered it.

## Evidence

- Rendered transcripts: [claude-sonnet-5](rendered/v11-anthropic-claude-sonnet-5.md) ·
  [gemini-flash-latest](rendered/v11-gemini-flash-latest.md) ·
  [gpt-5.4-mini take 1, FAILED](rendered/v11-openai-gpt-5.4-mini-take1-FAILED.md) ·
  [gpt-5.4-mini take 2](rendered/v11-openai-gpt-5.4-mini-take2.md)
- Report cards: `report-v11-*.txt` in this directory
- Raw JSONL: `transcripts/*2026-07-26*.jsonl`

The original 2026-07-24 recording, made against the pre-1.1 wire, remains
frozen and unedited in [RESULTS.md](RESULTS.md), `rendered/`, and
`transcripts/`.
