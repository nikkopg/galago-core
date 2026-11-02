# Phase 4: Operator-only Commands & STACK Acknowledge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-29
**Phase:** 4-operator-only-commands-stack-acknowledge
**Mode:** `--auto` (all areas auto-selected; each answer is the recommended option from
`.planning/research/ACK-AND-F3.md` and the ROADMAP Phase 4 notes)
**Areas discussed:** Operator-only table scope · Ack while a STACK step is running · SUCCESS-with-message
on the ack path · Guid validation strictness · Latch read mechanics

---

## Operator-only table scope

| Option | Description | Selected |
|--------|-------------|----------|
| Include fast now | `fast: ["pause","resume","abort"]` in the same refuse table — turns the legacy-step limitation into an explicit audited refusal (§2.4 recommended) | ✓ |
| STACK-only table | Ship `{ stack: ["acknowledge_failure"] }` only; add fast entries later | |

**User's choice:** [auto] Include fast now (recommended default)
**Notes:** Core Value says the web app never pauses/resumes/aborts an instrument on its own. No saved
protocols exist in this repo; the live DB is the only caveat. Behaviour change: such a step is refused
at run creation instead of executed.

---

## Ack while a STACK step is running

| Option | Description | Selected |
|--------|-------------|----------|
| Server refusal only | Card stays enabled (no `runState` reader without `runControl`); `recoveryControl` refuses with a STACK-specific message, audited (§1.4.1) | ✓ |
| `commandQueue.runningStep` query now | Add a small query so the card can grey actions during a STEP | |

**User's choice:** [auto] Server refusal only (recommended default)
**Notes:** A latch only exists after the step ends. The optional `runningStep` card query is deferred.

---

## SUCCESS-with-message on the ack path

| Option | Description | Selected |
|--------|-------------|----------|
| Strict for the ack only | SUCCESS reply with a non-empty `error_message` is a refusal via `RECOVERY_STRICT_SUCCESS` (§1.5); `Tool.controlCommand` unchanged | ✓ |
| Report as accepted | Keep `controlCommand`'s code-only `ok` verdict for the ack too | |

**User's choice:** [auto] Strict for the ack only (recommended default)
**Notes:** F.A.S.T. callers and tests stay untouched.

---

## Guid validation strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Permissive charset | `^[^\s\u0000-\u001f\u007f]{1,256}$`, never trimmed or coerced; exact guid check is the tool core's gate (§1.3) | ✓ |
| Strict guid format | Tighter pattern (e.g. hex-only); risks blocking a legitimate `submit-<hex>`/task guid | |

**User's choice:** [auto] Permissive charset (recommended default)

---

## Latch read mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Display only, never gates | "Read latch" button (no polling) → `tool.latchStatus` (toolId-only) → read-only result; "Use this guid" fills the input only; ack never gated on latch/instrument state (§3.3) | ✓ |
| Gate the ack on latch status | Enable "Acknowledge failure…" only after a successful latch read | |

**User's choice:** [auto] Display only, never gates (recommended default)
**Notes:** Gating the send on a latch read would add an instrument-state check (UI-08 violation).
`LATCH_READ_COMMAND` stays a single constant named at galago-tools Phase 4.

---

## the agent's Discretion

- Exact card/modal/toast copy (no default, no timer, no head-moves note, guid restated verbatim).
- Placement of pure helpers (`extractLatch`, client guid check sharing the server validator).
- Plan split across the three requirement groups (ack path / refuse table / latch + scans).
- Whether `protocol.preview` surfaces the refusal early (research §2.2 optional; deferred to planner).

## Deferred Ideas

- `commandQueue.runningStep` query to grey the recovery card during a STEP (optional later polish).
- Banner link to `/tools/<toolId>` when the failing tool is a STACK.
- `protocol.preview` early refusal feedback (authoring convenience).
- Generic tool-page command-panel reply display — owned by Phase 5 (GEN-03).
- Persistent error toast for `tool.runCommand` errors on the tool page — Phase 5 / quick task candidate.

### Reviewed Todos (not folded)

- "Evaluate whether expected_tray_id is still needed" — keyword-only match (same as the Phase 3 review);
  stays in Future Requirements.
- "Fetch F.A.S.T. plate list for source/dest plate dropdowns" — keyword-only match; stays in Future
  Requirements.
