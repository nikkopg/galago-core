// Connect All builds the tool.configure payload from the stored tools.config
// row. The row is already keyed by tool type ({"stack": {...}}), so wrapping it
// again under the type sent an empty sub-config and the server refused with
// "Config.host is required".
import { describe, it, expect } from "vitest";
import { Config } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { buildConnectConfig } from "@/components/tools/connectConfig";

describe("buildConnectConfig", () => {
  it("unwraps a type-keyed stored config instead of nesting it again", () => {
    const payload = buildConnectConfig({
      name: "STACK2-6",
      type: "stack",
      config: {
        stack: { host: "10.150.1.125", port: "5005", transfer_timeout_s: 0, ledger_dir: "" },
      },
    });
    expect(payload).toEqual({
      toolId: "STACK2-6",
      simulated: false,
      stack: { host: "10.150.1.125", port: "5005", transfer_timeout_s: 0, ledger_dir: "" },
    });
    // What the router does with it: the host must survive fromPartial.
    expect(Config.fromPartial(payload as unknown as Config).stack?.host).toBe("10.150.1.125");
  });

  it("reads simulated from the stored row's top level", () => {
    const payload = buildConnectConfig({
      name: "Tutorial PF400 234",
      type: "pf400",
      config: {
        toolId: "Tutorial PF400 234",
        simulated: true,
        pf400: { host: "127.0.0.1", port: 10000, joints: 6, gpl_version: "v2" },
      },
    });
    expect(payload).toEqual({
      toolId: "Tutorial PF400 234",
      simulated: true,
      pf400: { host: "127.0.0.1", port: 10000, joints: 6, gpl_version: "v2" },
    });
  });

  it("keeps sending a flat legacy config (no type key) as the sub-config", () => {
    const payload = buildConnectConfig({
      name: "FA100056",
      type: "fast",
      config: { host: "127.0.0.1", port: "5003" },
    });
    expect(payload).toEqual({
      toolId: "FA100056",
      simulated: false,
      fast: { host: "127.0.0.1", port: "5003" },
    });
  });
});
