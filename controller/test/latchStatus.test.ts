// OPR-03 (D-11, D-12, D-13): the latch read is a display-only surface. The
// server sends ONE fixed command constant through Tool.executeCommand (never
// the .controlCommand( path), and the pure extractLatch tolerates unknown
// reply shapes without any proto import. Unit matrix + stack FakeGrpc query
// integration, cloned from the recoveryControl test's harness.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/db/helpers", () => ({
  findOne: vi.fn(),
  findOneOrFail: vi.fn(),
  findMany: vi.fn(),
  exists: vi.fn(),
  count: vi.fn(),
  getSelectedWorkcellId: vi.fn(),
  INVENTORY_TOOL_MAP: {},
}));

// Source-scan helpers (staticScan.test.ts read() idiom) for the card and
// router pins — node fs/path only, no new deps.
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

import { ToolType } from "gen-interfaces/controller";
import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { findMany, getSelectedWorkcellId } from "@/db/helpers";
import { toolRouter } from "@/server/routers/tool";
import Tool from "@/server/tools";
import { ToolCommandExecutionError } from "@/server/tools";
import { LATCH_READ_COMMAND, extractLatch } from "@/server/recoveryActions";
import { installFakeTool, removeFakeTool, FakeGrpc } from "./helpers/fakeTool";

const STACK_TOOL_ROW = {
  id: 3,
  name: "stack-1",
  type: "stack",
  ip: "127.0.0.1",
  port: 3,
  workcellId: 1,
};

describe("extractLatch shape tolerance (D-13, no proto)", () => {
  it("returns latched:false unknown:false for undefined and empty meta", () => {
    expect(extractLatch(undefined)).toStrictEqual({ latched: false, unknown: false, raw: {} });
    expect(extractLatch({})).toStrictEqual({ latched: false, unknown: false, raw: {} });
  });

  it("finds a top-level string guid and carries kind/explanation verbatim", () => {
    const result = extractLatch({
      guid: "g-1",
      kind: "transfer",
      explanation: "sequence ended with transfer failure",
    });
    expect(result).toStrictEqual({
      latched: true,
      guid: "g-1",
      kind: "transfer",
      explanation: "sequence ended with transfer failure",
      unknown: false,
      raw: { guid: "g-1", kind: "transfer", explanation: "sequence ended with transfer failure" },
    });
  });

  it("finds a guid nested under latch", () => {
    expect(extractLatch({ latch: { guid: "g-2" } }).latched).toBe(true);
    expect(extractLatch({ latch: { guid: "g-2" } }).guid).toBe("g-2");
  });

  it("finds a guid nested under result", () => {
    expect(extractLatch({ result: { guid: "g-3" } })).toMatchObject({
      latched: true,
      guid: "g-3",
    });
  });

  it("takes the FIRST candidate with a guid: top-level beats nested", () => {
    const result = extractLatch({
      guid: "top",
      latch: { guid: "nested-latch" },
      result: { guid: "nested-result" },
    });
    expect(result.latched).toBe(true);
    expect(result.guid).toBe("top");
  });

  it("treats an empty-string guid as not latched (never trims or coerces)", () => {
    const result = extractLatch({ guid: "" });
    expect(result.latched).toBe(false);
    expect(result.guid).toBeUndefined();
    expect(result.unknown).toBe(true);
    expect(result.raw).toStrictEqual({ guid: "" });
  });

  it("refuses a non-string guid (number/object) as not latched", () => {
    expect(extractLatch({ guid: 42 })).toMatchObject({ latched: false, unknown: true });
    expect(extractLatch({ guid: { a: 1 } })).toMatchObject({ latched: false, unknown: true });
  });

  it("flags an uninterpretable shape as unknown with the full raw retained", () => {
    const meta = { foo: 1, bar: { deep: true } };
    const result = extractLatch(meta);
    expect(result).toStrictEqual({
      latched: false,
      unknown: true,
      raw: { foo: 1, bar: { deep: true } },
    });
  });

  it("falls back to resultKind/reason only when kind/explanation are absent", () => {
    const both = extractLatch({
      guid: "g-4",
      kind: "transfer",
      resultKind: "ignored",
      explanation: "kept",
      reason: "ignored",
    });
    expect(both.kind).toBe("transfer");
    expect(both.explanation).toBe("kept");

    const fallback = extractLatch({ guid: "g-5", resultKind: "method", reason: "why" });
    expect(fallback.kind).toBe("method");
    expect(fallback.explanation).toBe("why");
  });

  it("ignores non-string kind and explanation fields", () => {
    const result = extractLatch({ guid: "g-6", kind: 7, explanation: null });
    expect(result).toMatchObject({ latched: true, guid: "g-6" });
    expect(result.kind).toBeUndefined();
    expect(result.explanation).toBeUndefined();
  });
});

describe("tool.latchStatus query (D-11)", () => {
  let stackGrpc: FakeGrpc;

  beforeEach(() => {
    vi.mocked(getSelectedWorkcellId).mockResolvedValue(1);
    vi.mocked(findMany).mockResolvedValue([STACK_TOOL_ROW]);

    stackGrpc = installFakeTool("stack-1", "stack" as ToolType).grpc;
    stackGrpc.executeCommand.mockResolvedValue({
      response: ResponseCode.SUCCESS,
      return_reply: true,
    });
  });

  afterEach(async () => {
    await removeFakeTool("stack-1");
    vi.restoreAllMocks();
  });

  const caller = () => toolRouter.createCaller({});

  it("sends ONE fixed LATCH_READ_COMMAND through tool.executeCommand with return_reply", async () => {
    stackGrpc.executeCommand.mockResolvedValue({
      response: ResponseCode.SUCCESS,
      return_reply: true,
      meta_data: { guid: "g-9", kind: "transfer" },
    });
    const tool = Tool.lookup("stack-1")!;
    const executeCommand = vi.spyOn(tool, "executeCommand");
    const controlCommand = vi.spyOn(tool, "controlCommand");

    const result = await caller().latchStatus({ toolId: "stack-1" });

    expect(result).toStrictEqual({
      latched: true,
      guid: "g-9",
      kind: "transfer",
      explanation: undefined,
      unknown: false,
      raw: { guid: "g-9", kind: "transfer" },
    });
    // Exactly one executeCommand, and the command info carried the fixed
    // constant and return_reply:true — the read never rides a generic path.
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand.mock.calls[0][0]).toStrictEqual({
      toolId: "stack-1",
      toolType: "stack",
      command: LATCH_READ_COMMAND,
      params: {},
      return_reply: true,
    });
    // D-11: the read never touches the operator control path.
    expect(controlCommand).not.toHaveBeenCalled();
    expect(stackGrpc.executeCommand).toHaveBeenCalledTimes(1);
    expect(stackGrpc.executeCommand).toHaveBeenCalledWith({ stack: { latch_status: {} } });
  });

  it("returns a not-latched result when the reply carries no meta_data", async () => {
    stackGrpc.executeCommand.mockResolvedValue({
      response: ResponseCode.SUCCESS,
      return_reply: true,
    });

    const result = await caller().latchStatus({ toolId: "stack-1" });
    expect(result).toStrictEqual({ latched: false, unknown: false, raw: {} });
  });

  it("strict-maps a FAILURE reply to a thrown ToolCommandExecutionError", async () => {
    stackGrpc.executeCommand.mockResolvedValue({
      response: ResponseCode.ERROR_FROM_TOOL,
      error_message: "instrument not ready",
    });

    let thrown: unknown;
    try {
      await caller().latchStatus({ toolId: "stack-1" });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeDefined();

    // tRPC wraps the server-side throw; the operator-facing message (composed
    // by describeToolReply) and the coded ToolCommandExecutionError both
    // survive as the wrapped error's cause.
    const wrapped = thrown as { message?: string; cause?: unknown };
    expect(wrapped.message).toContain("instrument not ready");
    expect(wrapped.cause).toBeInstanceOf(ToolCommandExecutionError);
  });

  it("derives the tool type from the DB row (toolId-only input, D-11)", async () => {
    stackGrpc.executeCommand.mockResolvedValue({
      response: ResponseCode.SUCCESS,
      return_reply: true,
      meta_data: { guid: "submit-ab12" },
    });

    // The stack FakeGrpc received a stack-keyed payload — proof the type came
    // from the DB row ("stack"), never zToolType (which rejects "stack" until
    // Phase 5). Query input is the toolId string ONLY.
    const result = await caller().latchStatus({ toolId: "stack-1" });
    expect(result).toMatchObject({ latched: true, guid: "submit-ab12" });
    expect(stackGrpc.executeCommand).toHaveBeenCalledWith({ stack: { latch_status: {} } });
  });

  it("never calls the .controlCommand( path in the router's latchStatus block", () => {
    const source = read("server/routers/tool.ts");
    const blockStart = source.indexOf("latchStatus: procedure");
    expect(blockStart).toBeGreaterThan(0);
    // latchStatus is the router's last procedure — everything up to the end of
    // the router body is this procedure's block.
    const latchBlock = source.slice(blockStart);
    expect(latchBlock).toContain("LATCH_READ_COMMAND");
    expect(latchBlock).not.toContain("controlCommand");
    expect(latchBlock).not.toContain("zToolType");
  });
});

describe("card source invariants (latch block, D-11/D-12)", () => {
  const CARD = "components/tools/RunRecoverySection.tsx";

  // Whitespace-flattened source (comments and prose stay JS-wrapped) for
  // copy assertions, mirroring the controlDecision.test.ts idiom.
  function flat(rel: string): string {
    return read(rel).replace(/\s+/g, " ");
  }

  it("keeps the latch read display-only: no timers, no ack gating by the latch", () => {
    const card = read(CARD);
    // Runs once per explicit click — no polling anywhere in the card.
    expect(card).not.toMatch(/refetchInterval|setInterval|setTimeout/);
    // The enable gate for the ack stays solely the typed-guid check — the
    // ack button's isDisabled adds NO latch-derived term (D-12).
    const ackGate = card.match(/isDisabled=\{[^}]*isValidRecoveryGuid[^}]*\}/);
    expect(ackGate).toBeDefined();
    expect(ackGate![0]).not.toMatch(/latch/i);
  });

  it("renders the Latched failure block with the documented copy (UI-SPEC)", () => {
    const card = flat(CARD);
    expect(card).toContain("Latched failure");
    expect(card).toContain("Read latch");
    expect(card).toContain("Use this guid");
    expect(card).toContain("No failure latched");
    expect(card).toContain("Raw JSON");
    // Empty-state body copy, the documented sentence.
    expect(card).toContain(
      "This tool has no failure latched. An acknowledge is not possible until a STACK step fails and ends.",
    );
    // Per-click pending state with the small spinner.
    expect(card).toContain("Reading latch…");
    expect(card).toContain('Spinner size="sm"');
  });

  it("reads the latch through exactly one tool.latchStatus consumer (no polling opts)", () => {
    const card = read(CARD);
    expect(card.split("tool.latchStatus").length - 1).toBe(1);
    expect(card).toContain("enabled: false");
    expect(card).not.toContain("refetchOnMount");
    expect(card).not.toContain("refetchOnWindowFocus");
  });

  it('"Use this guid" fills the guid input only — never sends, never opens the modal', () => {
    const card = read(CARD);
    // Fills the same guid state verbatim (no trim), from the latched guid.
    expect(card).toContain("setGuid(latchResult.guid");
    expect(card).not.toMatch(/Use this guid[\s\S]{0,200}openConfirm/);
    expect(card).toContain('variant="outline"');
    expect(card).toContain('colorScheme="teal"');
  });

  it("clears the latch result only on an accepted send (afterAccepted parity, D-07)", () => {
    const card = read(CARD);
    const acceptedIdx = card.indexOf("const afterAccepted");
    expect(acceptedIdx).toBeGreaterThan(-1);
    const afterAccepted = card.slice(
      acceptedIdx,
      card.indexOf("];", acceptedIdx) > 0 ? card.indexOf("];", acceptedIdx) : acceptedIdx + 600,
    );
    expect(afterAccepted).toContain("setLatchResult(null)");
    expect(afterAccepted).toContain('setGuid("")');
  });
});
