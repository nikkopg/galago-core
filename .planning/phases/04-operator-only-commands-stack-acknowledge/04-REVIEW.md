---
phase: 04-operator-only-commands-stack-acknowledge
reviewed: 2026-10-29T12:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - controller/components/runs/controlDecision.ts
  - controller/components/runs/RunControlConfirmModal.tsx
  - controller/components/tools/RunRecoverySection.tsx
  - controller/hooks/useRunControl.ts
  - controller/pages/api/runs/index.ts
  - controller/server/operatorOnlyCommands.ts
  - controller/server/recoveryActions.ts
  - controller/server/recoveryControl.ts
  - controller/server/routers/run.ts
  - controller/server/routers/tool.ts
  - controller/server/runs.ts
  - controller/server/tools.ts
  - controller/test/controlDecision.test.ts
  - controller/test/latchStatus.test.ts
  - controller/test/operatorOnly.test.ts
  - controller/test/recoveryActions.test.ts
  - controller/test/recoveryControl.test.ts
  - controller/test/staticScan.test.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-10-29T12:00:00Z
**Depth:** standard (with cross-file call-chain tracing)
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed the operator-only command guard (enqueue + execute enforcement), the STACK acknowledge surface, the recovery card/keepsake flow, the latch read, and their tests at adversarial depth. The locked design decisions were honored where claimed: fast `pause/resume/abort` are in the refuse table by design (D-01); the card is not greyed during a running STACK step and the ack button stays enabled while a step is tracked (server refuses, D-09); `recoveryControl` sends with no deadline and never retries (D-23); the latch read is display-only and the ack gate adds no latch-derived term (D-12); the guid regex is permissive and never trims (D-08); SUCCESS-with-message is a refusal only on the ack path via `RECOVERY_STRICT_SUCCESS` (D-10). Cross-checked `normalizeToolKey`, `runControl`, `runState`, `command_queue.toolControl`, and `describeToolReply` call chains; the static-scan pins (`single confirmed send path`, `no instrument-state check before sending`, `.controlCommand(` callers) hold against the actual sources.

No Critical/blocker findings. Five Warnings found, the most important being a UI/display contract gap: the `unknown` flag produced by `extractLatch` (D-13) is dead in the recovery card, so an uninterpretable or missing latch reply is presented to the operator as a confident "No failure latched" — the opposite of the "flagged unknown so the card shows the full raw object instead of pretending to know" intent in the same module. Remaining warnings: a semantically dead first check in `validateRecoveryRequest`, unsanitized client-supplied text interpolated into audit-log details (log forging), and unbounded/unvalidated `numberOfRuns` in `run.create`.

## Warnings

### WR-01: `extractLatch`'s `unknown` state is never rendered — uninterpretable latch replies display as "No failure latched"

**File:** `controller/components/tools/RunRecoverySection.tsx:183-226`
**Issue:** `extractLatch` (server/recoveryActions.ts:233-262) produces `{ latched: false, unknown: true, raw }` for any non-empty reply object the shape-tolerant interpreter cannot read — including a reply carrying `guid: ""` or a non-string guid. The card, however, branches only on `!latchResult.latched` (line 185) and renders the "No failure latched" empty state with its confident copy: "This tool has no failure latched. An acknowledge is not possible until a STACK step fails and ends." The `unknown` field defined by the module (and asserted by `latchStatus.test.ts:104-112`) is never consumed anywhere in the card — `formatLatchRaw(latchResult.raw)` (line 211) is reachable only inside the `latched` branch. The operator is told a failure is NOT latched when the truthful answer is "the reply could not be interpreted," contradicting D-13's own stated display contract. An operator could walk away from a STACK tool whose failure latch state is genuinely unresolved.
**Fix:** Add an `unknown` branch before the not-latched branch, e.g.

```tsx
{!readPending && latchResult && (
  <VStack align="stretch" spacing={2}>
    {latchResult.unknown ? (
      <>
        <Heading size="sm" fontWeight={700}>Unrecognized latch reply</Heading>
        <Text fontSize="sm">The tool replied, but the latch state could not be interpreted. Inspect the raw reply below; do not assume no failure is latched.</Text>
        <Text fontFamily="mono" wordBreak="break-all" fontSize="xs">{formatLatchRaw(latchResult.raw)}</Text>
      </>
    ) : !latchResult.latched ? (
      /* existing "No failure latched" block */
```

and pin it with a card source invariant like the existing copy pins.

### WR-02: `tool.latchStatus` maps a reply without `meta_data` to a confident NOT-latched result

**File:** `controller/server/routers/tool.ts:557-568`
**Issue:** The query sets `return_reply: true` on the command info, but the gRPC reply's own `return_reply` field is what `Tool.executeCommand` (server/tools.ts:627, `reply.return_reply ? reply : undefined`) keys on. If the tool echoes `return_reply` falsy (or omits meta_data on success), the router falls into `if (!reply) return extractLatch(undefined)` which returns `{ latched: false, unknown: false, raw: {} }` — a positive "no failure latched" verdict for a reply the controller could not read. Combined with WR-01 the operator sees "This tool has no failure latched." `unknown: true` exists precisely for this case (D-13: "flagged unknown … instead of pretending to know"), and the comment on lines 554-556 even anticipates the undefined case — but maps it the wrong way.
**Fix:** Treat a missing/unreadable reply as unknown rather than not-latched:

```ts
if (!reply || reply.meta_data === undefined || reply.meta_data === null) {
  return { latched: false, unknown: true, raw: {} };
}
return extractLatch(reply.meta_data as Record<string, unknown>);
```

(success/FAILURE replies above this line are unaffected — FAILURE already throws via `describeToolReply`.) Update `latchStatus.test.ts`'s "not-latched result when the reply carries no meta_data" expectation accordingly.

### WR-03: `validateRecoveryRequest`'s first check is dead in production and semantically inverted — a blank tool type reports "No step is currently running."

**File:** `controller/server/recoveryActions.ts:115-126` (call site `controller/server/recoveryControl.ts:74`)
**Issue:** The parameter is named and documented `runningToolType: string | undefined` ("(a) no running step (blank runningToolType)"), mirroring `runControl.validateControlRequest`, which is genuinely fed the queue's running step type (command_queue.ts:531). But the ONLY production caller — `recoveryControl` — passes the TARGET tool's type from the DB row (`validateRecoveryRequest(toolType, action, params)`), which is always a non-empty string for an existing tool row. Check (a) therefore never runs server-side, and its message is wrong for a recovery target: if `record.type` were somehow blank, the operator would be refused with "No step is currently running." — a misdiagnosis of the actual problem ("this tool type is unknown/blank"). The dead branch is exercised only by unit tests, giving false confidence that a live path guards on the running step.
**Fix:** Either (a) rename the parameter to `toolType`, align the refusal message with reality (e.g. `Tool type "${toolType}" does not support recovery actions.` for the blank case), and delete or re-document the (a) branch as unit-level only; or (b) if the "no running step" precondition is genuinely intended for the recovery path, pass the real `runningStep?.toolType` from `recoveryControl` — but note that would break the locked "allows recovery while a different tool runs" behavior for recovery-target validation, so (a) is the correct reading. Keep the fixed first-failing refusal order intact for the remaining checks.

### WR-04: Client-controlled `action` is interpolated unsanitized into audit-log details (log forging)

**File:** `controller/server/recoveryControl.ts:40, 49-51, 63-68, 77-82, 113`
**Issue:** `action` arrives from the tRPC client as a bare `z.string()` (routers/tool.ts:521) and is embedded verbatim into `baseDetails = \`action=${action} ...\`` and into refusal messages (`Action "${action}" is not available...`), which are then written via `logAction`. A client sending `action: "x\nlevel=info action=Queue Resumed details=..."` can forge audit-log lines inside the `details` field. The same holds for `toolName` (lower risk — from the DB) and for the same interpolation pattern in `command_queue.toolControl`'s refusals. No command execution or DB injection follows (the action must pass `isRecoveryAction` before anything is sent), so this is log-integrity, not exploit-into-control.
**Fix:** Strip control characters/newlines from client-supplied interpolation before composing `details`/messages, e.g.

```ts
const safe = (s: string) => String(s).replace(/[\r\n\u0000-\u001f]/g, "?");
const baseDetails = `action=${safe(action)} toolId=${safe(toolName)} ...`;
```

or log the raw values through `JSON.stringify`. Apply the same helper where `command_queue.toolControl` composes its refusal details.

### WR-05: `run.create` leaves `numberOfRuns` unvalidated — negative/zero silently no-op, large values enqueue unbounded instrument runs

**File:** `controller/server/routers/run.ts:76-81`
**Issue:** `numberOfRuns: z.number().optional()` accepts any finite number. `const numRuns = input.numberOfRuns ?? 1;` then `for (let i = 0; i < numRuns; i++)`: `numberOfRuns: 0` or a negative number creates zero runs and returns `[]` with HTTP/tRPC success (the caller cannot distinguish "0 runs started" from success-with-runs), while `numberOfRuns: 10000` creates and enqueues ten thousand runs in a loop — each `createFromProtocol` call performs DB loads AND `CommandQueue.global.enqueueRun`, flooding the physical instrument's queue from one request. On an instrument controller this is an accidental-flood hazard, not just style.
**Fix:**

```ts
numberOfRuns: z.number().int().min(1).max(100).optional(),
```

and/or clamp server-side (`const numRuns = Math.min(Math.max(1, input.numberOfRuns ?? 1), 100);`) so zero/negative values are rejected instead of silently no-oping.

## Info

### IN-01: `RECOVERY_STRICT_SUCCESS[String(toolType)]` uses a prototype-exposed lookup, violating the module family's own D-04 discipline

**File:** `controller/server/recoveryControl.ts:109`
**Issue:** Every sibling lookup in this phase (`recoverToolSpec`, `getRunControl`, `getRecoverySpec`, modal `getActionSpec`, `completeRecoveryEntries`) is guarded by `Object.prototype.hasOwnProperty.call` with an explicit comment about inherited keys. This one lookup chains `String(toolType)?.includes(action)` off a plain object: for `toolType` of `"toString"`, `"constructor"`, `"hasOwnProperty"`, etc. the subexpression resolves to an inherited `Function` and the trailing `?.includes` would throw a TypeError (500) instead of rendering a graceful refusal. Unreachable today because `record.type` is a ToolType enum whose values are auto-generated tool names, but it is the one place where the pattern's own stated invariant (D-04) is not applied.
**Fix:** Index through an own-property check (e.g. reuse a small frozen-lookup helper or `Object.prototype.hasOwnProperty.call(RECOVERY_STRICT_SUCCESS, String(toolType))` before indexing).

### IN-02: Dead field — `RunStore.nextRunId` is never used

**File:** `controller/server/runs.ts:160`
**Issue:** Run ids come from `snowflakeIdGenerator.nextId()` (line 239); the class field `nextRunId = 1` has no references anywhere in `controller/` (verified by grep). Dead code that invites a future reader into the wrong id source.
**Fix:** Delete the field.

### IN-03: `readClick` awaits `latchQuery.refetch()` without a catch — a rejecting refetch escapes as an unhandled rejection

**File:** `controller/components/tools/RunRecoverySection.tsx:96-110`
**Issue:** `try { const refetched = await latchQuery.refetch(); ... } finally { setReadPending(false); }` — the common case (query error state) resolves and is handled via `refetched.error`, but if `refetch()` itself rejects (e.g. network flush/cancellation races in React Query), the finally resets the spinner yet the rejection propagates unobserved into the async click handler, and `latchResult` is left stale/untouched with no toast.
**Fix:** Wrap with a catch that reports through `persistentErrorToast("Latch read failed", e.message)` and sets `setLatchResult(null)` to match the error path's behavior.

### IN-04: `/api/runs` POST default branch leaks raw internal error text to clients with status 500

**File:** `controller/pages/api/runs/index.ts:14-27`
**Issue:** `catch (e: any) { ... default: res.status(500).end(e.message); }` sends the raw internal error message (DB/DRZ/gRPC internals included) to the client. The phase added the `OperatorOnlyCommandError` branch correctly (verified: the REST test asserts 400 + the operator-facing message); this default branch predates the change but sits in the same handler.
**Fix:** For unnamed/internal errors, respond with a generic message (`res.status(500).end("Failed to create run")`) and keep the operator-facing text for the classified error names; log the raw error server-side.

### IN-05: Confirm modal resolves the action spec from `runControl` regardless of `target.kind` — latent silent-refusal trap if the two families ever diverge

**File:** `controller/components/runs/RunControlConfirmModal.tsx:163-198`
**Issue:** The body computes `spec = getActionSpec(request.toolType, request.action)` first and only falls back to `getRecoverySpec` when the runControl spec is undefined. For a recovery-target request (today: `fast` resume/abort), the modal therefore renders the runControl shape even though the send goes through the recovery gate, which validates against the recovery shape. The two families are pinned byte-identical today (`test/recoveryActions.test.ts` "pins the fast entries as exact value copies of runControl"), so behavior is currently correct — but if a later change adds e.g. a `guid` kind to a fast recovery action, the modal would still render the old runControl shape and `completeRecoveryEntries` inside the send gate would return `null` → `{ status: "ignored" }` with no notification. `self.request.target.kind` is already available and could select the spec family explicitly.
**Fix:** Branch on `request.target.kind === "recovery" ? getRecoverySpec(...) : getActionSpec(...)` so the displayed decision surface is, by construction, the shape the send gate validates.

---

Verified-clean highlights (no finding): operator-only refusal is first statement in `Tool.executeCommand` (tools.ts:416-425) and precedes variable substitution; `controlCommand` remains deliberately unguarded; `createFromProtocol`'s enqueue scan refuses before storing/enqueueing and both HTTP (400 via `OperatorOnlyCommandError` case) and tRPC (BAD_REQUEST with the refusal's own message) paths surface the operator-facing text; the guid travels as data end-to-end and is restated verbatim in the modal without any input surface; the `.latch/i` scan holds for all four send-path files; single-flight `inFlight` guard plus per-confirm-modal remount key hold; test suites assert refusal ordering, guid boundaries (0/256/257), D-10 strict-success mapping, and the no-deadline/no-retry send semantics.

## AI Review Notes

- Review performed at standard depth per config; `files` from the config block were used directly. No `<structural_findings>` and no `<external_reviewer_evidence>` blocks were present.
- AGENTS.md and `.claude/skills/` were not found, so no additional project rules applied beyond the locked design decisions listed in the prompt (all four cross-checked against source; none flagged as defects).
- No source files were modified.

---

_Reviewed: 2026-10-29T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
