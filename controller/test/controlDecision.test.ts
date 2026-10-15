import { describe, it, expect, vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";
import {
  shouldShowControlBar,
  createConfirmedSender,
  getActionSpec,
  emptyDecisions,
  allDecisionsChosen,
  completeDecisions,
  controlButtonHints,
  progressValue,
  nextUnknownSince,
  confirmStillValid,
  restateChoice,
  decisionLabel,
  runAfterAccepted,
  shouldShowRecoverySection,
  isToolTrackedByRunningStep,
  normalizeToolKey,
  headMovesNote,
  HEAD_MOVES_NOTE,
  type RunningEnvelope,
  type ConfirmedSendOutcome,
} from "@/components/runs/controlDecision";
import type { RunStateEnvelope } from "@/server/runState";

function statusReplyWith(run_state: unknown): any {
  return { uptime: 1, status: ToolStatus.BUSY, run_state };
}

describe("confirmed pause reaches the running tool", () => {
  it("sends {fast: {pause: {}}} to the running tool through commandQueue.toolControl", async () => {
    const queue = new CommandQueue({} as any);
    queue.slackNotificationsEnabled = false;
    (globalThis as any)["__global_command_queue_key"] = queue;

    const fake = installFakeTool("fast-1", ToolType.fast);
    const grpc: FakeGrpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });
    grpc.getStatus.mockResolvedValue(
      statusReplyWith({ state: "running", percent: 10, pause: null }),
    );

    const step = deferred<any>();
    vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise);

    let loop: Promise<void> | undefined;

    try {
      await queue.commands.push({
        runId: "run-1",
        status: "CREATED",
        commandInfo: { toolId: "fast-1", toolType: ToolType.fast, command: "transfer", params: {} },
      } as any);
      loop = queue._start();

      await vi.waitFor(
        () => {
          expect(queue.runningStep).toBeDefined();
        },
        { timeout: 5000 },
      );

      const caller = commandQueueRouter.createCaller({});

      await vi.waitFor(
        async () => {
          const snapshot: any = await caller.runState();
          expect(snapshot.status).toBe("ok");
        },
        { timeout: 5000 },
      );

      const envelope: RunStateEnvelope = await caller.runState();
      expect(shouldShowControlBar(envelope)).toBe(true);

      const notify = { accepted: vi.fn(), refused: vi.fn() };
      const sender = createConfirmedSender({
        sendRunning: (input) => caller.toolControl(input) as any,
        notify,
      });

      const outcome = await sender.send({
        target: { kind: "running" },
        toolType: "fast",
        action: "pause",
        decisions: {},
      });

      expect(outcome.status).toBe("accepted");
      expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
      expect(grpc.executeCommand).toHaveBeenCalledWith({ fast: { pause: {} } });
      expect(notify.accepted.mock.calls[0][0]).toBe("Instrument paused");
      expect(step.isSettled()).toBe(false);
      expect(queue.isWaitingForInput).toBe(false);
    } finally {
      if (!step.isSettled()) {
        step.resolve(undefined);
      }
      if (loop) {
        await loop;
      }
      await new Promise((resolve) => setImmediate(resolve));
      await removeFakeTool("fast-1");
      delete (globalThis as any)["__global_command_queue_key"];
      vi.restoreAllMocks();
    }
  });
});

function makeEnvelope(overrides: Partial<RunningEnvelope> = {}): RunningEnvelope {
  return {
    running: true,
    queueId: 1,
    runId: "run-1",
    toolId: "tool-1",
    toolType: "fast" as any,
    command: "transfer",
    status: "ok",
    runState: null,
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("bar visibility", () => {
  function runningEnvelope(toolType: string): RunningEnvelope {
    return makeEnvelope({ toolType: toolType as any });
  }

  it("is false for undefined", () => {
    expect(shouldShowControlBar(undefined)).toBe(false);
  });

  it("is false when not running", () => {
    expect(shouldShowControlBar({ running: false })).toBe(false);
  });

  it("is false for a tool type with no runControl entry (pf400)", () => {
    expect(shouldShowControlBar(runningEnvelope("pf400"))).toBe(false);
  });

  it("is true for a running fast envelope", () => {
    expect(shouldShowControlBar(runningEnvelope("fast"))).toBe(true);
  });
});

describe("confirmed sender", () => {
  it("returns refused with the verbatim message on ok: false", async () => {
    const sendRunning = vi.fn().mockResolvedValue({
      ok: false,
      response: "ERROR_FROM_TOOL",
      message: "instrument not ready: not paused (state running)",
    });
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning, notify });

    const outcome = await sender.send({
      target: { kind: "running" },
      toolType: "fast",
      action: "pause",
      decisions: {},
    });

    expect(outcome).toStrictEqual({
      status: "refused",
      message: "instrument not ready: not paused (state running)",
    });
    expect(notify.refused).toHaveBeenCalledWith("instrument not ready: not paused (state running)");
    expect(sendRunning).toHaveBeenCalledTimes(1);
  });

  it("returns failed with the error message on a rejected send", async () => {
    const sendRunning = vi.fn().mockRejectedValue(new Error("14 UNAVAILABLE"));
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning, notify });

    const outcome = await sender.send({
      target: { kind: "running" },
      toolType: "fast",
      action: "pause",
      decisions: {},
    });

    expect(outcome).toStrictEqual({ status: "failed", message: "14 UNAVAILABLE" });
    expect(sendRunning).toHaveBeenCalledTimes(1);
  });

  it("ignores a second send while the first is in flight", async () => {
    const pending = deferred<{ ok: boolean; response: string; message?: string }>();
    const sendRunning = vi.fn().mockReturnValue(pending.promise);
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning, notify });

    const request = {
      target: { kind: "running" as const },
      toolType: "fast",
      action: "pause",
      decisions: {},
    };

    const first = sender.send(request);
    const second = await sender.send(request);

    expect(second).toStrictEqual({ status: "ignored", reason: "in-flight" });
    expect(sendRunning).toHaveBeenCalledTimes(1);

    pending.resolve({ ok: true, response: "SUCCESS" });
    await first;
  });

  it("ignores resume with no decisions and sends nothing", async () => {
    const sendRunning = vi.fn();
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning, notify });

    const outcome = await sender.send({
      target: { kind: "running" },
      toolType: "fast",
      action: "resume",
      decisions: {},
    });

    expect(outcome).toStrictEqual({ status: "ignored", reason: "incomplete" });
    expect(sendRunning).not.toHaveBeenCalled();
  });
});

describe("decision completeness", () => {
  const resumeSpec = getActionSpec("fast", "resume")!;
  const pauseSpec = getActionSpec("fast", "pause")!;

  it("emptyDecisions gives every declared decision undefined", () => {
    expect(emptyDecisions(resumeSpec)).toStrictEqual({ is_tip_broken: undefined });
  });

  it("allDecisionsChosen is false until every decision is exactly yes/no", () => {
    expect(allDecisionsChosen(resumeSpec, {})).toBe(false);
    expect(allDecisionsChosen(resumeSpec, { is_tip_broken: undefined })).toBe(false);
    expect(allDecisionsChosen(resumeSpec, { is_tip_broken: "" as any })).toBe(false);
    expect(allDecisionsChosen(resumeSpec, { is_tip_broken: "Yes" as any })).toBe(false);
    expect(allDecisionsChosen(resumeSpec, { is_tip_broken: "yes" })).toBe(true);
    expect(allDecisionsChosen(resumeSpec, { is_tip_broken: "no" })).toBe(true);
  });

  it("completeDecisions returns null until complete, else the declared keys", () => {
    expect(completeDecisions(resumeSpec, {})).toBeNull();
    expect(completeDecisions(resumeSpec, { is_tip_broken: "no" })).toStrictEqual({
      is_tip_broken: "no",
    });
  });

  it("pause's empty spec is complete with {}", () => {
    expect(completeDecisions(pauseSpec, {})).toStrictEqual({});
  });

  it("a fresh emptyDecisions call after a completed one is again all undefined (reset on reopen)", () => {
    const completed = emptyDecisions(resumeSpec);
    completed.is_tip_broken = "yes";
    const fresh = emptyDecisions(resumeSpec);
    expect(fresh).toStrictEqual({ is_tip_broken: undefined });
  });
});

describe("button hints", () => {
  it("running: pause and abort enabled, resume disabled", () => {
    const envelope = makeEnvelope({
      status: "ok",
      runState: { state: "running", percent: 1, pause: null },
    });
    expect(controlButtonHints(envelope)).toStrictEqual({ pause: true, resume: false, abort: true });
  });

  it("paused: resume and abort enabled, pause disabled", () => {
    const envelope = makeEnvelope({
      status: "ok",
      runState: { state: "paused", percent: 1, pause: null },
    });
    expect(controlButtonHints(envelope)).toStrictEqual({ pause: false, resume: true, abort: true });
  });

  it("an unrecognised state enables all three", () => {
    const envelope = makeEnvelope({
      status: "ok",
      runState: { state: "homing", percent: 1, pause: null },
    });
    expect(controlButtonHints(envelope)).toStrictEqual({ pause: true, resume: true, abort: true });
  });

  it("a null runState enables all three", () => {
    const envelope = makeEnvelope({ status: "ok", runState: null });
    expect(controlButtonHints(envelope)).toStrictEqual({ pause: true, resume: true, abort: true });
  });

  it("status unknown enables all three even with a last-good running state", () => {
    const envelope = makeEnvelope({
      status: "unknown",
      runState: { state: "running", percent: 1, pause: null },
      lastError: "x",
    });
    expect(controlButtonHints(envelope)).toStrictEqual({ pause: true, resume: true, abort: true });
  });
});

describe("progress", () => {
  it("clamps, rounds, and maps non-finite to null", () => {
    expect(progressValue(null)).toBeNull();
    expect(progressValue(NaN)).toBeNull();
    expect(progressValue(42.6)).toBe(43);
    expect(progressValue(-5)).toBe(0);
    expect(progressValue(140)).toBe(100);
  });
});

describe("unknown since", () => {
  it("starts tracking since on the first unknown poll with a lastError", () => {
    const envelope = makeEnvelope({
      status: "unknown",
      runState: null,
      lastError: "x",
      updatedAt: 1000,
    });
    expect(nextUnknownSince(null, envelope, 5000)).toStrictEqual({ queueId: 1, since: 1000 });
  });

  it("a later unknown poll for the same queueId keeps the original since", () => {
    const prev = { queueId: 1, since: 1000 };
    const envelope = makeEnvelope({
      status: "unknown",
      runState: null,
      lastError: "x",
      updatedAt: 2000,
    });
    expect(nextUnknownSince(prev, envelope, 5000)).toStrictEqual(prev);
  });

  it("status ok clears it", () => {
    const envelope = makeEnvelope({ status: "ok" });
    expect(nextUnknownSince({ queueId: 1, since: 1000 }, envelope, 5000)).toBeNull();
  });

  it("the pending first poll (unknown, no lastError) gives null", () => {
    const envelope = makeEnvelope({ status: "unknown", runState: null, updatedAt: null });
    expect(nextUnknownSince(null, envelope, 5000)).toBeNull();
  });

  it("running false gives null", () => {
    expect(nextUnknownSince({ queueId: 1, since: 1000 }, { running: false }, 5000)).toBeNull();
  });

  it("a queueId change restarts since", () => {
    const prev = { queueId: 1, since: 1000 };
    const envelope = makeEnvelope({
      queueId: 2,
      status: "unknown",
      runState: null,
      lastError: "x",
      updatedAt: 3000,
    });
    expect(nextUnknownSince(prev, envelope, 5000)).toStrictEqual({ queueId: 2, since: 3000 });
  });
});

describe("confirm validity", () => {
  it("undefined envelope keeps it valid", () => {
    expect(confirmStillValid(7, undefined)).toBe(true);
  });

  it("running false invalidates", () => {
    expect(confirmStillValid(7, { running: false })).toBe(false);
  });

  it("a different queueId invalidates", () => {
    expect(confirmStillValid(7, makeEnvelope({ queueId: 8 }))).toBe(false);
  });

  it("the same queueId stays valid", () => {
    expect(confirmStillValid(7, makeEnvelope({ queueId: 7 }))).toBe(true);
  });
});

describe("restatement", () => {
  it("restates resume with the chosen decision", () => {
    expect(restateChoice("fast", "resume", { is_tip_broken: "no" })).toBe(
      "Resume the F.A.S.T. run. Tip broken: No.",
    );
  });

  it("restates abort with the chosen decision", () => {
    expect(restateChoice("fast", "abort", { return_liquid: "yes" })).toBe(
      "Abort the F.A.S.T. run. Return liquid: Yes.",
    );
  });

  it("restates an unchosen decision as 'not chosen'", () => {
    expect(restateChoice("fast", "resume", {})).toBe(
      "Resume the F.A.S.T. run. Tip broken: not chosen.",
    );
  });

  it("decisionLabel maps the known decisions", () => {
    expect(decisionLabel("is_tip_broken")).toBe("Tip broken?");
    expect(decisionLabel("return_liquid")).toBe("Return liquid?");
  });
});

describe("recovery section visibility", () => {
  it("is true only for a tool type with a runControl entry, independent of any running step", () => {
    expect(shouldShowRecoverySection("fast")).toBe(true);
    expect(shouldShowRecoverySection("pf400")).toBe(false);
    expect(shouldShowRecoverySection("toolbox")).toBe(false);
    expect(shouldShowRecoverySection("constructor")).toBe(false);
    expect(shouldShowRecoverySection("")).toBe(false);
  });
});

describe("tracked tool", () => {
  it("normalizeToolKey folds case and separators the same way for equivalent names", () => {
    expect(normalizeToolKey("FAST 1")).toBe(normalizeToolKey("fast-1"));
  });

  it("is false for an undefined envelope", () => {
    expect(isToolTrackedByRunningStep(undefined, "fast-1")).toBe(false);
  });

  it("is false when not running", () => {
    expect(isToolTrackedByRunningStep({ running: false }, "fast-1")).toBe(false);
  });

  it("is true for a running envelope on this tool, even with status unknown", () => {
    const envelope = makeEnvelope({ toolId: "FAST 1", status: "unknown" });
    expect(isToolTrackedByRunningStep(envelope, "fast-1")).toBe(true);
  });

  it("is false for a running envelope on a different tool", () => {
    const envelope = makeEnvelope({ toolId: "fast-2" });
    expect(isToolTrackedByRunningStep(envelope, "fast-1")).toBe(false);
  });
});

describe("recovery send gate", () => {
  it("ignores a recovery pause and sends nothing", async () => {
    const sendRecovery = vi.fn().mockResolvedValue({ ok: true, response: "SUCCESS" });
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning: vi.fn(), sendRecovery, notify });

    const outcome = await sender.send({
      target: { kind: "recovery", toolId: "fast-1" },
      toolType: "fast",
      action: "pause",
      decisions: {},
    });

    expect(outcome).toStrictEqual({ status: "ignored", reason: "incomplete" });
    expect(sendRecovery).not.toHaveBeenCalled();
  });

  it("ignores a recovery resume with incomplete decisions and sends nothing", async () => {
    const sendRecovery = vi.fn().mockResolvedValue({ ok: true, response: "SUCCESS" });
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning: vi.fn(), sendRecovery, notify });

    const outcome = await sender.send({
      target: { kind: "recovery", toolId: "fast-1" },
      toolType: "fast",
      action: "resume",
      decisions: {},
    });

    expect(outcome).toStrictEqual({ status: "ignored", reason: "incomplete" });
    expect(sendRecovery).not.toHaveBeenCalled();
  });

  it("sends a complete recovery abort to sendRecovery and never sendRunning", async () => {
    const sendRecovery = vi.fn().mockResolvedValue({ ok: true, response: "SUCCESS" });
    const sendRunning = vi.fn();
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning, sendRecovery, notify });

    const outcome = await sender.send({
      target: { kind: "recovery", toolId: "fast-1" },
      toolType: "fast",
      action: "abort",
      decisions: { return_liquid: "no" },
    });

    expect(outcome).toStrictEqual({ status: "accepted" });
    expect(sendRecovery).toHaveBeenCalledTimes(1);
    expect(sendRecovery).toHaveBeenCalledWith({
      toolId: "fast-1",
      action: "abort",
      params: { return_liquid: "no" },
    });
    expect(sendRunning).not.toHaveBeenCalled();
  });

  it("fails and notifies refused when no sendRecovery dependency is given", async () => {
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning: vi.fn(), notify });

    const outcome = await sender.send({
      target: { kind: "recovery", toolId: "fast-1" },
      toolType: "fast",
      action: "resume",
      decisions: { is_tip_broken: "yes" },
    });

    expect(outcome).toStrictEqual({
      status: "failed",
      message: "Crash-recovery control is not available here.",
    });
    expect(notify.refused).toHaveBeenCalledWith("Crash-recovery control is not available here.");
  });

  it("ignores a second recovery send while the first is pending", async () => {
    const pending = deferred<{ ok: boolean; response: string }>();
    const sendRecovery = vi.fn().mockReturnValue(pending.promise);
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning: vi.fn(), sendRecovery, notify });

    const request = {
      target: { kind: "recovery" as const, toolId: "fast-1" },
      toolType: "fast",
      action: "abort",
      decisions: { return_liquid: "no" as const },
    };

    const first = sender.send(request);
    const second = await sender.send(request);

    expect(second).toStrictEqual({ status: "ignored", reason: "in-flight" });
    expect(sendRecovery).toHaveBeenCalledTimes(1);

    pending.resolve({ ok: true, response: "SUCCESS" });
    await first;
  });
});

describe("accepted then follow-up", () => {
  function outcomeSend(outcome: ConfirmedSendOutcome) {
    return () => Promise.resolve(outcome);
  }

  it("calls followUp once after an accepted send resolves", async () => {
    const followUp = vi.fn().mockResolvedValue(undefined);
    const result = await runAfterAccepted(outcomeSend({ status: "accepted" }), followUp);

    expect(followUp).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual({ outcome: { status: "accepted" }, followUp: "done" });
  });

  it.each([
    { status: "refused", message: "no" } as ConfirmedSendOutcome,
    { status: "failed", message: "no" } as ConfirmedSendOutcome,
    { status: "ignored", reason: "in-flight" } as ConfirmedSendOutcome,
  ])("never calls followUp for a non-accepted outcome (%j)", async (outcome) => {
    const followUp = vi.fn().mockResolvedValue(undefined);
    const result = await runAfterAccepted(outcomeSend(outcome), followUp);

    expect(followUp).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ outcome, followUp: "skipped" });
  });

  it("reports a thrown followUp error without throwing", async () => {
    const followUp = vi.fn().mockRejectedValue(new Error("boom"));
    const result = await runAfterAccepted(outcomeSend({ status: "accepted" }), followUp);

    expect(result).toStrictEqual({
      outcome: { status: "accepted" },
      followUp: "failed",
      followUpMessage: "boom",
    });
  });
});

describe("headMovesNote (WR-05)", () => {
  it("omits the head-moves note for a F.A.S.T. pause", () => {
    expect(headMovesNote("fast", "pause")).toBeNull();
  });

  it("shows the note for F.A.S.T. resume and abort", () => {
    expect(headMovesNote("fast", "resume")).toBe(HEAD_MOVES_NOTE);
    expect(headMovesNote("fast", "abort")).toBe(HEAD_MOVES_NOTE);
  });

  it("shows the note when the tool type or action is not declared", () => {
    expect(headMovesNote("pf400", "pause")).toBe(HEAD_MOVES_NOTE);
    expect(headMovesNote("fast", "unknown")).toBe(HEAD_MOVES_NOTE);
  });
});
