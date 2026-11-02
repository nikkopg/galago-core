// GEN-04b (D-07b): pins the latch-read constant against the REAL generated
// stack.Command oneof. An unknown oneof key would encode nothing and decode
// absent, so the round-trip assertion genuinely proves LATCH_READ_COMMAND
// names a real oneof key — the Phase 4 placeholder ("latch_status") would
// fail here. GEN-04d (D-07d): the same generated types activate the creation
// schemas — Object.values(ToolType) (the exact array routers/tool.ts's
// zToolType z.enum derives from) contains "stack", and the exported creation
// schema accepts a STACK tool input. Fakes only — no STACK motion (v2 hard
// constraint).
import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { ToolType } from "gen-interfaces/controller";
import * as tool_base from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { installFakeTool, removeFakeTool } from "./helpers/fakeTool";
import { LATCH_READ_COMMAND } from "@/server/recoveryActions";
import { zToolCreate, zTool } from "@/server/routers/tool";

// Source-scan helpers (staticScan.test.ts read() idiom) — node fs/path only,
// no new deps; the scanned router module is never runtime-imported for these.
const ROOT = path.resolve(__dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("stack activation (GEN-04b latch-read contract)", () => {
  afterEach(async () => {
    await removeFakeTool("stack-1");
  });

  it("LATCH_READ_COMMAND is the frozen stack.proto oneof key", () => {
    expect(LATCH_READ_COMMAND).toBe("get_failure_latch");
  });

  it("the latch-read payload encodes the LATCH_READ_COMMAND oneof branch on the real tool_base.Command", () => {
    const { tool } = installFakeTool("stack-1", ToolType.stack);

    const payload = tool._payloadForCommand({
      toolId: "stack-1",
      toolType: ToolType.stack,
      command: LATCH_READ_COMMAND,
      params: {},
    });
    const decoded = tool_base.Command.decode(tool_base.Command.encode(payload).finish());
    expect(decoded.stack?.[LATCH_READ_COMMAND]).toBeDefined();
  });
});

// GEN-04d (D-07d): "stack" is a first-class tool type through the REAL
// creation schemas — no rewiring, the zero-mechanism claim made testable.
describe("stack activation (GEN-04d schema/enum acceptance)", () => {
  afterEach(async () => {
    await removeFakeTool("stack-1");
  });

  it("the generated ToolType enum contains stack — the exact array zToolType's z.enum derives from", () => {
    expect(Object.values(ToolType)).toContain("stack");
  });

  it("zToolType still derives from Object.values(ToolType) — never a hand-written list (source pin)", () => {
    const src = read("server/routers/tool.ts");
    expect(src).toMatch(/const zToolType = z\.enum\(Object\.values\(ToolType\)/);
    // The anti-form: a hand-written literal array in the z.enum call.
    expect(src).not.toMatch(/const zToolType = z\.enum\(\[/);
  });

  it('zToolType (via the exported zTool) accepts type "stack"', () => {
    expect(zTool.safeParse({ type: "stack" }).success).toBe(true);
  });

  it("zToolCreate accepts a minimal STACK tool-creation input", () => {
    const result = zToolCreate.safeParse({
      name: "stack-1",
      type: "stack",
      ip: "127.0.0.1",
    });
    expect(result.success).toBe(true);
  });

  it("a Tool instance can be created with ToolType.stack via installFakeTool", () => {
    const { tool } = installFakeTool("stack-1", ToolType.stack);
    expect(tool.type).toBe(ToolType.stack);
    expect(String(tool.type)).toBe("stack");
  });
});
