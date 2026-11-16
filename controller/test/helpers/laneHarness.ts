// Shared harness for the concurrency-lane tests. Fakes only: Tool.executeCommand is
// replaced by a spy that returns one deferred per call, so a test decides exactly when
// each step ends. No gRPC endpoint is ever contacted, so no test can move an instrument.
import { vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { installFakeTool, removeFakeTool, deferred } from "./fakeTool";

const GLOBAL_KEY = "__global_command_queue_key";

export interface LaneStep {
  toolId: string;
  toolType: ToolType;
  command: string;
  params?: Record<string, unknown>;
  lane?: string;
  barrier?: boolean;
}

export interface LaneCall {
  toolId: string;
  command: string;
  params: unknown;
  /** The unique params.tag the row builder gave this step. */
  queueIdTag: string | undefined;
  /** The stored queueId of the row, resolved from the tag; undefined for an untagged call. */
  queueId: number | undefined;
  gate: ReturnType<typeof deferred<unknown>>;
}

export interface LaneHarnessOptions {
  parallelLanes?: boolean;
  loopDelayMs?: number;
}

export function stackStep(command: string, extra: Partial<LaneStep> = {}): LaneStep {
  return { toolId: "stack-1", toolType: ToolType.stack, command, ...extra };
}

export function fastStep(command: string, extra: Partial<LaneStep> = {}): LaneStep {
  return { toolId: "fast-1", toolType: ToolType.fast, command, ...extra };
}

export function createLaneHarness(opts?: LaneHarnessOptions) {
  vi.useFakeTimers({ toFake: ["setTimeout"] });

  const queue = new CommandQueue({} as any, {
    parallelLanes: opts?.parallelLanes ?? true,
    loopDelayMs: opts?.loopDelayMs ?? 1,
  });
  queue.slackNotificationsEnabled = false;
  (globalThis as any)[GLOBAL_KEY] = queue;

  installFakeTool("stack-1", ToolType.stack);
  installFakeTool("fast-1", ToolType.fast);

  const callList: LaneCall[] = [];
  const queueIdByTag = new Map<string, number>();
  vi.spyOn(Tool, "executeCommand").mockImplementation((info: any) => {
    const gate = deferred<unknown>();
    const tag = (info.params as { tag?: string } | undefined)?.tag;
    callList.push({
      toolId: info.toolId,
      command: info.command,
      params: info.params,
      queueIdTag: tag,
      queueId: tag === undefined ? undefined : queueIdByTag.get(tag),
      gate,
    });
    return gate.promise as Promise<any>;
  });

  const starts: Array<Promise<unknown>> = [];
  let tagCounter = 0;

  // Pushes one run. The lane / laneBarrier keys are written ONLY when given, never as
  // undefined or false (Pitfall 24b), and advancedParameters only when one is given.
  async function push(runId: string, steps: LaneStep[]): Promise<string[]> {
    const tags: string[] = [];
    for (const step of steps) {
      const tag = String(step.params?.tag ?? `${runId}-${tagCounter++}`);
      tags.push(tag);
      const commandInfo: Record<string, unknown> = {
        toolId: step.toolId,
        toolType: step.toolType,
        command: step.command,
        params: { ...(step.params ?? {}), tag },
      };
      const advanced: Record<string, unknown> = {};
      if (step.lane !== undefined) advanced.lane = step.lane;
      if (step.barrier === true) advanced.laneBarrier = true;
      if (Object.keys(advanced).length > 0) commandInfo.advancedParameters = advanced;
      await queue.commands.push({ runId, status: "CREATED", commandInfo } as any);
    }
    // Resolve each tag to its stored queueId so calls can be counted per queueId.
    for (const row of queue.commands.queuedRowsSync()) {
      const tag = (row.commandInfo.params as { tag?: string } | undefined)?.tag;
      if (tag !== undefined) queueIdByTag.set(tag, row.queueId);
    }
    return tags;
  }

  function start(source?: "operator" | "enqueue") {
    const p = queue._start(source);
    starts.push(p);
    return p;
  }

  async function tick(n = 1) {
    for (let i = 0; i < n; i++) {
      await vi.advanceTimersByTimeAsync(1);
    }
  }

  function calls(): LaneCall[] {
    return callList;
  }

  function finish(index: number, reply?: unknown) {
    callList[index].gate.resolve(reply);
  }

  function fail(index: number, error: unknown) {
    callList[index].gate.reject(error);
  }

  function queueIdOf(tag: string): number {
    const id = queueIdByTag.get(tag);
    if (id === undefined) throw new Error(`unknown tag ${tag}`);
    return id;
  }

  async function teardown() {
    const stopped = queue.stop();
    // Release every open deferred, including any a still-waking loop opens late, while
    // fake time advances 20000 ms in 1000 ms slices.
    for (let i = 0; i < 20; i++) {
      for (const call of callList) {
        if (!call.gate.isSettled()) call.gate.resolve(undefined);
      }
      await vi.advanceTimersByTimeAsync(1000);
    }
    await stopped;
    await Promise.all(starts);
    await queue.stop();
    vi.useRealTimers();
    await new Promise((resolve) => setImmediate(resolve));
    await removeFakeTool("stack-1");
    await removeFakeTool("fast-1");
    delete (globalThis as any)[GLOBAL_KEY];
    vi.restoreAllMocks();
  }

  return { queue, push, start, tick, calls, finish, fail, queueIdOf, teardown };
}

export type LaneHarness = ReturnType<typeof createLaneHarness>;
