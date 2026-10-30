---
phase: 04-operator-only-commands-stack-acknowledge
reviewed: 2026-10-30T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - controller/components/runs/RunControlConfirmModal.tsx
  - controller/components/runs/list/SwimLaneCommandComponent.tsx
  - controller/components/tools/RunRecoverySection.tsx
  - controller/pages/api/runs/index.ts
  - controller/server/command_queue.ts
  - controller/server/logger.ts
  - controller/server/operatorOnlyCommands.ts
  - controller/server/recoveryActions.ts
  - controller/server/recoveryControl.ts
  - controller/server/routers/run.ts
  - controller/server/routers/tool.ts
  - controller/server/runs.ts
  - controller/test/latchStatus.test.ts
  - controller/test/recoveryActions.test.ts
  - controller/test/runCreateReload.test.ts
  - controller/test/setup.ts
  - controller/test/staticScan.test.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-30
**Depth:** standard (incremental re-review of everything changed since e062871)
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This is an incremental re-review covering the prior-review fixes (WR-01..05, IN-01..05) and the gap-closure plans 04-06 (RunRecoverySection declared-action buttons, bounded raw latch collapsible, guid hint constant) and 04-07 (run.create classification by error name across a dev recompile).

The six touched test files pass under vitest (158 tests). Nothing was run against hardware.

**Prior fixes verified as correct, no regressions found:**
- WR-03 (validateRecoveryRequest first check): the dead "No step is currently running." branch is gone. `recoveryControl` has no caller that relied on it, and the queue-state refusal still lives in `recoveryControl` step (b).
- WR-05 (`numberOfRuns` 1..100): the only UI producer (`NewProtocolRunModal`) is already bounded 1..100 and the tutorial sends 1, so there is no client regression.
- IN-01 (own-property lookup of `RECOVERY_STRICT_SUCCESS`): correct.
- IN-02 (`nextRunId` removed): no remaining references.
- IN-03 (`readClick` try/catch/finally): correct, and all hooks still run before the early `return null`.
- IN-05 (modal spec family follows `target.kind`): behaviour for F.A.S.T. recovery resume/abort is unchanged, because the recovery spec's `yesno` entries equal the runControl spec's. STACK acknowledge is unchanged.
- 04-06 declared-action buttons and the `SwimLaneCommandComponent` change: `CommandImage` already rendered an empty `<Box>` when `imageUrl` was falsy, so dropping the wrapper is behaviour-neutral apart from the removed HStack gap.
- 04-07 name-based guards: `e instanceof Error && e.name === ...` works across module copies, and `runCreateReload.test.ts` exercises the reload path.

The remaining issues are below. The most important are the incomplete log-forging fix (WR-01) and the latch interpreter still returning a confident "No failure latched" for an empty-object reply (WR-02). The second is the same class of defect the WR-02 fix removed from the router.

## Warnings

### WR-01: Log-forging fix is incomplete — enqueue-time operator-only audit record interpolates `c.toolId` unsanitized

**File:** `controller/server/runs.ts:230-234`
**Issue:** The prior WR-04 fix flattened newlines and control characters at every composition site in `recoveryControl` and `commandQueue.toolControl`. The "Operator-Only Command Refused" audit write at enqueue time was missed. It interpolates `c.toolId`, which comes from stored protocol JSON (documented in the adjacent comment as untrusted), directly into `details`. A step whose `toolId` contains `\n` can forge additional audit lines inside the details field, which is exactly the vector `sanitizeLogText` was introduced to close. The `command=` value is less exploitable because it must trim/lowercase-match a declared operator-only command, so only surrounding whitespace can be injected. The sibling site at `controller/server/tools.ts:417-421` and the `Aborted Run Dequeue Failed` write at `controller/server/command_queue.ts:610-614` (it interpolates `errorMessage` and `baseDetails` raw) are also outside the sanitizer. Both are lower risk.
**Fix:**
```ts
await logAction({
  level: "warning",
  action: "Operator-Only Command Refused",
  details: sanitizeLogText(
    `protocolId=${protocolId} step=${i} toolId=${c.toolId} toolType=${c.toolType} command=${c.command} stage=enqueue`,
  ),
});
```
Apply the same wrap to `tools.ts:420` and `command_queue.ts:612`. Alternatively, sanitize inside `logAction` itself so no call site can forget it.

### WR-02: `extractLatch({})` still yields a confident "No failure latched", contradicting the WR-02 router fix and D-13

**File:** `controller/server/recoveryActions.ts:229-232` (reached via `controller/server/routers/tool.ts:564-576`)
**Issue:** The router fix now maps a missing or null `meta_data` to `unknown: true`, on the reasoning that a reply the controller cannot read back must never be shown as "not latched". `extractLatch` still treats an empty object as `{ latched: false, unknown: false }`, and `test/latchStatus.test.ts:49-50` pins this. A tool reply that carries an empty `meta_data` Struct decodes to `{}` and passes the router's guard. The card then renders the confident "No failure latched. An acknowledge is not possible..." copy for a reply that contained no latch information at all. That is the same unsafe-confidence defect the fix was meant to remove. The `undefined` branch of `extractLatch` is now unreachable from production, so the two layers disagree about what "empty" means.
**Fix:** Treat an empty object as unknown in `extractLatch` and update the pinned tests:
```ts
if (Object.keys(raw).length === 0) {
  return { latched: false, unknown: true, raw: {} };
}
```
Alternatively, require an explicit affirmative "not latched" shape (for example `latched === false`) before returning `unknown: false`.

### WR-03: Acknowledge button is not disabled while a send is pending; a repeat click silently clears the in-progress indicator

**File:** `controller/components/tools/RunRecoverySection.tsx:332-340` (interaction with `controller/components/runs/RunControlConfirmModal.tsx:241-255`)
**Issue:** Resume and Abort are gated by `disabled = tracked || pendingAction !== null`. The Acknowledge button is gated only by `!isValidRecoveryGuid(guid)`. After an Acknowledge is confirmed, the modal closes immediately (`closeOnDispatch`), and the guid stays filled until the send is accepted (`afterAccepted`). So the button remains clickable for the whole in-flight period of a physical STACK acknowledge.

A second click and confirm goes through the `closeOnDispatch` branch. The shared sender returns `ignored/in-flight`, so nothing is sent, but the branch calls `onPendingChange(false)` unconditionally. That sets `pendingAction` to null while the first send is still outstanding. The "Acknowledge in progress…" spinner disappears, and the operator has no indication that the first send is still running and no feedback that the second confirm was dropped.
**Fix:** Disable the button while a send is pending:
```tsx
<Button
  mt={4}
  colorScheme="teal"
  isDisabled={pendingAction !== null || !isValidRecoveryGuid(guid)}
  onClick={() => openConfirm("acknowledge_failure")}>
```
Also, in the modal's `closeOnDispatch` branch, only call `onPendingChange(false)` when `result.outcome.status !== "ignored"`.

### WR-04: `tool.latchStatus` sends the latch command to any registered tool type

**File:** `controller/server/routers/tool.ts:550-564`
**Issue:** The query takes only a `toolId`, resolves the DB row, and unconditionally sends `LATCH_READ_COMMAND` to that tool through `Tool.executeCommand`. It never checks that the tool's type declares a latch/acknowledge surface. The card only offers "Read latch" for STACK, but the server procedure is directly callable by any client. It can push a STACK-specific placeholder command (`latch_status`, a name explicitly not yet frozen) at a F.A.S.T., PF400 or other instrument. The header comment says this is meant to avoid the card becoming a generic command sender, yet the toolType derived from the DB row is not validated.
**Fix:** Gate on the recovery spec before sending:
```ts
if (!Object.prototype.hasOwnProperty.call(RECOVERY_STRICT_SUCCESS, String(record.type))) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Tool type "${String(record.type)}" has no latch to read.`,
  });
}
```
Use whichever recoveryActions export best expresses "this type has a latch", for example `needsGuidEntry`'s derivation.

### WR-05: `createFromProtocol` wraps every unexpected failure in `ProtocolGenerationFailedError` with the wrong constructor argument, so server faults surface as a client 400 with the real cause lost

**File:** `controller/server/runs.ts:280-283` (consumed at `controller/server/routers/run.ts:100-105`)
**Issue:** `ProtocolGenerationFailedError`'s constructor takes a `protocolId`, but the catch block passes a preformatted message: `new ProtocolGenerationFailedError(\`Failed to create run: ...\`)`. The resulting message is garbled: `Could not generate commands for protocol ID 'Failed to create run: <cause>'`. More importantly, `run.create` maps this class to `BAD_REQUEST: "Could not generate commands for the given params."`. A DB outage, an `enqueueRun` failure or a gRPC error during duration estimation is therefore reported to the operator as bad input, and the original error is never logged on this path. This predates the diff, but the 04-07 rework of this exact catch and its mappings left it untouched. The REST route gets the same 500 "Failed to create run" with no record of the original cause.
**Fix:** Log the original error before wrapping, and either pass `protocolId` to the constructor or introduce a distinct internal-failure error that the router maps to `INTERNAL_SERVER_ERROR`:
```ts
console.error("createFromProtocol failed:", error);
throw new ProtocolGenerationFailedError(protocolId);
```

## Info

### IN-01: Name-based type guards are not sound, and `throw e.cause` assumes a ZodError

**File:** `controller/server/runs.ts:316-326`, `controller/server/routers/run.ts:106-108`
**Issue:** `isProtocolParamsInvalidError` asserts `e is ProtocolParamsInvalidError` from `e.name` alone. The router then runs `throw e.cause`. Any `Error` named `"ProtocolParamsInvalidError"` without a `cause` (for example one thrown by a user protocol script, which executes inside `createFromProtocol`) makes the router `throw undefined`. The same applies to the other guards: a script error named `OperatorOnlyCommandError` would be returned verbatim to the client as BAD_REQUEST.
**Fix:** In `run.ts`, guard the dereference: `if (isProtocolParamsInvalidError(e) && e.cause instanceof Error) throw e.cause;`, and treat the name as a classification hint only.

### IN-02: GUID hint says "cannot be blank" for every invalid guid

**File:** `controller/components/tools/RunRecoverySection.tsx:111-112, 328`
**Issue:** `GUID_BLANK_HINT` renders whenever `!isValidRecoveryGuid(guid)`. That includes a non-blank guid containing a space or control character (for example `"ab cd"`), where the copy "A guid cannot be blank." is wrong. The line above it ("Spaces and control characters are not allowed.") partly mitigates this.
**Fix:** Show the blank copy only for `guid === ""`, and a separate "contains a space or control character" copy otherwise.

### IN-03: `sanitizeLogText` covers C0 controls only

**File:** `controller/server/logger.ts:11-12`
**Issue:** The class `[\r\n\u0000-\u001f]` leaves `\u007f`, `\u0085` (NEL), `\u2028` and `\u2029` intact. The guid validator in `recoveryActions.ts` already treats `\u0085` and `\u007f` as line/control characters for exactly this reason. A log viewer that splits on Unicode line separators could still show forged lines.
**Fix:** `value.replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]/g, "?")`.

### IN-04: `/api/runs` maps client-fault errors to 500

**File:** `controller/pages/api/runs/index.ts:14-31`
**Issue:** `ProtocolGenerationFailedError` and `ProtocolParamsInvalidError` have no `case` and fall into the generic 500 "Failed to create run" branch, although the tRPC route correctly treats them as 400. The IN-04 fix correctly stopped leaking raw text, but it also removed the only diagnostic a REST client had for these cases.
**Fix:** Add `case "ProtocolGenerationFailedError": case "ProtocolParamsInvalidError": res.status(400).end("Invalid protocol or parameters");`.

### IN-05: `extractLatch` ignores an explicit `latched` field

**File:** `controller/server/recoveryActions.ts:229-257`
**Issue:** The interpreter keys only on a non-empty string `guid`. It never reads the `latched` boolean that the documented galago-tools shape carries. A reply such as `{ latched: false }` renders as "Unrecognized latch reply", never as a cleared latch. A reply such as `{ latched: false, guid: "<stale>" }` renders as latched, with a "Use this guid" button. The wire shape is not frozen (A1), so this is display-only, but it should be settled before Phase 5 pins the contract.
**Fix:** When a candidate carries `latched === false`, return `{ latched: false, unknown: false, raw }`. Only treat a guid as latched when `latched !== false`.

---

_Reviewed: 2026-10-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
