# Phase 3: Queue Start Guard & Tool Error Visibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-28
**Phase:** 03-queue-start-guard-tool-error-visibility
**Mode:** `--auto` — every area auto-selected; the recommended option was chosen for each question.
**Areas discussed:** Start guard placement, Ignored-start feedback, Start summary in confirmation, Start audit log, Message composition, Code name, Banner re-arm, Step card error, Skipped-after-failure run status, Todo folding

---

## Start guard placement

| Option | Description | Selected |
|--------|-------------|----------|
| Guard at top of `_start()` before any state change | One guard covers Run, restart and enqueue auto-start | ✓ |
| Guard in each caller (router, enqueueRun) | Several guards, easy to miss one | |
| `startNext` skips STARTED rows | Defence in depth; changes drain behaviour tests pin | |

[auto] Start guard — Q: "Where does the single-flight guard go?" → Selected: "Top of `_start()`" (recommended default)

## Ignored-start feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Warning log only, caller resolves normally | Queue is already running what was asked | ✓ |
| Error toast to the operator | Invites a second press | |

[auto] Ignored start — Q: "What does the operator see when a start is ignored?" → Selected: "Log only" (recommended default)

## Start summary in confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Counts (rows, FAILED retries, distinct runs) in existing modal, pure helper over polled `getAll` | Matches QUE-08 wording, no new query | ✓ |
| Full row list in the modal | Long for big queues | |
| New server query for the summary | Extra endpoint for data the client has | |

[auto] Confirmation — Q: "What does the Run confirmation show and from where?" → Selected: "Counts from polled getAll" (recommended default)

## Start audit log

| Option | Description | Selected |
|--------|-------------|----------|
| "Queue Started" details list queue_ids/run_ids, server-side | Authoritative, also covers enqueue auto-start | ✓ |
| Separate log entry per row | Noisier | |

[auto] Audit — Q: "How is what a Start ran recorded?" → Selected: "Detail line on Queue Started" (recommended default)

## Message composition

| Option | Description | Selected |
|--------|-------------|----------|
| Pure `describeToolReply`; generic sentence + " Tool said: <msg>"; ERROR_FROM_TOOL wording unchanged; `getError` stops overwriting | One composer, tool text never lost | ✓ |
| Show only tool text for every code | Loses the helpful generic guidance | |

[auto] Message — Q: "How is the operator text composed?" → Selected: "describeToolReply, getError passes through" (recommended default)

## Code name

| Option | Description | Selected |
|--------|-------------|----------|
| `codeString = String(code)` in the error class; SUCCESS+message thrown as ERROR_FROM_TOOL | Fixes every consumer at the source | ✓ |
| Patch only the banner | Logs and stored errors still say UNKNOWN | |

[auto] Code — Q: "Where is the UNKNOWN code fixed?" → Selected: "In ToolCommandExecutionError" (recommended default)

## Banner re-arm

| Option | Description | Selected |
|--------|-------------|----------|
| Server failure `seq` in `getError`, client `dismissedSeq`, pure `queueError.ts` | Matches ERR-04; research's accepted small server change | ✓ |
| Client-side compare of error message text | Same message twice would stay hidden | |

[auto] Banner — Q: "How does the banner reappear after dismiss?" → Selected: "Failure seq" (recommended default)

## Step card error

| Option | Description | Selected |
|--------|-------------|----------|
| Pure `stepErrorText`; clamped text on FAILED cards, "Skipped after failure:" on SKIPPED-with-error | Persisted, survives restart | ✓ |
| Tooltip only | Not visible at a glance | |

[auto] Step card — Q: "How is the stored error shown on the card?" → Selected: "Inline clamped text" (recommended default)

## Skipped-after-failure run status

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct non-success outcome when a SKIPPED step carries an error; plain skips unchanged | Satisfies ERR-05 without changing plain-skip runs | ✓ |
| Any SKIPPED step makes the run non-success | Over-broad | |

[auto] Run status — Q: "How is a run with a skipped failed step reported?" → Selected: "Distinct non-success outcome" (recommended default)

## Todo folding

| Option | Description | Selected |
|--------|-------------|----------|
| Fold both matched todos (auto rule: score ≥ 0.4) | Adds unrelated F.A.S.T. form work | |
| Do not fold; record as reviewed | Matches were keyword-only; folding would be scope creep | ✓ |

[auto] Todos — Deviation from the auto fold rule: both todos scored 0.9 on keywords only and are listed in REQUIREMENTS.md Future Requirements; the scope guardrail takes precedence.

## Claude's Discretion

- Copy of the confirmation summary and the "Tool said:" joiner
- Helper module names and grouping
- Plan split

## Deferred Ideas

- "Send to Tool" outcome toast, persistent tool-page error toast, Gantt FAILED styling (ACK-AND-F3 §4.4 items 5-7)
- `startNext` skipping STARTED rows (Future Requirements)
- `GlobalQueueStatusIndicator` detail off the run page
