// Regression for G-04-7: tRPC run.create must map the operator-only refusal
// (and the other mapped errors) correctly even when the router and the
// RunStore singleton come from different module copies.
//
// Why it happens: `next dev` purges the server require cache after every
// compile, so server/routers/run.ts is re-evaluated (with fresh error classes)
// while RunStore.global stays pinned on `global.__global_run_store_key` to the
// copy that created it first. That stale store keeps throwing the OLD classes,
// so a class-identity check in the router misses every branch and the error
// falls through as INTERNAL_SERVER_ERROR.
//
// vi.resetModules() is the simulation of that purge (debug session
// run-create-operator-only-500, Evidence 00:59:20): copy A creates the
// singleton, the purge drops the module registry, and the router is then
// imported as copy B.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { ZodError } from "zod";
import {
  isOperatorOnlyCommandError,
  OperatorOnlyCommandError,
} from "@/server/operatorOnlyCommands";
import {
  isProtocolGenerationFailedError,
  isProtocolNotFoundError,
  isProtocolParamsInvalidError,
  ProtocolGenerationFailedError,
  ProtocolNotFoundError,
  ProtocolParamsInvalidError,
} from "@/server/runs";

const { dbMock, fakeQueue } = vi.hoisted(() => {
  const dbMock: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  const fakeQueue = {
    commands: { runPush: vi.fn(), push: vi.fn() },
    enqueueRun: vi.fn(),
    state: undefined,
  };
  return { dbMock, fakeQueue };
});

vi.mock("@/db/client", () => ({ db: dbMock, sqlite: {} }));
vi.mock("@/server/runs", async (importOriginal) => {
  return await importOriginal<typeof import("@/server/runs")>();
});
vi.mock("@/server/scripting/protocol-script-executor", () => ({
  executeProtocolScript: vi.fn(),
}));
vi.mock("@/server/scripting/resolve-tool-types", () => ({
  resolveToolTypes: vi.fn(async (commands: unknown[]) => commands),
}));
vi.mock("@/server/command_queue", () => ({
  default: class {
    static get global() {
      return fakeQueue;
    }
  },
}));

const STORE_KEY = "__global_run_store_key";
const ROOT = path.resolve(__dirname, "..");

function installDbChain() {
  dbMock.select.mockImplementation(() => dbMock);
  dbMock.from.mockImplementation(() => dbMock);
  dbMock.where.mockImplementation(() => dbMock);
}

beforeEach(() => {
  delete (globalThis as Record<string, unknown>)[STORE_KEY];
  dbMock.limit.mockReset();
  fakeQueue.enqueueRun.mockReset();
  installDbChain();
});

// Copy A creates the RunStore singleton. With `reload` the require cache is
// purged again (the dev recompile) before the router is imported as copy B.
async function loadCaller(reload: boolean) {
  // The file-level passthrough mock above caches ONE copy of server/runs across
  // resets, which would hide the stale-class drift for runs.ts's own error
  // classes. Dropping the mock here makes every import after a reset a genuinely
  // fresh copy, as in next dev.
  vi.doUnmock("@/server/runs");
  vi.resetModules();
  delete (globalThis as Record<string, unknown>)[STORE_KEY];
  const storeModule = await import("@/server/runs");
  const store = storeModule.default.global;
  if (reload) {
    vi.resetModules();
  }
  const { runRouter } = await import("@/server/routers/run");
  return { storeModule, store, caller: runRouter.createCaller({}) };
}

type Caller = Awaited<ReturnType<typeof loadCaller>>["caller"];

async function createError(caller: Caller, protocolId: number): Promise<any> {
  try {
    await caller.create({ protocolId });
  } catch (e) {
    return e;
  }
  throw new Error("run.create resolved, but a rejection was expected");
}

const visualAckRow = {
  id: 101,
  name: "visual-ack",
  mode: "visual",
  workcellId: 1,
  commands: [{ toolId: "stack-1", toolType: "stack", command: "acknowledge_failure", params: {} }],
};

describe.each([
  ["one module graph", false],
  ["after a dev recompile (RunStore.global pinned to an older module copy)", true],
] as const)("run.create error mapping, %s", (_label, reload) => {
  it("maps an operator-only step to BAD_REQUEST with the refusal's own message", async () => {
    const { caller } = await loadCaller(reload);
    dbMock.limit.mockResolvedValueOnce([visualAckRow]);

    const e = await createError(caller, 101);

    expect(e.constructor.name).toBe("TRPCError");
    expect(e.code).toBe("BAD_REQUEST");
    expect(e.message).toContain('on tool "stack-1"');
    expect(e.message).toContain("which is an operator action");
    expect(e.message).not.toContain("Could not generate commands for the given params.");
    expect(fakeQueue.enqueueRun).not.toHaveBeenCalled();
  });

  it("maps an unknown protocol to NOT_FOUND", async () => {
    const { caller } = await loadCaller(reload);
    dbMock.limit.mockResolvedValueOnce([]);

    const e = await createError(caller, 999);

    expect(e.constructor.name).toBe("TRPCError");
    expect(e.code).toBe("NOT_FOUND");
    expect(e.message).toBe("No protocol found for this ID.");
    expect(fakeQueue.enqueueRun).not.toHaveBeenCalled();
  });

  it("maps a protocol that generates no commands to BAD_REQUEST", async () => {
    const { caller } = await loadCaller(reload);
    dbMock.limit.mockResolvedValueOnce([
      { id: 104, name: "empty-protocol", mode: "visual", workcellId: 1, commands: [] },
    ]);

    const e = await createError(caller, 104);

    expect(e.constructor.name).toBe("TRPCError");
    expect(e.code).toBe("BAD_REQUEST");
    expect(e.message).toBe("Could not generate commands for the given params.");
    expect(fakeQueue.enqueueRun).not.toHaveBeenCalled();
  });

  it("rethrows a ProtocolParamsInvalidError's ZodError cause", async () => {
    const { caller, store, storeModule } = await loadCaller(reload);
    const zodError = new ZodError([]);
    vi.spyOn(store, "createFromProtocol").mockRejectedValueOnce(
      new storeModule.ProtocolParamsInvalidError("101", zodError),
    );

    const e = await createError(caller, 101);

    expect(e.cause).toBe(zodError);
    expect(fakeQueue.enqueueRun).not.toHaveBeenCalled();
  });
});

describe("isOperatorOnlyCommandError", () => {
  it("is true for a new OperatorOnlyCommandError", () => {
    expect(isOperatorOnlyCommandError(new OperatorOnlyCommandError("refused"))).toBe(true);
  });

  it("is true for an OperatorOnlyCommandError from a module copy loaded after a reset", async () => {
    vi.resetModules();
    const copy = await import("@/server/operatorOnlyCommands");
    expect(copy.OperatorOnlyCommandError).not.toBe(OperatorOnlyCommandError);
    expect(isOperatorOnlyCommandError(new copy.OperatorOnlyCommandError("refused"))).toBe(true);
  });

  it("is false for non-matching values", () => {
    const named = new Error("x");
    named.name = "ProtocolNotFoundError";
    expect(isOperatorOnlyCommandError(new Error("x"))).toBe(false);
    expect(isOperatorOnlyCommandError(named)).toBe(false);
    expect(isOperatorOnlyCommandError(null)).toBe(false);
    expect(isOperatorOnlyCommandError(undefined)).toBe(false);
    expect(isOperatorOnlyCommandError("OperatorOnlyCommandError")).toBe(false);
  });
});

describe("run-create error guards", () => {
  type Guard = (e: unknown) => boolean;
  const make = {
    ProtocolNotFoundError: (m: typeof import("@/server/runs")) => new m.ProtocolNotFoundError("1"),
    ProtocolGenerationFailedError: (m: typeof import("@/server/runs")) =>
      new m.ProtocolGenerationFailedError("1"),
    ProtocolParamsInvalidError: (m: typeof import("@/server/runs")) =>
      new m.ProtocolParamsInvalidError("1", new ZodError([])),
  };
  const guards: [string, Guard][] = [
    ["ProtocolNotFoundError", (e) => isProtocolNotFoundError(e)],
    ["ProtocolGenerationFailedError", (e) => isProtocolGenerationFailedError(e)],
    ["ProtocolParamsInvalidError", (e) => isProtocolParamsInvalidError(e)],
  ];

  it.each(guards)("%s guard is true for its own class, current copy", (name, guard) => {
    const own = {
      ProtocolNotFoundError: new ProtocolNotFoundError("1"),
      ProtocolGenerationFailedError: new ProtocolGenerationFailedError("1"),
      ProtocolParamsInvalidError: new ProtocolParamsInvalidError("1", new ZodError([])),
    }[name]!;
    expect(guard(own)).toBe(true);
  });

  it.each(guards)("%s guard is true for its own class, post-reset copy", async (name, guard) => {
    vi.doUnmock("@/server/runs");
    vi.resetModules();
    const copy = await import("@/server/runs");
    expect(guard(make[name as keyof typeof make](copy))).toBe(true);
  });

  it.each(guards)("%s guard is false for everything else", (name, guard) => {
    const others = Object.keys(make).filter((n) => n !== name);
    const current = {
      ProtocolNotFoundError: new ProtocolNotFoundError("1"),
      ProtocolGenerationFailedError: new ProtocolGenerationFailedError("1"),
      ProtocolParamsInvalidError: new ProtocolParamsInvalidError("1", new ZodError([])),
    } as Record<string, Error>;
    for (const other of others) {
      expect(guard(current[other])).toBe(false);
    }
    expect(guard(new OperatorOnlyCommandError("refused"))).toBe(false);
    expect(guard(new Error("plain"))).toBe(false);
    expect(guard(null)).toBe(false);
    expect(guard(undefined)).toBe(false);
    expect(guard(name)).toBe(false);
  });
});

describe("run.create source pin", () => {
  it("run.create classifies errors by name, never by class identity", () => {
    const routerSrc = fs.readFileSync(path.join(ROOT, "server/routers/run.ts"), "utf-8");
    const runsSrc = fs.readFileSync(path.join(ROOT, "server/runs.ts"), "utf-8");
    const identity =
      /instanceof\s+(ProtocolNotFoundError|ProtocolGenerationFailedError|ProtocolParamsInvalidError|OperatorOnlyCommandError)\b/;

    expect(routerSrc).not.toMatch(identity);
    expect(runsSrc).not.toMatch(identity);

    expect(routerSrc).toContain("isProtocolNotFoundError(e)");
    expect(routerSrc).toContain("isOperatorOnlyCommandError(e)");
    expect(routerSrc).toContain("isProtocolGenerationFailedError(e)");
    expect(routerSrc).toContain("isProtocolParamsInvalidError(e)");
    expect(runsSrc).toContain("isProtocolNotFoundError(error)");
    expect(runsSrc).toContain("isOperatorOnlyCommandError(error)");
  });
});
